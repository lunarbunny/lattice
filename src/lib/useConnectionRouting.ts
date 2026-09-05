import { useMemo } from "react";
import type { Connection, Device } from "./types";
import type { RackView, PositionedRack } from "./layout/rack";
import { CABLE_HW, CABLE_HH, U_H } from "./layout/rack";

interface DotPos {
  x: number;
  y: number;
}

interface UnrackedEntry {
  device: Device;
  x: number;
  y: number;
}

interface ConnectionPair {
  pairKey: string;
  srcPos: DotPos;
  dstPos: DotPos;
  srcName: string;
  dstName: string;
  count: number;
  hasFibre: boolean;
  hasEth: boolean;
  bundleProtocol?: string;
  bundleCount: number;
}

interface LaneAssignment {
  vLaneSrc: number;
  vLaneDst: number;
  hLane: number;
}

interface UseConnectionRoutingParams {
  devices: Device[];
  connections: Connection[];
  selectedId: string | null;
  layout: RackView;
  rackUOrder: "top" | "bottom";
  cableStyle: "bezier" | "orthogonal";
  unrackedEntries: UnrackedEntry[];
}

interface UseConnectionRoutingResult {
  dotPositions: Map<string, DotPos>;
  deviceRackMap: Map<string, { rack: PositionedRack; groupX: number; groupY: number; highwayY: number }>;
  activeConnections: { conn: Connection; srcPos: DotPos; dstPos: DotPos; pairKey: string }[];
  connectionPairs: ConnectionPair[];
  laneAssignments: { assignments: Map<string, LaneAssignment>; LANE_SPACING: number; MAX_V_LANES: number; MAX_H_LANES: number };
  connPath: (src: DotPos, dst: DotPos, pairIndex: number, pairTotal: number) => string;
  anchorPath: (src: DotPos, dst: DotPos, srcName: string, dstName: string, pairKey: string) => string;
}

const DOT_R = 3;

