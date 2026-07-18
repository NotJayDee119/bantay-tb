import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Activity, ArrowRight, Heart, Menu, X } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import gsap from "gsap";
import { ReactLenis, useLenis } from "lenis/react";
import { usePageTransition } from "../hooks/usePageTransition";
import { preloadRoute } from "../lib/lazyPages";
import { LazyFallback } from "./LazyFallback";
import { PublicChatbotFab } from "./PublicChatbotFab";

// Apple-glass-style momentum scroll for the public site — a longer, cubic
// ease-out glide instead of the browser's stock instant wheel steps.
// autoRaf is off because gsap.ticker drives the frame loop below, keeping
// Lenis and GSAP's own tweens on the same clock. `anchors` makes any
// in-page #hash link glide to its target through Lenis instead of jumping.
const LENIS_OPTIONS = {
  duration: 1.1,
  easing: (t: number) => 1 - Math.pow(1 - t, 3),
  autoRaf: false,
  anchors: true,
};

// Header glass surface — barely-there at the top of the page, deeper and
// more frosted once content scrolls beneath it. Animated as one GSAP tween
// (not competing CSS transitions) so blur/tint/shadow settle in lockstep.
const HEADER_AT_TOP = {
  backgroundColor: "rgba(255, 255, 255, 0.7)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  borderBottomColor: "rgba(226, 232, 240, 0)",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
};
const HEADER_SCROLLED = {
  backgroundColor: "rgba(255, 255, 255, 0.92)",
  backdropFilter: "blur(28px)",
  WebkitBackdropFilter: "blur(28px)",
  borderBottomColor: "rgba(226, 232, 240, 0.7)",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08), 0 2px 10px rgba(15, 23, 42, 0.05)",
};
// Auth pages (the Sign in flow) pin a flat, shadowless header — same glass
// tint as the top-of-page state but with the drop shadow and border removed,
// and the scroll-driven condense is suppressed so it never picks the shadow
// back up.
const HEADER_FLAT = {
  backgroundColor: "rgba(255, 255, 255, 0.7)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  borderBottomColor: "rgba(226, 232, 240, 0)",
  boxShadow: "0 0 0 rgba(15, 23, 42, 0)",
};
const AUTH_PATHS = [
  "/login",
  "/register",
  "/register/staff",
  "/forgot-password",
  "/reset-password",
];

const NAV = [
  { to: "/", label: "Home" },
  { to: "/dots-locator", label: "DOTS Locator" },
  { to: "/learn", label: "Health Education" },
  { to: "/about", label: "About" },
];

const FOOTER_PATIENT_LINKS = [
  { to: "/dots-locator", label: "DOTS Locator" },
  { to: "/learn", label: "Health Education" },
  { to: "/about", label: "About" },
];

const FOOTER_WORKER_LINKS = [
  { to: "/login", label: "Sign in" },
  { to: "/register", label: "Request an account" },
];

