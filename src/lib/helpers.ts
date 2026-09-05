import type { ImportSummary } from "./importer";
import type { Connection, Device, DeviceType, Rack } from "./types";

export const NON_NETWORKED_TYPES: Set<DeviceType> = new Set(["power", "accessory", "patch"]);

export type DeviceLinkState = "connected" | "unlinked" | "none";

/**
 * Link state for the status dot in rack/network views.
 * - "connected" — device participates in at least one connection
 * - "unlinked" — network-capable but no connections
 * - "none" — non-networked types (power, accessory, patch)
 */
export function getDeviceLinkState(device: Device, connections: Connection[], type: DeviceType): DeviceLinkState {
  if (NON_NETWORKED_TYPES.has(type)) return "none";
  const name = device.name.toLowerCase();
  const linked = connections.some(
    (c) => c.srcDevice.toLowerCase() === name || c.dstDevice.toLowerCase() === name
  );
  return linked ? "connected" : "unlinked";
}

/**
 * Build a sublabel for a device in network/rack views.
 * - Non-networked types (power, accessory, patch) → ""
 * - Network-capable with a primary IP → the IP
 * - Network-capable with connections but no IP → ""
 * - Network-capable without connections → "no link"
 */
export function getDeviceSublabel(device: Device, connections: Connection[], type: DeviceType): string {
  if (NON_NETWORKED_TYPES.has(type)) return "";
  const ip = getPrimaryIp(device, connections);
  if (ip) return ip;
  return getDeviceLinkState(device, connections, type) === "connected" ? "" : "no link";
}

/** Increment a trailing number in a name, preserving zero-padding (e.g. "eth0" → "eth1", "G1/0/9" → "G1/0/10"). */
export function incrementTrailingNumber(name: string): string {
  const match = name.match(/^(.*?)(\d+)$/);
  if (!match) return name;
  const num = parseInt(match[2], 10) + 1;
  return match[1] + String(num).padStart(match[2].length, "0");
}

