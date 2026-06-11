import { graphChecksum } from "@/lib/checksum";
import type { Clause, Predicate, TaskEdge, TaskGraph, TaskNode } from "@/lib/schema";
import { getTool } from "@/lib/tools";
import { CompileError, type Provider } from "./types";

/**
 * Deterministic intent compiler. No LLM, no key, no randomness, no clock —
 * the same sentence always compiles to the same plan (so the checksum is stable).
 *
 * It recognizes a small grammar of agent steps (sources, transforms, actions)
 * in reading order, chains their data flow, and lifts conditions into branch
 * predicates / verify gates. It is intentionally explainable: a senior engineer
 * can read this file and predict the graph for any of the showcase intents.
 */

const tr = (s: string) => s.toLocaleLowerCase("tr-TR");

interface Builder {
  nodes: TaskNode[];
  edges: TaskEdge[];
  clauses: Clause[];
  seamSeq: number;
  nodeSeq: number;
}

function nextSeam(b: Builder): string {
  b.seamSeq += 1;
  return b.seamSeq.toString().padStart(2, "0");
}

function addClause(b: Builder, kind: Clause["kind"], label: string, value: string): string {
  const seamId = nextSeam(b);
  b.clauses.push({ seamId, kind, label, value });
  return seamId;
}

function addNode(
  b: Builder,
  seamId: string,
  tool: string,
  method: string,
  params: Record<string, unknown>,
  opts: { inputs?: string[]; verify?: Predicate; branch?: Predicate } = {},
): TaskNode {
  const def = getTool(tool, method);
  if (!def) throw new CompileError(`Bilinmeyen araç: ${tool}.${method}`);
  b.nodeSeq += 1;
  const node: TaskNode = {
    id: `n${b.nodeSeq}`,
    seamId,
    tool,
    method,
    title: `${tool}.${method}`,
    params,
    inputs: opts.inputs ?? [],
    outputType: def.outputType,
    verify: opts.verify,
    branch: opts.branch,
    dryRun: !!def.dryRun,
  };
  b.nodes.push(node);
  for (const from of node.inputs) {
    b.edges.push({
      id: `e${b.edges.length + 1}`,
      from,
      to: node.id,
      kind: "data",
      verify: false,
    });
  }
  return node;
}

/* ── extractors ── */

const KNOWN_PLACES = [
  "bursa", "istanbul", "ankara", "izmir", "antalya", "konya", "adana", "gaziantep",
  "trabzon", "samsun", "eskişehir", "kayseri", "mersin", "diyarbakır", "london",
  "berlin", "paris", "new york", "tokyo", "amsterdam",
];

