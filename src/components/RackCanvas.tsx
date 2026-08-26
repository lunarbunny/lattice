import { useEffect, useMemo, useRef, useState } from "react";
import type { Connection, Device } from "../lib/types";
import { TYPE_META } from "../lib/types";
import { inferType } from "../lib/layout/topology";
import type { RackView } from "../lib/layout/rack";
import { RACK_HEAD, RACK_FOOT, U_H, CABLE_HW, CABLE_HH } from "../lib/layout/rack";
import type { PositionedRack, MountedDevice } from "../lib/layout/rack";
import { usePanZoom } from "../lib/usePanZoom";
import ZoomControls from "./ZoomControls";
import { TypeIcon } from "./Icons";
import DeviceHoverCard from "./DeviceHoverCard";
import ConnectionHoverCard from "./ConnectionHoverCard";
import { getDeviceSublabel } from "../lib/helpers";
import {
  CARD_FILL, CARD_FILL_SELECTED, CARD_FILL_HOVER,
  CARD_STROKE, SEPARATOR_LINE, DOT_PATTERN,
  TEXT_NAME, TEXT_NAME_ACTIVE, TEXT_SUBLABEL, TEXT_HEADING, TEXT_TERTIARY, TEXT_EMPTY_SLOT,
  DOT_CONNECTED, DOT_NO_LINK,
  CABLE_ETHERNET, CABLE_FIBRE, CABLE_MIXED, CABLE_HOVER,
  CONTAINER_FILL, CONTAINER_STROKE, CONTAINER_INNER_FILL, CONTAINER_INNER_STROKE,
  RAIL_STROKE, RAIL_SCREW, U_ROW_LINE, RACK_FOOT as RACK_FOOT_COLOR,
  HIGHWAY_FILL, HIGHWAY_STROKE, HIGHWAY_LABEL,
} from "../lib/colours";

function uRange(s: MountedDevice): string {
  const end = s.u + s.device.size - 1;
  return s.device.size > 1 ? `U${s.u}–U${end}` : `U${s.u}`;
}

/* ---- pixel-accurate text fitting for rack unit labels ---- */

const NAME_FONT = "600 11.5px 'IBM Plex Sans', sans-serif";
const measureCache = new Map<string, number>();
let mctx: CanvasRenderingContext2D | null = null;

function textWidth(text: string, font: string): number {
  if (!mctx) mctx = document.createElement("canvas").getContext("2d");
  if (!mctx) return text.length * 6.5;
  const key = `${font}|${text}`;
  const hit = measureCache.get(key);
  if (hit != null) return hit;
  mctx.font = font;
  const w = mctx.measureText(text).width;
  measureCache.set(key, w);
  return w;
}

function fitText(text: string, maxWidth: number, font: string): string {
  if (textWidth(text, font) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (textWidth(text.slice(0, mid).trimEnd() + "…", font) <= maxWidth) lo = mid;
    else hi = mid;
  }
  return text.slice(0, Math.max(1, lo)).trimEnd() + "…";
}

interface DotPos {
  x: number;
  y: number;
}

interface UnrackedEntry {
  device: Device;
  x: number;
  y: number;
}

const DOT_R = 3;
const UNRACKED_W = 220;
const UNRACKED_ROW_H = 36;
const UNRACKED_GAP = 110;
const UNRACKED_PAD = 90;

interface Props {
  devices: Device[];
  connections: Connection[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  externalHoverConnId?: string | null;
  drawerOpen?: boolean;
  drawerWidth?: number;
  cableStyle?: "bezier" | "orthogonal";
  layout: RackView;
}

export default function RackCanvas({ devices, connections, selectedId, onSelect, externalHoverConnId, drawerOpen, drawerWidth, cableStyle = "bezier", layout }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverPairKey, setHoverPairKey] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const [, setFontTick] = useState(0);
  useEffect(() => {
    let live = true;
    document.fonts?.ready?.then(() => {
      if (!live) return;
      measureCache.clear();
      setFontTick((t) => t + 1);
    });
    return () => { live = false; };
  }, []);

