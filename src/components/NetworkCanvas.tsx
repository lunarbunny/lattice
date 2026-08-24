import { useEffect, useMemo, useRef, useState } from "react";
import type { Connection, Device } from "../lib/types";
import { TYPE_META } from "../lib/types";
import { inferType } from "../lib/layout/topology";
import { parseCidr } from "../lib/cidr";
import { buildNetworkView, SUBNET_HEAD, SUBNET_W, DEV_H } from "../lib/layout/network";
import type { PositionedSubnet } from "../lib/layout/network";
import { usePanZoom } from "../lib/usePanZoom";
import ZoomControls from "./ZoomControls";
import { TypeIcon } from "./Icons";
import DeviceHoverCard from "./DeviceHoverCard";
import ConnectionHoverCard from "./ConnectionHoverCard";
import { getPrimaryIp } from "../lib/helpers";

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
    if (textWidth(text.slice(0, mid).trimEnd() + "\u2026", font) <= maxWidth) lo = mid;
    else hi = mid;
  }
  return text.slice(0, Math.max(1, lo)).trimEnd() + "\u2026";
}

interface DotPos {
  x: number;
  y: number;
}

const CARD_PAD = 16;

interface Props {
  devices: Device[];
  connections: Connection[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  externalHoverDeviceId?: string | null;
  drawerOpen?: boolean;
  drawerWidth?: number;
}

export default function NetworkCanvas({
  devices,
  connections,
  selectedId,
  onSelect,
  externalHoverDeviceId,
  drawerOpen,
  drawerWidth,
}: Props) {
  const layout = useMemo(() => buildNetworkView(devices, connections), [devices, connections]);
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
    return () => {
      live = false;
    };
  }, []);

  const { vb, isPanning, fit, zoomBy, panRef, onPointerDown, onPointerMove, onPointerUp } = usePanZoom(
    containerRef,
    svgRef,
    { width: layout.width, height: layout.height },
    [devices.length],
    (e) => {
      const target = e.target as Element | null;
      if (!target || !target.closest("[data-node]")) onSelect(null);
    }
  );

  const dotPositions = useMemo(() => {
    const map = new Map<string, DotPos>();
    const contentW = SUBNET_W - CARD_PAD * 2;
    for (const subnet of layout.subnets) {
      const contentX = subnet.x + CARD_PAD;
      subnet.devices.forEach((d, i) => {
        const cardY = subnet.y + SUBNET_HEAD + 6 + i * DEV_H;
        const cardH = DEV_H - 4;
        map.set(d.name.toLowerCase(), {
          x: contentX + contentW - 7.5,
          y: cardY + cardH / 2,
        });
      });
    }
    return map;
  }, [layout]);

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

  const hoveredPair = useMemo(() => {
    if (!hoverPairKey) return [];
    return activeConnections.filter((x) => x.pairKey === hoverPairKey);
  }, [hoverPairKey, activeConnections]);

  const hoverInfo = useMemo(() => {
    if (!hoverId) return null;
    for (const subnet of layout.subnets) {
      const dev = subnet.devices.find((d) => d.id === hoverId);
      if (dev) return { subnet, device: dev };
    }
    return null;
  }, [hoverId, layout]);

  const hoverType = hoverInfo
    ? inferType(hoverInfo.device.name, hoverInfo.device.model)
    : null;
  const showTooltip = !!hoverInfo && !panRef.current;

  const gatewayIds = useMemo(() => {
    const map = new Map<string, { id: string; explicit: boolean }>();
    for (const subnet of layout.subnets) {
      const explicit = subnet.devices
        .filter((d) => d.isGateway)
        .sort((a, b) => (parseCidr(getPrimaryIp(a, connections))?.hostId ?? 999) - (parseCidr(getPrimaryIp(b, connections))?.hostId ?? 999));
      if (explicit.length > 0) {
        map.set(subnet.key, { id: explicit[0].id, explicit: true });
        continue;
      }
      const candidates = subnet.devices
        .filter((d) => {
          const t = inferType(d.name, d.model);
          return t === "router" || t === "firewall";
        })
        .sort((a, b) => (parseCidr(getPrimaryIp(a, connections))?.hostId ?? 999) - (parseCidr(getPrimaryIp(b, connections))?.hostId ?? 999));
      if (candidates.length > 0) {
        map.set(subnet.key, { id: candidates[0].id, explicit: false });
      }
    }
    return map;
  }, [layout]);

  const connPath = (src: DotPos, dst: DotPos) => {
    const dy = dst.y - src.y;
    const absDy = Math.abs(dy);
    const cpOff = Math.max(44, Math.abs(dst.x - src.x) * 0.35);

    if (absDy < 4) {
      const bulge = Math.max(30, Math.abs(dst.x - src.x) * 0.25) + 10;
      const dir = src.y < vb.y + vb.h / 2 ? -1 : 1;
      const midX = (src.x + dst.x) / 2;
      return `M ${src.x} ${src.y} C ${midX} ${src.y + dir * bulge}, ${midX} ${dst.y + dir * bulge}, ${dst.x} ${dst.y}`;
    }

    return `M ${src.x} ${src.y} C ${src.x + cpOff} ${src.y}, ${dst.x + cpOff} ${dst.y}, ${dst.x} ${dst.y}`;
  };

  const renderDevice = (d: Device, subnet: PositionedSubnet, idx: number) => {
    const t = inferType(d.name, d.model);
    const col = TYPE_META[t].color;
    const contentW = subnet.w - CARD_PAD * 2;
    const cardX = subnet.x + CARD_PAD;
    const cardY = subnet.y + SUBNET_HEAD + 6 + idx * DEV_H;
    const cardH = DEV_H - 4;
    const isSel = selectedId === d.id;
    const isHover = hoverId === d.id || externalHoverDeviceId === d.id;
    const gwInfo = gatewayIds.get(subnet.key);
    const isGw = gwInfo?.id === d.id;
    const isExplicitGw = isGw && gwInfo?.explicit;

    return (
      <g
        key={d.id}
        data-node
        transform={`translate(${cardX} ${cardY})`}
        className="cursor-pointer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(d.id);
        }}
        onMouseEnter={() => setHoverId(d.id)}
        onMouseLeave={() => setHoverId((h) => (h === d.id ? null : h))}
      >
        <g className="unit-in" style={{ animationDelay: `${Math.min(idx, 30) * 28}ms` }}>
          {isSel && (
            <rect
              x={-3}
              y={-2.5}
              width={contentW + 6}
              height={cardH + 5}
              rx={5}
              fill="none"
              stroke={col}
              strokeWidth={1.2}
              className="ants"
            />
          )}
          <rect
            width={contentW}
            height={cardH}
            rx={4}
            fill={isSel ? "#1C2B4D" : isHover ? "#182645" : isGw && !isExplicitGw ? "#16203E" : "#141F3B"}
            stroke={isSel || isHover ? col : isGw && !isExplicitGw ? "#FBBF2460" : "#263252"}
            strokeWidth={isSel ? 1.5 : isGw && !isExplicitGw ? 1.3 : 1.1}
          />
          <rect width={3.5} height={cardH} rx={1.75} fill={col} />
          <g transform={`translate(9 ${(cardH - 13) / 2})`} color={col}>
            <TypeIcon type={t} size={13} className="h-[13px] w-[13px]" />
          </g>
          <g transform={`translate(0 ${(cardH - 28) / 2})`}>
            <text
              x={30}
              y={12.5}
              fontSize={11.5}
              fontWeight={600}
              fontFamily="IBM Plex Sans, sans-serif"
              fill={isSel || isHover ? "#F2F6FF" : "#C3CEE8"}
            >
              {fitText(d.name, contentW - 30 - 18, NAME_FONT)}
            </text>
            <text
              x={30}
              y={24.5}
              fontSize={9.5}
              fontFamily="IBM Plex Mono, monospace"
              fill="#7C8DB5"
            >
              {getPrimaryIp(d, connections) ?? "passive"}
            </text>
          </g>
          <circle
            cx={contentW - 7.5}
            cy={cardH / 2}
            r={3}
            fill="#4ADE80"
            className={isSel || isHover ? "blink" : undefined}
          />
          {isGw && (
            <g transform={`translate(${contentW - 26} 2)`}>
              <rect width={18} height={11} rx={3} fill={isExplicitGw ? "#2DD4BF20" : "#FBBF2420"} stroke={isExplicitGw ? "#2DD4BF50" : "#FBBF2450"} strokeWidth={0.8} />
              <text
                x={9}
                y={8.5}
                textAnchor="middle"
                fontSize={7}
                fontWeight={700}
                fontFamily="IBM Plex Mono, monospace"
                fill={isExplicitGw ? "#2DD4BF" : "#FBBF24"}
                letterSpacing={0.5}
              >
                GW
              </text>
            </g>
          )}
        </g>
      </g>
    );
  };

  const renderSubnet = (subnet: PositionedSubnet) => (
    <g key={subnet.key}>
      <rect
        x={subnet.x}
        y={subnet.y}
        width={subnet.w}
        height={subnet.h}
        rx={14}
        fill="#0F1A33"
        fillOpacity={0.6}
        stroke="#2A3A63"
        strokeWidth={1.5}
      />
      <g transform={`translate(${subnet.x + 14} ${subnet.y + 18})`}>
        <g color="#38BDF8">
          <TypeIcon type="subnet" size={15} className="h-[15px] w-[15px]" />
        </g>
        <text
          x={20}
          y={3}
          fontSize={12.5}
          fontWeight={700}
          fontFamily="Space Grotesk, sans-serif"
          fill="#E7EDF9"
        >
          {subnet.key}
        </text>
        <text
          x={20}
          y={17}
          fontSize={9}
          fontFamily="IBM Plex Mono, monospace"
          fill="#5E6D94"
        >
          {subnet.devices.length} device{subnet.devices.length === 1 ? "" : "s"}
        </text>
      </g>
      <line
        x1={subnet.x + 10}
        y1={subnet.y + SUBNET_HEAD}
        x2={subnet.x + subnet.w - 10}
        y2={subnet.y + SUBNET_HEAD}
        stroke="#1B2542"
      />
      {subnet.devices.map((d, i) => renderDevice(d, subnet, i))}
    </g>
  );

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
        aria-label="Network subnet diagram"
      >
        <defs>
          <pattern id="net-dots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="1.2" fill="#18233F" />
          </pattern>
        </defs>
        {!isPanning && (
          <rect
            x={vb.x - 300}
            y={vb.y - 300}
            width={vb.w + 600}
            height={vb.h + 600}
            fill="url(#net-dots)"
          />
        )}

        {layout.subnets.map(renderSubnet)}

        {/* Connection lines */}
        {(() => {
          const seen = new Set<string>();
          const pairs: {
            pairKey: string;
            srcPos: DotPos;
            dstPos: DotPos;
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
              count: group.length,
              hasFibre: group.some((g) => g.conn.medium === "fibre"),
              hasEth: group.some((g) => g.conn.medium === "ethernet"),
            });
          }
          return pairs.map((p) => {
            const isPairHover = hoverPairKey === p.pairKey;
            const baseWidth = 1.5 + (p.count - 1) * 1.2;
            const width = isPairHover ? baseWidth + 1 : baseWidth;
            const color =
              p.hasFibre && p.hasEth
                ? "#A78BFA"
                : p.hasFibre
                  ? "#FBBF24"
                  : "#3B82F6";
            const dash =
              p.hasFibre && !p.hasEth
                ? "6 4"
                : p.hasFibre && p.hasEth
                  ? "4 3 2 3"
                  : undefined;
            const path = connPath(p.srcPos, p.dstPos);
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

      {showTooltip && hoverInfo && hoverType && (
        <DeviceHoverCard
          device={hoverInfo.device}
          type={hoverType}
          mouseX={mouse.x}
          mouseY={mouse.y}
          connections={connections}
          location={`subnet ${hoverInfo.subnet.key}`}
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
