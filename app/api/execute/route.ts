import { execute } from "@/lib/engine/executor";
import type { ExecStreamEvent, RunMode, TaskGraph } from "@/lib/schema";
import { TaskGraph as TaskGraphSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExecBody {
  graph: TaskGraph;
  mode?: RunMode;
  cachedOutputs?: Record<string, unknown>;
  expectedChecksum?: string;
}

export async function POST(req: Request) {
  let body: ExecBody;
  try {
    body = (await req.json()) as ExecBody;
  } catch {
    return new Response("Geçersiz istek gövdesi.", { status: 400 });
  }

  const parsed = TaskGraphSchema.safeParse(body.graph);
  if (!parsed.success) {
    return new Response("Geçersiz görev grafı.", { status: 422 });
  }
  const graph = parsed.data;
  const mode: RunMode = body.mode === "replay" ? "replay" : "run";

  const encoder = new TextEncoder();
  const send = (
    controller: ReadableStreamDefaultController,
    e: ExecStreamEvent,
  ) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      const abort = new AbortController();
      // propagate client disconnects to in-flight tool fetches
      req.signal.addEventListener("abort", () => abort.abort());

      try {
        send(controller, { type: "start", runId: graph.checksum, total: graph.nodes.length });
        const result = await execute(graph, {
          mode,
          signal: abort.signal,
          cachedOutputs: body.cachedOutputs,
          expectedChecksum: body.expectedChecksum,
          onEvent: (event) => send(controller, { type: "event", event }),
        });
        send(controller, {
          type: "done",
          runChecksum: result.runChecksum,
          deterministic: result.deterministic,
          ok: result.ok,
          durationMs: result.durationMs,
        });
      } catch (err) {
        send(controller, {
          type: "error",
          message: err instanceof Error ? err.message : "Yürütme hatası.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
