/**
 * Deterministic, dependency-free content addressing.
 *
 * The whole point of PROSE is that the same intent compiles to the same plan,
 * and a replay of the same plan reproduces the same outputs. We make that
 * visible with two hashes:
 *
 *   graphChecksum(graph)  — stamps compile time. Same plan -> same id + ticks.
 *   runChecksum(graph, outputs) — fingerprints an execution. A deterministic
 *                                 replay matches it (cyan); live drift breaks it (red).
 *
 * No crypto import, so it runs identically in node + edge runtimes.
 */

/** Stable JSON: object keys sorted recursively, so key order can't change the hash. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") +
    "}"
  );
}

/** FNV-1a 32-bit. Small, stable, good enough for a content fingerprint. */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // h *= 16777619, kept in 32-bit space
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function hex4(n: number): string {
  return (n >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, 4);
}

/** 16 booleans derived from the low 16 bits of the hash — the punch-card tape. */
export function ticksFromHash(h: number): boolean[] {
  const ticks: boolean[] = [];
  for (let i = 0; i < 16; i++) ticks.push(((h >>> i) & 1) === 1);
  return ticks;
}

export interface Checksum {
  id: string; // "ps:7F3A·22"
  ticks: boolean[]; // 16 ticks
  hash: number;
}

/**
 * Content checksum over the structural core of a plan. Volatile fields
 * (checksum, ticks, compiledBy) are intentionally excluded.
 */
export function graphChecksum(core: {
  nodes: unknown[];
  edges: unknown[];
  source: string;
}): Checksum {
  const normalized = stableStringify({
    source: core.source.trim(),
    nodes: core.nodes,
    edges: core.edges,
  });
  const h = fnv1a(normalized);
  const nodeCount = core.nodes.length.toString().padStart(2, "0");
  return { id: `ps:${hex4(h)}·${nodeCount}`, ticks: ticksFromHash(h), hash: h };
}

/**
 * Fingerprint of an actual execution: the plan plus the ordered (nodeId, output)
 * pairs. Two replays of a deterministic plan produce the same value; a live
 * re-run whose tool data changed produces a different one.
 */
export function runChecksum(
  graphId: string,
  steps: { nodeId: string; output: unknown }[],
): string {
  const normalized = stableStringify({
    graph: graphId,
    steps: steps.map((s) => ({ id: s.nodeId, out: s.output })),
  });
  return `ps:${hex4(fnv1a(normalized))}`;
}
