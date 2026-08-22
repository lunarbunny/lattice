import { useMemo, useRef, useState } from "react";
import type { Device, RackDecl } from "../lib/types";
import { TYPE_META } from "../lib/types";
import { inferType } from "../lib/topology";
import { buildRackLayout, RACK_HEAD, U_H } from "../lib/rackview";
import type { Rack, RackSlot } from "../lib/rackview";
import { usePanZoom } from "../lib/usePanZoom";
import ZoomControls from "./ZoomControls";
import { TypeIcon } from "./icons";

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function uRange(s: RackSlot): string {
  const end = s.u + s.device.size - 1;
  return s.device.size > 1 ? `U${s.u}–U${end}` : `U${s.u}`;
}

interface Props {
  devices: Device[];
  racks: RackDecl[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function RackCanvas({ devices, racks, selectedId, onSelect }: Props) {
  const layout = useMemo(() => buildRackLayout(devices, racks), [devices, racks]);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const { vb, fit, zoomBy, panRef, onPointerDown, onPointerMove, onPointerUp } = usePanZoom(
    containerRef,
    svgRef,
    { width: layout.width, height: layout.height },
    [devices.length, racks.length],
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

  const hoverType = hoverInfo ? inferType(hoverInfo.s.device.name, hoverInfo.s.device.model) : null;
  const showTooltip = !!hoverInfo && !panRef.current;

  const renderSlot = (s: RackSlot, contentX: number, cy: number, cw: number, idx: number) => {
    const d = s.device;
    const t = inferType(d.name, d.model);
    const col = TYPE_META[t].color;
    const y = cy + (s.u - 1) * U_H + 3;
    const bh = U_H - 6;
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
          <text
            x={30}
            y={12.5}
            fontSize={11.5}
            fontWeight={600}
            fontFamily="IBM Plex Sans, sans-serif"
            fill={isSel || isHover ? "#F2F6FF" : "#C3CEE8"}
          >
            {trunc(d.name, 14)}
          </text>
          <text x={30} y={24.5} fontSize={9.5} fontFamily="IBM Plex Mono, monospace" fill="#7C8DB5">
            {d.ip}
            {d.size > 1 ? ` · ${d.size}U` : ""}
          </text>
          <circle
            cx={cw - 7.5}
            cy={bh / 2}
            r={2}
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
        {/* header shelf line (the shared row frame is drawn once per group) */}
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
        {/* rails */}
        <line x1={x + 9} y1={cy} x2={x + 9} y2={railBottom} stroke="#263252" strokeWidth={1.2} />
        <line x1={x + w - 9} y1={cy} x2={x + w - 9} y2={railBottom} stroke="#263252" strokeWidth={1.2} />
        {/* U ticks, labels and slot dividers */}
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
        onPointerLeave={() => setHoverId(null)}
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
              x={20}
              y={19}
              fontSize={14}
              fontWeight={700}
              fontFamily="Space Grotesk, sans-serif"
              fill={g.unassigned ? "#7C8DB5" : "#E7EDF9"}
            >
              {g.name}
            </text>
            <text x={20} y={34} fontSize={9} fontFamily="IBM Plex Mono, monospace" fill="#5E6D94">
              {g.racks.length} rack{g.racks.length === 1 ? "" : "s"} · {g.deviceCount} device
              {g.deviceCount === 1 ? "" : "s"}
            </text>

            {/* contiguous rack row: one shared frame, racks flush side by side */}
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
            {/* row feet */}
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
      </svg>

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

      <ZoomControls onZoomIn={() => zoomBy(1 / 1.3)} onZoomOut={() => zoomBy(1.3)} onFit={fit} />
    </div>
  );
}
