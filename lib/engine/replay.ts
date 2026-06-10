import type { Manifest, TaskGraph, TraceEvent } from "@/lib/schema";

/**
 * Replay support. A Manifest's successful events carry the exact tool outputs of
 * the original run; feeding them back as cachedOutputs makes a replay reproduce
 * the run deterministically (and the re-derived runChecksum must match).
 */

export function cachedOutputsFromEvents(events: TraceEvent[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const e of events) {
    if ((e.status === "ok" || e.status === "skip") && e.output !== undefined) {
      out[e.nodeId] = e.output;
    }
  }
  return out;
}

export function cachedOutputsFromManifest(m: Manifest): Record<string, unknown> {
  return cachedOutputsFromEvents(m.events);
}

/** Short, stable-ish run id derived from the graph checksum hex. */
export function runIdFromChecksum(checksum: string, seq: number): string {
  const hex = checksum.replace(/^ps:/, "").split("·")[0];
  return `RUN-${hex}${seq.toString(16).toUpperCase().padStart(2, "0")}`;
}

export interface BuildManifestArgs {
  runId: string;
  graph: TaskGraph;
  events: TraceEvent[];
  runChecksum: string;
  deterministic: boolean;
  durationMs: number;
  ok: boolean;
  createdAt: string;
  mode: Manifest["mode"];
}

export function buildManifest(a: BuildManifestArgs): Manifest {
  return {
    runId: a.runId,
    intentSource: a.graph.source,
    graph: a.graph,
    events: a.events,
    runChecksum: a.runChecksum,
    deterministic: a.deterministic,
    durationMs: a.durationMs,
    ok: a.ok,
    createdAt: a.createdAt,
    mode: a.mode,
  };
}
