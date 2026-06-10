import type { Predicate } from "@/lib/schema";

/** Read a dotted path from a value. "" or "." returns the whole value. */
export function getField(value: unknown, path: string): unknown {
  if (!path || path === ".") return value;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, value);
}

export function evalPredicate(output: unknown, pred: Predicate): boolean {
  const target = getField(output, pred.field);
  switch (pred.op) {
    case "exists":
      return target !== undefined && target !== null;
    case "truthy":
      return Boolean(target);
    case "equals":
      return target === pred.value;
    case "gt":
      return typeof target === "number" && target > Number(pred.value);
    case "lt":
      return typeof target === "number" && target < Number(pred.value);
    case "contains":
      if (Array.isArray(target)) return target.includes(pred.value);
      if (typeof target === "string") return target.includes(String(pred.value));
      return false;
    default:
      return false;
  }
}
