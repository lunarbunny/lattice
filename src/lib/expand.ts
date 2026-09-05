/**
 * Expand `{start-end}` range patterns in a string.
 *
 * - "G1/0/{1-48}"  → G1/0/1 … G1/0/48
 * - "eth{01-04}"   → eth01 … eth04 (zero-padded only when the start is)
 * - "M{1-2}_P{1-3}"→ cross product: M1_P1, M1_P2, … M2_P3
 * - "10.0.{1-4}.1" → 10.0.1.1 … 10.0.4.1
 * - "mgmt0"        → ["mgmt0"] (no pattern)
 *
 * Malformed ranges (reversed, non-numeric, huge) fall back to the literal text.
 */
export function expandRange(spec: string): string[] {
  const pattern = /\{(\d+)-(\d+)\}/;
  const match = spec.match(pattern);
  if (!match) return [spec];

  const [token, rawStart, rawEnd] = match;
  const start = parseInt(rawStart, 10);
  const end = parseInt(rawEnd, 10);
  if (end < start || end - start > 4096) return [spec];

  const width = rawStart.startsWith("0") ? Math.max(rawStart.length, rawEnd.length) : 0;
  const results: string[] = [];
  for (let n = start; n <= end; n++) {
    const num = width > 0 ? String(n).padStart(width, "0") : String(n);
    results.push(...expandRange(spec.replace(token, num)));
  }
  return results;
}

/** Expand all entries of a list into concrete values. */
export function expandAll(items: string[]): string[] {
  return items.flatMap(expandRange);
}
