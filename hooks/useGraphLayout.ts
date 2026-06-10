"use client";

import { useEffect, useState } from "react";
import type { TaskGraph } from "@/lib/schema";

/**
 * ELK 'layered' layout with ORTHOGONAL edge routing — the box-drawing aesthetic
 * depends on right-angle edges, never beziers. Runs in the browser; recomputes
 * when the graph identity (checksum) changes.
 */

export interface LaidNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LaidEdge {
  id: string;
  points: { x: number; y: number }[];
  kind: "data" | "branch";
  label?: string;
  verify: boolean;
  /** midpoint for the verify diamond */
  mid: { x: number; y: number };
}

export interface Layout {
  nodes: Record<string, LaidNode>;
  edges: LaidEdge[];
  width: number;
  height: number;
}

const NODE_W = 208;
const NODE_H = 72;

function midOf(points: { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  const i = Math.floor((points.length - 1) / 2);
  const a = points[i];
  const b = points[Math.min(i + 1, points.length - 1)];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function useGraphLayout(graph: TaskGraph | null): Layout | null {
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    if (!graph || graph.nodes.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLayout(null);
      return;
    }
    let cancelled = false;

    (async () => {
      const ELK = (await import("elkjs/lib/elk.bundled.js")).default;
      const elk = new ELK();
      const elkGraph = {
        id: "root",
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.direction": "DOWN",
          "elk.edgeRouting": "ORTHOGONAL",
          "elk.layered.spacing.nodeNodeBetweenLayers": "48",
          "elk.spacing.nodeNode": "32",
          "elk.layered.spacing.edgeNodeBetweenLayers": "24",
          "elk.padding": "[top=24,left=24,bottom=24,right=24]",
        },
        children: graph.nodes.map((n) => ({ id: n.id, width: NODE_W, height: NODE_H })),
        edges: graph.edges.map((e) => ({
          id: e.id,
          sources: [e.from],
          targets: [e.to],
        })),
      };

      try {
        const res = (await elk.layout(elkGraph)) as {
          width?: number;
          height?: number;
          children?: { id: string; x?: number; y?: number; width?: number; height?: number }[];
          edges?: {
            id: string;
            sections?: {
              startPoint: { x: number; y: number };
              endPoint: { x: number; y: number };
              bendPoints?: { x: number; y: number }[];
            }[];
          }[];
        };
        if (cancelled) return;

        const nodes: Record<string, LaidNode> = {};
        for (const c of res.children ?? []) {
          nodes[c.id] = {
            id: c.id,
            x: c.x ?? 0,
            y: c.y ?? 0,
            w: c.width ?? NODE_W,
            h: c.height ?? NODE_H,
          };
        }

        const edgeMeta = new Map(graph.edges.map((e) => [e.id, e]));
        const edges: LaidEdge[] = (res.edges ?? []).map((e) => {
          const sec = e.sections?.[0];
          const points = sec
            ? [sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint]
            : [];
          const meta = edgeMeta.get(e.id);
          return {
            id: e.id,
            points,
            kind: (meta?.kind ?? "data") as "data" | "branch",
            label: meta?.label,
            verify: !!meta?.verify,
            mid: midOf(points),
          };
        });

        setLayout({
          nodes,
          edges,
          width: res.width ?? NODE_W,
          height: res.height ?? NODE_H,
        });
      } catch {
        // fallback: simple vertical stack so the canvas is never blank
        if (cancelled) return;
        const nodes: Record<string, LaidNode> = {};
        graph.nodes.forEach((n, i) => {
          nodes[n.id] = { id: n.id, x: 24, y: 24 + i * (NODE_H + 48), w: NODE_W, h: NODE_H };
        });
        setLayout({
          nodes,
          edges: graph.edges.map((e) => {
            const a = nodes[e.from];
            const b = nodes[e.to];
            const points = a && b
              ? [
                  { x: a.x + a.w / 2, y: a.y + a.h },
                  { x: b.x + b.w / 2, y: b.y },
                ]
              : [];
            return {
              id: e.id,
              points,
              kind: e.kind,
              label: e.label,
              verify: e.verify,
              mid: midOf(points),
            };
          }),
          width: NODE_W + 48,
          height: 24 + graph.nodes.length * (NODE_H + 48),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [graph]);

  return layout;
}
