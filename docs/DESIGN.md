# PROSE — Design System: "The Living Seam"

> A sentence is source code. PROSE parses, type-checks, plans, executes, and verifies the developer's intent, and the interface refuses to hide any of that machinery. A disciplined terminal instrument: monospace structure, hard 1px rules, glyph status, zero decoration, every pixel load-bearing.

**Theme:** Dark (phosphor-glass). Committed. No light mode.
**Mood:** Quiet, exacting, instrument-grade — the calm of a well-built oscilloscope. Dense but never noisy; technical but never cosplaying "hacker."

Chosen by a 5-director / 5-judge design panel (`COMPILE/RUN` spine, 44/50), with the determinism checksum grafted from `DATUM`, per-clause provenance numbers from `Ledger`/`Errata`, and responsive + empty-state coverage from `Drafting Table`.

---

## 1. Tone & Principles

1. **The page does the talking, not chrome.** Structure is hard 1px rules and box-drawing characters, never shadows or cards.
2. **Status is typography, not icons.** `▷ ✓ ✗ ⟳ ⊘ ◷ ◇` — glyphs scan faster than icon sets at 28px row density.
3. **Motion is strictly diegetic.** Every animation depicts real execution. The phosphor pulse IS the program counter. Compile state SNAPS (discrete LED), it never eases.
4. **One artifact, three views.** Intent, graph, and trace are the same object seen from three angles — bound by the Living Seam and a shared determinism checksum.
5. **Density is rationed whitespace.** Whitespace separates the three columns and nothing else.

---

## 2. Type Scale & Roles

Three voices map to three layers of meaning:

| Voice | Font | Role | Sizes |
|---|---|---|---|
| **Machine** | JetBrains Mono | Intent text, all node text, trace rows, timings, IDs, manifests, checksums | 11 / 13 / 16 (mono) |
| **Display/Structure** | Martian Mono | Wordmark, surface headers, bracketed `[LABELS]` | 11 (tracked) / 14 / 18 |
| **Human** | IBM Plex Sans | ONLY prose: help text, tooltips, empty-state guidance, run notes | 13 / 14 |

**Hard rules:**
- JetBrains Mono ligatures **OFF** in the composer (the raw sentence must read literally), **ON** in compiled-code/manifest panels.
- Martian Mono is ONLY ever `[BRACKETED]`, uppercase, `letter-spacing: 0.08em`, weight 600. It must never be used for body text.
- IBM Plex Sans appears ONLY in sentence-shaped prose. If you reach for it on a label, you are wrong — use Martian Mono.
- Tabular figures everywhere numbers align: `font-variant-numeric: tabular-nums`.

### Type tokens
| Token | Font / Weight / Size / LH / Tracking |
|---|---|
| `type/wordmark` | Martian Mono 700 · 18px · 1 · 0.06em |
| `type/header` | Martian Mono 600 · 11px · 1 · 0.08em (uppercase) |
| `type/composer` | JetBrains Mono 500 · 16px · 1.5 · 0 |
| `type/node-title` | JetBrains Mono 500 · 13px · 1.3 · 0 |
| `type/node-id` | JetBrains Mono 400 · 11px · 1 · 0.02em (muted) |
| `type/trace-row` | JetBrains Mono 400 · 12px · 1 · 0 (tabular) |
| `type/chip` | JetBrains Mono 500 · 11px · 1 · 0.01em |
| `type/prose` | IBM Plex Sans 400 · 14px · 1.55 · 0 |
| `type/prose-emph` | IBM Plex Sans 500 · 13px · 1.5 · 0 |

---

## 3. Color Tokens

Phosphor-glass dark. Multi-dimensional: warm-off-white ink, mint signal (the live wire), calm-green ok, amber warn, terminal red err, cyan types, periwinkle replay. Each color has exactly one semantic job.

