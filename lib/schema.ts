import { z } from "zod";

/**
 * PROSE typed contract.
 *
 * An Intent (one sentence) compiles into a TaskGraph: a typed, versioned plan.
 * Executing a TaskGraph produces a Manifest: the graph plus an ordered trace of
 * TraceEvents. The Manifest is the replay source of truth.
 */

/* ── Intent / parse ── */

export const ClauseKind = z.enum([
  "trigger",
  "source",
  "condition",
  "action",
  "transform",
]);
export type ClauseKind = z.infer<typeof ClauseKind>;

export const Clause = z.object({
  seamId: z.string(), // stable provenance id, e.g. "01"
  kind: ClauseKind,
  label: z.string(), // uppercase display label, e.g. "TRIGGER"
  value: z.string(), // the raw words this clause captured
});
export type Clause = z.infer<typeof Clause>;

export const Intent = z.object({
  source: z.string(),
  clauses: z.array(Clause),
});
export type Intent = z.infer<typeof Intent>;

/* ── Verification / branching predicates ── */

export const PredicateOp = z.enum([
  "exists",
  "truthy",
  "equals",
  "gt",
  "lt",
  "contains",
]);
export type PredicateOp = z.infer<typeof PredicateOp>;

export const Predicate = z.object({
  field: z.string(), // dotted path into the node output, "" = whole value
  op: PredicateOp,
  value: z.unknown().optional(),
  label: z.string().optional(), // human label, e.g. "if weekend"
});
export type Predicate = z.infer<typeof Predicate>;

/* ── Graph ── */

export const TaskNode = z.object({
  id: z.string(), // "n1"
  seamId: z.string(), // ties back to a clause, "01"
  tool: z.string(), // "weather"
  method: z.string(), // "current"
  title: z.string(), // "weather.current"
  params: z.record(z.string(), z.unknown()),
  /** upstream node ids whose outputs feed this node's params via $ref tokens */
  inputs: z.array(z.string()).default([]),
  inputType: z.string().optional(),
  outputType: z.string(), // typed output, drives the cyan schema chips
  verify: Predicate.optional(),
  branch: Predicate.optional(), // node only runs if predicate over an input holds
  dryRun: z.boolean().default(false),
});
export type TaskNode = z.infer<typeof TaskNode>;

export const EdgeKind = z.enum(["data", "branch"]);
export type EdgeKind = z.infer<typeof EdgeKind>;

export const TaskEdge = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  kind: EdgeKind,
  label: z.string().optional(),
  verify: z.boolean().default(false), // a verify gate (◇) straddles this edge
});
export type TaskEdge = z.infer<typeof TaskEdge>;

export const TaskGraph = z.object({
  source: z.string(), // original intent text
  clauses: z.array(Clause),
  nodes: z.array(TaskNode),
  edges: z.array(TaskEdge),
  checksum: z.string(), // ps:XXXX·NN — content-addressed over the normalized plan
  ticks: z.array(z.boolean()), // 16-tick punch-card derived from the checksum
  compiledBy: z.string(), // provider name ("mock", "groq", ...)
});
export type TaskGraph = z.infer<typeof TaskGraph>;

/* ── Trace / run ── */

export const StepStatus = z.enum([
  "pending",
  "running",
  "ok",
  "error",
  "retry",
  "skip", // idempotent skip ⊘
  "gate", // waiting on a verify gate ◷ / ◇
]);
export type StepStatus = z.infer<typeof StepStatus>;

export const TraceEvent = z.object({
  nodeId: z.string(),
  seamId: z.string(),
  tool: z.string(),
  method: z.string(),
  status: StepStatus,
  startedAt: z.number(), // ms offset from run start
  durationMs: z.number(),
  retries: z.number(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  note: z.string().optional(), // e.g. "idempotent: identical params" / "gate passed"
});
export type TraceEvent = z.infer<typeof TraceEvent>;

export const RunMode = z.enum(["run", "replay"]);
export type RunMode = z.infer<typeof RunMode>;

export const Manifest = z.object({
  runId: z.string(), // "RUN-7F2A"
  intentSource: z.string(),
  graph: TaskGraph,
  events: z.array(TraceEvent),
  /** content hash over (graph + ordered step outputs) — the determinism fingerprint */
  runChecksum: z.string(),
  deterministic: z.boolean(), // replay matched the original runChecksum
  durationMs: z.number(),
  ok: z.boolean(),
  createdAt: z.string(), // ISO; stamped on the client (no Date in pure engine)
  mode: RunMode,
});
export type Manifest = z.infer<typeof Manifest>;

/* ── Streaming protocol (SSE between /api/execute and the client) ── */

export type ExecStreamEvent =
  | { type: "start"; runId: string; total: number }
  | { type: "event"; event: TraceEvent }
  | {
      type: "done";
      runChecksum: string;
      deterministic: boolean;
      ok: boolean;
      durationMs: number;
    }
  | { type: "error"; message: string };
