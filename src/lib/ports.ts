import type { Device, PortTemplate } from "./types";
import { expandRange, expandAll } from "./expand";

/** @deprecated Use `expandRange` from `./expand` directly. */
export const expandPortSpec = expandRange;

/** @deprecated Use `expandAll` from `./expand` directly. */
export const expandPorts = expandAll;

/** Expanded port names offered by a device via its port template, if any. */
export function getDevicePorts(device: Device | undefined, templates: PortTemplate[]): string[] {
  if (!device?.portTemplate) return [];
  const template = templates.find((t) => t.name === device.portTemplate);
  return template ? expandPorts(template.ports) : [];
}
