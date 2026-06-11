import { graphChecksum } from "@/lib/checksum";
import type { Clause, Predicate, TaskEdge, TaskGraph, TaskNode } from "@/lib/schema";
import { getTool } from "@/lib/tools";
import { CompileError } from "./types";

/**
 * Assemble a TaskGraph from a flat, LLM-friendly step list. The LLM only has to
 * pick tools, params, and (optionally) a condition + whether a step consumes the
 * previous one's output — we own ids, edges, typing, and the checksum here, so a
 * sloppy model can't produce an invalid graph.
 */
export interface PlanStep {
  tool: string;
  method: string;
  params?: Record<string, unknown>;
  /** feed the previous producing node's whole output into this step */
  consumesPrevious?: boolean;
  /** kind hint for the clause label */
  kind?: Clause["kind"];
  /** a condition over the previous node's output that gates this step */
  condition?: { field: string; op: Predicate["op"]; label?: string; value?: unknown };
}

const KIND_LABEL: Record<Clause["kind"], string> = {
  trigger: "TRIGGER",
  source: "SOURCE",
  condition: "COND",
  action: "ACTION",
  transform: "TRANSFORM",
};

function inferKind(tool: string): Clause["kind"] {
  if (tool === "email" || tool === "calendar") return "action";
  if (tool === "text" || tool === "math") return "transform";
  if (tool === "datetime") return "trigger";
  return "source";
}

export function assembleFromSteps(
  source: string,
  steps: PlanStep[],
  compiledBy: string,
): TaskGraph {
  if (!steps.length) throw new CompileError("Plan boş döndü.");

  const nodes: TaskNode[] = [];
  const edges: TaskEdge[] = [];
  const clauses: Clause[] = [];
  let prev: TaskNode | undefined;
  let seq = 0; // only increments for steps that survive validation

  for (const step of steps) {
    const def = getTool(step.tool, step.method);
    if (!def) continue; // unknown tool -> drop rather than fail the whole plan

    const params: Record<string, unknown> = { ...(step.params ?? {}) };
    const inputs: string[] = [];
    if (step.consumesPrevious && prev) {
      inputs.push(prev.id);
      // wire a generic body/text reference if the tool expects text and none given
      if (params.text === undefined && (step.tool === "text" || step.tool === "email")) {
        const key = step.tool === "email" ? "body" : "text";
        if (params[key] === undefined) params[key] = `$${prev.id}`;
      }
    }

    // Drop malformed steps (e.g. math.eval with no expr) BEFORE they enter the
    // graph, so a sloppy LLM step can't hard-fail the run at execution time.
    // $ref strings stay valid here (they satisfy string params and resolve at run).
    if (!def.params.safeParse(params).success) continue;

    // math.eval only evaluates LITERAL arithmetic. LLMs reach for it to "average"
    // or "sum" another step's output (which PROSE has no aggregation tool for),
    // leaving a non-arithmetic expr that fails at runtime. Drop those here.
    if (step.tool === "math" && step.method === "eval") {
      const expr = String((params as { expr?: unknown }).expr ?? "");
      if (!/^[\d\s+\-*/%.()]+$/.test(expr) || !/\d/.test(expr)) continue;
    }

    let branch: Predicate | undefined;
    if (step.condition && prev) {
      branch = {
        field: step.condition.field,
        op: step.condition.op,
        value: step.condition.value,
        label: step.condition.label,
      };
      if (!inputs.includes(prev.id)) inputs.push(prev.id);
    }

    seq += 1;
    const seamId = seq.toString().padStart(2, "0");
    const kind = step.kind ?? inferKind(step.tool);
    clauses.push({ seamId, kind, label: KIND_LABEL[kind], value: `${step.tool}.${step.method}` });

    const node: TaskNode = {
      id: `n${seq}`,
      seamId,
      tool: step.tool,
      method: step.method,
      title: `${step.tool}.${step.method}`,
      params,
      inputs,
      outputType: def.outputType,
      verify: undefined,
      branch,
      dryRun: !!def.dryRun,
    };
    nodes.push(node);

    for (const from of inputs) {
      const isBranch = !!branch && from === prev?.id;
      edges.push({
        id: `e${edges.length + 1}`,
        from,
        to: node.id,
        kind: isBranch ? "branch" : "data",
        label: isBranch ? branch?.label : undefined,
        verify: isBranch,
      });
    }

    prev = node;
  }

  if (nodes.length === 0) {
    throw new CompileError("Geçerli adım üretilemedi — niyeti yeniden ifade edin.");
  }

  const sum = graphChecksum({ source, nodes, edges });
  return {
    source,
    clauses,
    nodes,
    edges,
    checksum: sum.id,
    ticks: sum.ticks,
    compiledBy,
  };
}