export function useConnectionRouting({
  devices, connections, selectedId, layout, rackUOrder, cableStyle, unrackedEntries,
}: UseConnectionRoutingParams): UseConnectionRoutingResult {
  /** Map device name -> dot position in SVG root coords. */
  const dotPositions = useMemo(() => {
    const map = new Map<string, DotPos>();
    for (const g of layout.groups) {
      for (const r of g.racks) {
        const includeHighway = cableStyle === "orthogonal";
        const contentX = g.x + r.x + 30;
        const contentW = r.w - 44 - (includeHighway ? CABLE_HW : 0);
        const cy = g.y + r.y + r.h - 18 - r.units * U_H;
        for (const s of r.slots) {
          const bh = s.device.size * U_H - 6;
          const y = rackUOrder === "bottom"
            ? cy + (r.units - s.u) * U_H + 3
            : cy + (s.u - 1) * U_H + 3;
          map.set(s.device.name.toLowerCase(), {
            x: contentX + contentW - 7.5 + DOT_R,
            y: y + bh / 2,
          });
        }
      }
    }
    for (const u of unrackedEntries) {
      map.set(u.device.name.toLowerCase(), {
        x: u.x + 220 - 7.5 + DOT_R,
        y: u.y + 18,
      });
    }
    return map;
  }, [layout, unrackedEntries, rackUOrder, cableStyle]);

  /** Map device name -> its rack and group (for anchor routing). */
  const deviceRackMap = useMemo(() => {
    const map = new Map<string, { rack: PositionedRack; groupX: number; groupY: number; highwayY: number }>();
    for (const g of layout.groups) {
      for (const r of g.racks) {
        for (const s of r.slots) {
          map.set(s.device.name.toLowerCase(), {
            rack: r,
            groupX: g.x,
            groupY: g.y,
            highwayY: g.highwayY,
          });
        }
      }
    }
    return map;
  }, [layout]);

  /** Connections touching the selected device. */
  const activeConnections = useMemo(() => {
    if (!selectedId) return [];
    const sel = devices.find((d) => d.id === selectedId);
    if (!sel) return [];
    const name = sel.name.toLowerCase();
    return connections
      .filter((c) => c.srcDevice.toLowerCase() === name || c.dstDevice.toLowerCase() === name)
      .map((c) => {
        const srcPos = dotPositions.get(c.srcDevice.toLowerCase());
        const dstPos = dotPositions.get(c.dstDevice.toLowerCase());
        const pair = [c.srcDevice.toLowerCase(), c.dstDevice.toLowerCase()].sort().join("|");
        return { conn: c, srcPos, dstPos, pairKey: pair };
      })
      .filter((x): x is { conn: Connection; srcPos: DotPos; dstPos: DotPos; pairKey: string } => !!x.srcPos && !!x.dstPos);
  }, [selectedId, devices, connections, dotPositions]);

  /** Extract unique connection pairs for rendering. */
  const connectionPairs = useMemo(() => {
    const seen = new Set<string>();
    const pairs: ConnectionPair[] = [];
    for (const x of activeConnections) {
      if (seen.has(x.pairKey) || !x.srcPos || !x.dstPos) continue;
      seen.add(x.pairKey);
      const group = activeConnections.filter((y) => y.pairKey === x.pairKey);
      const bundled = group.filter((g) => g.conn.bundleId);
      const bundleProtocol = bundled.length > 0 ? bundled[0].conn.bundleProtocol : undefined;
      const bundleCount = bundled.length > 0 ? bundled.length : 0;
      pairs.push({
        pairKey: x.pairKey,
        srcPos: x.srcPos,
        dstPos: x.dstPos,
        srcName: x.conn.srcDevice.toLowerCase(),
        dstName: x.conn.dstDevice.toLowerCase(),
        count: group.length,
        hasFibre: group.some((g) => g.conn.medium === "fibre"),
        hasEth: group.some((g) => g.conn.medium === "ethernet"),
        bundleProtocol,
        bundleCount,
      });
    }
    return pairs;
  }, [activeConnections]);

  /** Assign lanes to connection pairs for anchor routing. */
  const laneAssignments = useMemo(() => {
    const assignments = new Map<string, LaneAssignment>();
    const LANE_SPACING = 6;
    const MAX_V_LANES = 5;
    const MAX_H_LANES = 5;

    const rackPairs = new Map<string, typeof connectionPairs>();
    for (const pair of connectionPairs) {
      const srcInfo = deviceRackMap.get(pair.srcName);
      const dstInfo = deviceRackMap.get(pair.dstName);

      if (srcInfo) {
        if (!rackPairs.has(srcInfo.rack.key)) rackPairs.set(srcInfo.rack.key, []);
        rackPairs.get(srcInfo.rack.key)!.push(pair);
      }
      if (dstInfo && dstInfo.rack.key !== srcInfo?.rack.key) {
        if (!rackPairs.has(dstInfo.rack.key)) rackPairs.set(dstInfo.rack.key, []);
        rackPairs.get(dstInfo.rack.key)!.push(pair);
      }
    }

    for (const [, pairs] of rackPairs) {
      pairs.sort((a, b) => {
        const aY = (a.srcPos.y + a.dstPos.y) / 2;
        const bY = (b.srcPos.y + b.dstPos.y) / 2;
        return aY - bY;
      });

      pairs.forEach((pair, idx) => {
        const lane = idx % MAX_V_LANES;
        const existing = assignments.get(pair.pairKey) || { vLaneSrc: 0, vLaneDst: 0, hLane: 0 };

        const srcInfo = deviceRackMap.get(pair.srcName);
        const dstInfo = deviceRackMap.get(pair.dstName);

        if (srcInfo && rackPairs.has(srcInfo.rack.key)) {
          const rackConns = rackPairs.get(srcInfo.rack.key)!;
          if (rackConns.includes(pair)) existing.vLaneSrc = lane;
        }
        if (dstInfo && rackPairs.has(dstInfo.rack.key)) {
          const rackConns = rackPairs.get(dstInfo.rack.key)!;
          if (rackConns.includes(pair)) existing.vLaneDst = lane;
        }

        assignments.set(pair.pairKey, existing);
      });
    }

    const crossRackPairs = connectionPairs.filter((pair) => {
      const srcInfo = deviceRackMap.get(pair.srcName);
      const dstInfo = deviceRackMap.get(pair.dstName);
      return srcInfo && dstInfo && srcInfo.rack.key !== dstInfo.rack.key;
    });

    crossRackPairs.sort((a, b) => {
      const aSrc = deviceRackMap.get(a.srcName)!;
      const aDst = deviceRackMap.get(a.dstName)!;
      const bSrc = deviceRackMap.get(b.srcName)!;
      const bDst = deviceRackMap.get(b.dstName)!;

      const aSrcX = aSrc.groupX + aSrc.rack.x;
      const aDstX = aDst.groupX + aDst.rack.x;
      const bSrcX = bSrc.groupX + bSrc.rack.x;
      const bDstX = bDst.groupX + bDst.rack.x;

      if (aSrcX !== bSrcX) return aSrcX - bSrcX;
      return aDstX - bDstX;
    });

    crossRackPairs.forEach((pair, idx) => {
      const lane = (MAX_H_LANES - 1) - (idx % MAX_H_LANES);
      const existing = assignments.get(pair.pairKey) || { vLaneSrc: 0, vLaneDst: 0, hLane: 0 };
      existing.hLane = lane;
      assignments.set(pair.pairKey, existing);
    });

    return { assignments, LANE_SPACING, MAX_V_LANES, MAX_H_LANES };
  }, [connectionPairs, deviceRackMap]);

  /** Compute the vertical highway center X for a rack (in SVG root coords). */
  const rackHighwayX = (rack: PositionedRack, groupX: number): number => {
    const contentX = groupX + rack.x + 30;
    const contentW = rack.w - 44 - CABLE_HW;
    return contentX + contentW + 5 + CABLE_HW / 2;
  };

  /** Bezier or orthogonal connection path (non-highway mode). */
  const connPath = (src: DotPos, dst: DotPos, pairIndex: number, pairTotal: number): string => {
    const dy = dst.y - src.y;
    const dx = dst.x - src.x;
    const isHorizontal = Math.abs(dy) < U_H * 0.5;

    if (cableStyle === "orthogonal") {
      const stagger = pairTotal > 1 ? (pairIndex - (pairTotal - 1) / 2) * 6 : 0;

      if (isHorizontal) {
        const midX = (src.x + dst.x) / 2;
        const drop = Math.max(16, Math.abs(dx) * 0.15) + Math.abs(stagger) + 12;
        return `M ${src.x} ${src.y} V ${src.y + drop} H ${dst.x} V ${dst.y}`;
      }

      if (dx < 0) {
        const off = 25 + Math.abs(stagger);
        return `M ${src.x} ${src.y} H ${src.x + off} V ${dst.y} H ${dst.x}`;
      }

      const off = Math.max(30, Math.abs(dx) * 0.15) + Math.abs(stagger);
      return `M ${src.x} ${src.y} H ${src.x + off} V ${dst.y} H ${dst.x}`;
    }

    if (isHorizontal) {
      const drop = U_H * 0.6 + pairIndex * 8;
      const cpOffset = Math.max(30, Math.abs(dx) * 0.25);
      return `M ${src.x} ${src.y} C ${src.x + cpOffset} ${src.y}, ${src.x + cpOffset} ${src.y + drop}, ${(src.x + dst.x) / 2} ${src.y + drop} C ${dst.x - cpOffset} ${src.y + drop}, ${dst.x - cpOffset} ${dst.y}, ${dst.x} ${dst.y}`;
    }

    const cpOffset = Math.max(40, Math.abs(dx) * 0.4);
    const stagger = pairTotal > 1 ? (pairIndex - (pairTotal - 1) / 2) * 6 : 0;
    return `M ${src.x} ${src.y} C ${src.x + cpOffset + stagger} ${src.y}, ${dst.x + cpOffset + stagger} ${dst.y}, ${dst.x} ${dst.y}`;
  };

  /** Anchor-based routing through cable highways with lane assignments. */
  const anchorPath = (
    src: DotPos,
    dst: DotPos,
    srcName: string,
    dstName: string,
    pairKey: string,
  ): string => {
    const srcInfo = deviceRackMap.get(srcName);
    const dstInfo = deviceRackMap.get(dstName);
    const lanes = laneAssignments.assignments.get(pairKey) || { vLaneSrc: 0, vLaneDst: 0, hLane: 0 };
    const { LANE_SPACING, MAX_V_LANES, MAX_H_LANES } = laneAssignments;

    const laneOffset = (lane: number, maxLanes: number) => (lane - (maxLanes - 1) / 2) * LANE_SPACING;

    if (!srcInfo || !dstInfo) {
      return `M ${src.x} ${src.y} H ${(src.x + dst.x) / 2} V ${dst.y} H ${dst.x}`;
    }

    const srcHwX = rackHighwayX(srcInfo.rack, srcInfo.groupX) + laneOffset(lanes.vLaneSrc, MAX_V_LANES);
    const dstHwX = rackHighwayX(dstInfo.rack, dstInfo.groupX) + laneOffset(lanes.vLaneDst, MAX_V_LANES);
    const sameRack = srcInfo.rack.key === dstInfo.rack.key;

    if (sameRack) {
      return `M ${src.x} ${src.y} H ${srcHwX} V ${dst.y} H ${dst.x}`;
    }

    const hhY = srcInfo.groupY + srcInfo.highwayY + laneOffset(lanes.hLane, MAX_H_LANES);
    return `M ${src.x} ${src.y} H ${srcHwX} V ${hhY} H ${dstHwX} V ${dst.y} H ${dst.x}`;
  };

  return {
    dotPositions,
    deviceRackMap,
    activeConnections,
    connectionPairs,
    laneAssignments,
    connPath,
    anchorPath,
  };
}
