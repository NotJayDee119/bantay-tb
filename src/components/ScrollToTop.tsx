import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Start every new page at the top instead of the previous page's scroll. */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