function extractPlace(text: string): string | undefined {
  const low = tr(text);
  for (const p of KNOWN_PLACES) if (low.includes(p)) return p[0].toLocaleUpperCase("tr-TR") + p.slice(1);
  // Turkish locative: "X'da / X'de / X'ta / X'te"
  const m = text.match(/([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)['’]?(?:da|de|ta|te)\b/);
  if (m) return m[1];
  return undefined;
}

function extractQuoted(text: string): string | undefined {
  const m = text.match(/["“”']([^"“”']{2,})["“”']/);
  return m ? m[1] : undefined;
}

function extractNumber(text: string, fallback: number): number {
  const m = text.match(/\b(\d{1,2})\b/);
  return m ? parseInt(m[1], 10) : fallback;
}

/* ── condition detection ── */

function detectRainCondition(text: string): boolean {
  const low = tr(text);
  return /(yağmur|rain|yağış)/.test(low) && /(ysa|yse|varsa|ise|olursa|if )/.test(low);
}

function detectWeekendCondition(text: string): boolean {
  const low = tr(text);
  return /(hafta\s?sonu|weekend|cumartesi|pazar)/.test(low);
}

/* ── the compiler ── */

export function compileMock(source: string): TaskGraph {
  const raw = source.trim();
  if (!raw) throw new CompileError("Boş niyet — bir cümle yazın.");

  const low = tr(raw);
  const b: Builder = { nodes: [], edges: [], clauses: [], seamSeq: 0, nodeSeq: 0 };

  // Track the most recent "producer" node so later steps can consume its output.
  let lastProducer: TaskNode | undefined;

  /* ── 1. SOURCES ── */

  // weather
  if (/(hava|weather|yağmur|rain|sıcaklık|temperature)/.test(low)) {
    const place = extractPlace(raw) ?? "İstanbul";
    const seam = addClause(b, "source", "SOURCE", `hava · ${place}`);
    // note: avoid matching "bugün" (the "gün" substring) — require explicit forecast words
    const method = /(tahmin|forecast|haftalık|önümüzdeki|sonraki\s*\d|\d\s*günlük)/.test(low)
      ? "forecast"
      : "current";
    const params: Record<string, unknown> = { place };
    if (method === "forecast") params.days = extractNumber(raw, 3);
    lastProducer = addNode(b, seam, "weather", method, params);
  }

  // hacker news
  if (/(hacker\s?news|hn\b|başlık|haber|story|stories)/.test(low)) {
    const seam = addClause(b, "source", "SOURCE", "hacker news");
    const limit = extractNumber(raw, 5);
    lastProducer = addNode(b, seam, "hackernews", "top", { limit });
  }

  // wikipedia
  if (/(wikipedia|wiki|ansiklopedi)/.test(low)) {
    const title = extractQuoted(raw) ?? raw.replace(/.*wikipedia['’]?d[ae]\s*/i, "").split(/[.;]/)[0].trim();
    const seam = addClause(b, "source", "SOURCE", `wiki · ${title}`);
    lastProducer = addNode(b, seam, "wikipedia", "summary", {
      title: title || "transformer (machine learning)",
      lang: /[ığüşöç]/.test(title) || !/[a-z]/.test(title) ? "tr" : "en",
    });
  }

  // math
  // capture full arithmetic incl. parentheses, e.g. "12 * (3 + 4)"
  const mathExpr = raw.match(/[\d(][\d\s+\-*/%().]*[-+*/%][\d\s+\-*/%().]*[\d)]/);
  if (mathExpr && /(hesapla|kaç|topla|çarp|calculate|sum|=|\?)/.test(low)) {
    const seam = addClause(b, "source", "COMPUTE", mathExpr[0].trim());
    lastProducer = addNode(b, seam, "math", "eval", { expr: mathExpr[0].trim() });
  }

  // currency / exchange rate
  if (
    /(dolar|euro|sterlin|kur|döviz|currency|exchange|usd|eur|gbp|chf|\btl\b|lira)/.test(low) &&
    /(kaç|çevir|convert|ne kadar|fiyat|rate|eder|karşılığ)/.test(low)
  ) {
    const CUR: Record<string, string> = {
      dolar: "USD", usd: "USD", euro: "EUR", eur: "EUR", sterlin: "GBP", pound: "GBP",
      gbp: "GBP", lira: "TRY", "tl": "TRY", "try": "TRY", frank: "CHF", chf: "CHF",
      yen: "JPY", jpy: "JPY",
    };
    const found: string[] = [];
    for (const [word, code] of Object.entries(CUR)) {
      if (new RegExp(`\\b${word}\\b`).test(low) && !found.includes(code)) found.push(code);
    }
    const from = found[0] ?? "USD";
    const to = found[1] ?? (from === "TRY" ? "USD" : "TRY");
    const amountM = raw.match(/\b(\d{1,9})\b/);
    const amount = amountM ? parseInt(amountM[1], 10) : 1;
    const seam = addClause(b, "source", "CURRENCY", `${amount} ${from}→${to}`);
    lastProducer = addNode(b, seam, "currency", "convert", { from, to, amount });
  }

  // public holidays
  if (/(resmi tatil|tatil|bayram|public holiday|\bholiday)/.test(low)) {
    const yearM = raw.match(/\b(20\d{2})\b/);
    const year = yearM ? parseInt(yearM[1], 10) : undefined;
    let country = "TR";
    if (/(amerika|abd|usa|united states)/.test(low)) country = "US";
    else if (/(almanya|germany)/.test(low)) country = "DE";
    else if (/(ingiltere|birleşik krallık|\buk\b|britain)/.test(low)) country = "GB";
    else if (/(fransa|france)/.test(low)) country = "FR";
    const seam = addClause(b, "source", "HOLIDAYS", `${country}${year ? " · " + year : ""}`);
    lastProducer = addNode(
      b,
      seam,
      "holidays",
      "list",
      year !== undefined ? { country, year } : { country },
    );
  }

  // datetime (calendar-like trigger) — only as a fallback when nothing else matched
  if (!lastProducer && /(takvim|calendar|cumartesi|pazartesi|hafta\s?sonu|bugün|tarih|date|saat)/.test(low)) {
    const seam = addClause(b, "trigger", "TRIGGER", "zaman / takvim");
    lastProducer = addNode(b, seam, "datetime", "now", {});
  }

  /* ── 2. TRANSFORMS ── */

  // aggregate over a previous array-producing step (mock: focused on HN scores)
  if (
    lastProducer &&
    lastProducer.tool === "hackernews" &&
    /(ortalama|average|topla|toplam|\bsum\b|en yüksek|en düşük|maksimum|minimum|medyan|median|kaç tane|adet)/.test(low)
  ) {
    let op = "mean";
    if (/(topla|toplam|\bsum\b)/.test(low)) op = "sum";
    else if (/(en yüksek|maksimum|\bmax\b|en fazla)/.test(low)) op = "max";
    else if (/(en düşük|minimum|\bmin\b|en az)/.test(low)) op = "min";
    else if (/(medyan|median)/.test(low)) op = "median";
    else if (/(kaç tane|adet)/.test(low)) op = "count";
    const prevId = lastProducer.id;
    const seam = addClause(b, "transform", "AGGREGATE", `${op}(score)`);
    lastProducer = addNode(
      b,
      seam,
      "aggregate",
      "compute",
      { items: `$${prevId}`, field: "score", op },
      { inputs: [prevId] },
    );
  }

  const wantsSummary = /(özet|summar|tek cümle|kısalt|madde|bullet|indir)/.test(low);
  if (wantsSummary && lastProducer) {
    const op = /(madde|bullet|indir)/.test(low) ? "bulletize" : "summarize";
    const seam = addClause(b, "transform", "TRANSFORM", op === "bulletize" ? "maddele" : "özetle");
    // reference the producer's most useful text field
    const ref =
      lastProducer.tool === "wikipedia"
        ? `$${lastProducer.id}.extract`
        : `$${lastProducer.id}`;
    lastProducer = addNode(b, seam, "text", "transform", { text: ref, op }, {
      inputs: [lastProducer.id],
    });
  }

  /* ── 3. CONDITIONS (lift into a branch predicate for the action) ── */

  let branch: Predicate | undefined;
  let gateFrom: TaskNode | undefined;
  if (detectRainCondition(raw)) {
    const weatherNode = b.nodes.find((n) => n.tool === "weather");
    if (weatherNode) {
      branch = { field: "isRaining", op: "truthy", label: "yağmurluysa" };
      gateFrom = weatherNode;
      addClause(b, "condition", "COND", "yağmurluysa");
    }
  } else if (detectWeekendCondition(raw) && b.nodes.some((n) => n.tool === "datetime")) {
    const dt = b.nodes.find((n) => n.tool === "datetime");
    if (dt) {
      branch = { field: "isWeekend", op: "truthy", label: "hafta sonuysa" };
      gateFrom = dt;
      addClause(b, "condition", "COND", "hafta sonuysa");
    }
  }

  /* ── 4. ACTIONS ── */

  const wantsEmail = /(e-?posta|e-?mail|mail|gönder|ilet|taslağ|draft)/.test(low) && !/hatırlat/.test(low);
  const wantsReminder = /(hatırlat|reminder|uyar|alarm)/.test(low);

  if (wantsReminder) {
    const seam = addClause(b, "action", "ACTION", "hatırlatıcı (dry-run)");
    const inputs = gateFrom ? [gateFrom.id] : lastProducer ? [lastProducer.id] : [];
    const node = addNode(
      b,
      seam,
      "calendar",
      "reminder",
      { title: titleFrom(raw), when: extractWhen(raw) },
      { inputs, branch },
    );
    markBranchEdge(b, gateFrom ?? lastProducer, node, branch);
    lastProducer = node;
  } else if (wantsEmail) {
    const seam = addClause(b, "action", "ACTION", "e-posta taslağı (dry-run)");
    const bodyRef = lastProducer ? `$${lastProducer.id}` : "";
    const inputs = lastProducer ? [lastProducer.id] : [];
    const node = addNode(
      b,
      seam,
      "email",
      "draft",
      { to: "me", subject: subjectFrom(raw), body: bodyRef },
      { inputs, branch: gateFrom && lastProducer === gateFrom ? branch : undefined },
    );
    if (branch && gateFrom) markBranchEdge(b, gateFrom, node, branch);
    lastProducer = node;
  } else if (branch && gateFrom) {
    // a bare condition with no explicit action -> a verify gate proving the condition
    const seam = addClause(b, "action", "VERIFY", branch.label ?? "koşul");
    const node = addNode(b, seam, "calendar", "reminder", {
      title: branch.label ?? "koşul sağlandı",
      when: extractWhen(raw),
    }, { inputs: [gateFrom.id], branch });
    markBranchEdge(b, gateFrom, node, branch);
  }

  /* ── 5. add a verify gate on the last action when there was a condition ── */
  if (branch && gateFrom) {
    const lastAction = b.nodes[b.nodes.length - 1];
    if (lastAction && lastAction.id !== gateFrom.id) {
      lastAction.verify = { field: "dryRun", op: "exists", label: "dry-run doğrulandı" };
    }
  }

  if (b.nodes.length === 0) {
    throw new CompileError(
      "Bu niyeti derleyemedim. Hava, Hacker News, Wikipedia, hesap, özet, e-posta veya hatırlatıcı içeren bir cümle deneyin.",
    );
  }

  return finalize(b, raw, "mock");
}

/* ── helpers ── */

function markBranchEdge(
  b: Builder,
  from: TaskNode | undefined,
  to: TaskNode,
  branch: Predicate | undefined,
) {
  if (!from || !branch) return;
  // upgrade the data edge from->to into a labelled branch edge with a verify gate
  const edge = b.edges.find((e) => e.from === from.id && e.to === to.id);
  if (edge) {
    edge.kind = "branch";
    edge.label = branch.label;
    edge.verify = true;
  } else {
    b.edges.push({
      id: `e${b.edges.length + 1}`,
      from: from.id,
      to: to.id,
      kind: "branch",
      label: branch.label,
      verify: true,
    });
  }
}

function titleFrom(raw: string): string {
  if (/(yağmur|rain)/.test(tr(raw))) return "Yağmur uyarısı";
  if (/(hafta\s?sonu|weekend)/.test(tr(raw))) return "Hafta sonu özeti";
  return "PROSE hatırlatıcı";
}

function subjectFrom(raw: string): string {
  const low = tr(raw);
  if (low.includes("hacker")) return "Hacker News · ilk başlıklar";
  if (low.includes("wiki")) return "Wikipedia özeti";
  return "PROSE özeti";
}

function extractWhen(raw: string): string {
  const low = tr(raw);
  if (/pazartesi/.test(low)) return "pazartesi 09:00";
  if (/(sabah|morning)/.test(low)) return "yarın 09:00";
  if (/(bugün|today)/.test(low)) return "bugün";
  return "pazartesi 09:00";
}

export function finalize(b: Builder, source: string, compiledBy: string): TaskGraph {
  const core = {
    source,
    nodes: b.nodes.map((n) => ({ ...n, dryRun: n.dryRun })),
    edges: b.edges,
  };
  const sum = graphChecksum(core);
  return {
    source,
    clauses: b.clauses,
    nodes: b.nodes,
    edges: b.edges,
    checksum: sum.id,
    ticks: sum.ticks,
    compiledBy,
  };
}

export const mockProvider: Provider = {
  name: "mock",
  keyless: true,
  compile: async (source: string) => compileMock(source),
};