  /** Devices not placed in any rack slot. */
  const unrackedDevices = useMemo(() => {
    const rackedIds = new Set<string>();
    for (const g of layout.groups)
      for (const r of g.racks)
        for (const s of r.slots) rackedIds.add(s.device.id);
    return devices.filter((d) => !rackedIds.has(d.id));
  }, [devices, layout]);

  /** Layout unracked devices in a column to the right of the rack groups. */
  const unrackedEntries = useMemo<UnrackedEntry[]>(() => {
    if (unrackedDevices.length === 0) return [];
    const startX = layout.width + UNRACKED_GAP;
    const startY = UNRACKED_PAD;
    return unrackedDevices.map((d, i) => ({
      device: d,
      x: startX,
      y: startY + i * UNRACKED_ROW_H,
    }));
  }, [unrackedDevices, layout.width]);

  /** Total bounds including the unracked column. */
  const totalBounds = useMemo(() => {
    let w = layout.width;
    let h = layout.height;
    if (unrackedEntries.length > 0) {
      w = unrackedEntries[0].x + UNRACKED_W + UNRACKED_PAD;
      const unrackedH = unrackedEntries[unrackedEntries.length - 1].y + UNRACKED_ROW_H + UNRACKED_PAD;
      h = Math.max(h, unrackedH);
    }
    return { width: w, height: h };
  }, [layout, unrackedEntries]);

  const { vb, isPanning, fit, zoomBy, panRef, onPointerDown, onPointerMove, onPointerUp } = usePanZoom(
    containerRef,
    svgRef,
    totalBounds,
    [devices.length, layout.rackCount, unrackedEntries.length],
    (e) => {
      const target = e.target as Element | null;
      if (!target || !target.closest("[data-node]")) onSelect(null);
    }
  );

  const hoverInfo = useMemo(() => {
    if (!hoverId) return null;
    for (const g of layout.groups)
      for (const r of g.racks) for (const s of r.slots) if (s.device.id === hoverId) return { g, r, s };
    return null;
  }, [hoverId, layout]);

  const hoverUnracked = useMemo(
    () => unrackedEntries.find((u) => u.device.id === hoverId) ?? null,
    [hoverId, unrackedEntries]
  );

  const hoverType = hoverInfo
    ? inferType(hoverInfo.s.device.name, hoverInfo.s.device.model)
    : hoverUnracked
      ? inferType(hoverUnracked.device.name, hoverUnracked.device.model)
      : null;
  const showTooltip = (!!hoverInfo || !!hoverUnracked) && !panRef.current;

  /** Map device name → green-dot position in SVG root coords. */
  const dotPositions = useMemo(() => {
    const map = new Map<string, DotPos>();
    for (const g of layout.groups) {
      for (const r of g.racks) {
        const includeHighway = cableStyle === "orthogonal";
        const contentX = g.x + r.x + 30;
        const contentW = r.w - 44 - (includeHighway ? CABLE_HW : 0);
        const cy = g.y + r.y + r.h - RACK_FOOT - r.units * U_H;
        for (const s of r.slots) {
          const bh = s.device.size * U_H - 6;
          const y = cy + (s.u - 1) * U_H + 3;
          map.set(s.device.name.toLowerCase(), {
            x: contentX + contentW - 7.5 + DOT_R,
            y: y + bh / 2,
          });
        }
      }
    }
    for (const u of unrackedEntries) {
      map.set(u.device.name.toLowerCase(), {
        x: u.x + UNRACKED_W - 7.5 + DOT_R,
        y: u.y + UNRACKED_ROW_H / 2,
      });
    }
    return map;
  }, [layout, unrackedEntries]);

  /** Map device name → its rack and group (for anchor routing). */
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

