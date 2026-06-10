import type { ExecStreamEvent } from "@/lib/schema";

/**
 * Consume a Server-Sent-Events POST stream (EventSource only supports GET, so we
 * read the response body directly and split on the SSE record delimiter).
 */
export async function streamExecute(
  body: unknown,
  onEvent: (e: ExecStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`execute ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const record = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = record.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()) as ExecStreamEvent);
      } catch {
        /* ignore malformed keep-alive */
      }
    }
  }
}
