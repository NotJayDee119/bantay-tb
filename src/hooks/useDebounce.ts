import { useEffect, useState } from "react";

/**
 * Returns `value` after it has stayed unchanged for `delay` ms. Use for
 * search inputs so filtering/queries don't run on every keystroke — the
 * input itself stays controlled by the raw value, only the consumer of the
 * debounced value lags behind.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
