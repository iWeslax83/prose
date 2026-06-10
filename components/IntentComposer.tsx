"use client";

import { useRef } from "react";
import type { CompileErrorInfo, CompileStage } from "@/hooks/useProse";
import { SHOWCASE_INTENTS } from "@/lib/client/showcase";
import type { Clause, TaskGraph } from "@/lib/schema";
import { ChecksumTape } from "./ChecksumTape";

const STAGE_SEQ: CompileStage[] = ["parse", "type", "plan", "ready"];
const STAGE_LABEL: Record<CompileStage, string> = {
  idle: "READY",
  parse: "PARSE",
  type: "TYPE",
  plan: "PLAN",
  ready: "COMPILED",
  error: "ERROR",
};

function ParseStrip({ clauses }: { clauses: Clause[] }) {
  return (
    <div className="parse-strip" role="list" aria-label="ayrıştırılmış cümle">
      {clauses.map((c, i) => (
        <span key={c.seamId} className="typed-span" role="listitem" data-seam-id={c.seamId}>
          <span className="span-seam tabular">{c.seamId}</span>
          <span className="span-label">{c.label}</span>
          <span className="span-value">{c.value}</span>
          {i < clauses.length - 1 && <span className="span-arrow" aria-hidden>→</span>}
          <span className="span-tick" aria-hidden />
        </span>
      ))}
    </div>
  );
}

export function IntentComposer({
  source,
  setSource,
  compileStage,
  graph,
  error,
  running,
  onCompile,
  onRun,
}: {
  source: string;
  setSource: (s: string) => void;
  compileStage: CompileStage;
  graph: TaskGraph | null;
  error: CompileErrorInfo | null;
  running: boolean;
  onCompile: () => void;
  onRun: () => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onCompile();
    }
  };

  const stageIndex = STAGE_SEQ.indexOf(compileStage);

  return (
    <section className="composer-surface">
      <div className="panel-header">
        <span className="label">[ INTENT ]</span>
        <span className="header-hint human">bir cümle yaz · ⌘↵ derle</span>
      </div>

      <div className="composer-well ligatures-off">
        <span className="composer-gutter tabular">01</span>
        <textarea
          ref={taRef}
          className="composer-input"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          spellCheck={false}
          placeholder=""
          aria-label="niyet cümlesi"
        />
        {source.length === 0 && (
          <span className="composer-empty human" aria-hidden>
            <span className="block-cursor" /> Ne olması gerektiğini yaz. PROSE bunu tipli,
            yeniden-yürütülebilir bir görev grafına derler.
          </span>
        )}
      </div>

      <div className="showcase-row">
        {SHOWCASE_INTENTS.map((s) => (
          <button
            key={s.label}
            className="showcase-chip"
            onClick={() => setSource(s.source)}
            disabled={running}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="compile-bar">
        <button className="compile-btn" onClick={onCompile} disabled={running || !source.trim()}>
          ◆ DERLE
        </button>
        <button
          className="run-btn"
          onClick={onRun}
          disabled={running || !graph || compileStage !== "ready"}
        >
          ▷ ÇALIŞTIR
        </button>
        <div className="compile-state" aria-live="polite">
          {STAGE_SEQ.map((st) => (
            <span
              key={st}
              className={`compile-led ${
                compileStage === st
                  ? "led-active"
                  : stageIndex > STAGE_SEQ.indexOf(st)
                    ? "led-done"
                    : ""
              }`}
            >
              {STAGE_LABEL[st]}
            </span>
          ))}
          {compileStage === "ready" && graph && (
            <span className="compile-result">
              <span className="ok-glyph">✓</span> {graph.nodes.length} düğüm · 0 tip-hatası
              <ChecksumTape id={graph.checksum} ticks={graph.ticks} showId />
            </span>
          )}
          {compileStage === "error" && error && (
            <span className="compile-err">
              <span className="err-glyph">✗</span> {error.message}
            </span>
          )}
        </div>
      </div>

      {graph && graph.clauses.length > 0 && <ParseStrip clauses={graph.clauses} />}
    </section>
  );
}
