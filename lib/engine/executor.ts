import { runChecksum, stableStringify } from "@/lib/checksum";
import type { RunMode, TaskGraph, TaskNode, TraceEvent } from "@/lib/schema";
import { getTool } from "@/lib/tools";
import { evalPredicate, getField } from "./predicate";

/**
 * The executor runs a TaskGraph deterministically-as-possible:
 *  - topological order from the edges
 *  - idempotency: identical (nodeId, params) within a run is skipped (⊘)
 *  - branch gating: a node with an unmet branch predicate is skipped
 *  - retries with backoff (⟳), then terminal error (✗)
 *  - verify gates (◇): a failed post-condition fails the step
 *  - emits TraceEvents as it goes (the API route streams them as SSE)
 *
 * In "replay" mode tool outputs are read from `cachedOutputs` instead of being
 * re-fetched, so a replay reproduces the run byte-for-byte (the determinism proof).
 */

export interface ExecuteOptions {
  mode: RunMode;
  signal?: AbortSignal;
  onEvent?: (e: TraceEvent) => void;
  /** nodeId -> output, used in replay mode */
  cachedOutputs?: Record<string, unknown>;
  /** the original run's checksum to compare against (for the deterministic flag) */
  expectedChecksum?: string;
  /** retries per node (default 2 -> up to 3 attempts) */
  maxRetries?: number;
}

export interface ExecuteResult {
  events: TraceEvent[];
  outputs: Record<string, unknown>;
  runChecksum: string;
  deterministic: boolean;
  ok: boolean;
  durationMs: number;
}

function topoSort(graph: TaskGraph): TaskNode[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of graph.nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of graph.edges) {
    if (!indeg.has(e.to) || !adj.has(e.from)) continue;
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    adj.get(e.from)!.push(e.to);
  }
  // stable queue: preserve original node order among ready nodes
  const order: TaskNode[] = [];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const ready = graph.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  while (ready.length) {
    const id = ready.shift()!;
    const node = byId.get(id);
    if (node) order.push(node);
    for (const next of adj.get(id) ?? []) {
      indeg.set(next, (indeg.get(next) ?? 0) - 1);
      if ((indeg.get(next) ?? 0) === 0) ready.push(next);
    }
  }
  // any cycle leftovers appended in declared order (shouldn't happen for our plans)
  if (order.length < graph.nodes.length) {
    for (const n of graph.nodes) if (!order.includes(n)) order.push(n);
  }
  return order;
}