  /** Connections touching the selected device, with pair keys. */
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
      .filter((x) => x.srcPos && x.dstPos);
  }, [selectedId, devices, connections, dotPositions]);

  /** All connections in the hovered pair. */
  const hoveredPair = useMemo(() => {
    if (!hoverPairKey) return [];
    return activeConnections.filter((x) => x.pairKey === hoverPairKey);
  }, [hoverPairKey, activeConnections]);

  const connPath = (src: DotPos, dst: DotPos, pairIndex: number, pairTotal: number) => {
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

  /** Compute the vertical highway center X for a rack (in SVG root coords). */
  const rackHighwayX = (rack: PositionedRack, groupX: number): number => {
    const contentX = groupX + rack.x + 30;
    const contentW = rack.w - 44 - CABLE_HW;
    return contentX + contentW + 5 + CABLE_HW / 2;
  };

  /** Extract unique connection pairs for rendering. */
  const connectionPairs = useMemo(() => {
    const seen = new Set<string>();
    const pairs: {
      pairKey: string;
      srcPos: DotPos;
      dstPos: DotPos;
      srcName: string;
      dstName: string;
      count: number;
      hasFibre: boolean;
      hasEth: boolean;
    }[] = [];
    for (const x of activeConnections) {
      if (seen.has(x.pairKey) || !x.srcPos || !x.dstPos) continue;
      seen.add(x.pairKey);
      const group = activeConnections.filter((y) => y.pairKey === x.pairKey);
      pairs.push({
        pairKey: x.pairKey,
        srcPos: x.srcPos,
        dstPos: x.dstPos,
        srcName: x.conn.srcDevice.toLowerCase(),
        dstName: x.conn.dstDevice.toLowerCase(),
        count: group.length,
        hasFibre: group.some((g) => g.conn.medium === "fibre"),
        hasEth: group.some((g) => g.conn.medium === "ethernet"),
      });
    }
    return pairs;
  }, [activeConnections]);

  /** Assign lanes to connection pairs for anchor routing. */
  const laneAssignments = useMemo(() => {
    const assignments = new Map<string, { vLaneSrc: number; vLaneDst: number; hLane: number }>();
    const LANE_SPACING = 6;
    const MAX_V_LANES = 5;
    const MAX_H_LANES = 5;

    // Group pairs by which vertical highways they use
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

    // Assign vertical highway lanes per rack
    for (const [, pairs] of rackPairs) {
      // Sort by average Y to minimize crossings
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
          if (rackConns.includes(pair)) {
            existing.vLaneSrc = lane;
          }
        }
        if (dstInfo && rackPairs.has(dstInfo.rack.key)) {
          const rackConns = rackPairs.get(dstInfo.rack.key)!;
          if (rackConns.includes(pair)) {
            existing.vLaneDst = lane;
          }
        }

        assignments.set(pair.pairKey, existing);
      });
    }

    // Assign horizontal highway lanes for cross-rack connections
    const crossRackPairs = connectionPairs.filter((pair) => {
      const srcInfo = deviceRackMap.get(pair.srcName);
      const dstInfo = deviceRackMap.get(pair.dstName);
      return srcInfo && dstInfo && srcInfo.rack.key !== dstInfo.rack.key;
    });

    // Sort by source rack X, then destination rack X
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

    // Fallback if device not in any rack (unracked)
    if (!srcInfo || !dstInfo) {
      return `M ${src.x} ${src.y} H ${(src.x + dst.x) / 2} V ${dst.y} H ${dst.x}`;
    }

    const srcHwX = rackHighwayX(srcInfo.rack, srcInfo.groupX) + laneOffset(lanes.vLaneSrc, MAX_V_LANES);
    const dstHwX = rackHighwayX(dstInfo.rack, dstInfo.groupX) + laneOffset(lanes.vLaneDst, MAX_V_LANES);
    const sameRack = srcInfo.rack.key === dstInfo.rack.key;

    if (sameRack) {
      // Intra-rack: device → vertical highway → target Y → target device
      return `M ${src.x} ${src.y} H ${srcHwX} V ${dst.y} H ${dst.x}`;
    }

    // Cross-rack: device → vertical highway → horizontal highway → target vertical highway → target device
    const hhY = srcInfo.groupY + srcInfo.highwayY + laneOffset(lanes.hLane, MAX_H_LANES);
    return `M ${src.x} ${src.y} H ${srcHwX} V ${hhY} H ${dstHwX} V ${dst.y} H ${dst.x}`;
  };

  const renderSlot = (s: MountedDevice, contentX: number, cy: number, cw: number, idx: number) => {
    const d = s.device;
    const t = inferType(d.name, d.model);
    const sublabel = getDeviceSublabel(d, connections, t);
    const col = TYPE_META[t].color;
    const y = cy + (s.u - 1) * U_H + 3;
    const bh = d.size * U_H - 6;
    const isSel = selectedId === d.id;
    const isHover = hoverId === d.id;
    return (
      <g
        key={d.id}
        data-node
        transform={`translate(${contentX} ${y})`}
        className="cursor-pointer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(d.id);
        }}
        onMouseEnter={() => setHoverId(d.id)}
        onMouseLeave={() => setHoverId((h) => (h === d.id ? null : h))}
      >
        <g className="unit-in" style={{ animationDelay: `${Math.min(idx, 22) * 28}ms` }}>
          {isSel && (
            <rect
              x={-4}
              y={-3.5}
              width={cw + 8}
              height={bh + 7}
              rx={6}
              fill="none"
              stroke={col}
              strokeWidth={1.2}
              className="ants"
            />
          )}
          <rect
            width={cw}
            height={bh}
            rx={4}
            fill={isSel ? CARD_FILL_SELECTED : isHover ? CARD_FILL_HOVER : CARD_FILL}
            stroke={isSel || isHover ? col : CARD_STROKE}
            strokeWidth={isSel ? 1.5 : 1.1}
          />
          <rect width={3.5} height={bh} rx={1.75} fill={col} />
          <g transform={`translate(9 ${(bh - 13) / 2})`} color={col}>
            <TypeIcon type={t} size={13} className="h-[13px] w-[13px]" />
          </g>
          <g transform={`translate(0 ${(bh - (sublabel ? 28 : 17)) / 2})`}>
            <text
              x={30}
              y={12.5}
              fontSize={11.5}
              fontWeight={600}
              fontFamily="IBM Plex Sans, sans-serif"
              fill={isSel || isHover ? TEXT_NAME_ACTIVE : TEXT_NAME}
            >
              {fitText(d.name, cw - 30 - 18, NAME_FONT)}
            </text>
            {sublabel && (
              <text x={30} y={24.5} fontSize={9.5} fontFamily="IBM Plex Mono, monospace" fill={TEXT_SUBLABEL}>
                {sublabel}
                {d.size > 1 ? ` · ${d.size}U` : ""}
              </text>
            )}
          </g>
          {(sublabel || t === "patch") && (
            <circle
              cx={cw - 7.5}
              cy={bh / 2}
              r={3}
              fill={sublabel === "no link" ? DOT_NO_LINK : sublabel ? DOT_CONNECTED : col}
              className={isSel || isHover ? "blink" : undefined}
            />
          )}
        </g>
      </g>
    );
  };

  const renderRack = (rack: PositionedRack) => {
    const { x, y, w, h, units } = rack;
    const includeHighway = cableStyle === "orthogonal";
    const contentX = x + 30;
    const contentW = w - 44 - (includeHighway ? CABLE_HW : 0);
    const cy = y + h - RACK_FOOT - units * U_H;
    const railBottom = cy + units * U_H;
    return (
      <g key={rack.key}>
        <path d={`M ${x + 2} ${y + RACK_HEAD - 8} H ${x + w - 2}`} stroke={SEPARATOR_LINE} />
        <text
          x={x + 14}
          y={y + 21}
          fontSize={13}
          fontWeight={700}
          fontFamily="Space Grotesk, sans-serif"
          fill={TEXT_HEADING}
        >
          {rack.label}
        </text>
        <text x={x + 14} y={y + 36} fontSize={9} fontFamily="IBM Plex Mono, monospace" fill={TEXT_TERTIARY}>
          {units}U · {rack.slots.length} mounted
          {rack.slots.length === 0 ? " · empty" : ""}
        </text>
        <line x1={x + 9} y1={cy} x2={x + 9} y2={railBottom} stroke={RAIL_STROKE} strokeWidth={1.2} />
        <line x1={contentX + contentW + 5} y1={cy} x2={contentX + contentW + 5} y2={railBottom} stroke={RAIL_STROKE} strokeWidth={1.2} />
        {Array.from({ length: units }, (_, i) => {
          const u = i + 1;
          const uy = cy + i * U_H;
          const occupied = rack.slots.some((s) => u >= s.u && u < s.u + s.device.size);
          return (
            <g key={u}>
              <circle cx={x + 9} cy={uy + U_H / 2} r={1} fill={RAIL_SCREW} />
              <circle cx={x + w - 9} cy={uy + U_H / 2} r={1} fill={RAIL_SCREW} />
              <text
                x={x + 19.5}
                y={uy + U_H / 2 + 2.5}
                fontSize={7.5}
                fontFamily="IBM Plex Mono, monospace"
                fill={occupied ? TEXT_TERTIARY : TEXT_EMPTY_SLOT}
                textAnchor="middle"
              >
                {u}
              </text>
              {u > 1 && (
                <line x1={contentX} y1={uy} x2={contentX + contentW} y2={uy} stroke={U_ROW_LINE} />
              )}
            </g>
          );
        })}
        {rack.slots.map((s, i) => renderSlot(s, contentX, cy, contentW, i))}
      </g>
    );
  };

  const renderUnrackedDevice = (u: UnrackedEntry, idx: number) => {
    const d = u.device;
    const t = inferType(d.name, d.model);
    const sublabel = getDeviceSublabel(d, connections, t);
    const col = TYPE_META[t].color;
    const isSel = selectedId === d.id;
    const isHover = hoverId === d.id;
    const cw = UNRACKED_W;
    const bh = UNRACKED_ROW_H;
    return (
      <g
        key={d.id}
        data-node
        transform={`translate(${u.x} ${u.y})`}
        className="cursor-pointer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(d.id);
        }}
        onMouseEnter={() => setHoverId(d.id)}
        onMouseLeave={() => setHoverId((h) => (h === d.id ? null : h))}
      >
        <g className="unit-in" style={{ animationDelay: `${Math.min(idx, 22) * 28}ms` }}>
          {isSel && (
            <rect
              x={-3}
              y={-2.5}
              width={cw + 6}
              height={bh + 5}
              rx={5}
              fill="none"
              stroke={col}
              strokeWidth={1.2}
              className="ants"
            />
          )}
          <rect
            width={cw}
            height={bh}
            rx={4}
            fill={isSel ? CARD_FILL_SELECTED : isHover ? CARD_FILL_HOVER : CARD_FILL}
            stroke={isSel || isHover ? col : CARD_STROKE}
            strokeWidth={isSel ? 1.5 : 1.1}
          />
          <rect width={3.5} height={bh} rx={1.75} fill={col} />
          <g transform={`translate(9 ${(bh - 13) / 2})`} color={col}>
            <TypeIcon type={t} size={13} className="h-[13px] w-[13px]" />
          </g>
          <g transform={`translate(0 ${(bh - (sublabel ? 28 : 17)) / 2})`}>
            <text
              x={30}
              y={12.5}
              fontSize={11.5}
              fontWeight={600}
              fontFamily="IBM Plex Sans, sans-serif"
              fill={isSel || isHover ? TEXT_NAME_ACTIVE : TEXT_NAME}
            >
              {fitText(d.name, cw - 30 - 18, NAME_FONT)}
            </text>
            {sublabel && (
              <text x={30} y={24.5} fontSize={9.5} fontFamily="IBM Plex Mono, monospace" fill={TEXT_SUBLABEL}>
                {sublabel}
              </text>
            )}
          </g>
          {(sublabel || t === "patch") && (
            <circle
              cx={cw - 7.5}
              cy={bh / 2}
              r={3}
              fill={sublabel === "no link" ? DOT_NO_LINK : sublabel ? DOT_CONNECTED : col}
              className={isSel || isHover ? "blink" : undefined}
            />
          )}
        </g>
      </g>
    );
  };

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <svg
        ref={svgRef}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => {
          if (!panRef.current) setMouse({ x: e.clientX, y: e.clientY });
          onPointerMove(e);
        }}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setHoverId(null);
          setHoverPairKey(null);
        }}
        role="img"
        aria-label="Rack elevation diagram"
      >
        <defs>
          <pattern id="rack-dots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="1.2" fill={DOT_PATTERN} />
          </pattern>
        </defs>
        {!isPanning && (
          <rect
            x={vb.x - 300}
            y={vb.y - 300}
            width={vb.w + 600}
            height={vb.h + 600}
            fill="url(#rack-dots)"
          />
        )}

        {/* Rack groups */}
        {layout.groups.map((g) => (
          <g key={g.name} transform={`translate(${g.x} ${g.y})`}>
            <rect
              width={g.w}
              height={g.h}
              rx={18}
              fill={CONTAINER_FILL}
              fillOpacity={0.5}
              stroke={CONTAINER_STROKE}
              strokeWidth={1.4}
              strokeDasharray="1 7"
              strokeLinecap="round"
            />
            <text
              x={g.w / 2}
              y={19}
              textAnchor="middle"
              fontSize={14}
              fontWeight={700}
              fontFamily="Space Grotesk, sans-serif"
              fill={g.unassigned ? TEXT_SUBLABEL : TEXT_HEADING}
            >
              {g.name}
            </text>
            <text
              x={g.w / 2}
              y={34}
              textAnchor="middle"
              fontSize={9}
              fontFamily="IBM Plex Mono, monospace"
              fill={TEXT_TERTIARY}
            >
              {g.racks.length} rack{g.racks.length === 1 ? "" : "s"} · {g.deviceCount} device
              {g.deviceCount === 1 ? "" : "s"}
            </text>

            <rect
              x={g.rowX}
              y={g.rowY}
              width={g.rowW}
              height={g.rowH}
              rx={10}
              fill={CONTAINER_INNER_FILL}
              stroke={CONTAINER_INNER_STROKE}
              strokeWidth={1.5}
            />
            {g.racks.slice(1).map((r) => (
              <line
                key={`div-${r.key}`}
                x1={r.x}
                y1={g.rowY + 1}
                x2={r.x}
                y2={g.rowY + g.rowH - 1}
                stroke={CONTAINER_STROKE}
                strokeWidth={1.2}
              />
            ))}
            <rect x={g.rowX + 10} y={g.rowY + g.rowH} width={26} height={6} rx={2} fill={RACK_FOOT_COLOR} />
            <rect
              x={g.rowX + g.rowW - 36}
              y={g.rowY + g.rowH}
              width={26}
              height={6}
              rx={2}
              fill={RACK_FOOT_COLOR}
            />

            {g.racks.map(renderRack)}

            {/* Cable highway indicators — only visible in orthogonal mode */}
            {cableStyle === "orthogonal" && (
              <g>
                {/* Horizontal highway */}
                <rect
                  x={g.rowX}
                  y={g.highwayY - CABLE_HH / 2}
                  width={g.rowW}
                  height={CABLE_HH}
                  fill={HIGHWAY_FILL}
                  fillOpacity={0.3}
                  stroke={HIGHWAY_STROKE}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  rx={4}
                />
                <text
                  x={g.rowX + g.rowW / 2}
                  y={g.highwayY + 3}
                  textAnchor="middle"
                  fontSize={8}
                  fontFamily="IBM Plex Mono, monospace"
                  fill={HIGHWAY_LABEL}
                  fontWeight={600}
                >
                  CABLE HIGHWAY
                </text>

                {/* Vertical highways for each rack */}
                {g.racks.map((r) => {
                  const contentX = r.x + 30;
                  const contentW = r.w - 44 - CABLE_HW;
                  const hwX = contentX + contentW + 5;
                  const hwY = g.highwayY + CABLE_HH / 2;
                  const hwHeight = r.y + r.h - RACK_FOOT - hwY;
                  return (
                    <rect
                      key={`vhw-${r.key}`}
                      x={hwX}
                      y={hwY}
                      width={CABLE_HW}
                      height={hwHeight}
                      fill={HIGHWAY_FILL}
                      fillOpacity={0.3}
                      stroke={HIGHWAY_STROKE}
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      rx={4}
                    />
                  );
                })}
              </g>
            )}
          </g>
        ))}

        {/* Unracked devices column */}
        {unrackedEntries.length > 0 && (
          <g>
            <rect
              x={unrackedEntries[0].x - 16}
              y={unrackedEntries[0].y - 40}
              width={UNRACKED_W + 32}
              height={unrackedEntries[unrackedEntries.length - 1].y + UNRACKED_ROW_H - unrackedEntries[0].y + 56}
              rx={14}
              fill={CONTAINER_FILL}
              fillOpacity={0.5}
              stroke={CONTAINER_STROKE}
              strokeWidth={1.4}
              strokeDasharray="1 7"
              strokeLinecap="round"
            />
            <text
              x={unrackedEntries[0].x + UNRACKED_W / 2}
              y={unrackedEntries[0].y - 18}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fontFamily="Space Grotesk, sans-serif"
              fill={TEXT_SUBLABEL}
            >
              Unracked
            </text>
            <text
              x={unrackedEntries[0].x + UNRACKED_W / 2}
              y={unrackedEntries[0].y - 4}
              textAnchor="middle"
              fontSize={9}
              fontFamily="IBM Plex Mono, monospace"
              fill={TEXT_TERTIARY}
            >
              {unrackedEntries.length} device{unrackedEntries.length === 1 ? "" : "s"}
            </text>
            {unrackedEntries.map(renderUnrackedDevice)}
          </g>
        )}

        {/* Connection lines — one per pair, thicker when multiple links exist */}
        {connectionPairs.map((p) => {
            const isSvgHover = hoverPairKey === p.pairKey;
            const isExternalHover = externalHoverConnId != null && activeConnections.some(
              (x) => x.conn.id === externalHoverConnId && x.pairKey === p.pairKey
            );
            const isPairHover = isSvgHover || isExternalHover;
            const baseWidth = 1.5 + (p.count - 1) * 1.2;
            const width = isPairHover ? baseWidth + 1 : baseWidth;
            const color = p.hasFibre && p.hasEth ? CABLE_MIXED : p.hasFibre ? CABLE_FIBRE : CABLE_ETHERNET;
            const dash = p.hasFibre && !p.hasEth ? "6 4" : p.hasFibre && p.hasEth ? "4 3 2 3" : undefined;
            const path = cableStyle === "orthogonal"
              ? anchorPath(p.srcPos, p.dstPos, p.srcName, p.dstName, p.pairKey)
              : connPath(p.srcPos, p.dstPos, 0, 1);
            return (
              <g key={p.pairKey}>
                <path
                  d={path}
                  fill="none"
                  stroke={isPairHover ? CABLE_HOVER : color}
                  strokeWidth={width}
                  strokeOpacity={isPairHover ? 0.9 : 0.5}
                  strokeDasharray={dash}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverPairKey(p.pairKey)}
                  onMouseLeave={() => setHoverPairKey(null)}
                />
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverPairKey(p.pairKey)}
                  onMouseLeave={() => setHoverPairKey(null)}
                />
              </g>
            );
          })}
      </svg>

      {/* Device hover tooltip (racked) */}
      {showTooltip && hoverInfo && hoverType && (
        <DeviceHoverCard
          device={hoverInfo.s.device}
          type={hoverType}
          mouseX={mouse.x}
          mouseY={mouse.y}
          connections={connections}
          location={
            hoverInfo.g.unassigned
              ? `unracked · ${uRange(hoverInfo.s)}`
              : `${hoverInfo.g.name} · ${hoverInfo.r.label} · ${uRange(hoverInfo.s)}${hoverInfo.s.device.size > 1 ? ` (${hoverInfo.s.device.size}U)` : ""}`
          }
        />
      )}

      {/* Device hover tooltip (unracked) */}
      {showTooltip && hoverUnracked && hoverType && (
        <DeviceHoverCard
          device={hoverUnracked.device}
          type={hoverType}
          mouseX={mouse.x}
          mouseY={mouse.y}
          connections={connections}
          location="unracked"
        />
      )}

      {hoveredPair.length > 0 && (
        <ConnectionHoverCard
          connections={hoveredPair.map((x) => x.conn)}
          selectedDeviceName={devices.find((d) => d.id === selectedId)?.name ?? ""}
          mouseX={mouse.x}
          mouseY={mouse.y}
        />
      )}

      <ZoomControls onZoomIn={() => zoomBy(1 / 1.3)} onZoomOut={() => zoomBy(1.3)} onFit={fit} rightOffset={drawerOpen && drawerWidth ? `${drawerWidth + 16}px` : undefined} />
    </div>
  );
}