export function PublicLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { containerRef: pageRef, pathname: pageKey, element: pageElement } = usePageTransition();

  const headerRef = useRef<HTMLElement>(null);
  const pillTrackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const pillReady = useRef(false);
  const headerScrolled = useRef(false);

  // On the Sign in flow the header stays flat and shadowless; keep a ref the
  // scroll callback can read so it skips the condense on those pages.
  const isAuthPage = AUTH_PATHS.includes(location.pathname);
  const isAuthPageRef = useRef(isAuthPage);
  isAuthPageRef.current = isAuthPage;

  // The Lenis scroll callback drives the header's glass/shadow condense.
  // Reading the smooth Lenis value (instead of a native scroll listener)
  // keeps the shadow easing in and out with the momentum scroll — and
  // because navigation scrolls the next page back to the top through
  // Lenis too, that same callback fires and fades the shadow away smoothly
  // on every page change instead of leaving it stuck from the old page.
  const lenis = useLenis((instance) => {
    const header = headerRef.current;
    if (!header || isAuthPageRef.current) return;
    const next = instance.scroll > 8;
    if (next === headerScrolled.current) return;
    headerScrolled.current = next;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.to(header, {
      ...(next ? HEADER_SCROLLED : HEADER_AT_TOP),
      duration: reduced ? 0.01 : 0.55,
      ease: "power3.out",
      overwrite: "auto",
    });
  });

  // Baseline glass state, re-evaluated whenever the route changes: auth pages
  // snap to the flat/shadowless state, every other page starts at the subtle
  // top-of-page state and lets the Lenis callback tween away from there once
  // the page scrolls.
  useLayoutEffect(() => {
    if (!headerRef.current) return;
    headerScrolled.current = false;
    gsap.set(headerRef.current, isAuthPage ? HEADER_FLAT : HEADER_AT_TOP);
  }, [isAuthPage]);

  useEffect(() => {
    if (!lenis) return;
    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);
    return () => gsap.ticker.remove(onTick);
  }, [lenis]);

  // Sliding glass pill behind the active nav item — measured off the
  // NavLink React Router already marks with aria-current, then eased into
  // place with GSAP so it glides between tabs instead of jumping.
  useLayoutEffect(() => {
    const track = pillTrackRef.current;
    const pill = pillRef.current;
    const active = track?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!track || !pill) return;

    // No nav item is active (e.g. the /login page isn't in NAV) — fade the
    // pill out instead of leaving it parked behind whatever tab was last
    // active, which otherwise lingers as a dark blob in the navbar.
    if (!active) {
      gsap.to(pill, {
        opacity: 0,
        duration: 0.3,
        ease: "power3.out",
        overwrite: "auto",
      });
      pillReady.current = false;
      return;
    }

    const rect = {
      x: active.offsetLeft,
      y: active.offsetTop,
      width: active.offsetWidth,
      height: active.offsetHeight,
    };

    if (!pillReady.current) {
      gsap.set(pill, { ...rect, opacity: 1 });
      pillReady.current = true;
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.to(pill, {
      ...rect,
      opacity: 1,
      duration: reduced ? 0.01 : 0.5,
      ease: "power3.out",
      overwrite: "auto",
    });
  }, [location.pathname]);

  // Re-snap the pill (no easing) if the layout reflows underneath it —
  // window resizes, font loads, etc.
  useEffect(() => {
    const onResize = () => {
      const track = pillTrackRef.current;
      const pill = pillRef.current;
      const active = track?.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!track || !pill) return;
      if (!active) {
        gsap.set(pill, { opacity: 0 });
        return;
      }
      gsap.set(pill, {
        x: active.offsetLeft,
        y: active.offsetTop,
        width: active.offsetWidth,
        height: active.offsetHeight,
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close the drawer the instant navigation starts, but hold the scroll
  // reset until the new page actually lands — public pages scroll the
  // document itself, and jumping to top mid-exit-fade would yank the old
  // page's content out from under the user before it's finished leaving.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    // Lenis tracks its own target scroll position — a raw window.scrollTo
    // would desync it, causing the next wheel/touch input to jump back.
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  }, [pageKey, lenis]);

  // While the mobile menu is open: lock the page scroll behind it and let
  // Escape close it, like any modal surface.
  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    lenis?.stop();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      lenis?.start();
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen, lenis]);

  // Check if current page should hide footer
  const hideFooter = [
    "/login",
    "/register",
    "/register/staff",
    "/dots-locator",
  ].includes(location.pathname);

  // The DOTS Locator's full-screen map already has its own floating panels
  // (search/list top-left, route summary bottom-right) — the chatbot FAB
  // would overlap them.
  const hideChatbot = location.pathname === "/dots-locator";

  // Clicking a nav link for the page you're already on re-navigates
  // nowhere — instead, glide back to the top with the Lenis easing.
  // `force` matters for the mobile drawer: Lenis is stopped while it's
  // open, and a stopped Lenis silently ignores un-forced scrollTo calls.
  const glideTopIfCurrent = (to: string) => {
    if (location.pathname === to) lenis?.scrollTo(0, { force: true });
  };

  // Warm a link's route chunk on hover/focus so, by click time, the page is
  // usually already cached and the transition runs without a fallback flash.
  const preloadProps = (to: string) => ({
    onMouseEnter: () => preloadRoute(to),
    onFocus: () => preloadRoute(to),
  });

  return (
    <ReactLenis root options={LENIS_OPTIONS}>
    <div className="flex min-h-screen flex-col bg-white">
      <header ref={headerRef} className="sticky top-0 z-40 border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-3"
            onClick={() => glideTopIfCurrent("/")}
          >
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-950 text-white shadow-soft">
              <Activity className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-vigil-400" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">
                BANTAY-TB
              </span>
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                Davao City &middot; public health
              </span>
            </span>
          </Link>

          {/* Segmented pill nav */}
          <nav className="hidden items-center lg:flex">
            <div
              ref={pillTrackRef}
              className="relative flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100/70 p-1"
            >
              <span
                ref={pillRef}
                aria-hidden
                className="absolute left-0 top-0 z-0 rounded-full bg-brand-950 shadow-soft"
                style={{ width: 0, height: 0, opacity: 0 }}
              />
              {NAV.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  onClick={() => glideTopIfCurrent(l.to)}
                  {...preloadProps(l.to)}
                  className={({ isActive }) =>
                    "relative z-10 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 " +
                    (isActive
                      ? "text-white"
                      : "text-slate-600 hover:bg-white hover:text-slate-900")
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
            <Link
              to="/login"
              {...preloadProps("/login")}
              className="ml-4 inline-flex h-10 items-center gap-2 rounded-full bg-brand-950 px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-900"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>

          <div className="flex items-center gap-2 lg:hidden">
            <Link
              to="/login"
              className="inline-flex h-9 items-center rounded-full bg-brand-950 px-4 text-sm font-medium text-white shadow-soft transition hover:bg-brand-900"
            >
              Sign in
            </Link>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-soft transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="public-mobile-menu"
            >
              {/* Burger ↔ X cross-fade with a quarter turn. */}
              <span className="relative grid h-5 w-5 place-items-center">
                <Menu
                  className={
                    "absolute h-5 w-5 transition-all duration-200 " +
                    (mobileOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100")
                  }
                />
                <X
                  className={
                    "absolute h-5 w-5 transition-all duration-200 " +
                    (mobileOpen ? "rotate-0 opacity-100" : "-rotate-90 opacity-0")
                  }
                />
              </span>
            </button>
          </div>
        </div>
        {/* Mobile menu — always mounted so both open and close animate
            (max-height slide + fade). Capped at the viewport minus the
            header and scrollable inside, so it works in landscape phones
            too; `invisible` when closed keeps links unfocusable. */}
        <div
          id="public-mobile-menu"
          className={
            "overflow-y-auto bg-white/95 backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden " +
            (mobileOpen
              ? "visible max-h-[calc(100dvh-4.25rem)] border-t border-slate-200/70 opacity-100"
              : "invisible max-h-0 opacity-0")
          }
        >
          <nav className="mx-auto flex max-w-7xl flex-col gap-1.5 px-4 py-4 text-sm sm:px-6">
            {NAV.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                {...preloadProps(l.to)}
                onClick={() => {
                  // Same-page tap: the pathname doesn't change, so the
                  // route-change effect won't close the drawer — do both here.
                  setMobileOpen(false);
                  glideTopIfCurrent(l.to);
                }}
                className={({ isActive }) =>
                  "flex items-center justify-between rounded-xl px-4 py-3 font-medium transition " +
                  (isActive
                    ? "bg-brand-950 text-white shadow-soft"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                }
              >
                {({ isActive }) => (
                  <>
                    {l.label}
                    {isActive && <ArrowRight className="h-4 w-4" />}
                  </>
                )}
              </NavLink>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-slate-200/70 pt-4">
              <Link
                to="/login"
                {...preloadProps("/login")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-950 px-4 font-semibold text-white shadow-soft transition hover:bg-brand-900"
              >
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/register"
                {...preloadProps("/register")}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 font-medium text-slate-700 shadow-soft transition hover:bg-slate-50"
              >
                Request an account
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Backdrop behind the open mobile menu — sits under the sticky
          header (z-40) so the menu and burger stay interactive. */}
      <div
        className={
          "fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden " +
          (mobileOpen ? "opacity-100" : "pointer-events-none opacity-0")
        }
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <main className="flex-1 overflow-x-hidden">
        {/* Suspense lives *inside* the keyed transition container: a cold
            page chunk falls back to the route-progress bar while the header,
            nav and footer stay mounted, and pageRef stays stable so the GSAP
            enter/exit tweens keep owning the whole transition. */}
        <div key={pageKey} ref={pageRef}>
          <Suspense fallback={<LazyFallback />}>{pageElement}</Suspense>
        </div>
      </main>
      {!hideFooter && (
        <footer className="relative overflow-hidden bg-brand-950">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid opacity-40" />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 top-[-40%] h-[26rem] w-[26rem] rounded-full bg-accent-500/10 blur-[100px]"
          />
          {/* Main footer */}
          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
              <div>
                <Link to="/" className="inline-flex items-center gap-3">
                  <span className="relative grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-white/10 text-white">
                    <Activity className="h-5 w-5" />
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-brand-950 bg-vigil-400" />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="font-display text-lg font-extrabold tracking-tight text-white">
                      BANTAY-TB
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      Davao City &middot; public health
                    </span>
                  </span>
                </Link>
                <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-400">
                  A public health platform for tuberculosis information,
                  navigation, and surveillance in Davao City — designed to help
                  residents, patients, and frontline workers.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-400" />
                  </span>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                    Surveillance active &middot; 182 barangays
                  </span>
                </div>
              </div>

              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-300">
                  For patients
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {FOOTER_PATIENT_LINKS.map((l) => (
                    <li key={l.to}>
                      <Link
                        to={l.to}
                        className="group inline-flex items-center gap-1.5 py-1 text-slate-300 transition hover:text-white"
                      >
                        {l.label}
                        <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-accent-400 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-300">
                  For health workers
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {FOOTER_WORKER_LINKS.map((l) => (
                    <li key={l.to}>
                      <Link
                        to={l.to}
                        className="group inline-flex items-center gap-1.5 py-1 text-slate-300 transition hover:text-white"
                      >
                        {l.label}
                        <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-accent-400 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-vigil-400" />
                &copy; {new Date().getFullYear()} BANTAY-TB &middot; Davao City
              </p>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                Made with <Heart className="h-3 w-3 text-red-400" /> for Davao City
              </p>
            </div>
          </div>
        </footer>
      )}
      {!hideChatbot && <PublicChatbotFab />}
    </div>
    </ReactLenis>
  );
}
