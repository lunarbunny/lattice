import type { Connection, Device, DeviceType, Rack } from "../types";
import type { CidrInfo } from "../cidr";
import { parseCidr } from "../cidr";
import { inferType } from "./topology";
import { NON_NETWORKED_TYPES, getDeviceIps } from "../helpers";
import { resolveRack } from "../importer";

export type SubnetIssueKind =
  | "ip-conflict"
  | "subnet-overlap"
  | "no-gateway"
  | "no-ip"
  | "reserved-address";

export interface SubnetIssue {
  id: string;
  kind: SubnetIssueKind;
  severity: "error" | "warning";
  message: string;
  /** Subnets affected — used for group header badges */
  subnetKeys: string[];
  /** Devices to jump to when the issue is clicked in the issues panel */
  deviceIds: string[];
}

export type SubnetRow =
  | {
      kind: "device";
      device: Device;
      type: DeviceType;
      hostId: number | null;
      ip: string | null;
      location: string;
      issueIds: string[];
    }
  | { kind: "free"; from: number; to: number };

export interface GroupedSubnet {
  /** CIDR key like "10.10.1.0/24", or "unknown" for devices without an IP */
  key: string;
  info: CidrInfo | null;
  gateway: Device | null;
  gatewayExplicit: boolean;
  /** Number of devices placed in this subnet */
  usedCount: number;
  /** Total usable host addresses (0 for the unknown bucket) */
  usable: number;
  rows: SubnetRow[];
}

export interface NetworkView {
  subnets: GroupedSubnet[];
  issues: SubnetIssue[];
}

const UNKNOWN = "unknown";

/** Render a host ID relative to its network, e.g. hostId 20 on a /24 → ".20". */
export function hostLabel(info: CidrInfo, hostId: number): string {
  const bytes = Math.max(1, Math.ceil((32 - info.prefix) / 8));
  const parts: string[] = [];
  for (let i = bytes - 1; i >= 0; i--) parts.push(String((hostId >>> (i * 8)) & 255));
  return "." + parts.join(".");
}

/**
 * Build the subnet address-plan view: devices grouped by their primary IP's
 * subnet, rows interleaved with free address runs, plus factual audits
 * (IP conflicts, overlapping subnets, missing gateways, missing IPs,
 * network/broadcast addresses in use).
 */
