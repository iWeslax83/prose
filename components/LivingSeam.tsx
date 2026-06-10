"use client";

import { useEffect, useRef, useState } from "react";

/**
 * THE LIVING SEAM. For the active seam-id, find every element that carries it —
 * the parse-strip span, the graph node, the trace row — and draw one continuous
 * mint connector through them. Identity-based (data-seam-id), so it survives
 * panel resize/scroll: alignment is by matching id, not pixel-continuous SVG.
 */
export function LivingSeam({
  containerRef,
  activeSeamId,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeSeamId: string | null;
}) {
  const [segments, setSegments] = useState<{ x: number; y: number }[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !activeSeamId) {
      setSegments([]);
      return;
    }

    const recompute = () => {
      const host = containerRef.current;
      if (!host) return;
      const hostRect = host.getBoundingClientRect();
      const els = Array.from(
        host.querySelectorAll<HTMLElement>(`[data-seam-id="${activeSeamId}"]`),
      );
      const pts = els
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.left - hostRect.left + r.width / 2,
            y: r.top - hostRect.top + r.height / 2,
          };
        })
        .sort((a, b) => a.y - b.y);
      setSegments(pts);
    };

    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(recompute);
    };

    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(container);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [containerRef, activeSeamId]);

  if (segments.length < 2) return null;

  const d = segments
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg className="living-seam" aria-hidden>
      <path d={d} className="seam-path" />
      {segments.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} className="seam-anchor" />
      ))}
    </svg>
  );
}
