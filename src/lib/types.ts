export type DeviceType =
  | "router"
  | "firewall"
  | "switch"
  | "ap"
  | "server"
  | "kvm"
  | "power"
  | "patch"
  | "accessory";

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
  /** Reference to a port template's `name` — defines the device's port list */
  portTemplate?: string;
  /** File name (or origin) the device was imported from */
  source: string;
  importedAt: number;
}

/**
 * Named list of port names a device can offer. Defined only via JSON import.
 * Entries in `ports` may contain `{start-end}` range patterns, expanded by
 * `expandPorts` in `ports.ts` (e.g. "G1/0/{1-48}", "M{1-2}_P{1-24}").
 */
export interface PortTemplate {
  /** Unique reference name devices point at via `Device.portTemplate` */
  name: string;
  ports: string[];
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

/** A single VLAN sub-connection on a trunk port, with optional SVI IPs for L3 routing. */
export interface VlanSubConnection {
  vlanId: number;
  /** CIDR IP on the source device's SVI for this VLAN, e.g. "10.10.0.2/24" */
  srcIp?: string;
  /** CIDR IP on the destination device's SVI for this VLAN, e.g. "10.10.0.1/24" */
  dstIp?: string;
  /** Optional free-text note describing what this VLAN is for. */
  notes?: string;
}

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
  /** VLAN trunk sub-connections — each carries a tagged VLAN ID with optional SVI IPs. */
  vlans?: VlanSubConnection[];
  /** Shared ID grouping this connection into a multi-link bundle (e.g. LACP port-channel). */
  bundleId?: string;
  /** Bundle aggregation protocol, e.g. "802.3ad", "active-passive", "balance-rr", or custom. */
  bundleProtocol?: string;
}

export const TYPE_META: Record<DeviceType, { label: string; color: string }> = {
  router: { label: "Router", color: "#38BDF8" },
  firewall: { label: "Firewall", color: "#FB7185" },
  switch: { label: "Switch", color: "#2DD4BF" },
  ap: { label: "Access point", color: "#FBBF24" },
  server: { label: "Server", color: "#A78BFA" },
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
];
