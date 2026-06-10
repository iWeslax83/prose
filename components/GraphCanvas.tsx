"use client";

import { useGraphLayout, type LaidEdge } from "@/hooks/useGraphLayout";
import type { StepStatus, TaskGraph, TaskNode } from "@/lib/schema";

function pathString(e: LaidEdge): string {
  if (e.points.length === 0) return "";
  return e.points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

const STATUS_BORDER: Record<StepStatus, string> = {
  pending: "var(--rule-hard)",
  running: "var(--accent-signal)",
  ok: "var(--state-ok)",
  error: "var(--state-err)",
  retry: "var(--state-warn)",
  skip: "var(--rule-hover)",
  gate: "var(--state-warn)",
};

function paramSummary(node: TaskNode): string {
  const entries = Object.entries(node.params)
    .filter(([, v]) => typeof v !== "string" || !v.startsWith("$"))
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  return entries.join("  ").slice(0, 64);
}

export function GraphCanvas({
  graph,
  nodeStatus,
  selectedNodeId,
  onHoverNode,
  frozen,
}: {
  graph: TaskGraph | null;
  nodeStatus: Record<string, StepStatus>;
  selectedNodeId: string | null;
  onHoverNode?: (id: string | null) => void;
  frozen?: boolean;
}) {
  const layout = useGraphLayout(graph);

  return (
    <section className="canvas-surface">
      <div className="panel-header">
        <span className="label">[ TASK GRAPH ]</span>
        {graph && (
          <span className="header-hint tabular">
            {graph.nodes.length} düğüm · {graph.edges.length} kenar
          </span>
        )}
      </div>

      <div className={`canvas-scroll ${frozen ? "canvas-frozen" : ""}`}>
        {!graph || !layout ? (
          <div className="canvas-empty">
            <pre className="empty-frame" aria-hidden>{`┌─[ AWAITING COMPILE ]─┐
│                      │
└──────────────────────┘`}</pre>
            <p className="human">Bir niyet derle — grafı burada çizilir.</p>
          </div>
        ) : (
          <div
            className="canvas-stage"
            style={{ width: layout.width, height: layout.height }}
          >
            <svg
              className="edge-layer"
              width={layout.width}
              height={layout.height}
              aria-hidden
            >
              {layout.edges.map((e) => {
                const active = e.points.length > 0 && nodeStatus[edgeTarget(graph, e.id)] === "running";
                const stroke =
                  e.kind === "branch" ? "var(--state-warn)" : "var(--accent-type)";
                return (
                  <g key={e.id}>
                    <path
                      d={pathString(e)}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={1}
                      strokeDasharray={e.kind === "branch" ? "4 3" : undefined}
                      opacity={0.85}
                    />
                    {e.verify && (
                      <g transform={`translate(${e.mid.x} ${e.mid.y})`}>
                        <rect
                          x={-5}
                          y={-5}
                          width={10}
                          height={10}
                          transform="rotate(45)"
                          fill="var(--bg-void)"
                          stroke="var(--state-warn)"
                          strokeWidth={1}
                        />
                      </g>
                    )}
                    {e.label && (
                      <text
                        x={e.mid.x + 8}
                        y={e.mid.y - 4}
                        fill="var(--state-warn)"
                        fontSize={10}
                        fontFamily="var(--font-mono)"
                      >
                        [{e.label}]
                      </text>
                    )}
                    {active && !frozen && (
                      <circle r={3.5} fill="var(--accent-signal)">
                        <animateMotion dur="0.9s" repeatCount="indefinite" path={pathString(e)} />
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>

            {graph.nodes.map((n) => {
              const pos = layout.nodes[n.id];
              if (!pos) return null;
              const status = nodeStatus[n.id] ?? "pending";
              const selected = selectedNodeId === n.id;
              return (
                <div
                  key={n.id}
                  className={`gnode ${selected ? "gnode-selected" : ""}`}
                  data-seam-id={n.seamId}
                  tabIndex={0}
                  aria-label={`adım ${n.seamId}, ${n.title}, ${status}`}
                  onMouseEnter={() => onHoverNode?.(n.id)}
                  onMouseLeave={() => onHoverNode?.(null)}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: pos.w,
                    minHeight: pos.h,
                    borderColor: STATUS_BORDER[status],
                  }}
                >
                  <div className="gnode-title">
                    <span className="gnode-seam tabular">#{n.seamId}</span>
                    <span className="gnode-tool">{n.title}</span>
                    {n.dryRun && <span className="gnode-dry">dry-run</span>}
                  </div>
                  {paramSummary(n) && <div className="gnode-params">{paramSummary(n)}</div>}
                  <div className="gnode-io">
                    <span className="schema-chip">out:[{n.outputType}]</span>
                    {n.verify && <span className="gate-chip">◇ verify</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function edgeTarget(graph: TaskGraph, edgeId: string): string {
  return graph.edges.find((e) => e.id === edgeId)?.to ?? "";
}
