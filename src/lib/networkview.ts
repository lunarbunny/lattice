import type { Connection, Device } from "./types";
import { parseCidr } from "./cidr";
import { inferType } from "./topology";
import { getPrimaryIp } from "./helpers";

export interface SubnetBox {
  key: string;
  devices: Device[];
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NetworkLayout {
  subnets: SubnetBox[];
  width: number;
  height: number;
}

export const SUBNET_W = 260;
export const SUBNET_HEAD = 50;
export const DEV_H = 38;
const SUBNET_GAP = 50;
const PAD = 80;
const BOTTOM_PAD = 14;

const TYPE_RANK: Record<string, number> = {
  router: 0,
  firewall: 1,
  switch: 2,
  ap: 3,
  server: 4,
  kvm: 5,
  power: 6,
  patch: 7,
  accessory: 8,
  camera: 9,
  phone: 10,
  printer: 11,
};

export function buildNetworkLayout(devices: Device[], connections: Connection[] = []): NetworkLayout {
  if (devices.length === 0) return { subnets: [], width: 0, height: 0 };

  const bySubnet = new Map<string, Device[]>();
  for (const d of devices) {
    const info = parseCidr(getPrimaryIp(d, connections));
    const key = info?.key ?? "unknown";
    const list = bySubnet.get(key) ?? [];
    list.push(d);
    bySubnet.set(key, list);
  }

  const sortedKeys = [...bySubnet.keys()].sort();

  const subnets: SubnetBox[] = [];
  let maxX = 0;

  for (const key of sortedKeys) {
    const devs = [...bySubnet.get(key)!].sort((a, b) => {
      const ta = inferType(a.name, a.model);
      const tb = inferType(b.name, b.model);
      const rankDiff = (TYPE_RANK[ta] ?? 9) - (TYPE_RANK[tb] ?? 9);
      if (rankDiff !== 0) return rankDiff;
      const ha = parseCidr(getPrimaryIp(a, connections))?.hostId ?? 0;
      const hb = parseCidr(getPrimaryIp(b, connections))?.hostId ?? 0;
      return ha - hb;
    });

    const h = SUBNET_HEAD + devs.length * DEV_H + BOTTOM_PAD;
    const x = PAD + subnets.length * (SUBNET_W + SUBNET_GAP);
    subnets.push({ key, devices: devs, x, y: PAD, w: SUBNET_W, h });
    maxX = Math.max(maxX, x + SUBNET_W);
  }

  return {
    subnets,
    width: maxX + PAD,
    height: PAD + (subnets.reduce((max, s) => Math.max(max, s.h), 0)) + PAD,
  };
}