export function notifyImport(
  res: { error?: string; summary?: ImportSummary },
  push: (kind: "success" | "warning" | "error", title: string, detail?: string) => void,
  label: string
) {
  if (res.error || !res.summary) {
    push("error", `Import failed — ${label}`, res.error ?? "Unknown error");
    return;
  }
  const s = res.summary;
  const bits: string[] = [];
  if (s.duplicates > 0) bits.push(`${s.duplicates} duplicate${s.duplicates === 1 ? "" : "s"} skipped`);
  if (s.invalid.length > 0) bits.push(`${s.invalid.length} invalid entr${s.invalid.length === 1 ? "y" : "ies"}`);
  if (s.warnings.length > 0) bits.push(`${s.warnings.length} warning${s.warnings.length === 1 ? "" : "s"}`);
  const detail = bits.length > 0 ? bits.join(" · ") : undefined;
  const templateBit =
    s.templatesAdded.length > 0
      ? ` and ${s.templatesAdded.length} port template${s.templatesAdded.length === 1 ? "" : "s"}`
      : "";
  if (s.added.length > 0) {
    const rackBit =
      s.racksAdded.length > 0
        ? ` and ${s.racksAdded.length} rack${s.racksAdded.length === 1 ? "" : "s"}`
        : "";
    const connBit =
      s.connectionsAdded.length > 0
        ? ` and ${s.connectionsAdded.length} connection${s.connectionsAdded.length === 1 ? "" : "s"}`
        : "";
    push(
      "success",
      `Imported ${s.added.length} device${s.added.length === 1 ? "" : "s"}${rackBit}${templateBit}${connBit} from ${label}`,
      detail
    );
  } else if (s.racksAdded.length > 0) {
    push(
      "success",
      `Registered ${s.racksAdded.length} rack${s.racksAdded.length === 1 ? "" : "s"}${templateBit} from ${label}`,
      detail
    );
  } else if (s.templatesAdded.length > 0) {
    push(
      "success",
      `Registered ${s.templatesAdded.length} port template${s.templatesAdded.length === 1 ? "" : "s"} from ${label}`,
      detail
    );
  } else if (s.duplicates > 0) {
    push("warning", `Nothing new from ${label}`, "Every device was already in the registry.");
  } else {
    push("warning", `No devices imported from ${label}`, detail);
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** dd/MMM/yyyy, e.g. "22 Aug 2026" */
export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/**
 * Get the IP address for a device on a specific connection.
 * Returns the IP on the device's side, or undefined if none.
 */
export function getConnectionIp(device: Device, conn: Connection): string | undefined {
  const name = device.name.toLowerCase();
  if (conn.srcDevice.toLowerCase() === name) return conn.srcIp;
  if (conn.dstDevice.toLowerCase() === name) return conn.dstIp;
  return undefined;
}

/**
 * Resolve a device's primary IP from its connections.
 * 1. Find connections where the device has an IP
 * 2. If any has isPrimary = true on the device's side, return that IP
 * 3. Otherwise return the first connection's IP on the device's side
 * 4. Return undefined if no connections have IPs for this device
 */
export function getPrimaryIp(device: Device, connections: Connection[]): string | undefined {
  const name = device.name.toLowerCase();
  const deviceConns = connections.filter(
    (c) => c.srcDevice.toLowerCase() === name || c.dstDevice.toLowerCase() === name
  );

  // Collect connections with IPs on the device's side
  const withIp: { ip: string; isPrimary: boolean }[] = [];
  for (const c of deviceConns) {
    const isSrc = c.srcDevice.toLowerCase() === name;
    const ip = isSrc ? c.srcIp : c.dstIp;
    const isPrimary = isSrc ? c.srcIsPrimary === true : c.dstIsPrimary === true;
    if (ip) withIp.push({ ip, isPrimary });
  }

  if (withIp.length === 0) return undefined;

  // Prefer explicitly marked primary
  const primary = withIp.find((x) => x.isPrimary);
  if (primary) return primary.ip;

  // Fall back to first connection with an IP
  return withIp[0].ip;
}

/**
 * Get all IPs for a device from its connections.
 */
export function getDeviceIps(device: Device, connections: Connection[]): string[] {
  const name = device.name.toLowerCase();
  const ips: string[] = [];
  for (const c of connections) {
    if (c.srcDevice.toLowerCase() === name && c.srcIp) ips.push(c.srcIp);
    if (c.dstDevice.toLowerCase() === name && c.dstIp) ips.push(c.dstIp);
  }
  return ips;
}

export function findNextRackSlot(
  rack: Rack,
  devices: Device[],
  mountIndex: number,
  size: number,
  rackUOrder: "top" | "bottom",
): number | null {
  const occupied = new Set<number>();
  for (const dev of devices) {
    if (dev.rackId !== rack.id || !dev.mountIndex) continue;
    for (let u = dev.mountIndex; u < dev.mountIndex + dev.size; u++) occupied.add(u);
  }

  const trySlot = (u: number): number | null => {
    for (let k = 0; k < size; k++) {
      if (occupied.has(u + k)) return null;
    }
    return u + size - 1 <= rack.units ? u : null;
  };

  if (rackUOrder === "bottom") {
    for (let u = mountIndex - 1; u >= 1; u--) {
      const result = trySlot(u);
      if (result !== null) return result;
    }
    for (let u = mountIndex + size; u + size - 1 <= rack.units; u++) {
      const result = trySlot(u);
      if (result !== null) return result;
    }
  } else {
    for (let u = mountIndex + size; u + size - 1 <= rack.units; u++) {
      const result = trySlot(u);
      if (result !== null) return result;
    }
    for (let u = mountIndex - 1; u >= 1; u--) {
      const result = trySlot(u);
      if (result !== null) return result;
    }
  }
  return null;
}
