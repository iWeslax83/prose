# PROSE — Architecture & Implementation Plan

PROSE compiles a natural-language **intent** into a typed, versioned, **replayable** agent
task-graph, then **executes** it step-by-step with verification, retries, idempotency, and a
live observability trace. Built on Next.js (App Router) + TypeScript, deployed on Vercel.

## Module map

```
app/
  page.tsx                 # the single-screen instrument (client shell)
  layout.tsx               # fonts, metadata, global css
  globals.css              # design tokens ("The Living Seam") + base
  api/
    compile/route.ts       # POST intent -> TaskGraph (provider or mock)
    execute/route.ts       # POST graph -> SSE stream of trace events
lib/
  schema.ts                # Zod types: Intent, TaskGraph, Node, Edge, Manifest, TraceEvent
  checksum.ts              # content-addressed deterministic hash -> ps:XXXX·NN + 16 ticks
  tools/
    index.ts               # registry + typed dispatch
    *.ts                   # weather, httpFetch, wikipedia, hackernews, datetime, math, text,
                           # emailDraft (dry-run), calendarReminder (dry-run)
  providers/
    index.ts               # selectProvider() from env
    types.ts               # Provider interface (compile(intent) -> TaskGraph)
    mock.ts                # deterministic pattern compiler (works with ZERO keys)
    groq.ts / gemini.ts / openrouter.ts / ollama.ts   # structured-output adapters
  engine/
    executor.ts            # runs a graph: topological order, retries, idempotency,
                           # verify gates, emits TraceEvents; pure + streamable
    replay.ts              # re-run from a saved Manifest; re-derive checksum; detect drift
components/
  StatusBar, IntentField, ParseStrip, CompileState, GraphCanvas, GraphNode,
  OrthoEdge, TraceTimeline, TraceRow, RunHistory, ReplayScrubber, ChecksumTape,
  LivingSeam (SVG overlay)
hooks/
  useRuns.ts               # localStorage persistence of manifests (the replay source of truth)
  useSeam.ts               # data-seam-id anchor resolution via ResizeObserver + rAF
```

## Core types (lib/schema.ts)

- `Intent` — raw text + parsed `clauses[]` (each with `seamId`, `kind: trigger|source|cond|action`, `span`).
- `ToolRef` — `{ tool, method, params }` with Zod-validated params per tool.
- `TaskNode` — `{ id, seamId, tool, method, params, inputs[], outputType, verify?, branch? }`.
- `TaskEdge` — `{ from, to, kind: data|branch, label? }`.
- `TaskGraph` — `{ nodes[], edges[], checksum, source }` — the typed, versioned manifest.
- `TraceEvent` — `{ nodeId, seamId, status, startedAt, durationMs, retries, input, output, error? }`.
- `Manifest` — `{ runId, graph, events[], checksum, deterministic, createdAt }`.

## Determinism (the product's promise, made visible)

`checksum(graph)` is a stable hash over the **normalized** graph (sorted keys, no timestamps).
Same intent → same compiled graph → same checksum. On replay, tool outputs are **read from the
saved manifest** (cached), so re-execution is byte-identical and the re-derived checksum matches
(cyan). "Live re-run" actually re-calls tools; if a free API returns different data the checksum
drifts (red) — which is the honest, correct signal.

## Executor contract

`execute(graph, { mode, signal, onEvent })`:
1. Topologically order nodes from edges.
2. For each node: resolve inputs from upstream outputs; build an **idempotency key** from
   `(nodeId + normalized params)`; if already satisfied in this run, emit `⊘` skip.
3. Call the tool with retry (max 2, backoff) → emit `⟳` on retry, `✗` on terminal failure.
4. If the node has a `verify` predicate, run it as a gate → `◇` until satisfied.
5. Emit `▷`(start) → `✓`(ok) TraceEvents; stream via SSE in the API route.

## Tools (all free / no API key)

| tool.method | source | side-effect |
|---|---|---|
| `weather.current` / `weather.forecast` | open-meteo.com (no key) | read |
| `http.get` | public URLs | read |
| `wikipedia.summary` | REST summary API | read |
| `hackernews.top` | Firebase HN API | read |
| `datetime.now` / `datetime.add` | local | pure |
| `math.eval` | safe expression eval | pure |
| `text.transform` | upper/lower/summarize-stub | pure |
| `email.draft` | **dry-run** — records a draft, never sends | simulated |
| `calendar.reminder` | **dry-run** — records a reminder | simulated |

## Providers

`Provider.compile(intent): Promise<TaskGraph>`. Default env = no key → **Mock**: a deterministic
parser that recognizes the showcase intents and a general pattern grammar (trigger/source/
condition/action) and emits a real typed graph. With `PROSE_PROVIDER=groq|gemini|openrouter|ollama`
+ key, the adapter prompts the model for a JSON graph constrained by the Zod schema, validates,
and (on parse failure) falls back to Mock. The app is therefore **fully functional with zero keys.**

## Showcase intents (work key-free)

1. `Bugün Bursa'da hava yağmurlu mu? Yağmurluysa bana bir hatırlatıcı taslağı oluştur.`
2. `Hacker News'te ilk 5 başlığı al, her birini tek cümlede özetle, bir e-posta taslağı yap.`
3. `Wikipedia'da "transformer (machine learning)" özetini çek ve 3 maddeye indir.`
4. `Her cumartesi takvime bak; hafta sonu rezervasyon varsa pazartesi sabahı özet at.`

## Build order

1. tokens + shell + fonts (visible skeleton)
2. schema + checksum + tools + mock provider (engine works headless)
3. executor + replay
4. API routes (compile, execute SSE)
5. UI surfaces wired to the engine + the Living Seam overlay
6. a11y/reduced-motion + anti-slop review + `next build`
7. README + deploy button + GitHub repo + push
