"use client";

import { useMemo, useRef, useState } from "react";
import "./instrument.css";
import { GraphCanvas } from "@/components/GraphCanvas";
import { IntentComposer } from "@/components/IntentComposer";
import { LivingSeam } from "@/components/LivingSeam";
import { RunHistory } from "@/components/RunHistory";
import { StatusBar } from "@/components/StatusBar";
import { TraceTimeline } from "@/components/TraceTimeline";
import { useProse } from "@/hooks/useProse";

export default function Page() {
  const p = useProse();
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [scrub, setScrub] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);

  const seamOf = useMemo(
    () => (id: string | null) =>
      id ? (p.graph?.nodes.find((n) => n.id === id)?.seamId ?? null) : null,
    [p.graph],
  );

  const runningSeam = seamOf(p.activeNodeId);
  const hoverSeam = seamOf(hoverNode);
  const activeSeam = hoverSeam ?? runningSeam;

  // terminal nodes (no outgoing edge) hold the run's result — auto-expand them
  const resultNodeIds = useMemo(() => {
    if (!p.graph) return [];
    const hasOut = new Set(p.graph.edges.map((e) => e.from));
    return p.graph.nodes.filter((n) => !hasOut.has(n.id)).map((n) => n.id);
  }, [p.graph]);

  const tapeState: "idle" | "match" | "drift" =
    p.phase === "replay" && p.deterministic !== null
      ? p.deterministic
        ? "match"
        : "drift"
      : "idle";

  return (
    <div className="app">
      <StatusBar
        provider={p.provider}
        phase={p.phase}
        running={p.running}
        checksumId={p.runChecksum ?? p.graph?.checksum ?? null}
        ticks={p.graph?.ticks}
        tapeState={tapeState}
      />

      <main className="grid" ref={mainRef}>
        <div className="col col-left">
          <IntentComposer
            source={p.source}
            setSource={p.setSource}
            compileStage={p.compileStage}
            graph={p.graph}
            error={p.compileError}
            running={p.running}
            onCompile={p.compile}
            onRun={p.run}
          />
        </div>

        <div className="col col-center">
          <GraphCanvas
            graph={p.graph}
            nodeStatus={p.nodeStatus}
            selectedNodeId={hoverNode}
            onHoverNode={setHoverNode}
            frozen={p.phase === "replay" && !p.running}
          />
        </div>

        <div className="col col-right">
          <TraceTimeline
            trace={p.trace}
            highlightSeamId={activeSeam}
            onHoverNode={setHoverNode}
            resultNodeIds={resultNodeIds}
            running={p.running}
          />
        </div>

        <LivingSeam containerRef={mainRef} activeSeamId={activeSeam} />
      </main>

      <RunHistory
        runs={p.runs}
        selectedRunId={p.selectedRunId}
        onSelect={p.selectRun}
        onReplay={p.replaySelected}
        scrubValue={scrub}
        onScrub={setScrub}
        deterministic={p.deterministic}
        running={p.running}
      />
    </div>
  );
}
