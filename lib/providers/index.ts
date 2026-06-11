import { llmConfigFromEnv, makeLLMProvider } from "./llm";
import { mockProvider } from "./mock";
import type { Provider } from "./types";

export type { Provider } from "./types";
export { CompileError } from "./types";

/**
 * Select a compiler from the environment.
 *   PROSE_PROVIDER = mock | xai(grok) | groq | openrouter | ollama | gemini   (default: mock)
 * If a hosted provider is requested but its key is missing, we transparently use
 * the mock — so a fresh Vercel deploy with no env vars is fully functional.
 */
export function selectProvider(): Provider {
  const requested = (process.env.PROSE_PROVIDER || "mock").toLowerCase();
  if (requested === "mock") return mockProvider;

  const cfg = llmConfigFromEnv(requested);
  if (!cfg) return mockProvider;
  // ollama is keyless (local); the others need a key or we fall back
  if (!cfg.apiKey && cfg.name !== "ollama") return mockProvider;
  return makeLLMProvider(cfg);
}

/** Human-readable label for the status bar, e.g. "mock" or "groq". */
export function providerLabel(): string {
  return selectProvider().name;
}