| Token | Hex | Role |
|---|---|---|
| `bg/void` | `#0B0D0C` | App background — near-black, faint green cast (phosphor glass), never pure #000 |
| `bg/panel` | `#121514` | Raised surfaces: composer, canvas, trace panel |
| `bg/sunken` | `#080A09` | Inset wells: code/manifest viewers, terminal output |
| `rule/hard` | `#2A2F2C` | 1px structural rules + box-drawing. Visible, never faint |
| `rule/hover` | `#3E4642` | Rule brightens on hover/active focus |
| `ink/primary` | `#E6EAE3` | Primary text — warm off-white, not blue-white |
| `ink/muted` | `#7E8A82` | Secondary text, IDs, timestamps, inactive labels |
| `accent/signal` | `#7CFFB2` | THE phosphor-mint: running state, active edge, cursor, seam pulse, primary action. The live wire — used sparingly |
| `state/ok` | `#46D38A` | Verified / passed / committed (calmer than signal) |
| `state/warn` | `#E8B341` | Retry, degraded, idempotency-skip, gate-waiting (amber) |
| `state/err` | `#FF5C57` | Failed step, type error, compile error, checksum drift (terminal red) |
| `accent/type` | `#56B6E0` | Type annotations, schema chips, data-flow edges (cool cyan = structure) |
| `accent/replay` | `#C8A2FF` | Replay / deterministic time-axis ONLY. Muted periwinkle. NEVER a gradient/fill — 1px markers + scrubber only |

**Anti-slop guard on `accent/replay`:** the only purple-adjacent value is semantically quarantined to the replay time axis. It must never appear as a gradient, a fill, or anywhere in the general UI. This is the rule that prevents the one purple tone from becoming a slop tell.

---

## 4. Spacing, Grid, Radius, Shadow

- **Base unit:** 4px. All spacing is a multiple: `4 / 8 / 12 / 16 / 24 / 32 / 40 / 64`.
- **Radius:** `0` everywhere. No rounded containers. The single exception: status pips/dots which are circles by nature.
- **Shadow:** NONE. Depth is expressed by background-shift (`bg/panel` → `bg/sunken`) and 1px rules, never `box-shadow` and never blur. Glassmorphism is forbidden.
- **Rules:** structural separators are always exactly `1px solid var(--rule-hard)`. Drag handles render the box-drawing glyph `╎`.
- **Fixed row height:** trace rows are exactly `28px`. Status bar is `40px`.

---

## 5. The Four Surfaces

### Shell
Single full-bleed app, no rounded containers, no cards-in-cards. A `40px` **STATUS BAR** spans the top:
- **Left:** `PROSE` wordmark (Martian Mono) + workspace name.
- **Center:** global run-state glyph (`● live` / `○ idle`) + clock + the active **checksum tape**.
- **Right:** segmented control `[BUILD ●] [RUN ▷] [REPLAY ⟲]`.

Below it, three resizable vertical columns separated by draggable 1px rules (handle = `╎`). Every panel header is a Martian Mono bracketed label sitting ON a 1px rule, text knocking out the rule:
```
──[ TASK GRAPH ]────────────────────────────
```

### Surface 1 — Intent Composer (top of left column)
A sunken well (`bg/sunken`) with a line-number gutter (`ink/muted`) and a blinking phosphor block cursor. Type one sentence in JetBrains Mono 500/16, ligatures off.

Beneath it, a live **PARSE STRIP**: one 1px-ruled row of bracketed typed spans:
```
[TRIGGER: every saturday] → [SOURCE: calendar] → [COND: weekend booking] → [ACTION: monday-am summary]
```
Each span carries its stable **seam-id** (`01 02 03 04`) and a 1px mint tick on its bottom edge. Right-aligned compile state cycles through DISCRETE snaps (no easing):
`PARSE → TYPE → PLAN → ✓ COMPILED · 4 nodes · 0 type-errors · ps:7F3A·22`
On failure: `✗` with the offending span underlined in `state/err` and the type expectation in a Plex Sans tooltip.

### Surface 2 — Task-Graph Canvas (center, largest)
Nodes are hard 1px-ruled rectangles (NOT pills, NO radius):
- Title bar: seam-id `#02` (`ink/muted`) + tool name (`ink/primary`).
- Body: optional param summary.
- Footer: typed I/O as square-bracket cyan schema chips — `in:[Calendar.Events] out:[Booking[]]`.

Edges are **orthogonal box-drawing polylines** (`─ │ ┌ └ ├ ┤`), never bezier. Data-flow = `accent/type` cyan; branch edges labelled `[if weekend]` in amber; **verify gates** = a `◇` diamond straddling the edge. Background = faint 24px dot grid in `rule/hard`. The active run animates a single phosphor-mint pulse along the current edge. Selected node draws a corner-bracket frame `⌜ ⌟`, never a glow.

