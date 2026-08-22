import type { Device, DeviceType } from "./types";
import { parseCidr } from "./cidr";

export type NodeKind = "internet" | "device";

export interface TopoNode {
  id: string;
  kind: NodeKind;
  type: DeviceType;
  label: string;
  sublabel: string;
  device?: Device;
  subnet?: string;
  memberCount?: number;
  children: TopoNode[];
  depth: number;
  span: number;
  x: number;
  y: number;
}

export interface TopoEdge {
  id: string;
  from: TopoNode;
  to: TopoNode;
}

export interface Topology {
  root: TopoNode | null;
  nodes: TopoNode[];
  edges: TopoEdge[];
  subnetCount: number;
  width: number;
  height: number;
}

export const LEAF_W = 138;
export const LEVEL_H = 190;
export const PAD = 90;
export const NODE_R = 26;

const RULES: Array<{ type: DeviceType; re: RegExp }> = [
  // KVM / console gear is managed out-of-band — always an endpoint, even when named "…switch".
  { type: "client", re: /\bkvm\b|ipmi|\bilo\b|\bidrac\b|console server/i },
  { type: "firewall", re: /(firewall|\bfw\b|pfsense|forti|palo alto|opnsense|sophos|usg)/i },
  {
    type: "router",
    re: /(router|gateway|\bgw\b|\bedge\b|\budm\b|\ber-|vyos?|routeros|mikrotik|ccr\d)/i,
  },
  {
    type: "switch",
    re: /(switch|\busw\b|\bsw[- ]?\d|\bcore sw\b|catalyst|aruba|\borgs\b|\bigs\b|c9\d{3})/i,
  },
  { type: "ap", re: /(access.?point|\buap\b|\bap[- ]?\d|wifi|wlan|\bssid\b)/i },
  {
    type: "server",
    re: /(server|\bsrv\b|\bnas\b|\bsan\b|storage|\bpve\b|proxmox|vmware|\besxi\b|\bvcsa\b|hyper-?v|hypervisor|\bhost\b|proliant|poweredge|supermicro|thinksystem|\bucs\b|\bdl\d{3}\b|\br\d{3,4}xd?\b|\bgen ?\d\b|docker|k8s|\bnode-?\d\b|nvr|synology|truenas|homeassistant|netapp|isilon|nimble)/i,
  },
  { type: "camera", re: /(camera|\bcam\b|cam-|doorbell|\bg4\b|\bg5\b|axis|reolink|hanwha)/i },
  { type: "phone", re: /(phone|voip|\bsip\b|yealink|polycom)/i },
  { type: "printer", re: /(printer|\bmfp\b|print-|laserjet)/i },
];

/**
 * Heuristically classify a device from its name and, when available, its
 * model string — so "VMWare Host" / "HPE ProLiant Gen 8" lands on servers.
 */
export function inferType(name: string, model?: string): DeviceType {
  const text = model ? `${name} ${model}` : name;
  for (const r of RULES) if (r.re.test(text)) return r.type;
  return "client";
}

const CHILD_RANK: Record<DeviceType, number> = {
  switch: 0,
  ap: 1,
  server: 2,
  camera: 3,
  phone: 4,
  printer: 5,
  firewall: 6,
  router: 6,
  client: 7,
};

/**
 * Build a UniFi-style hierarchy: Internet → per-subnet gateway → members.
 */
export function buildTopology(devices: Device[]): Topology {
  if (devices.length === 0) {
    return { root: null, nodes: [], edges: [], subnetCount: 0, width: 0, height: 0 };
  }

  const bySubnet = new Map<string, Array<{ device: Device; hostId: number }>>();
  for (const d of devices) {
    const info = parseCidr(d.ip);
    if (!info) continue;
    const list = bySubnet.get(info.key) ?? [];
    list.push({ device: d, hostId: info.hostId });
    bySubnet.set(info.key, list);
  }

  const gatewayNodes: TopoNode[] = [];
  const edges: TopoEdge[] = [];

  for (const [key, members] of bySubnet) {
    const routers = members
      .filter((m) => {
        const t = inferType(m.device.name, m.device.model);
        return t === "router" || t === "firewall";
      })
      .sort((a, b) => a.hostId - b.hostId);
    const head =
      routers[0] ??
      members.find((m) => m.hostId === 1) ??
      [...members].sort((a, b) => a.hostId - b.hostId)[0];

    const headNode: TopoNode = {
      id: head.device.id,
      kind: "device",
      type: inferType(head.device.name, head.device.model),
      label: head.device.name,
      sublabel: head.device.ip,
      device: head.device,
      subnet: key,
      memberCount: members.length,
      children: [],
      depth: 1,
      span: 1,
      x: 0,
      y: 0,
    };

    const children = members
      .filter((m) => m.device.id !== head.device.id)
      .sort(
        (a, b) =>
          CHILD_RANK[inferType(a.device.name, a.device.model)] -
            CHILD_RANK[inferType(b.device.name, b.device.model)] ||
          a.hostId - b.hostId
      )
      .map<TopoNode>((m) => ({
        id: m.device.id,
        kind: "device",
        type: inferType(m.device.name, m.device.model),
        label: m.device.name,
        sublabel: m.device.ip,
        device: m.device,
        children: [],
        depth: 2,
        span: 1,
        x: 0,
        y: 0,
      }));

    headNode.children = children;
    gatewayNodes.push(headNode);
    for (const ch of children) {
      edges.push({ id: `${headNode.id}->${ch.id}`, from: headNode, to: ch });
    }
  }

  gatewayNodes.sort((a, b) => (a.subnet ?? "").localeCompare(b.subnet ?? ""));

  const root: TopoNode = {
    id: "__internet__",
    kind: "internet",
    type: "router",
    label: "Internet",
    sublabel: "WAN",
    children: gatewayNodes,
    depth: 0,
    span: 1,
    x: 0,
    y: 0,
  };
  for (const g of gatewayNodes) {
    edges.push({ id: `${root.id}->${g.id}`, from: root, to: g });
  }

  // Tidy tree: bottom-up spans, then position.
  const setSpans = (n: TopoNode): number => {
    n.span = n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + setSpans(c), 0);
    return n.span;
  };
  setSpans(root);

  const totalW = root.span * LEAF_W;
  const place = (n: TopoNode, left: number) => {
    n.y = PAD + n.depth * LEVEL_H;
    if (n.children.length === 0) {
      n.x = left + (n.span * LEAF_W) / 2;
      return;
    }
    let cursor = left;
    for (const c of n.children) {
      place(c, cursor);
      cursor += c.span * LEAF_W;
    }
    const first = n.children[0];
    const last = n.children[n.children.length - 1];
    n.x = (first.x + last.x) / 2;
  };
  place(root, PAD);

  const nodes: TopoNode[] = [];
  const walk = (n: TopoNode) => {
    nodes.push(n);
    n.children.forEach(walk);
  };
  walk(root);

  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);

  return {
    root,
    nodes,
    edges,
    subnetCount: bySubnet.size,
    width: totalW + PAD * 2,
    height: PAD * 2 + maxDepth * LEVEL_H + 60,
  };
}
