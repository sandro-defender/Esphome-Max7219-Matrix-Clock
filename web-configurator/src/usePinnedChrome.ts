import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Keeps two CSS custom properties in step with the chrome that is actually on
 * screen:
 *
 * - `--nav-h` — the sticky section nav's own height, used for anchor offsets;
 * - `--pin-top` — where the pinned chrome currently ends, in viewport pixels,
 *   used as the `top` of the matrix that stays pinned on phones.
 *
 * Measuring beats hard-coding here: the nav sits below the brand row until that
 * row scrolls away, and its height moves with the safe-area inset, the notice
 * bar and the user's font size. A fixed offset would let the menu overlap the
 * matrix (or the matrix overlap the header buttons) the moment any of those
 * changes. Writing the values straight onto the document element keeps scroll
 * handling out of React, so scrolling never re-renders the page.
 *
 * Both effects are layout effects: the first measurement has to land before the
 * browser paints, or the pinned matrix would flash over the header once.
 */
export function usePinnedChrome(
  topbarRef: RefObject<HTMLElement | null>,
  navRef: RefObject<HTMLElement | null>,
): void {
  const measureRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const root = document.documentElement;
    let queued = 0;

    const measure = () => {
      queued = 0;
      const nav = navRef.current;
      if (!nav) return;
      const rect = nav.getBoundingClientRect();
      const height = Math.max(0, Math.round(rect.height));
      const bottom = Math.max(0, Math.round(rect.bottom));
      if (root.style.getPropertyValue("--nav-h") !== `${height}px`) {
        root.style.setProperty("--nav-h", `${height}px`);
      }
      root.style.setProperty("--pin-top", `${bottom}px`);
    };
    measureRef.current = measure;

    const schedule = () => {
      if (queued) return;
      queued = typeof requestAnimationFrame === "function" ? requestAnimationFrame(measure) : (measure(), 0);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (navRef.current) observer?.observe(navRef.current);
    if (topbarRef.current) observer?.observe(topbarRef.current);

    return () => {
      if (queued && typeof cancelAnimationFrame === "function") cancelAnimationFrame(queued);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [navRef, topbarRef]);

  // The notice bar appears and disappears without a scroll or a resize.
  useLayoutEffect(() => {
    measureRef.current();
  });
}
