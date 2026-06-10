"use client";

import { ChecksumTape } from "./ChecksumTape";
import type { Manifest } from "@/lib/schema";

function ReplayScrubber({
  steps,
  value,
  onChange,
  deterministic,
  onReplay,
  running,
}: {
  steps: number;
  value: number;
  onChange: (v: number) => void;
  deterministic: boolean | null;
  onReplay: () => void;
  running: boolean;
}) {
  return (
    <div className="scrubber">
      <button className="replay-btn" onClick={onReplay} disabled={running}>
        ⟲ REPLAY
      </button>
      <div className="scrub-axis">
        <input
          type="range"
          min={0}
          max={Math.max(0, steps - 1)}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="replay zaman ekseni"
          className="scrub-range"
        />
        <div className="scrub-ticks" aria-hidden>
          {Array.from({ length: steps }).map((_, i) => (
            <span key={i} className={`scrub-tick ${i <= value ? "scrub-on" : ""}`} />
          ))}
        </div>
      </div>
      <span
        className="scrub-verdict"
        style={{
          color:
            deterministic === null
              ? "var(--ink-muted)"
              : deterministic
                ? "var(--accent-type)"
                : "var(--state-err)",
        }}
      >
        {deterministic === null ? "—" : deterministic ? "✓ deterministik" : "✗ sapma"}
      </span>
    </div>
  );
}

export function RunHistory({
  runs,
  selectedRunId,
  onSelect,
  onReplay,
  scrubValue,
  onScrub,
  deterministic,
  running,
}: {
  runs: Manifest[];
  selectedRunId: string | null;
  onSelect: (id: string) => void;
  onReplay: () => void;
  scrubValue: number;
  onScrub: (v: number) => void;
  deterministic: boolean | null;
  running: boolean;
}) {
  const selected = runs.find((r) => r.runId === selectedRunId);
  return (
    <section className="history-surface">
      <div className="panel-header">
        <span className="label">[ RUN HISTORY ]</span>
        <span className="header-hint tabular">{runs.length} kayıt</span>
      </div>

      {selected && (
        <ReplayScrubber
          steps={selected.events.filter((e) => e.status !== "running").length}
          value={scrubValue}
          onChange={onScrub}
          deterministic={deterministic}
          onReplay={onReplay}
          running={running}
        />
      )}

      <div className="history-scroll">
        {runs.length === 0 ? (
          <div className="history-empty">── no runs recorded ──</div>
        ) : (
          runs.map((r) => (
            <button
              key={r.runId}
              className={`manifest-row ${selectedRunId === r.runId ? "manifest-sel" : ""}`}
              onClick={() => onSelect(r.runId)}
            >
              <span className="manifest-glyph" style={{ color: r.ok ? "var(--state-ok)" : "var(--state-err)" }}>
                {r.ok ? "✓" : "✗"}
              </span>
              <span className="manifest-id tabular">{r.runId}</span>
              <ChecksumTape id={r.runChecksum} ticks={r.graph.ticks} showId={false} />
              <span className="manifest-time tabular">
                {new Date(r.createdAt).toLocaleString("tr-TR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="manifest-dur tabular">{(r.durationMs / 1000).toFixed(1)}s</span>
              <span
                className="manifest-det"
                style={{ color: r.deterministic ? "var(--accent-type)" : "var(--ink-muted)" }}
              >
                {r.mode === "replay" ? "⟲" : "▷"}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
