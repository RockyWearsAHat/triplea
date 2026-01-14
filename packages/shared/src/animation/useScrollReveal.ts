import * as React from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

export function useScrollReveal(
  containerRef: React.RefObject<HTMLElement | null>,
  depsOrOptions?: ReadonlyArray<unknown> | RevealOptions,
  maybeOptions?: RevealOptions
) {
  const deps = Array.isArray(depsOrOptions) ? depsOrOptions : [];
  const options: RevealOptions | undefined = Array.isArray(depsOrOptions)
    ? maybeOptions
    : (depsOrOptions as RevealOptions | undefined);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (prefersReducedMotion()) {
      // Ensure elements are visible immediately.
      const selector = options?.selector ?? "[data-reveal]";
      container.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }

    if (!registered) {
      gsap.registerPlugin(ScrollTrigger);
      registered = true;
    }

    const selector = options?.selector ?? "[data-reveal]";
    const y = options?.y ?? 18;
    const duration = options?.duration ?? 0.6;
    const stagger = options?.stagger ?? 0.08;

    let extraTriggers: ScrollTrigger[] = [];
    let refreshTimer: number | null = null;

    const ctx = gsap.context(() => {
      const all = Array.from(container.querySelectorAll<HTMLElement>(selector));
      const elements = all.filter((el) => el.dataset.revealDone !== "1");
      if (elements.length === 0) return;

      // Start hidden for new elements only.
      gsap.set(elements, { autoAlpha: 0, y, willChange: "transform,opacity" });

      // Batch everything to avoid expensive per-element layout reads.
      // Elements already in view will enter immediately after refresh.
      extraTriggers = ScrollTrigger.batch(elements, {
        start: "top 86%",
        once: true,
        interval: 0.1,
        batchMax: 12,
        onEnter: (batch) => {
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration,
            ease: "power2.out",
            stagger,
            overwrite: true,
            onComplete: () => {
              batch.forEach((el) => {
                (el as HTMLElement).dataset.revealDone = "1";
                (el as HTMLElement).style.willChange = "";
              });
            },
          });
        },
      });

      // Recompute trigger positions after content changes.
      // Debounced to reduce forced layouts while async content/images settle.
      if (refreshTimer != null) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        ScrollTrigger.refresh();
      }, 50);
    }, container);

    return () => {
      if (refreshTimer != null) {
        window.clearTimeout(refreshTimer);
      }
      extraTriggers.forEach((t) => t.kill());
      ctx.revert();
    };
  }, [
    containerRef,
    options?.selector,
    options?.y,
    options?.duration,
    options?.stagger,
    ...deps,
  ]);
}

export type RevealOptions = {
  selector?: string;
  y?: number;
  duration?: number;
  stagger?: number;
};
