"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamExecute } from "@/lib/client/sse";
import { cachedOutputsFromManifest } from "@/lib/engine/replay";
import type {
  ExecStreamEvent,
  Manifest,
  StepStatus,
  TaskGraph,
  TraceEvent,
} from "@/lib/schema";

const RUNS_KEY = "prose.runs.v1";
const MAX_RUNS = 12;

export type Phase = "build" | "run" | "replay";
export type CompileStage = "idle" | "parse" | "type" | "plan" | "ready" | "error";

export interface CompileErrorInfo {
  message: string;
  atValue?: string;
}

export interface ProseState {
  source: string;
  setSource: (s: string) => void;

  provider: string;
  phase: Phase;

  compileStage: CompileStage;
  graph: TaskGraph | null;
  compileError: CompileErrorInfo | null;

  running: boolean;
  /** ordered trace, one row per node, updated in place */
  trace: TraceEvent[];
  nodeStatus: Record<string, StepStatus>;
  activeNodeId: string | null;

  runChecksum: string | null;
  deterministic: boolean | null;
  ok: boolean | null;
  durationMs: number | null;

  runs: Manifest[];
  selectedRunId: string | null;

  compile: () => Promise<void>;
  run: () => Promise<void>;
  replaySelected: () => Promise<void>;
  selectRun: (runId: string) => void;
  clearSelection: () => void;
  reset: () => void;
}

function loadRuns(): Manifest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RUNS_KEY);
    return raw ? (JSON.parse(raw) as Manifest[]) : [];
  } catch {
    return [];
  }
}

