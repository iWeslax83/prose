"use client";

/**
 * The determinism fingerprint. A 16-tick punch-card bound to a run hash, rendered
 * identically across composer, status bar, trace, and manifest. Glows verify-cyan
 * on a deterministic replay match; red on drift.
 */
export function ChecksumTape({
  id,
  ticks,
  state = "idle",
  showId = true,
}: {
  id?: string | null;
  ticks?: boolean[];
  state?: "idle" | "match" | "drift";
  showId?: boolean;
}) {
  const cells = ticks ?? new Array(16).fill(false);
  const color =
    state === "match"
      ? "var(--accent-type)"
      : state === "drift"
        ? "var(--state-err)"
        : "var(--accent-signal)";
  return (
    <span className="tape" title={id ?? "checksum"} aria-label={`checksum ${id ?? "yok"}`}>
      <span className="tape-ticks" aria-hidden>
        {cells.map((on, i) => (
          <span
            key={i}
            className="tape-tick"
            style={{ background: on ? color : "var(--rule-hard)" }}
          />
        ))}
      </span>
      {showId && <span className="tape-id tabular">{id ?? "ps:----·--"}</span>}
    </span>
  );
}
