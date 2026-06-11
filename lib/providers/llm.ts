import { listTools } from "@/lib/tools";
import { assembleFromSteps, type PlanStep } from "./assemble";
import { compileMock } from "./mock";
import type { Provider } from "./types";

/**
 * LLM-backed compiler. The model returns a JSON step list (not a full graph);
 * assembleFromSteps owns ids/edges/typing/checksum. Any failure falls back to
 * the deterministic mock compiler, so the app is never key-dependent to work.
 */

function systemPrompt(): string {
  const tools = listTools()
    .map((t) => `  - ${t.key} -> ${t.outputType}${t.dryRun ? " (dry-run side-effect)" : ""}`)
    .join("\n");
  return `You compile a single natural-language INTENT (often Turkish) into a PROSE plan:
an ordered list of typed tool steps that an agent executes.

Available tools (tool.method -> OutputType):
${tools}

Return STRICT JSON only, no prose, of shape:
{"steps":[{"tool":"weather","method":"current","params":{"place":"Bursa"},
  "consumesPrevious":false,"kind":"source",
  "condition":{"field":"isRaining","op":"truthy","label":"yağmurluysa"}}]}

Rules:
- Use ONLY the tools listed. Pick the smallest correct pipeline.
- "consumesPrevious":true feeds the previous step's output into this step.
- Put a "condition" on a step when it should only run if a predicate over the
  previous step's output holds. op is one of exists|truthy|equals|gt|lt|contains.
- kind is one of trigger|source|condition|action|transform.
- Side-effect tools (email.draft, calendar.reminder) are dry-run; prefer them for "send/remind".
- Every required param must be present with a CONCRETE literal value. Param shapes:
  weather {place}; weather.forecast {place,days}; hackernews {limit}; wikipedia {title,lang};
  currency.convert {from,to,amount} (ISO codes e.g. USD,TRY,EUR); holidays.list {country,year} (e.g. TR,US);
  text.transform {text,op:"summarize"|"bulletize"|"upper"|"lower"}; email.draft {subject,body}; calendar.reminder {title,when}.
- math.eval needs a LITERAL arithmetic string in {expr}, e.g. {"expr":"12*(3+4)"}. NEVER use math to
  operate on another step's output and never leave expr empty — if there is no literal arithmetic, omit math entirely.`;
}

interface LLMConfig {
  name: string;
  endpoint: string;
  model: string;
  apiKey?: string;
  flavor: "openai" | "gemini";
}

async function callOpenAICompatible(cfg: LLMConfig, source: string): Promise<string> {
  const res = await fetch(cfg.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: source },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${cfg.name} HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${cfg.name}: empty response`);
  return content;
}

async function callGemini(cfg: LLMConfig, source: string): Promise<string> {
  const res = await fetch(`${cfg.endpoint}?key=${cfg.apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt() }] },
      contents: [{ role: "user", parts: [{ text: source }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Gemini: empty response");
  return content;
}

function parseSteps(content: string): PlanStep[] {
  // tolerate code fences / stray text around the JSON object
  const match = content.match(/\{[\s\S]*\}/);
  const json = JSON.parse(match ? match[0] : content) as { steps?: PlanStep[] };
  if (!json.steps || !Array.isArray(json.steps) || json.steps.length === 0) {
    throw new Error("no steps in LLM output");
  }
  return json.steps;
}

export function makeLLMProvider(cfg: LLMConfig): Provider {
  return {
    name: cfg.name,
    keyless: false,
    compile: async (source: string) => {
      try {
        const content =
          cfg.flavor === "gemini"
            ? await callGemini(cfg, source)
            : await callOpenAICompatible(cfg, source);
        const steps = parseSteps(content);
        return assembleFromSteps(source, steps, cfg.name);
      } catch (err) {
        // never fail the request because the model misbehaved — degrade to mock
        console.warn(`[prose] ${cfg.name} compile failed, falling back to mock:`, err);
        return compileMock(source);
      }
    },
  };
}

export function llmConfigFromEnv(provider: string): LLMConfig | undefined {
  switch (provider) {
    case "xai":
    case "grok":
      // xAI Grok — OpenAI-compatible. Keys start with "xai-".
      return {
        name: "grok",
        flavor: "openai",
        endpoint: "https://api.x.ai/v1/chat/completions",
        model: process.env.PROSE_MODEL || "grok-2-1212",
        apiKey:
          process.env.XAI_API_KEY ||
          process.env.GROK_API_KEY ||
          process.env.GROQ_API_KEY,
      };
    case "groq":
      return {
        name: "groq",
        flavor: "openai",
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        model: process.env.PROSE_MODEL || "llama-3.3-70b-versatile",
        apiKey: process.env.GROQ_API_KEY,
      };
    case "openrouter":
      return {
        name: "openrouter",
        flavor: "openai",
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        model: process.env.PROSE_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
        apiKey: process.env.OPENROUTER_API_KEY,
      };
    case "ollama":
      return {
        name: "ollama",
        flavor: "openai",
        endpoint:
          (process.env.OLLAMA_HOST || "http://localhost:11434") + "/v1/chat/completions",
        model: process.env.PROSE_MODEL || "llama3.1",
        apiKey: undefined,
      };
    case "gemini":
      return {
        name: "gemini",
        flavor: "gemini",
        endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${
          process.env.PROSE_MODEL || "gemini-1.5-flash"
        }:generateContent`,
        model: process.env.PROSE_MODEL || "gemini-1.5-flash",
        apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      };
    default:
      return undefined;
  }
}