export function useProse(): ProseState {
  const [source, setSource] = useState("");
  const [provider, setProvider] = useState("mock");
  const [phase, setPhase] = useState<Phase>("build");

  const [compileStage, setCompileStage] = useState<CompileStage>("idle");
  const [graph, setGraph] = useState<TaskGraph | null>(null);
  const [compileError, setCompileError] = useState<CompileErrorInfo | null>(null);

  const [running, setRunning] = useState(false);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [nodeStatus, setNodeStatus] = useState<Record<string, StepStatus>>({});
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const [runChecksum, setRunChecksum] = useState<string | null>(null);
  const [deterministic, setDeterministic] = useState<boolean | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const [runs, setRuns] = useState<Manifest[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const rowIndex = useRef<Map<string, number>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // client-only: localStorage is unavailable during SSR, so we hydrate runs
    // here rather than in a useState initializer (which would mismatch on hydrate)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRuns(loadRuns());
    fetch("/api/compile")
      .then((r) => r.json())
      .then((d: { provider?: string }) => d.provider && setProvider(d.provider))
      .catch(() => {});
  }, []);

  const persistRuns = useCallback((next: Manifest[]) => {
    const trimmed = next.slice(0, MAX_RUNS);
    setRuns(trimmed);
    try {
      window.localStorage.setItem(RUNS_KEY, JSON.stringify(trimmed));
    } catch {
      /* quota — ignore */
    }
  }, []);

  const resetRun = useCallback(() => {
    setTrace([]);
    setNodeStatus({});
    setActiveNodeId(null);
    setRunChecksum(null);
    setDeterministic(null);
    setOk(null);
    setDurationMs(null);
    rowIndex.current = new Map();
  }, []);

  const compile = useCallback(async () => {
    if (!source.trim()) return;
    setSelectedRunId(null);
    setPhase("build");
    setCompileError(null);
    setGraph(null);
    resetRun();

    // discrete compile-state snaps (diegetic, no easing)
    setCompileStage("parse");
    await new Promise((r) => setTimeout(r, 140));
    setCompileStage("type");
    await new Promise((r) => setTimeout(r, 140));
    setCompileStage("plan");

    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCompileError({ message: data.error ?? "Derleme hatası.", atValue: data.atValue });
        setCompileStage("error");
        return;
      }
      setGraph(data.graph as TaskGraph);
      if (data.provider) setProvider(data.provider);
      setCompileStage("ready");
    } catch (err) {
      setCompileError({ message: err instanceof Error ? err.message : "Ağ hatası." });
      setCompileStage("error");
    }
  }, [source, resetRun]);

  const consume = useCallback(
    (e: ExecStreamEvent) => {
      if (e.type === "event") {
        const ev = e.event;
        setNodeStatus((prev) => ({ ...prev, [ev.nodeId]: ev.status }));
        if (ev.status === "running") setActiveNodeId(ev.nodeId);
        setTrace((prev) => {
          const idx = rowIndex.current.get(ev.nodeId);
          if (idx === undefined) {
            rowIndex.current.set(ev.nodeId, prev.length);
            return [...prev, ev];
          }
          const next = prev.slice();
          // keep the richest record: merge retry counts / outputs forward
          next[idx] = { ...next[idx], ...ev, retries: Math.max(next[idx].retries, ev.retries) };
          return next;
        });
      } else if (e.type === "done") {
        setActiveNodeId(null);
        setRunChecksum(e.runChecksum);
        setDeterministic(e.deterministic);
        setOk(e.ok);
        setDurationMs(e.durationMs);
      } else if (e.type === "error") {
        setCompileError({ message: e.message });
      }
    },
    [],
  );

  const run = useCallback(async () => {
    if (!graph || running) return;
    setPhase("run");
    setSelectedRunId(null);
    resetRun();
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const collected: TraceEvent[] = [];
    try {
      await streamExecute(
        { graph, mode: "run" },
        (e) => {
          if (e.type === "event") collected.push(e.event);
          consume(e);
          if (e.type === "done") {
            const runId = `RUN-${graph.checksum.replace(/^ps:/, "").split("·")[0]}${(
              runs.length + 1
            )
              .toString(16)
              .toUpperCase()
              .padStart(2, "0")}`;
            const manifest: Manifest = {
              runId,
              intentSource: graph.source,
              graph,
              events: collected,
              runChecksum: e.runChecksum,
              deterministic: e.deterministic,
              durationMs: e.durationMs,
              ok: e.ok,
              createdAt: new Date().toISOString(),
              mode: "run",
            };
            persistRuns([manifest, ...runs]);
          }
        },
        ac.signal,
      );
    } catch (err) {
      if (!ac.signal.aborted) {
        setCompileError({ message: err instanceof Error ? err.message : "Yürütme hatası." });
      }
    } finally {
      setRunning(false);
    }
  }, [graph, running, consume, persistRuns, runs, resetRun]);

  const replaySelected = useCallback(async () => {
    const m = runs.find((r) => r.runId === selectedRunId);
    if (!m || running) return;
    setPhase("replay");
    setGraph(m.graph);
    setCompileStage("ready");
    resetRun();
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamExecute(
        {
          graph: m.graph,
          mode: "replay",
          cachedOutputs: cachedOutputsFromManifest(m),
          expectedChecksum: m.runChecksum,
        },
        (e) => consume(e),
        ac.signal,
      );
    } catch (err) {
      if (!ac.signal.aborted) {
        setCompileError({ message: err instanceof Error ? err.message : "Replay hatası." });
      }
    } finally {
      setRunning(false);
    }
  }, [runs, selectedRunId, running, consume, resetRun]);

  const selectRun = useCallback(
    (runId: string) => {
      const m = runs.find((r) => r.runId === runId);
      if (!m) return;
      abortRef.current?.abort();
      setSelectedRunId(runId);
      setPhase("replay");
      setGraph(m.graph);
      setCompileStage("ready");
      setSource(m.intentSource);
      // load the frozen trace from the manifest
      setTrace(m.events.filter((e) => e.status !== "running"));
      const statuses: Record<string, StepStatus> = {};
      for (const e of m.events) statuses[e.nodeId] = e.status;
      setNodeStatus(statuses);
      setActiveNodeId(null);
      setRunChecksum(m.runChecksum);
      setDeterministic(m.deterministic);
      setOk(m.ok);
      setDurationMs(m.durationMs);
    },
    [runs],
  );

  const clearSelection = useCallback(() => {
    setSelectedRunId(null);
    setPhase("build");
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSource("");
    setGraph(null);
    setCompileError(null);
    setCompileStage("idle");
    setSelectedRunId(null);
    setPhase("build");
    resetRun();
  }, [resetRun]);

  return {
    source,
    setSource,
    provider,
    phase,
    compileStage,
    graph,
    compileError,
    running,
    trace,
    nodeStatus,
    activeNodeId,
    runChecksum,
    deterministic,
    ok,
    durationMs,
    runs,
    selectedRunId,
    compile,
    run,
    replaySelected,
    selectRun,
    clearSelection,
    reset,
  };
}
