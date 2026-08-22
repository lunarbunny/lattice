export type DeviceType =
  | "router"
  | "firewall"
  | "switch"
  | "ap"
  | "server"
  | "camera"
  | "phone"
  | "printer"
  | "client";

export interface Device {
  id: string;
  name: string;
  /** Normalised CIDR string, e.g. "10.10.1.10/24" */
  ip: string;
  notes: string;
  /** Manufacturer model, e.g. "Oring RGS-P9000" — secondary metadata, shown on hover/inspect */
  model?: string;
  /** Reference to a declared rack's `id` */
  rackId?: string;
  /** U position from the top of the rack (1-based) */
  mountIndex?: number;
  /** Rack units the device occupies, defaults to 1 */
  size: number;
  /** File name (or origin) the device was imported from */
  source: string;
  importedAt: number;
}

export interface RackDecl {
  id: string;
  /** Group / room / department name — racks sharing a name render as one row */
  name: string;
  /** Rack number within the group (string, sorted naturally) */
  number?: string;
  /** Rack height in U */
  units: number;
}

export const TYPE_META: Record<DeviceType, { label: string; color: string }> = {
  router: { label: "Router", color: "#38BDF8" },
  firewall: { label: "Firewall", color: "#FB7185" },
  switch: { label: "Switch", color: "#2DD4BF" },
  ap: { label: "Access point", color: "#FBBF24" },
  server: { label: "Server", color: "#A78BFA" },
  camera: { label: "Camera", color: "#F472B6" },
  phone: { label: "VoIP phone", color: "#4ADE80" },
  printer: { label: "Printer", color: "#F59E0B" },
  client: { label: "Client", color: "#94A3B8" },
};

export const TYPE_ORDER: DeviceType[] = [
  "router",
  "firewall",
  "switch",
  "ap",
  "server",
  "camera",
  "phone",
  "printer",
  "client",
];
