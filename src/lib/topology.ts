import type { Device, DeviceType } from "./types";
import { parseCidr } from "./cidr";

export type NodeKind = "internet" | "device" | "no-gateway";

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
  fallbackGatewayCount: number;
  width: number;
  height: number;
}

export const LEAF_W = 138;
export const LEVEL_H = 190;
export const PAD = 90;
export const NODE_R = 26;

export interface BuildOptions {
  collapsedSubnets?: Set<string>;
  isHorizontal?: boolean;
  leafSpacing?: number;
}

const RULES: Array<{ type: DeviceType; re: RegExp }> = [
  // KVM / console gear is managed out-of-band — always an endpoint, even when named "…switch".
  { type: "client", re: /\bkvm\b|ipmi|\bilo\b|\bidrac\b|console server/i },
  { type: "patch", re: /(patch.?panel|keystone|panduit|leviton|\bpp[- ]?\d|patch bay)/i },
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
  patch: 6,
  firewall: 6,
  router: 6,
  client: 7,
};

/**
 * Build a UniFi-style hierarchy: Internet → per-subnet gateway → members.
 */
export function buildTopology(devices: Device[], opts?: BuildOptions): Topology {
  if (devices.length === 0) {
    return { root: null, nodes: [], edges: [], subnetCount: 0, fallbackGatewayCount: 0, width: 0, height: 0 };
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
  let fallbackGatewayCount = 0;

  for (const [key, members] of bySubnet) {
    const explicit = members.filter((m) => m.device.isGateway);
    const sortedExplicit = [...explicit].sort((a, b) => a.hostId - b.hostId);

    type Member = (typeof members)[number];

    const makeChildNode = (m: Member, depth: number): TopoNode => ({
      id: m.device.id,
      kind: "device",
      type: inferType(m.device.name, m.device.model),
      label: m.device.name,
      sublabel: m.device.ip,
      device: m.device,
      children: [],
      depth,
      span: 1,
      x: 0,
      y: 0,
    });

    const sortChildren = (list: Member[]): Member[] =>
      [...list].sort(
        (a, b) =>
          CHILD_RANK[inferType(a.device.name, a.device.model)] -
            CHILD_RANK[inferType(b.device.name, b.device.model)] ||
          a.hostId - b.hostId
      );

    if (sortedExplicit.length > 0) {
      // Multiple explicit gateways: all become depth-1 nodes.
      // Non-gateway members become children of the first gateway.
      const gatewayIds = new Set(sortedExplicit.map((g) => g.device.id));
      const nonGateways = sortChildren(members.filter((m) => !gatewayIds.has(m.device.id)));

      for (let i = 0; i < sortedExplicit.length; i++) {
        const gw = sortedExplicit[i];
        const gwNode: TopoNode = {
          id: gw.device.id,
          kind: "device",
          type: inferType(gw.device.name, gw.device.model),
          label: gw.device.name,
          sublabel: gw.device.ip,
          device: gw.device,
          subnet: key,
          memberCount: members.length,
          children: [],
          depth: 1,
          span: 1,
          x: 0,
          y: 0,
        };
        if (i === 0) {
          gwNode.children = nonGateways.map((m) => makeChildNode(m, 2));
          for (const ch of gwNode.children) {
            edges.push({ id: `${gwNode.id}->${ch.id}`, from: gwNode, to: ch });
          }
        }
        gatewayNodes.push(gwNode);
      }
    } else {
      // No explicit gateway — try routers/firewalls only
      const routers = sortChildren(
        members.filter((m) => {
          const t = inferType(m.device.name, m.device.model);
          return t === "router" || t === "firewall";
        })
      );

      if (routers.length > 0) {
        fallbackGatewayCount++;
        const head = routers[0];
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
        const children = sortChildren(members.filter((m) => m.device.id !== head.device.id));
        headNode.children = children.map((m) => makeChildNode(m, 2));
        gatewayNodes.push(headNode);
        for (const ch of headNode.children) {
          edges.push({ id: `${headNode.id}->${ch.id}`, from: headNode, to: ch });
        }
      } else {
        // No router/firewall — create a dummy gateway so devices aren't direct children of Internet
        const dummyId = `__no_gw_${key}__`;
        const dummy: TopoNode = {
          id: dummyId,
          kind: "no-gateway",
          type: "router",
          label: "No Gateway",
          sublabel: key,
          subnet: key,
          memberCount: members.length,
          children: [],
          depth: 1,
          span: 1,
          x: 0,
          y: 0,
        };
        const children = sortChildren(members).map((m) => makeChildNode(m, 2));
        dummy.children = children;
        for (const ch of children) {
          edges.push({ id: `${dummyId}->${ch.id}`, from: dummy, to: ch });
        }
        gatewayNodes.push(dummy);
      }
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

  const collapsed = opts?.collapsedSubnets ?? new Set<string>();
  const horizontal = opts?.isHorizontal ?? false;
  const leafSpacing = opts?.leafSpacing ?? LEAF_W;
  const levelH = horizontal ? LEVEL_H * 0.75 : LEVEL_H;

  const isCollapsed = (n: TopoNode) =>
    n.kind !== "internet" && !!n.subnet && collapsed.has(n.subnet);

  // Tidy tree: bottom-up spans, then position.
  // In both modes, span = leaf slot count.
  // Vertical (root top): span → width (x), depth → y.
  // Horizontal (root left): span → height (y), depth → x.
  const setSpans = (n: TopoNode): number => {
    if (isCollapsed(n)) {
      n.span = 1;
      return 1;
    }
    n.span = n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + setSpans(c), 0);
    return n.span;
  };
  setSpans(root);

  const treeDepth = (n: TopoNode): number =>
    n.children.length === 0 ? n.depth : Math.max(...n.children.map(treeDepth));
  const maxDepth = horizontal ? treeDepth(root) : 0;

  const totalW = horizontal
    ? (maxDepth + 1) * levelH
    : root.span * leafSpacing;

  const place = (n: TopoNode, slot: number) => {
    if (horizontal) {
      n.x = PAD + n.depth * levelH;
      if (n.children.length === 0 || isCollapsed(n)) {
        n.y = PAD + (slot + n.span / 2) * leafSpacing;
        return;
      }
      let cursor = slot;
      for (const c of n.children) {
        place(c, cursor);
        cursor += c.span;
      }
      n.y = (n.children[0].y + n.children[n.children.length - 1].y) / 2;
    } else {
      n.y = PAD + n.depth * levelH;
      if (n.children.length === 0 || isCollapsed(n)) {
        n.x = PAD + (slot + n.span / 2) * leafSpacing;
        return;
      }
      let cursor = slot;
      for (const c of n.children) {
        place(c, cursor);
        cursor += c.span;
      }
      n.x = (n.children[0].x + n.children[n.children.length - 1].x) / 2;
    }
  };
  place(root, 0);

  const nodes: TopoNode[] = [];
  const walk = (n: TopoNode) => {
    nodes.push(n);
    if (n.subnet && collapsed.has(n.subnet)) return;
    n.children.forEach(walk);
  };
  walk(root);

  const visibleIds = new Set(nodes.map((n) => n.id));
  const visibleEdges = edges.filter((e) => visibleIds.has(e.to.id));

  const visibleDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);

  return {
    root,
    nodes,
    edges: visibleEdges,
    subnetCount: bySubnet.size,
    fallbackGatewayCount,
    width: totalW + PAD * 2,
    height: horizontal
      ? PAD * 2 + root.span * leafSpacing
      : PAD * 2 + visibleDepth * levelH + 60,
  };
}
