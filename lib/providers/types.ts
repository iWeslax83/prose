import type { TaskGraph } from "@/lib/schema";

/**
 * A Provider turns one natural-language intent into a typed TaskGraph.
 * The Mock provider is deterministic and key-free; hosted adapters prompt an
 * LLM for a JSON graph constrained to the same schema and fall back to Mock.
 */
export interface Provider {
  name: string;
  /** true when the provider needs no API key (the Mock). */
  keyless: boolean;
  compile(source: string): Promise<TaskGraph>;
}

export class CompileError extends Error {
  constructor(
    message: string,
    /** seam-id / clause value the error points at, for the ✗ underline */
    public readonly atValue?: string,
  ) {
    super(message);
    this.name = "CompileError";
  }
}