> **Edge routing requirement:** use ELK.js (`elkjs`) with `elk.layered` + `org.eclipse.elk.edgeRouting: ORTHOGONAL`. A naive router will cross edges and break the TUI aesthetic. Verify-diamond is a custom SVG marker placed at edge-midpoint by the layout pass.

### Surface 3 — Execution Trace Timeline (right column)
Dense vertical log, fixed 28px rows, grid-aligned columns:
```
[glyph] #02  calendar.list  ──────── 412ms  ⟲2
```
- Far-left status glyph: `▷` running · `✓` ok · `✗` err · `⟳` retry · `⊘` idempotent-skip · `◷` waiting-gate.
- A thin continuous left rail `│` connects rows into one trace spine.
- Rows are expandable: click slides open an inset sunken well with input/output JSON, the checked field highlighted `accent/type`, retries shown diff-style `±`.
- Streaming output appends with a 1-frame mint cursor at the tail. **Rows SNAP in (120ms ease-out max) — logs do not dissolve.**

### Surface 4 — Run History + Replay (collapsible bottom strip, full width)
Horizontal ruled table of past runs:
```
RUN-7F2A · ps:7F3A·22 · 2026-06-10 09:14 · 1.2s · ✓ · [↻ re-run] [⟲ replay]
```
Selecting a run loads its manifest into the canvas in a desaturated **frozen** state and arms the **REPLAY SCRUBBER** along the bottom rule: a periwinkle (`accent/replay`) time-axis with one tick per step, draggable to scrub the trace deterministically. The re-derived checksum compares live: **cyan glow = deterministic match, red ticks = drift.**

---

## 6. Components (exact)

- **`<StatusBar>`** — 40px, grid `[wordmark · workspace | runglyph · clock · checksum | segmented-control]`.
- **`<IntentField>`** — sunken textarea (auto-grow 1–3 lines), line-number gutter, block cursor `530ms` blink. Ligatures off.
- **`<ParseStrip>`** — flex row of `<TypedSpan>`; each = label (Martian Mono 600/11 tracked) + value (JetBrains Mono 400/13) + seam-id + mint tick.
- **`<CompileState>`** — discrete 4-state stepper (PARSE/TYPE/PLAN/READY), 140ms hard cuts, terminates in `✓ COMPILED · N nodes · 0 type-errors · <ChecksumTape/>`.
- **`<GraphNode>`** — 1px `rule/hard` rect, no radius. States recolor the BORDER only: idle=`rule/hard`, running=`accent/signal` + traveling pulse, ok=`state/ok`, err=`state/err`, gate=`◇` + `state/warn` until satisfied. Selected = `⌜ ⌟` corner brackets.
- **`<OrthoEdge>` / `<VerifyDiamond>`** — SVG orthogonal polyline + midpoint diamond marker, colored by kind (cyan data / amber branch).
- **`<TraceRow>`** — fixed 28px grid `[glyph | #id | tool.method | leader-dots | dur ms | retry ⟲n]`; hover sets `bg/panel`→`rule/hover` left rail; expand reveals `<IOWell>` (sunken, checked-field highlighted cyan).
- **`<ManifestRow>`** — horizontal ruled record; selection desaturates canvas + arms `<ReplayScrubber>`.
- **`<ChecksumTape>`** — SHARED component bound to the run hash; 16 tiny ticks (punch-card). Identical on composer, status bar, every trace row, manifest. `verify-cyan` on deterministic match, `state/err` on drift.

---

## 7. Iconography

Purpose-built TUI glyph set. **STATUS is always typographic, never icons:** `▷ ✓ ✗ ⟳ ⊘ ◷ ◇ ● ○`. Structure uses box-drawing literally: `─ │ ┌ ┐ └ ┘ ├ ┤ ╎`. Labels are `[BRACKETED]` uppercase. Schema/type chips are square-bracketed mono in cyan. For the rare pictographic need (tool palette), Lucide at 1.5px stroke / 16px, cool-toned. **No emoji, no filled/duotone sets, no rounded friendly icons.**

---

## 8. Motion (diegetic only)

