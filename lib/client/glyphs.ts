import type { StepStatus } from "@/lib/schema";

/** Status is typography, never icons. Glyph + token color per step status. */
export const STATUS_GLYPH: Record<StepStatus, string> = {
  pending: "◇",
  running: "▷",
  ok: "✓",
  error: "✗",
  retry: "⟳",
  skip: "⊘",
  gate: "◷",
};

export const STATUS_COLOR: Record<StepStatus, string> = {
  pending: "var(--ink-muted)",
  running: "var(--accent-signal)",
  ok: "var(--state-ok)",
  error: "var(--state-err)",
  retry: "var(--state-warn)",
  skip: "var(--state-warn)",
  gate: "var(--state-warn)",
};

export const STATUS_LABEL: Record<StepStatus, string> = {
  pending: "bekliyor",
  running: "çalışıyor",
  ok: "tamam",
  error: "hata",
  retry: "yeniden",
  skip: "atlandı",
  gate: "geçit",
};
