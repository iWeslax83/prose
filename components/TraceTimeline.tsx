"use client";

import { useEffect, useState } from "react";
import { STATUS_COLOR, STATUS_GLYPH } from "@/lib/client/glyphs";
import type { TraceEvent } from "@/lib/schema";

function IOWell({ event }: { event: TraceEvent }) {
  return (
    <div className="io-well ligatures-on">
      {event.input !== undefined && (
        <div className="io-block">
          <span className="io-label label">[ IN ]</span>
          <pre className="io-json">{JSON.stringify(event.input, null, 2)}</pre>
        </div>
      )}
      {event.output !== undefined && (
        <div className="io-block">
          <span className="io-label label">[ OUT ]</span>
          <pre className="io-json io-out">{JSON.stringify(event.output, null, 2)}</pre>
        </div>
      )}
      {event.error && (
        <div className="io-block">
          <span className="io-label label" style={{ color: "var(--state-err)" }}>
            [ ERR ]
          </span>
          <pre className="io-json io-err">{event.error}</pre>
        </div>
      )}
      {event.note && <div className="io-note human">{event.note}</div>}
    </div>
  );
}

function TraceRow({
  event,
  highlighted,
  autoOpen,
  onHover,
}: {
  event: TraceEvent;
  highlighted: boolean;
  autoOpen?: boolean;
  onHover?: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  // surface the final result automatically: when a terminal step settles, open it
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpen) setOpen(true);
  }, [autoOpen]);
  const glyph = STATUS_GLYPH[event.status];
  const color = STATUS_COLOR[event.status];
  return (
    <div
      className={`trace-group ${highlighted ? "trace-hi" : ""} ${autoOpen ? "trace-result" : ""}`}
      data-seam-id={event.seamId}
      onMouseEnter={() => onHover?.(event.nodeId)}
      onMouseLeave={() => onHover?.(null)}
    >
      <button
        className="trace-row"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`adım ${event.seamId}, ${event.tool}.${event.method}, ${event.status}, ${Math.round(
          event.durationMs,
        )}ms`}
      >
        <span className="trace-glyph" style={{ color }}>
          {glyph}
        </span>
        <span className="trace-seam tabular">#{event.seamId}</span>
        <span className="trace-tool">
          {event.tool}.{event.method}
        </span>
        <span className="trace-leader" aria-hidden />
        <span className="trace-dur tabular">{Math.round(event.durationMs)}ms</span>
        {event.retries > 0 && <span className="trace-retry tabular">⟲{event.retries}</span>}
      </button>
      {open && <IOWell event={event} />}
    </div>
  );
}

export function TraceTimeline({
  trace,
  highlightSeamId,
  onHoverNode,
  resultNodeIds,
  running,
}: {
  trace: TraceEvent[];
  highlightSeamId?: string | null;
  onHoverNode?: (id: string | null) => void;
  /** terminal nodes whose output is the run's result — auto-expanded when settled */
  resultNodeIds?: string[];
  running?: boolean;
}) {
  return (
    <section className="trace-surface">
      <div className="panel-header">
        <span className="label">[ TRACE ]</span>
        {trace.length > 0 && <span className="header-hint tabular">{trace.length} adım</span>}
      </div>
      <div className="trace-scroll">
        {trace.length === 0 ? (
          <div className="trace-empty">
            <span className="trace-spine-empty">│</span>
            <span className="idle-glyph">○ idle</span>
          </div>
        ) : (
          <div className="trace-list">
            {trace.map((e) => (
              <TraceRow
                key={e.nodeId}
                event={e}
                highlighted={highlightSeamId === e.seamId}
                autoOpen={
                  !running &&
                  (e.status === "ok" || e.status === "error") &&
                  !!resultNodeIds?.includes(e.nodeId)
                }
                onHover={onHoverNode}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
