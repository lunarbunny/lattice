// Port resolution — resolves a device's port list from its named port template.

import type { Device, PortTemplate } from "./types";
import { expandAll } from "./rangeExpand";

/** Expanded port names offered by a device via its port template, if any. */
export function getDevicePorts(device: Device | undefined, templates: PortTemplate[]): string[] {
  if (!device?.portTemplate) return [];
  const template = templates.find((t) => t.name === device.portTemplate);
  return template ? expandAll(template.ports) : [];
}

/**
 * Compare two port names by the order defined in a device's port template.
 * Falls back to alphanumeric when the device has no template or a port is
 * not found in the template.
 */
export function portOrderComparator(ports: string[]): (a: string, b: string) => number {
  const nat = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
  if (ports.length === 0) return nat;
  const idx = new Map(ports.map((p, i) => [p.toLowerCase(), i]));
  return (a, b) => {
    const ai = idx.get(a.toLowerCase());
    const bi = idx.get(b.toLowerCase());
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    return nat(a, b);
  };
}
