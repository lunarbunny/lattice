import { useMemo, useRef, useState } from "react";
import type { Connection, Device } from "../lib/types";
import { TYPE_META } from "../lib/types";
import { inferType, buildTopologyView, LEAF_W, NODE_R } from "../lib/layout/topology";
import type { TopologyNode } from "../lib/layout/topology";
import { usePanZoom } from "../lib/usePanZoom";
import ZoomControls from "./ZoomControls";
import { TypeIcon } from "./Icons";
import { parseCidr } from "../lib/cidr";
import { getPrimaryIp } from "../lib/helpers";
import DeviceHoverCard from "./DeviceHoverCard";
import {
  NODE_FILL, NODE_FILL_ACTIVE, NODE_FILL_NO_GW,
  CARD_STROKE,
  TEXT_NAME, TEXT_NAME_ACTIVE, TEXT_SUBLABEL, TEXT_TERTIARY, TEXT_LINK,
  DOT_CONNECTED,
  CONTAINER_INNER_FILL, CONTAINER_INNER_STROKE,
  EDGE_STROKE, EDGE_FLOW,
  INTERNET_COLOUR, NO_GATEWAY_COLOUR,
} from "../lib/colours";

const AUTO_COLLAPSE_THRESHOLD = 9;

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

interface Props {
  devices: Device[];
  connections: Connection[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  externalHoverDeviceId?: string | null;
  isHorizontal?: boolean;
  leafSpacing?: number;
  drawerOpen?: boolean;
  drawerWidth?: number;
}

export default function TopologyCanvas({ devices, connections, selectedId, onSelect, externalHoverDeviceId, isHorizontal = false, leafSpacing, drawerOpen, drawerWidth }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [manualExpanded, setManualExpanded] = useState<Set<string>>(() => new Set());
  const [manualCollapsed, setManualCollapsed] = useState<Set<string>>(() => new Set());

  const autoCollapsed = useMemo(() => {
    const s = new Set<string>();
    const bySubnet = new Map<string, number>();
    for (const d of devices) {
      const info = parseCidr(getPrimaryIp(d, connections));
      if (info) bySubnet.set(info.key, (bySubnet.get(info.key) ?? 0) + 1);
    }
    for (const [key, count] of bySubnet) {
      if (count > AUTO_COLLAPSE_THRESHOLD) s.add(key);
    }
    return s;
  }, [devices]);

  const collapsedSubnets = useMemo(() => {
    const s = new Set(autoCollapsed);
    for (const k of manualExpanded) s.delete(k);
    for (const k of manualCollapsed) s.add(k);
    return s;
  }, [autoCollapsed, manualExpanded, manualCollapsed]);

  const topo = useMemo(
    () => buildTopologyView(devices, connections, { collapsedSubnets, isHorizontal, leafSpacing }),
    [devices, connections, collapsedSubnets, isHorizontal, leafSpacing],
  );

  const { vb, isPanning, fit, zoomBy, panRef, onPointerDown, onPointerMove, onPointerUp } = usePanZoom(
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

  const edgePath = (a: TopologyNode, b: TopologyNode) => {
    if (isHorizontal) {
      const x1 = a.x + NODE_R + 6;
      const y1 = a.y;
      const x2 = b.x - NODE_R - 6;
      const y2 = b.y;
      const midX = (x1 + x2) / 2;
      return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
    }
    const x1 = a.x;
    const y1 = a.y + NODE_R + 6;
    const x2 = b.x;
    const y2 = b.y - NODE_R - 6;
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  };

  const toggleSubnet = (subnet: string) => {
    setManualExpanded((prev) => {
      const next = new Set(prev);
      if (collapsedSubnets.has(subnet)) next.add(subnet);
      else next.delete(subnet);
      return next;
    });
    setManualCollapsed((prev) => {
      const next = new Set(prev);
      if (!collapsedSubnets.has(subnet)) next.add(subnet);
      else next.delete(subnet);
      return next;
    });
  };

  const renderNode = (n: TopologyNode, idx: number) => {
    const isInternet = n.kind === "internet";
    const isNoGateway = n.kind === "no-gateway";
    const isCollapsed = !isInternet && !!n.subnet && collapsedSubnets.has(n.subnet);
    const col = isInternet ? "#38BDF8" : isNoGateway ? "#64748B" : TYPE_META[n.type].color;
    const isSel = n.id === selectedId;
    const isHover = n.id === hoverId || n.id === externalHoverDeviceId;
    return (
      <g
        key={n.id}
        data-node={isInternet || isNoGateway || isCollapsed ? undefined : ""}
        transform={`translate(${n.x} ${n.y})`}
        className={isInternet || isNoGateway ? undefined : "cursor-pointer"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (isCollapsed && n.subnet) {
            toggleSubnet(n.subnet);
            return;
          }
          if (!isInternet && !isNoGateway) onSelect(n.id);
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
            strokeOpacity={isSel || isHover ? 0.55 : isNoGateway ? 0.25 : 0.14}
            strokeWidth={isSel ? 1.6 : 1.2}
            strokeDasharray={isSel ? undefined : isNoGateway ? "5 5" : "3 5"}
            className={isSel ? "ants" : undefined}
          />
          {isInternet && (
            <circle
              r={NODE_R + 12}
              fill="none"
              stroke={INTERNET_COLOUR}
              strokeOpacity={0.25}
              strokeWidth={1.4}
              strokeDasharray="2 9"
              className="spin-ring"
            />
          )}
          <circle
            r={NODE_R}
            fill={isNoGateway ? NODE_FILL_NO_GW : isSel || isHover ? NODE_FILL_ACTIVE : NODE_FILL}
            stroke={col}
            strokeOpacity={isSel ? 1 : isHover ? 0.9 : isNoGateway ? 0.4 : 0.65}
            strokeWidth={isSel ? 2 : 1.5}
            strokeDasharray={isNoGateway ? "4 3" : undefined}
          />
          <g transform={`translate(-12 -12)`} color={col}>
            <TypeIcon type={isInternet ? "internet" : isNoGateway ? "no-gateway" : n.type} className="h-6 w-6" size={24} />
          </g>
          {isInternet && <circle cx={NODE_R - 4} cy={-NODE_R + 4} r={3.2} fill={DOT_CONNECTED} className="blink" />}
          {!isInternet && n.subnet && (
            <g
              transform={`translate(${-NODE_R + 4} ${NODE_R - 4})`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                toggleSubnet(n.subnet!);
              }}
            >
              <circle r={8} fill={CONTAINER_INNER_FILL} stroke={isCollapsed ? "#3B82F6" : CARD_STROKE} strokeWidth={1.2} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontWeight={700}
                fontFamily="IBM Plex Mono, monospace"
                fill={isCollapsed ? TEXT_LINK : TEXT_SUBLABEL}
              >
                {isCollapsed ? "+" : "−"}
              </text>
            </g>
          )}
          {(() => {
            const vLeaf = isHorizontal && n.children.length === 0;
            return <>
              <text
                x={vLeaf ? NODE_R + 14 : 0}
                y={vLeaf ? -4 : NODE_R + 22}
                textAnchor={vLeaf ? "start" : "middle"}
                fontSize={12.5}
                fontWeight={600}
                fontFamily="IBM Plex Sans, sans-serif"
                fill={isSel || isHover ? TEXT_NAME_ACTIVE : TEXT_NAME}
              >
                {trunc(n.label, 20)}
              </text>
              <text
                x={vLeaf ? NODE_R + 14 : 0}
                y={vLeaf ? 12 : NODE_R + 37}
                textAnchor={vLeaf ? "start" : "middle"}
                fontSize={10.5}
                fontFamily="IBM Plex Mono, monospace"
                fill={isInternet ? TEXT_TERTIARY : TEXT_SUBLABEL}
              >
                {isInternet ? "WAN uplink" : n.sublabel}
              </text>
            </>;
          })()}
          {isCollapsed && (
            <g
              transform={!isHorizontal && n.children.length === 0 ? `translate(${-NODE_R - 50} 0)` : `translate(0 ${-NODE_R - 18})`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (n.subnet) toggleSubnet(n.subnet);
              }}
            >
              <rect
                x={-44}
                y={-10}
                width={88}
                height={17}
                rx={8.5}
                fill={CONTAINER_INNER_FILL}
                stroke="#3B82F6"
                strokeOpacity={0.5}
              />
              <text
                textAnchor="middle"
                y={2.5}
                fontSize={9.5}
                fontFamily="IBM Plex Mono, monospace"
                fill={TEXT_LINK}
              >
                {n.memberCount} device{n.memberCount === 1 ? "" : "s"}
              </text>
            </g>
          )}
          {!isInternet && !isCollapsed && n.subnet && (
            <g transform={!isHorizontal && n.children.length === 0 ? `translate(${-NODE_R - 50} 0)` : `translate(0 ${-NODE_R - 18})`} className="group/badge">
              <rect
                x={-44}
                y={-10}
                width={88}
                height={17}
                rx={8.5}
                fill={CONTAINER_INNER_FILL}
                stroke={CARD_STROKE}
              />
              <text
                textAnchor="middle"
                y={2.5}
                fontSize={9.5}
                fontFamily="IBM Plex Mono, monospace"
                fill={TEXT_SUBLABEL}
              >
                {n.memberCount} device{n.memberCount === 1 ? "" : "s"}
              </text>
              <text
                textAnchor="middle"
                y={2.5}
                fontSize={9.5}
                fontFamily="IBM Plex Mono, monospace"
                fill={TEXT_SUBLABEL}
                opacity={0}
                className="transition-opacity duration-150 group-hover/badge:opacity-100"
              >
                {n.subnet}
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
          if (!panRef.current) setMouse({ x: e.clientX, y: e.clientY });
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
        {!isPanning && (
          <rect
            x={vb.x - 300}
            y={vb.y - 300}
            width={vb.w + 600}
            height={vb.h + 600}
            fill="url(#topo-dots)"
          />
        )}

        {topo.edges.map((e, i) => (
          <g key={e.id}>
            <path
              d={edgePath(e.from, e.to)}
              fill="none"
              stroke={EDGE_STROKE}
              strokeWidth={1.4}
              pathLength={1}
              className="edge-draw"
              style={{ animationDelay: `${Math.min(i, 30) * 40}ms` }}
            />
            <path
              d={edgePath(e.from, e.to)}
              fill="none"
              stroke={EDGE_FLOW}
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
        <DeviceHoverCard
          device={hoverNode.device}
          type={hoverNode.type}
          mouseX={mouse.x}
          mouseY={mouse.y}
          connections={connections}
          location={
            hoverNode.device.rackId
              ? `rack ${hoverNode.device.rackId}${hoverNode.device.mountIndex != null ? ` · U${hoverNode.device.mountIndex}` : ""}`
              : undefined
          }
        />
      )}

      <ZoomControls onZoomIn={() => zoomBy(1 / 1.3)} onZoomOut={() => zoomBy(1.3)} onFit={fit} rightOffset={drawerOpen && drawerWidth ? `${drawerWidth + 16}px` : undefined} />
    </div>
  );
}
