import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useLenis } from "lenis/react";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ResolvedArticleImage } from "../../data/healthImages";
import type { Locale } from "../../lib/i18n";
import { t } from "../../data/learnUi";

/** Pointer travel, in px, past which a press on the zoomed image counts as a
 *  drag to pan rather than a click. Small enough that a deliberate pan always
 *  registers, large enough that the wobble in an ordinary click doesn't. */
const DRAG_THRESHOLD = 5;

/** The article's poster at full size, opened over the page in a viewer rather
 *  than in a new tab — a new tab left the reader on a bare image with no way
 *  back but the browser's tab strip, and lost their place in the article.
 *
 *  It opens *fitted*: the whole poster on one screen, which is what most
 *  readers want. Its wording is often too small to read fitted, so a click
 *  (or the zoom button) switches to actual size, landing on the spot that was
 *  clicked — the reader asked to see *that* part bigger, not the top-left
 *  corner. Zoomed, it pans by drag with a mouse, by finger on touch, and by
 *  wheel or trackpad either way.
 *
 *  Zoom is only offered when actual size is meaningfully bigger than fitted.
 *  On a large monitor a 768px poster already shows at full size, and a zoom
 *  control that does nothing reads as broken. */
export function ImageLightbox({
  image,
  locale,
  onClose,
}: {
  image: ResolvedArticleImage;
  locale: Locale;
  onClose: () => void;
}) {
  const lenis = useLenis();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const [canZoom, setCanZoom] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Where the reader clicked, as fractions of the fitted image's width and
  // height. Read once, right after zooming in, to aim the scroll there.
  const focusPoint = useRef<{ x: number; y: number } | null>(null);
  // In-progress mouse pan. `moved` survives until the click that ends the
  // gesture, so a pan doesn't also register as "zoom out" when released.
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);

  // Freeze the page behind the viewer. `overflow: hidden` stops native
  // scrolling, but Lenis drives this page from its own animation loop and
  // ignores that, so it has to be stopped too — the same pair PublicLayout
  // uses for the mobile menu. The scroller below opts back in with
  // `data-lenis-prevent`, which Lenis honours ahead of its stopped state.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lenis?.stop();
    return () => {
      document.body.style.overflow = prev;
      lenis?.start();
    };
  }, [lenis]);

  // Focus moves into the viewer on open and back to the figure on close, so a
  // keyboard reader resumes exactly where they were in the article.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // Escape closes; Tab cycles within the viewer instead of wandering off into
  // the page hidden behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes =
        dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fitted size against actual size. Only measured while fitted — zoomed, the
  // rendered size *is* the actual size and the comparison means nothing.
  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    setCanZoom(
      img.naturalWidth > img.clientWidth * 1.15 ||
        img.naturalHeight > img.clientHeight * 1.15,
    );
  }, []);

  useEffect(() => {
    if (zoomed) return;
    // The figure already loaded this file, so it's usually cached and `load`
    // may have fired before React could listen for it.
    if (imgRef.current?.complete) measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [zoomed, measure]);

  // Aim the zoomed view at the point that was clicked. Layout effect, so the
  // scroll lands in the same frame as the zoom and the reader never sees the
  // image flash at its top-left corner first.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!zoomed || !el) return;
    const p = focusPoint.current ?? { x: 0.5, y: 0.5 };
    focusPoint.current = null;
    el.scrollLeft = p.x * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = p.y * el.scrollHeight - el.clientHeight / 2;
  }, [zoomed]);

  function toggleZoom(e?: ReactMouseEvent) {
    if (zoomed) {
      setZoomed(false);
      return;
    }
    if (!canZoom) return;
    const img = imgRef.current;
    if (e && img) {
      const r = img.getBoundingClientRect();
      focusPoint.current = {
        x: (e.clientX - r.left) / r.width,
        y: (e.clientY - r.top) / r.height,
      };
    } else {
      // Keyboard or toolbar button: no point was chosen, so start centred.
      focusPoint.current = { x: 0.5, y: 0.5 };
    }
    setZoomed(true);
  }

  // Mouse-only drag to pan. Touch and pen already pan the scroller natively,
  // and capturing them here would fight the browser's own momentum scrolling.
  function onPointerDown(e: ReactPointerEvent<HTMLImageElement>) {
    if (!zoomed || e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    e.preventDefault(); // no native image drag-and-drop ghost
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLImageElement>) {
    const d = drag.current;
    const el = scrollerRef.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
    }
    el.scrollLeft = d.left - dx;
    el.scrollTop = d.top - dy;
  }

  function onPointerUp(e: ReactPointerEvent<HTMLImageElement>) {
    if (!drag.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    // Leave `drag` set until the click handler has seen it — that's how a
    // pan that ends on the image avoids also zooming out.
  }

  function onImageClick(e: ReactMouseEvent) {
    const wasDrag = drag.current?.moved;
    drag.current = null;
    if (wasDrag) return;
    toggleZoom(e);
  }

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={image.alt}
      className="lb-backdrop-in fixed inset-0 z-[1000] flex flex-col bg-slate-950/90 backdrop-blur-sm"
    >
      {/* Controls sit in their own bar above the image, never on top of it —
          a poster is text, and a button floating over it covers words. */}
      <div className="flex flex-none items-center justify-end gap-2 p-3 sm:p-4">
        {(canZoom || zoomed) && (
          <button
            type="button"
            onClick={() => toggleZoom()}
            aria-label={t(zoomed ? "zoomOut" : "zoomIn", locale)}
            aria-pressed={zoomed}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {zoomed ? (
              <ZoomOut className="h-5 w-5" aria-hidden />
            ) : (
              <ZoomIn className="h-5 w-5" aria-hidden />
            )}
          </button>
        )}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("close", locale)}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div
        ref={scrollerRef}
        data-lenis-prevent
        className={cn(
          "min-h-0 flex-1 overscroll-contain",
          zoomed ? "overflow-auto" : "overflow-hidden",
        )}
      >
        {/* A click on the dark space around the picture closes the viewer —
            the target check keeps a click on the picture itself from counting.
            Zoomed, the wrapper grows to the image (`w-max`) but still fills the
            scroller on any axis the image is smaller on, so a wide poster
            stays centred vertically while it pans sideways. */}
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className={cn(
            "flex items-center justify-center",
            zoomed
              ? "min-h-full min-w-full w-max p-4"
              : "h-full w-full px-4 pb-4 sm:px-8 sm:pb-8",
          )}
        >
          <img
            ref={imgRef}
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            draggable={false}
            onLoad={() => !zoomed && measure()}
            onClick={onImageClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={cn(
              "lb-image-in block select-none rounded-lg shadow-2xl",
              zoomed
                ? cn(
                    "max-h-none max-w-none",
                    dragging ? "cursor-grabbing" : "cursor-grab",
                  )
                : cn(
                    "h-auto max-h-full w-auto max-w-full object-contain",
                    canZoom && "cursor-zoom-in",
                  ),
            )}
          />
        </div>
      </div>

      {image.caption && (
        <p className="flex-none px-4 pb-4 text-center text-[13px] leading-relaxed text-slate-300 sm:px-8 sm:pb-5">
          {image.caption}
        </p>
      )}
    </div>,
    document.body,
  );
}
