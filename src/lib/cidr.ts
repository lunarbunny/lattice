export interface CidrInfo {
  ip: string;
  prefix: number;
  ipInt: number;
  networkInt: number;
  broadcastInt: number;
  network: string;
  broadcast: string;
  mask: string;
  wildcard: string;
  hostId: number;
  usable: number;
  firstHost: string;
  lastHost: string;
  /** Subnet key, e.g. "10.10.1.0/24" */
  key: string;
}

export function ipToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

export function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function maskFromPrefix(p: number): number {
  return p === 0 ? 0 : (~0 << (32 - p)) >>> 0;
}

/** Parse an IPv4 CIDR string like "192.168.1.10/24". Returns null when invalid or undefined. */
export function parseCidr(raw: string | undefined): CidrInfo | null {
  if (typeof raw !== "string") return null;
  const m = raw
    .trim()
    .match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*\/\s*(\d{1,2})$/);
  if (!m) return null;
  const prefix = Number(m[2]);
  if (prefix > 32) return null;
  const ipInt = ipToInt(m[1]);
  if (ipInt === null) return null;

  const mask = maskFromPrefix(prefix);
  const networkInt = (ipInt & mask) >>> 0;
  const broadcastInt = (networkInt | ~mask) >>> 0;
  const hostId = (ipInt ^ networkInt) >>> 0;
  const size = broadcastInt - networkInt + 1;
  const usable = prefix >= 31 ? size : Math.max(0, size - 2);

  return {
    ip: m[1],
    prefix,
    ipInt,
    networkInt,
    broadcastInt,
    network: intToIp(networkInt),
    broadcast: intToIp(broadcastInt),
    mask: intToIp(mask),
    wildcard: intToIp(~mask >>> 0),
    hostId,
    usable,
    firstHost:
      prefix >= 31 ? intToIp(networkInt) : intToIp((networkInt + 1) >>> 0),
    lastHost:
      prefix >= 31 ? intToIp(broadcastInt) : intToIp((broadcastInt - 1) >>> 0),
    key: `${intToIp(networkInt)}/${prefix}`,
  };
}
