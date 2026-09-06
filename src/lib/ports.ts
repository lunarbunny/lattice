// Port resolution — resolves a device's port list from its named port template.

import type { Device, PortTemplate } from "./types";
import { expandAll } from "./rangeExpand";

/** Expanded port names offered by a device via its port template, if any. */
export function getDevicePorts(device: Device | undefined, templates: PortTemplate[]): string[] {
  if (!device?.portTemplate) return [];
  const template = templates.find((t) => t.name === device.portTemplate);
  return template ? expandAll(template.ports) : [];
}
