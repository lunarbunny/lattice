import type { Device } from "./types";
import { parseCidr } from "./cidr";
import { inferType } from "./topology";

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
const ROW_GAP = 50;
const PAD = 80;
const MAX_COLS = 3;
const BOTTOM_PAD = 14;

const TYPE_RANK: Record<string, number> = {
  router: 0,
  firewall: 1,
  switch: 2,
  ap: 3,
  server: 4,
  patch: 5,
  camera: 6,
  phone: 7,
  printer: 8,
  client: 9,
};

export function buildNetworkLayout(devices: Device[]): NetworkLayout {
  if (devices.length === 0) return { subnets: [], width: 0, height: 0 };

  const bySubnet = new Map<string, Device[]>();
  for (const d of devices) {
    const info = parseCidr(d.ip);
    const key = info?.key ?? "unknown";
    const list = bySubnet.get(key) ?? [];
    list.push(d);
    bySubnet.set(key, list);
  }

  const sortedKeys = [...bySubnet.keys()].sort();
  const cols = Math.min(MAX_COLS, sortedKeys.length);

  const subnets: SubnetBox[] = [];
  let col = 0;
  let rowY = PAD;
  let rowH = 0;
  let maxX = 0;

  for (const key of sortedKeys) {
    const devs = [...bySubnet.get(key)!].sort((a, b) => {
      const ta = inferType(a.name, a.model);
      const tb = inferType(b.name, b.model);
      const rankDiff = (TYPE_RANK[ta] ?? 9) - (TYPE_RANK[tb] ?? 9);
      if (rankDiff !== 0) return rankDiff;
      const ha = parseCidr(a.ip)?.hostId ?? 0;
      const hb = parseCidr(b.ip)?.hostId ?? 0;
      return ha - hb;
    });

    const h = SUBNET_HEAD + devs.length * DEV_H + BOTTOM_PAD;

    if (col >= cols) {
      col = 0;
      rowY += rowH + ROW_GAP;
      rowH = 0;
    }

    const x = PAD + col * (SUBNET_W + SUBNET_GAP);
    subnets.push({ key, devices: devs, x, y: rowY, w: SUBNET_W, h });
    rowH = Math.max(rowH, h);
    maxX = Math.max(maxX, x + SUBNET_W);
    col++;
  }

  return {
    subnets,
    width: maxX + PAD,
    height: rowY + rowH + PAD,
  };
}
