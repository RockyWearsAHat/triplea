/**
 * Simple className composition helper.
 * Supports strings, arrays, and object maps.
 */
export function cx(...args: any[]): string {
  const out: string[] = [];
  for (const a of args) {
    if (!a) continue;
    if (typeof a === "string") {
      out.push(...a.split(" ").filter(Boolean));
    } else if (Array.isArray(a)) {
      out.push(...cx(...a).split(" ").filter(Boolean));
    } else if (typeof a === "object") {
      for (const k in a) {
        if ((a as any)[k]) out.push(k);
      }
    }
  }
  return out.join(" ");
}
