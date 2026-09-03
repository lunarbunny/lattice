import type { Device, PortTemplate } from "./types";

/**
 * Expand `{start-end}` range patterns in a port spec entry.
 *
 * - "G1/0/{1-48}"  → G1/0/1 … G1/0/48
 * - "eth{01-04}"   → eth01 … eth04 (zero-padded only when the start is)
 * - "M{1-2}_P{1-3}"→ cross product: M1_P1, M1_P2, … M2_P3
 * - "mgmt0"        → ["mgmt0"] (no pattern)
 *
 * Malformed ranges (reversed, non-numeric, huge) fall back to the literal text.
 */
export function expandPortSpec(spec: string): string[] {
  const pattern = /\{(\d+)-(\d+)\}/;
  const match = spec.match(pattern);
  if (!match) return [spec];

  const [token, rawStart, rawEnd] = match;
  const start = parseInt(rawStart, 10);
  const end = parseInt(rawEnd, 10);
  // Cap expansion so a typo like {1-999999} can't hang the app.
  if (end < start || end - start > 4096) return [spec];

  // Zero-pad only when the start is explicitly padded (e.g. {01-48}); {1-48} stays unpadded.
  const width = rawStart.startsWith("0") ? Math.max(rawStart.length, rawEnd.length) : 0;
  const results: string[] = [];
  for (let n = start; n <= end; n++) {
    const num = width > 0 ? String(n).padStart(width, "0") : String(n);
    results.push(...expandPortSpec(spec.replace(token, num)));
  }
  return results;
}

/** Expand all entries of a template's port list into concrete port names. */
export function expandPorts(ports: string[]): string[] {
  return ports.flatMap(expandPortSpec);
}

/** Expanded port names offered by a device via its port template, if any. */
export function getDevicePorts(device: Device | undefined, templates: PortTemplate[]): string[] {
  if (!device?.portTemplate) return [];
  const template = templates.find((t) => t.name === device.portTemplate);
  return template ? expandPorts(template.ports) : [];
}
