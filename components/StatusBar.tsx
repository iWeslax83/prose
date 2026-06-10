"use client";

import { useEffect, useState } from "react";
import type { Phase } from "@/hooks/useProse";
import { ChecksumTape } from "./ChecksumTape";

const PHASES: { key: Phase; label: string; glyph: string }[] = [
  { key: "build", label: "BUILD", glyph: "●" },
  { key: "run", label: "RUN", glyph: "▷" },
  { key: "replay", label: "REPLAY", glyph: "⟲" },
];

function Clock() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const tick = () =>
      setT(
        new Date().toLocaleTimeString("tr-TR", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular">{t}</span>;
}

export function StatusBar({
  provider,
  phase,
  running,
  checksumId,
  ticks,
  tapeState,
}: {
  provider: string;
  phase: Phase;
  running: boolean;
  checksumId?: string | null;
  ticks?: boolean[];
  tapeState?: "idle" | "match" | "drift";
}) {
  return (
    <header className="statusbar">
      <div className="statusbar-left">
        <span className="wordmark">PROSE</span>
        <span className="label" style={{ color: "var(--ink-muted)" }}>
          intent-first
        </span>
        <span className="provider-chip" title="aktif derleyici">
          [{provider}]
        </span>
      </div>

      <div className="statusbar-center">
        <span
          className="run-glyph"
          style={{ color: running ? "var(--accent-signal)" : "var(--ink-muted)" }}
        >
          {running ? "● live" : "○ idle"}
        </span>
        <span className="statusbar-sep">·</span>
        <Clock />
        <span className="statusbar-sep">·</span>
        <ChecksumTape id={checksumId} ticks={ticks} state={tapeState} />
      </div>

      <nav className="segmented" aria-label="çalışma fazı">
        {PHASES.map((p) => (
          <span
            key={p.key}
            className={`segment ${phase === p.key ? "segment-active" : ""}`}
          >
            <span className="segment-glyph">{p.glyph}</span> {p.label}
          </span>
        ))}
      </nav>
    </header>
  );
}
