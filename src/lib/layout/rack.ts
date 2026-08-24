import type { Device, Rack } from "../types";
import { rackKey, resolveRack } from "../importer";

export interface MountedDevice {
  device: Device;
  /** Resolved top U position (1 = top of rack) */
  u: number;
}

export interface PositionedRack {
  key: string;
  /** Declared rack id, if this rack came from a declaration */
  declId?: string;
  group: string;
  number?: string;
  label: string;
  units: number;
  slots: MountedDevice[];
  /** Position relative to the group plate */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GroupedRack {
  name: string;
  unassigned: boolean;
  racks: PositionedRack[];
  deviceCount: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Geometry of the contiguous rack row inside the group plate */
  rowX: number;
  rowY: number;
  rowW: number;
  rowH: number;
  /** Y position (group-relative) of the horizontal cable highway center */
  highwayY: number;
}

export interface RackView {
  groups: GroupedRack[];
  rackCount: number;
  width: number;
  height: number;
  hasMixedHeights: boolean;
}

export const U_H = 36;
export const RACK_W = 256;
export const RACK_HEAD = 48;
export const RACK_FOOT = 18;
export const CABLE_HW = 32;
export const CABLE_HH = 32;
const GROUP_GAP = 110;
const GROUP_HEADER = 40;
const PLATE_PAD = 22;
const PAD = 90;

export const UNRACKED = "Unracked";

/**
 * Mount devices into a rack.
 *
 * Ordering QOL: devices that declare a mountIndex are inserted at their
 * indexes first (collisions push down to the next free block). Only then are
 * the remaining devices populated top-to-bottom in the order they appear in
 * the JSON — so a file without any mountIndex mounts purely in JSON order.
 */
function assignSlots(devs: Device[]): MountedDevice[] {
  const isIndexed = (d: Device) => typeof d.mountIndex === "number" && d.mountIndex >= 1;
  const indexed = devs.filter(isIndexed).sort((a, b) => a.mountIndex! - b.mountIndex!);
  const rest = devs.filter((d) => !isIndexed(d));

  const used = new Set<number>();
  const blockFree = (u: number, size: number) => {
    for (let k = 0; k < size; k++) if (used.has(u + k)) return false;
    return true;
  };
  const take = (start: number, size: number) => {
    let u = start;
    while (!blockFree(u, size)) u++;
    for (let k = 0; k < size; k++) used.add(u + k);
    return u;
  };

  const slots: MountedDevice[] = [];
  for (const d of indexed) slots.push({ device: d, u: take(d.mountIndex!, d.size) });
  for (const d of rest) slots.push({ device: d, u: take(1, d.size) });
  return slots.sort((a, b) => a.u - b.u);
}

const numericPart = (s?: string): number | null => {
  if (s == null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

function compareRackNumbers(a?: string, b?: string): number {
  const na = numericPart(a);
  const nb = numericPart(b);
  if (na != null && nb != null) return na - nb;
  if (na != null) return -1;
  if (nb != null) return 1;
  return (a ?? "").localeCompare(b ?? "");
}

interface Bag {
  gName: string;
  number?: string;
  devices: Device[];
}

/**
 * Map devices into physical space: racks sharing a `name` form one group and
 * render flush side by side, ordered by their number. Declared racks are
 * rendered even when empty, at their declared unit height.
 */
export function buildRackView(devices: Device[], decls: Rack[], cableStyle: "bezier" | "orthogonal" = "bezier", rackAlign: "top" | "bottom" = "bottom"): RackView {
  const declById = new Map(decls.map((r) => [r.id, r]));

  const bags = new Map<string, Bag>();
  for (const d of devices) {
    const decl = resolveRack(d, decls);
    let key: string;
    let gName: string;
    let number: string | undefined;
    if (decl) {
      key = decl.id;
      gName = decl.name;
      number = decl.number;
    } else {
      gName = UNRACKED;
      number = undefined;
      key = `${UNRACKED}#x`;
    }
    let bag = bags.get(key);
    if (!bag) {
      bag = { gName, number, devices: [] };
      bags.set(key, bag);
    }
    bag.devices.push(d);
  }

  const declUnits = new Map<string, number>();
  const declKeys = new Set<string>();
  for (const r of decls) {
    declUnits.set(r.id, r.units);
    declKeys.add(r.id);
  }

  const allKeys = new Set<string>([...bags.keys(), ...declKeys]);

  // A rack belongs to the group named by its declaration.
  const groupOfKey = (key: string): string => declById.get(key)?.name ?? UNRACKED;

  const groupNames = new Set<string>();
  for (const key of allKeys) groupNames.add(groupOfKey(key));
  const sortedGroups = [...groupNames].sort((a, b) => {
    if (a === UNRACKED) return 1;
    if (b === UNRACKED) return -1;
    return a.localeCompare(b);
  });

  const groups: GroupedRack[] = [];
  let rackCount = 0;
  let gx = PAD;
  let maxGH = 0;
  let hasMixedHeights = false;

  for (const gName of sortedGroups) {
    const unassigned = gName === UNRACKED;
    const keys = [...allKeys].filter((k) => groupOfKey(k) === gName);
    // Within a group, racks line up ordered by their rack number.
    const numberFor = (key: string): string | undefined => {
      const decl = declById.get(key);
      if (decl) return decl.number;
      const n = key.split("#")[1];
      return n === "" || n === "x" ? undefined : n;
    };
    const ordered = keys.sort((a, b) => compareRackNumbers(numberFor(a), numberFor(b)));

    const includeHighway = cableStyle === "orthogonal";

    // First pass: compute base heights (without highway space) to find the tallest.
    const baseHeights: number[] = [];
    const rackUnits: number[] = [];
    const rackSlots: MountedDevice[][] = [];
    let maxBaseH = 0;

    for (const key of ordered) {
      const bag = bags.get(key);
      const devs = bag?.devices ?? [];
      const slots = assignSlots(devs);
      const needed = slots.reduce((m, s) => Math.max(m, s.u + s.device.size - 1), 0);
      const declared = declUnits.get(key);
      const units =
        declared != null
          ? Math.max(declared, needed)
          : Math.max(12, Math.ceil(Math.max(needed, 6) / 6) * 6);
      const baseH = RACK_HEAD + units * U_H + RACK_FOOT;
      baseHeights.push(baseH);
      rackUnits.push(units);
      rackSlots.push(slots);
      maxBaseH = Math.max(maxBaseH, baseH);
    }

    // Second pass: build positioned racks, adding highway space only where needed.
    const racks: PositionedRack[] = [];
    let deviceCount = 0;
    let rx = PLATE_PAD;
    let maxRH = 0;

    for (let i = 0; i < ordered.length; i++) {
      const key = ordered[i];
      const decl = declById.get(key);
      const number = decl?.number ?? bags.get(key)?.number;
      const slots = rackSlots[i];
      const units = rackUnits[i];
      deviceCount += slots.length;

      // When bottom-aligned, only the tallest rack(s) get highway space above U1.
      const rackHasHighway = includeHighway && (rackAlign === "top" || baseHeights[i] === maxBaseH);
      const h = baseHeights[i] + (rackHasHighway ? CABLE_HH : 0);
      const w = RACK_W + (includeHighway ? CABLE_HW : 0);
      racks.push({
        key,
        declId: decl?.id,
        group: gName,
        number,
        label: number ? `Rack ${number}` : unassigned ? "Loose gear" : "Unnumbered rack",
        units,
        slots,
        x: rx,
        y: 0,
        w,
        h,
      });
      rx += w;
      maxRH = Math.max(maxRH, h);
    }

    // Align racks within the group plate — bottom (shared floor) or top.
    for (const r of racks) {
      r.y = rackAlign === "top"
        ? GROUP_HEADER + PLATE_PAD
        : GROUP_HEADER + PLATE_PAD + (maxRH - r.h);
    }

    // Horizontal cable highway Y: center of the CABLE_HH space above U1 of the tallest rack.
    const tallestRack = racks.reduce((a, b) => (a.y < b.y ? a : b));
    const highwayY = tallestRack.y + RACK_HEAD + (includeHighway ? CABLE_HH / 2 : 0);

    const rackTotalW = RACK_W + (includeHighway ? CABLE_HW : 0);
    const gw = Math.max(rx + PLATE_PAD, rackTotalW + PLATE_PAD * 2);
    const gh = GROUP_HEADER + PLATE_PAD * 2 + maxRH;
    const groupHasMixedHeights = racks.length > 1 && new Set(racks.map((r) => r.h)).size > 1;
    if (groupHasMixedHeights) hasMixedHeights = true;
    groups.push({
      name: gName,
      unassigned,
      racks,
      deviceCount,
      x: gx,
      y: PAD,
      w: gw,
      h: gh,
      rowX: PLATE_PAD,
      rowY: GROUP_HEADER + PLATE_PAD,
      rowW: racks.length * rackTotalW,
      rowH: maxRH,
      highwayY,
    });
    gx += gw + GROUP_GAP;
    maxGH = Math.max(maxGH, gh);
    rackCount += racks.length;
  }

  return {
    groups,
    rackCount,
    width: groups.length > 0 ? gx - GROUP_GAP + PAD : 0,
    height: groups.length > 0 ? PAD * 2 + maxGH : 0,
    hasMixedHeights,
  };
}
