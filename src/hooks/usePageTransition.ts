import { useLayoutEffect, useRef, useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import gsap from "gsap";

/**
 * Route-change transition for a routed <Outlet>. React Router swaps the
 * outlet's content the instant the URL changes, so there's no built-in way
 * to animate the old page out first — this hook fakes it by delaying the
 * swap: it keeps rendering the previous page while GSAP tweens it away,
 * then only commits the new page (via setState) once that tween finishes,
 * immediately following with its own GSAP entrance.
 *
 * Callers should key their wrapper div on the returned `pathname` (not
 * `useLocation()`'s) so it still reflects what's actually on screen during
 * the exit half of the transition.
 */
export function usePageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ pathname: location.pathname, element: outlet });

  // Exit — plays on the page still mounted from before this navigation,
  // then swaps `view` to the new route once it's faded/settled out.
  useLayoutEffect(() => {
    if (location.pathname === view.pathname) return;
    const node = containerRef.current;
    if (!node) {
      setView({ pathname: location.pathname, element: outlet });
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tween = gsap.to(node, {
      opacity: 0,
      y: -10,
      duration: reduced ? 0.01 : 0.18,
      ease: "power2.in",
      overwrite: "auto",
      onComplete: () => setView({ pathname: location.pathname, element: outlet }),
    });
    return () => {
      tween.kill();
    };
    // Deliberately pathname-only: `outlet` is a new element every render
    // (would refire this on every keystroke elsewhere in the tree), and
    // `view.pathname` is the state *this* effect writes to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Enter — runs once the new page is committed and mounted, including on
  // first load.
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.fromTo(
      node,
      { opacity: 0, y: 14 },
      {
        opacity: 1,
        y: 0,
        duration: reduced ? 0.01 : 0.45,
        ease: "power3.out",
        clearProps: "opacity,transform",
      }
    );
  }, [view.pathname]);

  return { containerRef, pathname: view.pathname, element: view.element };
}
