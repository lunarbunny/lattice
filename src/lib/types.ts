export type DeviceType =
  | "router"
  | "firewall"
  | "switch"
  | "ap"
  | "server"
  | "kvm"
  | "power"
  | "patch"
  | "accessory"
  | "camera"
  | "phone"
  | "printer";

export interface Device {
  id: string;
  name: string;
  notes: string;
  /** Manufacturer model, e.g. "Oring RGS-P9000" — secondary metadata, shown on hover/inspect */
  model?: string;
  /** Reference to a declared rack's `id` */
  rackId?: string;
  /** U position from the top of the rack (1-based) */
  mountIndex?: number;
  /** Rack units the device occupies, defaults to 1 */
  size: number;
  /** Explicitly marks this device as the gateway for its subnet */
  isGateway?: boolean;
  /** File name (or origin) the device was imported from */
  source: string;
  importedAt: number;
}

export interface Rack {
  id: string;
  /** Group / room / department name — racks sharing a name render as one row */
  name: string;
  /** Rack number within the group (string, sorted naturally) */
  number?: string;
  /** Rack height in U */
  units: number;
}

export type CableMedium = "ethernet" | "fibre";

export interface Connection {
  id: string;
  srcDevice: string;
  dstDevice: string;
  srcPort: string;
  dstPort: string;
  medium: CableMedium;
  /** CIDR IP on the source device's interface, e.g. "10.10.0.2/24" */
  srcIp?: string;
  /** CIDR IP on the destination device's interface, e.g. "10.10.0.1/24" */
  dstIp?: string;
  /** Marks srcIp as the source device's primary IP for subnet grouping */
  srcIsPrimary?: boolean;
  /** Marks dstIp as the destination device's primary IP for subnet grouping */
  dstIsPrimary?: boolean;
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
  kvm: { label: "KVM", color: "#06B6D4" },
  power: { label: "Power", color: "#F97316" },
  patch: { label: "Patch panel", color: "#94A3B8" },
  accessory: { label: "Accessory", color: "#64748B" },
};

export const TYPE_ORDER: DeviceType[] = [
  "router",
  "firewall",
  "switch",
  "ap",
  "server",
  "kvm",
  "power",
  "patch",
  "accessory",
  "camera",
  "phone",
  "printer",
];
