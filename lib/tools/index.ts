import { z } from "zod";

/**
 * Tool registry. Every tool is real and free (no API key) or an explicit
 * dry-run side-effect. Each declares a typed param schema, a typed output name
 * (drives the cyan schema chips), and a short human describe() for the node body.
 */

export interface ToolContext {
  signal?: AbortSignal;
}

export interface ToolDef<P = Record<string, unknown>> {
  tool: string;
  method: string;
  outputType: string;
  dryRun?: boolean;
  params: z.ZodType<P>;
  describe: (params: P) => string;
  run: (params: P, ctx: ToolContext) => Promise<unknown>;
}

const TIMEOUT = 8000;

/**
 * A bounded integer that CLAMPS out-of-range input instead of rejecting it.
 * LLM compilers happily emit `limit: 50`; clamping is friendlier than a hard
 * type error and keeps the run going. Non-numbers fall back to `def`.
 */
const clampInt = (min: number, max: number, def: number) =>
  z.preprocess((v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  }, z.number().int().min(min).max(max));

async function getJSON(url: string, ctx: ToolContext): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  const onAbort = () => ctrl.abort();
  ctx.signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "PROSE/1.0 (intent-first programming)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    ctx.signal?.removeEventListener("abort", onAbort);
  }
}

/* ── geocoding shared by the weather tools (open-meteo, no key) ── */
async function geocode(
  place: string,
  ctx: ToolContext,
): Promise<{ name: string; latitude: number; longitude: number; country?: string }> {
  const data = (await getJSON(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      place,
    )}&count=1&language=tr&format=json`,
    ctx,
  )) as { results?: Array<{ name: string; latitude: number; longitude: number; country?: string }> };
  const hit = data.results?.[0];
  if (!hit) throw new Error(`Yer bulunamadı: "${place}"`);
  return hit;
}

const WEATHER_CODES: Record<number, string> = {
  0: "açık",
  1: "az bulutlu",
  2: "parçalı bulutlu",
  3: "kapalı",
  45: "sisli",
  48: "kırağı sisi",
  51: "çiseleme",
  53: "çiseleme",
  55: "yoğun çiseleme",
  61: "hafif yağmur",
  63: "yağmur",
  65: "kuvvetli yağmur",
  71: "hafif kar",
  73: "kar",
  75: "yoğun kar",
  80: "sağanak",
  81: "sağanak",
  82: "şiddetli sağanak",
  95: "gök gürültülü fırtına",
};

/* ── a tiny safe arithmetic evaluator (no Function/eval) ── */
function safeEval(expr: string): number {
  let i = 0;
  const s = expr.replace(/\s+/g, "");
  function peek() {
    return s[i];
  }
  function number(): number {
    const start = i;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    if (start === i) throw new Error(`Sayı bekleniyordu @${i}`);
    return parseFloat(s.slice(start, i));
  }
  function factor(): number {
    if (peek() === "(") {
      i++;
      const v = expr2();
      if (peek() !== ")") throw new Error("')' eksik");
      i++;
      return v;
    }
    if (peek() === "-") {
      i++;
      return -factor();
    }
    return number();
  }
  function term(): number {
    let v = factor();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = s[i++];
      const r = factor();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  }
  function expr2(): number {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  const result = expr2();
  if (i !== s.length) throw new Error(`Beklenmeyen karakter @${i}`);
  if (!Number.isFinite(result)) throw new Error("Sonuç tanımsız");
  return result;
}

function firstSentence(text: string): string {
  const m = text.match(/[^.!?]+[.!?]/);
  return (m ? m[0] : text).trim();
}

/* ── the registry ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOLS: ToolDef<any>[] = [
  {
    tool: "weather",
    method: "current",
    outputType: "Weather",
    params: z.object({ place: z.string() }),
    describe: (p) => `place: "${p.place}"`,
    run: async (p, ctx) => {
      const loc = await geocode(p.place, ctx);
      const data = (await getJSON(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,precipitation,weather_code`,
        ctx,
      )) as { current?: { temperature_2m: number; precipitation: number; weather_code: number } };
      const c = data.current;
      if (!c) throw new Error("Hava verisi alınamadı");
      return {
        place: loc.name,
        tempC: c.temperature_2m,
        precipitationMm: c.precipitation,
        isRaining: c.precipitation > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95].includes(c.weather_code),
        condition: WEATHER_CODES[c.weather_code] ?? `kod ${c.weather_code}`,
      };
    },
  } as ToolDef<{ place: string }>,
  {
    tool: "weather",
    method: "forecast",
    outputType: "Forecast",
    params: z.object({ place: z.string(), days: clampInt(1, 7, 3) }),
    describe: (p) => `place: "${p.place}", days: ${p.days ?? 3}`,
    run: async (p, ctx) => {
      const loc = await geocode(p.place, ctx);
      const days = p.days ?? 3;
      const data = (await getJSON(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&forecast_days=${days}&timezone=auto`,
        ctx,
      )) as {
        daily?: {
          time: string[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
          precipitation_sum: number[];
          weather_code: number[];
        };
      };
      const d = data.daily;
      if (!d) throw new Error("Tahmin alınamadı");
      return {
        place: loc.name,
        days: d.time.map((t, idx) => ({
          date: t,
          maxC: d.temperature_2m_max[idx],
          minC: d.temperature_2m_min[idx],
          precipitationMm: d.precipitation_sum[idx],
          condition: WEATHER_CODES[d.weather_code[idx]] ?? `kod ${d.weather_code[idx]}`,
        })),
      };
    },
  } as ToolDef<{ place: string; days: number }>,
  {
    tool: "http",
    method: "get",
    outputType: "HttpResponse",
    params: z.object({ url: z.string().url() }),
    describe: (p) => p.url,
    run: async (p) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
      try {
        const res = await fetch(p.url, { signal: ctrl.signal });
        const text = await res.text();
        return {
          status: res.status,
          contentType: res.headers.get("content-type") ?? "",
          body: text.slice(0, 4000),
          truncated: text.length > 4000,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  } as ToolDef<{ url: string }>,
  {
    tool: "wikipedia",
    method: "summary",
    outputType: "WikiSummary",
    params: z.object({ title: z.string(), lang: z.string().default("tr") }),
    describe: (p) => `${p.lang ?? "tr"}:"${p.title}"`,
    run: async (p, ctx) => {
      const lang = p.lang ?? "tr";
      const data = (await getJSON(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
          p.title.replace(/\s+/g, "_"),
        )}`,
        ctx,
      )) as { title?: string; extract?: string; description?: string };
      if (!data.extract) throw new Error(`Wikipedia özeti yok: "${p.title}"`);
      return { title: data.title, description: data.description, extract: data.extract };
    },
  } as ToolDef<{ title: string; lang: string }>,
  {
    tool: "hackernews",
    method: "top",
    outputType: "HNStory[]",
    params: z.object({ limit: clampInt(1, 15, 5) }),
    describe: (p) => `limit: ${p.limit ?? 5}`,
    run: async (p, ctx) => {
      const limit = p.limit ?? 5;
      const ids = (await getJSON(
        "https://hacker-news.firebaseio.com/v0/topstories.json",
        ctx,
      )) as number[];
      const top = ids.slice(0, limit);
      const stories = await Promise.all(
        top.map((id) =>
          getJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, ctx) as Promise<{
            title: string;
            url?: string;
            score: number;
            by: string;
          }>,
        ),
      );
      return stories.map((s) => ({ title: s.title, url: s.url ?? null, score: s.score, by: s.by }));
    },
  } as ToolDef<{ limit: number }>,
  {
    tool: "datetime",
    method: "now",
    outputType: "DateTime",
    params: z.object({}),
    describe: () => "now()",
    run: async () => {
      const now = new Date();
      const day = now.getDay();
      return {
        iso: now.toISOString(),
        weekday: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][day],
        isWeekend: day === 0 || day === 6,
      };
    },
  } as ToolDef<Record<string, never>>,
  {
    tool: "datetime",
    method: "add",
    outputType: "DateTime",
    params: z.object({ iso: z.string().optional(), days: z.number().default(1) }),
    describe: (p) => `+${p.days ?? 1}d`,
    run: async (p) => {
      const base = p.iso ? new Date(p.iso) : new Date();
      base.setDate(base.getDate() + (p.days ?? 1));
      const day = base.getDay();
      return {
        iso: base.toISOString(),
        weekday: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][day],
        isWeekend: day === 0 || day === 6,
      };
    },
  } as ToolDef<{ iso?: string; days: number }>,
  {
    tool: "math",
    method: "eval",
    outputType: "Number",
    params: z.object({ expr: z.string() }),
    describe: (p) => p.expr,
    run: async (p) => ({ expr: p.expr, value: safeEval(p.expr) }),
  } as ToolDef<{ expr: string }>,
  {
    tool: "text",
    method: "transform",
    outputType: "Text",
    params: z.object({
      text: z.string(),
      op: z
        .enum(["upper", "lower", "trim", "summarize", "bulletize", "count"])
        .default("summarize")
        .catch("summarize"),
    }),
    describe: (p) => `op: ${p.op ?? "summarize"}`,
    run: async (p) => {
      const op = p.op ?? "summarize";
      const t = p.text ?? "";
      switch (op) {
        case "upper":
          return { result: t.toLocaleUpperCase("tr-TR") };
        case "lower":
          return { result: t.toLocaleLowerCase("tr-TR") };
        case "trim":
          return { result: t.trim() };
        case "count":
          return { words: t.trim().split(/\s+/).filter(Boolean).length, chars: t.length };
        case "bulletize":
          return {
            bullets: t
              .split(/[.!?\n]+/)
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 5),
          };
        case "summarize":
        default:
          return { summary: firstSentence(t), method: "heuristic:first-sentence" };
      }
    },
  } as ToolDef<{ text: string; op: "upper" | "lower" | "trim" | "summarize" | "bulletize" | "count" }>,
  {
    tool: "email",
    method: "draft",
    outputType: "EmailDraft",
    dryRun: true,
    params: z.object({
      to: z.string().default("me"),
      subject: z.string().default("PROSE özeti"),
      body: z.string().default(""),
    }),
    describe: (p) => `to: ${p.to ?? "me"} · "${p.subject}"`,
    run: async (p) => ({
      drafted: true,
      sent: false,
      dryRun: true,
      to: p.to ?? "me",
      subject: p.subject,
      body: p.body,
    }),
  } as ToolDef<{ to: string; subject: string; body: string }>,
  {
    tool: "calendar",
    method: "reminder",
    outputType: "Reminder",
    dryRun: true,
    params: z.object({
      title: z.string().default("PROSE hatırlatıcı"),
      when: z.string().default("monday 09:00"),
    }),
    describe: (p) => `"${p.title}" @ ${p.when ?? "monday 09:00"}`,
    run: async (p) => ({
      scheduled: false,
      dryRun: true,
      title: p.title,
      when: p.when ?? "monday 09:00",
    }),
  } as ToolDef<{ title: string; when: string }>,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY = new Map<string, ToolDef<any>>();
for (const t of TOOLS) REGISTRY.set(`${t.tool}.${t.method}`, t);

export function getTool(
  tool: string,
  method: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ToolDef<any> | undefined {
  return REGISTRY.get(`${tool}.${method}`);
}

export function listTools(): { key: string; outputType: string; dryRun: boolean }[] {
  return TOOLS.map((t) => ({
    key: `${t.tool}.${t.method}`,
    outputType: t.outputType,
    dryRun: !!t.dryRun,
  }));
}