export function buildNetworkView(
  devices: Device[],
  connections: Connection[] = [],
  racks: Rack[] = [],
): NetworkView {
  if (devices.length === 0) return { subnets: [], issues: [] };

  // ---- Group devices by subnet (a device can span multiple subnets) ----
  const deviceSubnets = new Map<string, Map<string, CidrInfo>>();
  const bySubnet = new Map<string, Device[]>();
  for (const d of devices) {
    const allIps = getDeviceIps(d, connections);
    const subnetMap = new Map<string, CidrInfo>();
    for (const ip of allIps) {
      const info = parseCidr(ip);
      if (info && !subnetMap.has(info.key)) subnetMap.set(info.key, info);
    }
    deviceSubnets.set(d.id, subnetMap);

    if (subnetMap.size === 0) {
      const list = bySubnet.get(UNKNOWN) ?? [];
      list.push(d);
      bySubnet.set(UNKNOWN, list);
    } else {
      for (const key of subnetMap.keys()) {
        const list = bySubnet.get(key) ?? [];
        list.push(d);
        bySubnet.set(key, list);
      }
    }
  }

  const hostIdInSubnet = (d: Device, subnetKey: string): number =>
    deviceSubnets.get(d.id)?.get(subnetKey)?.hostId ?? 0;

  const resolveGateway = (members: Device[], subnetKey: string): { gateway: Device | null; explicit: boolean } => {
    const explicit = members.filter((d) => d.isGateway).sort((a, b) => hostIdInSubnet(a, subnetKey) - hostIdInSubnet(b, subnetKey));
    if (explicit.length > 0) return { gateway: explicit[0], explicit: true };
    const routers = members
      .filter((d) => {
        const t = inferType(d.name, d.model);
        return t === "router" || t === "firewall";
      })
      .sort((a, b) => hostIdInSubnet(a, subnetKey) - hostIdInSubnet(b, subnetKey));
    if (routers.length > 0) return { gateway: routers[0], explicit: false };
    return { gateway: null, explicit: false };
  };

  // ---- Audits ----
  const issues: SubnetIssue[] = [];
  const deviceByName = new Map(devices.map((d) => [d.name.toLowerCase(), d]));

  // Every interface IP on every connection, resolved to its device.
  interface IpEntry {
    info: CidrInfo;
    deviceId: string;
    deviceName: string;
  }
  const interfaceIps: IpEntry[] = [];
  for (const c of connections) {
    for (const [name, ip] of [
      [c.srcDevice, c.srcIp],
      [c.dstDevice, c.dstIp],
    ] as const) {
      const info = parseCidr(ip);
      const dev = deviceByName.get(name.toLowerCase());
      if (!info || !dev) continue;
      interfaceIps.push({ info, deviceId: dev.id, deviceName: dev.name });
    }
  }

  // IP conflict — the same address claimed by more than one *device*.
  // The same device repeating an IP across parallel links is the normal
  // multi-link pattern (one logical interface over several physical links),
  // so only distinct devices count.
  const byIp = new Map<number, IpEntry[]>();
  for (const e of interfaceIps) {
    const list = byIp.get(e.info.ipInt) ?? [];
    list.push(e);
    byIp.set(e.info.ipInt, list);
  }
  for (const [ipInt, entries] of byIp) {
    const deviceIds = [...new Set(entries.map((e) => e.deviceId))];
    if (deviceIds.length < 2) continue;
    const names = [...new Set(entries.map((e) => e.deviceName))];
    issues.push({
      id: `conflict-${ipInt}`,
      kind: "ip-conflict",
      severity: "error",
      message: `${entries[0].info.ip} claimed by ${names.join(" and ")}`,
      subnetKeys: [...new Set(entries.map((e) => e.info.key))],
      deviceIds,
    });
  }

  // Reserved address — a device using its subnet's network or broadcast address.
  const seenReserved = new Set<string>();
  for (const e of interfaceIps) {
    const { info } = e;
    if (info.prefix > 30) continue;
    const isNetwork = info.hostId === 0;
    const isBroadcast = info.ipInt === info.broadcastInt;
    if (!isNetwork && !isBroadcast) continue;
    const dedupe = `${e.deviceId}|${info.ipInt}`;
    if (seenReserved.has(dedupe)) continue;
    seenReserved.add(dedupe);
    issues.push({
      id: `reserved-${dedupe}`,
      kind: "reserved-address",
      severity: "error",
      message: `${info.ip} is the ${isNetwork ? "network" : "broadcast"} address of ${info.key} (${e.deviceName})`,
      subnetKeys: [info.key],
      deviceIds: [e.deviceId],
    });
  }

  // Overlapping subnets — two subnet keys whose address ranges intersect.
  const realKeys = [...bySubnet.keys()].filter((k) => k !== UNKNOWN);
  const keyInfos = realKeys
    .map((key) => ({ key, info: parseCidr(key) }))
    .filter((x): x is { key: string; info: CidrInfo } => x.info !== null);
  for (let i = 0; i < keyInfos.length; i++) {
    for (let j = i + 1; j < keyInfos.length; j++) {
      const a = keyInfos[i];
      const b = keyInfos[j];
      if (a.info.networkInt <= b.info.broadcastInt && b.info.networkInt <= a.info.broadcastInt) {
        issues.push({
          id: `overlap-${a.key}|${b.key}`,
          kind: "subnet-overlap",
          severity: "warning",
          message: `${a.key} overlaps ${b.key}`,
          subnetKeys: [a.key, b.key],
          deviceIds: [],
        });
      }
    }
  }

  // Gateway resolution + no-gateway audit (per real subnet).
  const gateways = new Map<string, { gateway: Device | null; explicit: boolean }>();
  for (const key of realKeys) {
    const gw = resolveGateway(bySubnet.get(key)!, key);
    gateways.set(key, gw);
    if (!gw.gateway) {
      issues.push({
        id: `nogw-${key}`,
        kind: "no-gateway",
        severity: "warning",
        message: `No gateway in ${key} — no marked gateway, router or firewall`,
        subnetKeys: [key],
        deviceIds: [],
      });
    }
  }

  // Missing IP — network-capable devices that have connections but no IP.
  const linkedNames = new Set<string>();
  for (const c of connections) {
    linkedNames.add(c.srcDevice.toLowerCase());
    linkedNames.add(c.dstDevice.toLowerCase());
  }
  for (const d of devices) {
    const subnets = deviceSubnets.get(d.id);
    if (subnets && subnets.size > 0) continue;
    if (NON_NETWORKED_TYPES.has(inferType(d.name, d.model))) continue;
    if (!linkedNames.has(d.name.toLowerCase())) continue;
    issues.push({
      id: `noip-${d.id}`,
      kind: "no-ip",
      severity: "warning",
      message: `${d.name} has connections but no IP address`,
      subnetKeys: [UNKNOWN],
      deviceIds: [d.id],
    });
  }

  const issuesByDevice = new Map<string, string[]>();
  for (const issue of issues) {
    for (const id of issue.deviceIds) {
      const list = issuesByDevice.get(id) ?? [];
      list.push(issue.id);
      issuesByDevice.set(id, list);
    }
  }

  // ---- Rows ----
  const locationOf = (d: Device): string => {
    const r = resolveRack(d, racks);
    if (!r) return "unracked";
    const rackLabel = r.number ? `${r.name}-${r.number}` : r.name;
    const slot = d.mountIndex != null ? `U${d.mountIndex}` : "auto";
    return `${rackLabel} · ${slot}`;
  };

  const subnetOrder = [...bySubnet.keys()].sort((a, b) => {
    if (a === UNKNOWN) return 1;
    if (b === UNKNOWN) return -1;
    const ia = parseCidr(a)!;
    const ib = parseCidr(b)!;
    return ia.networkInt - ib.networkInt || ia.prefix - ib.prefix;
  });

  const subnets: GroupedSubnet[] = subnetOrder.map((key) => {
    const members = bySubnet.get(key)!;
    const info = key === UNKNOWN ? null : parseCidr(key);
    const gw = gateways.get(key) ?? { gateway: null, explicit: false };

    const sorted = [...members].sort(
      (a, b) => hostIdInSubnet(a, key) - hostIdInSubnet(b, key) || a.name.localeCompare(b.name),
    );

    const rows: SubnetRow[] = [];
    const pushDeviceRow = (d: Device) => {
      const infoInSubnet = key === UNKNOWN ? null : deviceSubnets.get(d.id)?.get(key) ?? null;
      rows.push({
        kind: "device",
        device: d,
        type: inferType(d.name, d.model),
        hostId: infoInSubnet?.hostId ?? null,
        ip: infoInSubnet?.ip ?? null,
        location: locationOf(d),
        issueIds: issuesByDevice.get(d.id) ?? [],
      });
    };

    if (info) {
      // Interleave free address runs between occupied hosts. Hosts outside the
      // usable range (network/broadcast misuse) render but split no runs.
      const size = info.broadcastInt - info.networkInt + 1;
      const lo = info.prefix >= 31 ? 0 : 1;
      const hi = info.prefix >= 31 ? size - 1 : size - 2;
      let cursor = lo;
      for (const d of sorted) {
        const h = hostIdInSubnet(d, key);
        if (h > cursor) {
          const to = Math.min(h - 1, hi);
          if (cursor <= to) rows.push({ kind: "free", from: cursor, to });
        }
        cursor = Math.max(cursor, Math.min(h, hi) + 1);
        pushDeviceRow(d);
      }
      if (cursor >= lo && cursor <= hi) rows.push({ kind: "free", from: cursor, to: hi });
    } else {
      for (const d of sorted) pushDeviceRow(d);
    }

    return {
      key,
      info,
      gateway: gw.gateway,
      gatewayExplicit: gw.explicit,
      usedCount: members.length,
      usable: info?.usable ?? 0,
      rows,
    };
  });

  return { subnets, issues };
}