/** Replace "$nodeId" / "$nodeId.path" string params with upstream outputs. */
function resolveParams(
  params: Record<string, unknown>,
  outputs: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") {
      const m = v.match(/^\$(\w+)(?:\.(.+))?$/);
      if (m) {
        const upstream = outputs[m[1]];
        const resolved = m[2] ? getField(upstream, m[2]) : upstream;
        out[k] =
          typeof resolved === "string"
            ? resolved
            : resolved === undefined
              ? ""
              : stableStringify(resolved);
        continue;
      }
    }
    out[k] = v;
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function execute(
  graph: TaskGraph,
  opts: ExecuteOptions,
): Promise<ExecuteResult> {
  const start = Date.now();
  const order = topoSort(graph);
  const outputs: Record<string, unknown> = {};
  const events: TraceEvent[] = [];
  const idempotency = new Map<string, string>(); // key -> nodeId that produced it
  const checksumSteps: { nodeId: string; output: unknown }[] = [];
  const maxRetries = opts.maxRetries ?? 2;
  let ok = true;

  const emit = (e: TraceEvent) => {
    events.push(e);
    opts.onEvent?.(e);
  };

  const base = (node: TaskNode): Omit<TraceEvent, "status"> => ({
    nodeId: node.id,
    seamId: node.seamId,
    tool: node.tool,
    method: node.method,
    startedAt: Date.now() - start,
    durationMs: 0,
    retries: 0,
  });

  for (const node of order) {
    if (opts.signal?.aborted) break;
    const t0 = Date.now();

    // ── branch gate: only run if the predicate over an input holds ──
    if (node.branch) {
      const src = node.inputs[0];
      const passed = src !== undefined && evalPredicate(outputs[src], node.branch);
      if (!passed) {
        emit({
          ...base(node),
          status: "skip",
          durationMs: Date.now() - t0,
          note: `koşul sağlanmadı: ${node.branch.label ?? node.branch.field}`,
        });
        continue;
      }
    }

    const resolved = resolveParams(node.params, outputs);

    // ── idempotency: identical work already done this run ──
    const idemKey = `${node.tool}.${node.method}:${stableStringify(resolved)}`;
    if (idempotency.has(idemKey)) {
      const ofNode = idempotency.get(idemKey)!;
      outputs[node.id] = outputs[ofNode];
      checksumSteps.push({ nodeId: node.id, output: outputs[node.id] });
      emit({
        ...base(node),
        status: "skip",
        durationMs: Date.now() - t0,
        output: outputs[node.id],
        note: `idempotent: ${ofNode} ile aynı`,
      });
      continue;
    }

    emit({ ...base(node), status: "running", input: resolved });

    // ── run (replay reads cache; live calls the tool) with retries ──
    let output: unknown;
    let attempt = 0;
    let lastErr: unknown;
    let succeeded = false;

    if (opts.mode === "replay" && opts.cachedOutputs && node.id in opts.cachedOutputs) {
      output = opts.cachedOutputs[node.id];
      succeeded = true;
    } else {
      const def = getTool(node.tool, node.method);
      while (attempt <= maxRetries) {
        if (opts.signal?.aborted) break;
        try {
          if (!def) throw new Error(`Bilinmeyen araç: ${node.tool}.${node.method}`);
          const pr = def.params.safeParse(resolved);
          if (!pr.success) {
            const first = pr.error.issues[0];
            throw new Error(
              `tip hatası: ${first.path.join(".") || node.tool} — ${first.message}`,
            );
          }
          output = await def.run(pr.data, { signal: opts.signal });
          succeeded = true;
          break;
        } catch (err) {
          lastErr = err;
          attempt += 1;
          if (attempt <= maxRetries) {
            emit({
              ...base(node),
              status: "retry",
              durationMs: Date.now() - t0,
              retries: attempt,
              note: err instanceof Error ? err.message : String(err),
            });
            await sleep(180 * attempt);
          }
        }
      }
    }

    if (!succeeded) {
      ok = false;
      emit({
        ...base(node),
        status: "error",
        durationMs: Date.now() - t0,
        retries: attempt,
        error: lastErr instanceof Error ? lastErr.message : String(lastErr),
      });
      continue;
    }

    outputs[node.id] = output;
    idempotency.set(idemKey, node.id);
    checksumSteps.push({ nodeId: node.id, output });

    // ── verify gate (◇): post-condition over the output ──
    if (node.verify) {
      const verified = evalPredicate(output, node.verify);
      if (!verified) {
        ok = false;
        emit({
          ...base(node),
          status: "error",
          durationMs: Date.now() - t0,
          retries: attempt,
          output,
          error: `doğrulama başarısız: ${node.verify.label ?? node.verify.field}`,
        });
        continue;
      }
      emit({
        ...base(node),
        status: "ok",
        durationMs: Date.now() - t0,
        retries: attempt,
        output,
        note: `◇ ${node.verify.label ?? "doğrulandı"}`,
      });
      continue;
    }

    emit({
      ...base(node),
      status: "ok",
      durationMs: Date.now() - t0,
      retries: attempt,
      output,
    });
  }

  const rc = runChecksum(graph.checksum, checksumSteps);
  const deterministic = opts.expectedChecksum ? rc === opts.expectedChecksum : true;

  return {
    events,
    outputs,
    runChecksum: rc,
    deterministic,
    ok,
    durationMs: Date.now() - start,
  };
}