| # | Motion | Spec | Justification |
|---|---|---|---|
| 1 | **Seam pulse** | phosphor-mint travels intent→edge→trace at true step cadence | It IS the program counter |
| 2 | **Compile state** | DISCRETE snaps PARSE/TYPE/PLAN/READY, 140ms hard cuts, no easing | Compilation is discrete, not smooth (grafted from DATUM avionics model) |
| 3 | **Parse spinner** | `⠋⠙⠹⠸` braille cycle, stops instantly on COMPILED | Active-compile indicator |
| 4 | **Trace rows** | snap in, 120ms ease-out max, mint tail cursor. NO fade | Logs don't dissolve |
| 5 | **Block cursor** | blink 530ms (classic terminal cadence) | — |
| 6 | **Replay scrub** | drag moves pulse + checksum re-derive in lockstep | Scrubbing IS the animation |

**Forbidden:** parallax, entrance choreography, hover-bounce, ambient loops, pulse-glows.
**`prefers-reduced-motion`:** seam pulse → static highlighted segment; spinner → static `◐`; everything else is already static.

---

## 9. Responsive Strategy

- **≥1440px:** three columns + history strip, full density (target).
- **1280–1439px:** trace column collapses to a docked bottom drawer (tab-toggled with history); canvas keeps center stage. Fixed 28px rows preserved.
- **<1280px:** single-column tabbed mode — `[COMPOSER] [GRAPH] [TRACE] [HISTORY]` as a Martian Mono segmented switcher; seam-id matching (not pixel-continuous SVG) keeps provenance legible across tabs.
- Columns are min-width clamped: composer 320px, canvas 480px, trace 360px.

---

## 10. Empty States

- **Composer empty:** blinking mint block cursor in the sunken well + one Plex Sans line: *"Describe what should happen. PROSE compiles it into a typed, replayable task-graph."* The `<ChecksumTape>` renders at zero (all ticks `rule/hard`).
- **Canvas empty:** faint 24px dot grid + centered box-drawing frame `┌─[ AWAITING COMPILE ]─┐`.
- **Trace empty:** the single left-rail `│` spine with one muted `○ idle` glyph at top.
- **History empty:** `── no runs recorded ──` centered in `ink/muted`.

---

## 11. Accessibility

- Contrast: `ink/primary #E6EAE3` on `bg/void #0B0D0C` ≈ 14:1 (AAA). `ink/muted #7E8A82` on `bg/void` ≈ 6.2:1 (AA). Verified pairings only.
- Status is never color-alone: every status carries its typographic glyph (`✓ ✗ ⟳`) so color-blind users scan by shape.
- Focus rings: 1px `accent/signal` corner-bracket `⌜ ⌟`, never a removed outline.
- All motion respects `prefers-reduced-motion`.
- Keyboard: composer is a real textarea; graph nodes are tab-focusable with seam-id announced via `aria-label="step 02, calendar.list, ok, 412ms"`.

---

## 12. Signature Detail — THE LIVING SEAM (+ Determinism Checksum)

Intent, graph, and trace are stitched by ONE continuous mint signal line that physically connects all three surfaces, anchored by a determinism checksum so the seam proves replayability, not just shows flow.

- Each parsed token in the PARSE STRIP gets a stable **seam-id** (`01 02 03`) and a 1px mint tick on its bottom edge.
- Those ticks descend as vertical guides into the exact graph node they compiled into (`#02`), and the same line continues into that node's trace row.
- During a run, a single phosphor pulse travels the seam end-to-end: it lights the active token, flows the active edge, arrives at the streaming trace row — you literally watch one English clause become a typed node become an executing step.
- Hovering any node back-highlights its sentence span AND forward-highlights its trace rows (matched by seam-id).
- **The checksum anchor:** on compile, a content-addressed hash `ps:7F3A·22` renders as a 16-tick tape and stamps the composer, graph, every trace, and the saved manifest — identical across surfaces. On replay, the hash is re-derived live: matches → seam + tape glow `verify-cyan` (deterministic); drift → tape ticks `state/err`.

**DOM strategy (closes the #1 risk):** the seam is rendered as an SVG overlay layer absolutely positioned over the column container, with line endpoints resolved from `data-seam-id` anchors via `getBoundingClientRect()` on a `ResizeObserver` + scroll listener (rAF-throttled). If a panel is collapsed/tabbed (responsive), the continuous line degrades gracefully to seam-id badge matching — provenance survives because alignment is identity-based, not pixel-dependent.
