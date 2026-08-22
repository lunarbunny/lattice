import { useMemo, useRef, useState } from "react";
import type { Device } from "../lib/types";
import { TYPE_META } from "../lib/types";
import { inferType, buildTopology, LEAF_W, NODE_R } from "../lib/topology";
import type { TopoNode } from "../lib/topology";
import { usePanZoom } from "../lib/usePanZoom";
import ZoomControls from "./ZoomControls";
import { TypeIcon } from "./icons";

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

interface Props {
  devices: Device[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function TopologyCanvas({ devices, selectedId, onSelect }: Props) {
  const topo = useMemo(() => buildTopology(devices), [devices]);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const { vb, fit, zoomBy, panRef, onPointerDown, onPointerMove, onPointerUp } = usePanZoom(
    containerRef,
    svgRef,
    { width: topo.width, height: topo.height },
    [devices.length],
    (e) => {
      const target = e.target as Element | null;
      if (!target || !target.closest("[data-node]")) onSelect(null);
    }
  );

  const hoverNode = useMemo(
    () => topo.nodes.find((n) => n.id === hoverId) ?? null,
    [hoverId, topo]
  );

  const showTooltip = !!hoverNode && !panRef.current;

  const edgePath = (a: TopoNode, b: TopoNode) => {
    const x1 = a.x;
    const y1 = a.y + NODE_R + 6;
    const x2 = b.x;
    const y2 = b.y - NODE_R - 6;
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  };

  const renderNode = (n: TopoNode, idx: number) => {
    const isInternet = n.kind === "internet";
    const col = isInternet ? "#38BDF8" : TYPE_META[n.type].color;
    const isSel = n.id === selectedId;
    const isHover = n.id === hoverId;
    return (
      <g
        key={n.id}
        data-node={isInternet ? undefined : ""}
        transform={`translate(${n.x} ${n.y})`}
        className="cursor-pointer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (!isInternet) onSelect(n.id);
        }}
        onMouseEnter={() => setHoverId(n.id)}
        onMouseLeave={() => setHoverId((h) => (h === n.id ? null : h))}
      >
        <g
          className="node-pop"
          style={{ animationDelay: `${Math.min(idx, 24) * 35}ms` }}
        >
          {/* connection halo */}
          <circle
            r={NODE_R + 7}
            fill="none"
            stroke={col}
            strokeOpacity={isSel || isHover ? 0.55 : 0.14}
            strokeWidth={isSel ? 1.6 : 1.2}
            strokeDasharray={isSel ? undefined : "3 5"}
            className={isSel ? "ants" : undefined}
          />
          {isInternet && (
            <circle
              r={NODE_R + 12}
              fill="none"
              stroke="#38BDF8"
              strokeOpacity={0.25}
              strokeWidth={1.4}
              strokeDasharray="2 9"
              className="spin-ring"
            />
          )}
          <circle
            r={NODE_R}
            fill={isSel || isHover ? "#1B2A4B" : "#131F3A"}
            stroke={col}
            strokeOpacity={isSel ? 1 : isHover ? 0.9 : 0.65}
            strokeWidth={isSel ? 2 : 1.5}
          />
          <g transform={`translate(-12 -12)`} color={col}>
            <TypeIcon type={isInternet ? "internet" : n.type} className="h-6 w-6" size={24} />
          </g>
          {isInternet && <circle cx={NODE_R - 4} cy={-NODE_R + 4} r={3.2} fill="#4ADE80" className="blink" />}
          {!isInternet && n.device && (
            <circle cx={NODE_R - 4} cy={-NODE_R + 4} r={3} fill="#4ADE80" />
          )}
          <text
            y={NODE_R + 22}
            textAnchor="middle"
            fontSize={12.5}
            fontWeight={600}
            fontFamily="IBM Plex Sans, sans-serif"
            fill={isSel || isHover ? "#F2F6FF" : "#C3CEE8"}
          >
            {trunc(n.label, 20)}
          </text>
          <text
            y={NODE_R + 37}
            textAnchor="middle"
            fontSize={10.5}
            fontFamily="IBM Plex Mono, monospace"
            fill={isInternet ? "#5E6D94" : "#7C8DB5"}
          >
            {isInternet ? "WAN uplink" : n.sublabel}
          </text>
          {!isInternet && n.subnet && (
            <g transform={`translate(0 ${-NODE_R - 18})`}>
              <rect
                x={-44}
                y={-10}
                width={88}
                height={17}
                rx={8.5}
                fill="#0E1730"
                stroke="#263252"
              />
              <text
                textAnchor="middle"
                y={2.5}
                fontSize={9.5}
                fontFamily="IBM Plex Mono, monospace"
                fill="#7C8DB5"
              >
                {n.subnet} · {n.memberCount}
              </text>
            </g>
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
          setMouse({ x: e.clientX, y: e.clientY });
          onPointerMove(e);
        }}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHoverId(null)}
        role="img"
        aria-label="Network topology diagram"
      >
        <defs>
          <pattern id="topo-dots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="1.2" fill="#18233F" />
          </pattern>
        </defs>
        <rect
          x={vb.x - 300}
          y={vb.y - 300}
          width={vb.w + 600}
          height={vb.h + 600}
          fill="url(#topo-dots)"
        />

        {topo.edges.map((e, i) => (
          <g key={e.id}>
            <path
              d={edgePath(e.from, e.to)}
              fill="none"
              stroke="#2B3A61"
              strokeWidth={1.4}
              pathLength={1}
              className="edge-draw"
              style={{ animationDelay: `${Math.min(i, 30) * 40}ms` }}
            />
            <path
              d={edgePath(e.from, e.to)}
              fill="none"
              stroke="#3E5386"
              strokeOpacity={0.55}
              strokeWidth={1.4}
              className="edge-flow"
              style={{ animationDelay: `${Math.min(i, 30) * 60}ms` }}
            />
          </g>
        ))}

        {topo.nodes.map(renderNode)}
      </svg>

      {showTooltip && hoverNode && hoverNode.device && (
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
                color: TYPE_META[inferType(hoverNode.device.name, hoverNode.device.model)].color,
                background: `${TYPE_META[inferType(hoverNode.device.name, hoverNode.device.model)].color}1f`,
              }}
            >
              <TypeIcon type={hoverNode.type} size={16} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-txt">{hoverNode.device.name}</p>
              <p className="font-mono text-[11px] text-mute">{hoverNode.device.ip}</p>
            </div>
          </div>
          {hoverNode.device.model && (
            <p className="mt-1.5 truncate font-mono text-[10.5px] text-mute">
              <span className="text-faint">model · </span>
              {hoverNode.device.model}
            </p>
          )}
          {hoverNode.device.notes && (
            <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-mute">
              {hoverNode.device.notes}
            </p>
          )}
          {hoverNode.device.rackId && (
            <p className="mt-2 font-mono text-[10.5px] text-brand">
              rack {hoverNode.device.rackId}
              {hoverNode.device.mountIndex != null ? ` · U${hoverNode.device.mountIndex}` : ""}
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
