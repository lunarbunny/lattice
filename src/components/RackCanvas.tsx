import { useEffect, useMemo, useRef, useState } from "react";
import type { Connection, Device, RackDecl } from "../lib/types";
import { TYPE_META } from "../lib/types";
import { inferType } from "../lib/topology";
import { buildRackLayout, RACK_HEAD, U_H } from "../lib/rackview";
import type { Rack, RackSlot } from "../lib/rackview";
import { usePanZoom } from "../lib/usePanZoom";
import ZoomControls from "./ZoomControls";
import { TypeIcon } from "./icons";

function uRange(s: RackSlot): string {
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
  racks: RackDecl[];
  connections: Connection[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  externalHoverConnId?: string | null;
}

export default function RackCanvas({ devices, racks, connections, selectedId, onSelect, externalHoverConnId }: Props) {
  const layout = useMemo(() => buildRackLayout(devices, racks), [devices, racks]);
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

  const { vb, fit, zoomBy, panRef, onPointerDown, onPointerMove, onPointerUp } = usePanZoom(
    containerRef,
    svgRef,
    totalBounds,
    [devices.length, racks.length, unrackedEntries.length],
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
        const contentX = g.x + r.x + 30;
        const contentW = r.w - 44;
        const cy = g.y + r.y + RACK_HEAD;
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

    if (isHorizontal) {
      const drop = U_H * 0.6 + pairIndex * 8;
      const cpOffset = Math.max(30, Math.abs(dx) * 0.25);
      return `M ${src.x} ${src.y} C ${src.x + cpOffset} ${src.y}, ${src.x + cpOffset} ${src.y + drop}, ${(src.x + dst.x) / 2} ${src.y + drop} C ${dst.x - cpOffset} ${src.y + drop}, ${dst.x - cpOffset} ${dst.y}, ${dst.x} ${dst.y}`;
    }

    const cpOffset = Math.max(40, Math.abs(dx) * 0.4);
    const stagger = pairTotal > 1 ? (pairIndex - (pairTotal - 1) / 2) * 6 : 0;
    return `M ${src.x} ${src.y} C ${src.x + cpOffset + stagger} ${src.y}, ${dst.x + cpOffset + stagger} ${dst.y}, ${dst.x} ${dst.y}`;
  };

  const renderSlot = (s: RackSlot, contentX: number, cy: number, cw: number, idx: number) => {
    const d = s.device;
    const t = inferType(d.name, d.model);
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
            fill={isSel ? "#1C2B4D" : isHover ? "#182645" : "#141F3B"}
            stroke={isSel || isHover ? col : "#263252"}
            strokeWidth={isSel ? 1.5 : 1.1}
          />
          <rect width={3.5} height={bh} rx={1.75} fill={col} />
          <g transform={`translate(9 ${(bh - 13) / 2})`} color={col}>
            <TypeIcon type={t} size={13} className="h-[13px] w-[13px]" />
          </g>
          <g transform={`translate(0 ${(bh - 28) / 2})`}>
            <text
              x={30}
              y={12.5}
              fontSize={11.5}
              fontWeight={600}
              fontFamily="IBM Plex Sans, sans-serif"
              fill={isSel || isHover ? "#F2F6FF" : "#C3CEE8"}
            >
              {fitText(d.name, cw - 30 - 18, NAME_FONT)}
            </text>
            <text x={30} y={24.5} fontSize={9.5} fontFamily="IBM Plex Mono, monospace" fill="#7C8DB5">
              {d.ip}
              {d.size > 1 ? ` · ${d.size}U` : ""}
            </text>
          </g>
          <circle
            cx={cw - 7.5}
            cy={bh / 2}
            r={3}
            fill="#4ADE80"
            className={isSel || isHover ? "blink" : undefined}
          />
        </g>
      </g>
    );
  };

  const renderRack = (rack: Rack) => {
    const { x, y, w, h, units } = rack;
    const contentX = x + 30;
    const contentW = w - 44;
    const cy = y + RACK_HEAD;
    const railBottom = cy + units * U_H;
    return (
      <g key={rack.key}>
        <path d={`M ${x + 2} ${y + RACK_HEAD - 8} H ${x + w - 2}`} stroke="#1B2542" />
        <text
          x={x + 14}
          y={y + 21}
          fontSize={13}
          fontWeight={700}
          fontFamily="Space Grotesk, sans-serif"
          fill="#E7EDF9"
        >
          {rack.label}
        </text>
        <text x={x + 14} y={y + 36} fontSize={9} fontFamily="IBM Plex Mono, monospace" fill="#5E6D94">
          {units}U · {rack.slots.length} mounted
          {rack.slots.length === 0 ? " · empty" : ""}
        </text>
        <line x1={x + 9} y1={cy} x2={x + 9} y2={railBottom} stroke="#263252" strokeWidth={1.2} />
        <line x1={x + w - 9} y1={cy} x2={x + w - 9} y2={railBottom} stroke="#263252" strokeWidth={1.2} />
        {Array.from({ length: units }, (_, i) => {
          const u = i + 1;
          const uy = cy + i * U_H;
          const occupied = rack.slots.some((s) => u >= s.u && u < s.u + s.device.size);
          return (
            <g key={u}>
              <circle cx={x + 9} cy={uy + U_H / 2} r={1} fill="#33406A" />
              <circle cx={x + w - 9} cy={uy + U_H / 2} r={1} fill="#33406A" />
              <text
                x={x + 19.5}
                y={uy + U_H / 2 + 2.5}
                fontSize={7.5}
                fontFamily="IBM Plex Mono, monospace"
                fill={occupied ? "#5E6D94" : "#3A4770"}
                textAnchor="middle"
              >
                {u}
              </text>
              {u > 1 && (
                <line x1={contentX} y1={uy} x2={contentX + contentW} y2={uy} stroke="#161F3A" />
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
            fill={isSel ? "#1C2B4D" : isHover ? "#182645" : "#141F3B"}
            stroke={isSel || isHover ? col : "#263252"}
            strokeWidth={isSel ? 1.5 : 1.1}
          />
          <rect width={3.5} height={bh} rx={1.75} fill={col} />
          <g transform={`translate(9 ${(bh - 13) / 2})`} color={col}>
            <TypeIcon type={t} size={13} className="h-[13px] w-[13px]" />
          </g>
          <text
            x={30}
            y={12.5}
            fontSize={11.5}
            fontWeight={600}
            fontFamily="IBM Plex Sans, sans-serif"
            fill={isSel || isHover ? "#F2F6FF" : "#C3CEE8"}
          >
            {fitText(d.name, cw - 30 - 18, NAME_FONT)}
          </text>
          <text x={30} y={24.5} fontSize={9.5} fontFamily="IBM Plex Mono, monospace" fill="#7C8DB5">
            {d.ip}
          </text>
          <circle
            cx={cw - 7.5}
            cy={bh / 2}
            r={3}
            fill="#4ADE80"
            className={isSel || isHover ? "blink" : undefined}
          />
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
          setMouse({ x: e.clientX, y: e.clientY });
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
            <circle cx="1.2" cy="1.2" r="1.2" fill="#18233F" />
          </pattern>
        </defs>
        <rect
          x={vb.x - 300}
          y={vb.y - 300}
          width={vb.w + 600}
          height={vb.h + 600}
          fill="url(#rack-dots)"
        />

        {/* Rack groups */}
        {layout.groups.map((g) => (
          <g key={g.name} transform={`translate(${g.x} ${g.y})`}>
            <rect
              width={g.w}
              height={g.h}
              rx={18}
              fill="#0F1A33"
              fillOpacity={0.5}
              stroke="#223055"
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
              fill={g.unassigned ? "#7C8DB5" : "#E7EDF9"}
            >
              {g.name}
            </text>
            <text
              x={g.w / 2}
              y={34}
              textAnchor="middle"
              fontSize={9}
              fontFamily="IBM Plex Mono, monospace"
              fill="#5E6D94"
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
              fill="#0E1730"
              stroke="#2A3A63"
              strokeWidth={1.5}
            />
            {g.racks.slice(1).map((r) => (
              <line
                key={`div-${r.key}`}
                x1={r.x}
                y1={g.rowY + 1}
                x2={r.x}
                y2={g.rowY + g.rowH - 1}
                stroke="#223055"
                strokeWidth={1.2}
              />
            ))}
            <rect x={g.rowX + 10} y={g.rowY + g.rowH} width={26} height={6} rx={2} fill="#17223E" />
            <rect
              x={g.rowX + g.rowW - 36}
              y={g.rowY + g.rowH}
              width={26}
              height={6}
              rx={2}
              fill="#17223E"
            />

            {g.racks.map(renderRack)}
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
              fill="#0F1A33"
              fillOpacity={0.5}
              stroke="#223055"
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
              fill="#7C8DB5"
            >
              Unracked
            </text>
            <text
              x={unrackedEntries[0].x + UNRACKED_W / 2}
              y={unrackedEntries[0].y - 4}
              textAnchor="middle"
              fontSize={9}
              fontFamily="IBM Plex Mono, monospace"
              fill="#5E6D94"
            >
              {unrackedEntries.length} device{unrackedEntries.length === 1 ? "" : "s"}
            </text>
            {unrackedEntries.map(renderUnrackedDevice)}
          </g>
        )}

        {/* Connection lines — one per pair, thicker when multiple links exist */}
        {(() => {
          const seen = new Set<string>();
          const pairs: { pairKey: string; srcPos: DotPos; dstPos: DotPos; count: number; hasFibre: boolean; hasEth: boolean }[] = [];
          for (const x of activeConnections) {
            if (seen.has(x.pairKey) || !x.srcPos || !x.dstPos) continue;
            seen.add(x.pairKey);
            const group = activeConnections.filter((y) => y.pairKey === x.pairKey);
            pairs.push({
              pairKey: x.pairKey,
              srcPos: x.srcPos,
              dstPos: x.dstPos,
              count: group.length,
              hasFibre: group.some((g) => g.conn.medium === "fibre"),
              hasEth: group.some((g) => g.conn.medium === "ethernet"),
            });
          }
          return pairs.map((p) => {
            const isSvgHover = hoverPairKey === p.pairKey;
            const isExternalHover = externalHoverConnId != null && activeConnections.some(
              (x) => x.conn.id === externalHoverConnId && x.pairKey === p.pairKey
            );
            const isPairHover = isSvgHover || isExternalHover;
            const baseWidth = 1.5 + (p.count - 1) * 1.2;
            const width = isPairHover ? baseWidth + 1 : baseWidth;
            const color = p.hasFibre && p.hasEth ? "#A78BFA" : p.hasFibre ? "#FBBF24" : "#3B82F6";
            const dash = p.hasFibre && !p.hasEth ? "6 4" : p.hasFibre && p.hasEth ? "4 3 2 3" : undefined;
            const path = connPath(p.srcPos, p.dstPos, 0, 1);
            return (
              <g key={p.pairKey}>
                <path
                  d={path}
                  fill="none"
                  stroke={isPairHover ? "#4ADE80" : color}
                  strokeWidth={width}
                  strokeOpacity={isPairHover ? 0.9 : 0.5}
                  strokeDasharray={dash}
                  strokeLinecap="round"
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
          });
        })()}
      </svg>

      {/* Device hover tooltip (racked) */}
      {showTooltip && hoverInfo && hoverType && (
        <div
          className="pointer-events-none fixed z-50 w-64 rounded-lg border border-line bg-raised/95 p-3 shadow-xl shadow-black/50 backdrop-blur"
          style={{
            left: Math.min(mouse.x + 16, window.innerWidth - 270),
            top: Math.min(mouse.y + 14, window.innerHeight - 150),
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{
                color: TYPE_META[hoverType].color,
                background: `${TYPE_META[hoverType].color}1f`,
              }}
            >
              <TypeIcon type={hoverType} size={16} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-txt">{hoverInfo.s.device.name}</p>
              <p className="font-mono text-[11px] text-mute">{hoverInfo.s.device.ip}</p>
            </div>
          </div>
          {hoverInfo.s.device.model && (
            <p className="mt-1.5 truncate font-mono text-[10.5px] text-mute">
              <span className="text-faint">model · </span>
              {hoverInfo.s.device.model}
            </p>
          )}
          <p className="mt-2 font-mono text-[10.5px] text-brand">
            {hoverInfo.g.unassigned
              ? `unracked · ${uRange(hoverInfo.s)}`
              : `${hoverInfo.g.name} · ${hoverInfo.r.label} · ${uRange(hoverInfo.s)}`}
            {hoverInfo.s.device.size > 1 ? ` (${hoverInfo.s.device.size}U)` : ""}
          </p>
          {hoverInfo.s.device.notes && (
            <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-mute">
              {hoverInfo.s.device.notes}
            </p>
          )}
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-faint">
            click to inspect
          </p>
        </div>
      )}

      {/* Device hover tooltip (unracked) */}
      {showTooltip && hoverUnracked && hoverType && (
        <div
          className="pointer-events-none fixed z-50 w-64 rounded-lg border border-line bg-raised/95 p-3 shadow-xl shadow-black/50 backdrop-blur"
          style={{
            left: Math.min(mouse.x + 16, window.innerWidth - 270),
            top: Math.min(mouse.y + 14, window.innerHeight - 150),
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{
                color: TYPE_META[hoverType].color,
                background: `${TYPE_META[hoverType].color}1f`,
              }}
            >
              <TypeIcon type={hoverType} size={16} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-txt">{hoverUnracked.device.name}</p>
              <p className="font-mono text-[11px] text-mute">{hoverUnracked.device.ip}</p>
            </div>
          </div>
          {hoverUnracked.device.model && (
            <p className="mt-1.5 truncate font-mono text-[10.5px] text-mute">
              <span className="text-faint">model · </span>
              {hoverUnracked.device.model}
            </p>
          )}
          <p className="mt-2 font-mono text-[10.5px] text-brand">unracked</p>
          {hoverUnracked.device.notes && (
            <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-mute">
              {hoverUnracked.device.notes}
            </p>
          )}
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-faint">
            click to inspect
          </p>
        </div>
      )}

      {/* Connection hover tooltip (grouped by remote device) */}
      {hoveredPair.length > 0 && (() => {
        const selName = devices.find((d) => d.id === selectedId)?.name ?? "";
        const groups = new Map<string, typeof hoveredPair>();
        for (const x of hoveredPair) {
          const selLower = selName.toLowerCase();
          const isSrc = x.conn.srcDevice.toLowerCase() === selLower;
          const remote = isSrc ? x.conn.dstDevice : x.conn.srcDevice;
          const key = remote.toLowerCase();
          const list = groups.get(key) ?? [];
          list.push(x);
          groups.set(key, list);
        }
        return (
          <div
            className="pointer-events-none fixed z-50 w-72 rounded-lg border border-emerald-400/30 bg-raised/95 p-3 shadow-xl shadow-black/50 backdrop-blur"
            style={{
              left: Math.min(mouse.x + 16, window.innerWidth - 310),
              top: Math.min(mouse.y + 14, window.innerHeight - 200),
            }}
          >
            <div className="space-y-2.5">
              {[...groups.entries()].map(([remoteKey, items]) => {
                const remoteName = items[0].conn.srcDevice.toLowerCase() === selName.toLowerCase()
                  ? items[0].conn.dstDevice
                  : items[0].conn.srcDevice;
                return (
                  <div key={remoteKey}>
                    <div className="relative flex items-center">
                      <p className="truncate font-mono text-[11.5px] font-medium text-txt">{selName}</p>
                      <span className="absolute left-1/2 -translate-x-1/2 shrink-0 px-1 text-faint text-[10px]">⟷</span>
                      <span className="flex-1" />
                      <p className="truncate font-mono text-[11.5px] font-medium text-txt">{remoteName}</p>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {items.map(({ conn }) => {
                        const selLower = selName.toLowerCase();
                        const isSrc = conn.srcDevice.toLowerCase() === selLower;
                        const localPort = isSrc ? conn.srcPort : conn.dstPort;
                        const remotePort = isSrc ? conn.dstPort : conn.srcPort;
                        return (
                          <div key={conn.id} className="relative flex items-center font-mono text-[10px]">
                            <span className="rounded bg-brand/12 px-1 py-0.5 text-brand">{localPort}</span>
                            <span
                              className="absolute left-1/2 -translate-x-1/2 shrink-0 rounded px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider"
                              style={{
                                background: conn.medium === "fibre" ? "#FBBF2418" : "#3B82F618",
                                color: conn.medium === "fibre" ? "#FBBF24" : "#3B82F6",
                              }}
                            >
                              {conn.medium}
                            </span>
                            <span className="flex-1" />
                            <span className="rounded bg-brand/12 px-1 py-0.5 text-brand">{remotePort}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <ZoomControls onZoomIn={() => zoomBy(1 / 1.3)} onZoomOut={() => zoomBy(1.3)} onFit={fit} />
    </div>
  );
}
