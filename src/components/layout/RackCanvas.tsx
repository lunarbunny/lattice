import { useEffect, useMemo, useRef, useState, memo } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Connection, Device } from "../../lib/types";
import { TYPE_META } from "../../lib/types";
import { inferType } from "../../lib/layout/topology";
import type { RackView } from "../../lib/layout/rack";
import { RACK_HEAD, RACK_FOOT, U_H, SLOT_PAD, CABLE_HW, CABLE_HH } from "../../lib/layout/rack";
import type { PositionedRack, MountedDevice } from "../../lib/layout/rack";
import { usePanZoom } from "../../lib/usePanZoom";
import { useConnectionRouting } from "../../lib/useConnectionRouting";
import { useRackDrag } from "../../lib/useRackDrag";
import type { RackDragInfo } from "../../lib/useRackDrag";
import ZoomControls from "../ZoomControls";
import ContextMenu from "../ContextMenu";
import type { ContextMenuItem } from "../ContextMenu";
import { TypeIcon, IconEdit, IconFibre, IconPlus, IconCopy, IconTrash } from "../Icons";
import DeviceHoverCard from "../device/DeviceHoverCard";
import DeviceCard from "../device/DeviceCard";
import ConnectionHoverCard from "../connection/ConnectionHoverCard";
import { getDeviceSublabel, getDeviceLinkState } from "../../lib/helpers";
import { fitText, NAME_FONT } from "../../lib/fitText";
import {
  CARD_FILL,
  SEPARATOR_LINE, DOT_PATTERN,
  TEXT_NAME, TEXT_SUBLABEL, TEXT_HEADING, TEXT_TERTIARY, TEXT_EMPTY_SLOT,
  CABLE_ETHERNET, CABLE_FIBRE, CABLE_MIXED, CABLE_HOVER,
  CONTAINER_FILL, CONTAINER_FILL_HOVER, CONTAINER_HEADER_FILL, CONTAINER_HEADER_FILL_HOVER,
  CONTAINER_STROKE, CONTAINER_INNER_FILL, CONTAINER_INNER_STROKE,
  RAIL_STROKE, RAIL_SCREW, U_ROW_LINE, RACK_FOOT as RACK_FOOT_COLOR,
  HIGHWAY_FILL, HIGHWAY_STROKE, HIGHWAY_LABEL,
  DRAG_DROP_TARGET, DRAG_SWAP_STRIPE, DRAG_SOURCE,
} from "../../lib/colours";

function uRange(s: MountedDevice): string {
  const end = s.u + s.device.size - 1;
  return s.device.size > 1 ? `U${s.u}–U${end}` : `U${s.u}`;
}

interface UnrackedEntry {
  device: Device;
  x: number;
  y: number;
}

const UNRACKED_W = 220;
const UNRACKED_ROW_H = 36;
const UNRACKED_GAP = 110;
const UNRACKED_PAD = 90;

// ---- Memoised rack column ----

interface RackColumnProps {
  rack: PositionedRack;
  groupX: number;
  groupY: number;
  connections: Connection[];
  hoveredDeviceId: string | null;
  selectedId: string | null;
  mouseX: number;
  mouseY: number;
  dragInfo: RackDragInfo;
  cableStyle: "bezier" | "orthogonal";
  rackUOrder: "top" | "bottom";
  rackLabelMode: "name" | "model";
  isHovered: boolean;
  devices: Device[];
  onSlotPointerDown: (e: ReactPointerEvent, deviceId: string, groupX: number, groupY: number, rackX: number, slotY: number, size: number) => void;
  onSlotPointerMove: (e: ReactPointerEvent, deviceId: string) => void;
  onSlotPointerUp: (e: ReactPointerEvent, deviceId: string) => void;
  onSelect: (id: string) => void;
  onEditDevice?: (device: Device) => void;
  onEditConnections?: (device: Device) => void;
  onAddDeviceToRack?: (rackKey: string, u: number) => void;
  onCloneDevice?: (device: Device) => void;
  onQuickCloneDevice?: (device: Device) => void;
  onDeleteDevice?: (device: Device) => void;
  onHoverDevice: (id: string | null) => void;
  onSetCtxMenu: (menu: { x: number; y: number; items: ContextMenuItem[] } | null) => void;
}

const RackColumn = memo(function RackColumn({
  rack, groupX, groupY, connections, hoveredDeviceId, selectedId, mouseX, mouseY,
  dragInfo, cableStyle, rackUOrder, rackLabelMode, isHovered, devices,
  onSlotPointerDown, onSlotPointerMove, onSlotPointerUp,
  onSelect, onEditDevice, onEditConnections, onAddDeviceToRack,
  onCloneDevice, onQuickCloneDevice, onDeleteDevice,
  onHoverDevice, onSetCtxMenu,
}: RackColumnProps) {
  const { x, y, w, h, units } = rack;
  const includeHighway = cableStyle === "orthogonal";
  const contentX = x + 30;
  const contentW = w - 44 - (includeHighway ? CABLE_HW : 0);
  const cy = y + h - RACK_FOOT - units * U_H;
  const railBottom = cy + units * U_H;

  const hoveredSlotDevice = isHovered
    ? rack.slots.find(s => s.device.id === hoveredDeviceId) ?? null
    : null;

  const renderSlot = (s: MountedDevice, idx: number) => {
    const d = s.device;
    const displayName = rackLabelMode === "model" && d.model ? d.model : d.name;
    const isDimmed = rackLabelMode === "model" && !d.model;
    const t = inferType(d.name, d.model);
    const sublabel = getDeviceSublabel(d, connections, t);
    const linkState = getDeviceLinkState(d, connections, t);
    const col = TYPE_META[t].color;
    const slotY = rackUOrder === "bottom"
      ? cy + (units - s.u - d.size + 1) * U_H + SLOT_PAD
      : cy + (s.u - 1) * U_H + SLOT_PAD;
    const bh = d.size * U_H - 6;
    const isSel = selectedId === d.id;
    const isHover = hoveredDeviceId === d.id;
    return (
      <g
        key={d.id}
        data-node
        transform={`translate(${contentX} ${slotY})`}
        className="cursor-pointer"
        onPointerDown={(e) => onSlotPointerDown(e, d.id, groupX, groupY, rack.x, slotY, d.size)}
        onPointerMove={(e) => onSlotPointerMove(e, d.id)}
        onPointerUp={(e) => onSlotPointerUp(e, d.id)}
        onClick={(e) => { e.stopPropagation(); onSelect(d.id); }}
        onContextMenu={(e) => {
          if (!onEditDevice && !onEditConnections && !onCloneDevice && !onQuickCloneDevice && !onDeleteDevice) return;
          e.preventDefault();
          e.stopPropagation();
          const items: ContextMenuItem[] = [];
          if (onEditDevice) items.push({ label: "Edit device", icon: <IconEdit className="h-3.5 w-3.5" size={14} />, onClick: () => onEditDevice(d) });
          if (onEditConnections) items.push({ label: "Edit connections", icon: <IconFibre className="h-3.5 w-3.5" size={14} />, onClick: () => onEditConnections(d) });
          let rackHasSpace = false;
          if (d.rackId) {
            const rackData = devices.find(dev => dev.rackId === d.rackId);
            if (rackData) {
              const occupied = new Set<number>();
              for (const slot of rack.slots) {
                if (slot.device.id === d.id) continue;
                for (let u = slot.u; u < slot.u + slot.device.size; u++) occupied.add(u);
              }
              for (let u = 1; u + d.size - 1 <= rack.units; u++) {
                let fits = true;
                for (let k = 0; k < d.size; k++) { if (occupied.has(u + k)) { fits = false; break; } }
                if (fits) { rackHasSpace = true; break; }
              }
            }
          }
          if (onQuickCloneDevice) items.push({ label: "Quick clone", icon: <IconCopy className="h-3.5 w-3.5" size={14} />, onClick: () => onQuickCloneDevice(d), disabled: !rackHasSpace });
          if (onCloneDevice) items.push({ label: "Clone…", icon: <IconCopy className="h-3.5 w-3.5" size={14} />, onClick: () => onCloneDevice(d), disabled: !rackHasSpace });
          if (onDeleteDevice) items.push({ label: "Delete", icon: <IconTrash className="h-3.5 w-3.5" size={14} />, onClick: () => onDeleteDevice(d), danger: true });
          onSetCtxMenu({ x: e.clientX, y: e.clientY, items });
        }}
        onMouseEnter={() => onHoverDevice(d.id)}
        onMouseLeave={() => onHoverDevice(null)}
      >
        <g>
          <DeviceCard
            width={contentW} height={bh} type={t} name={displayName}
            sublabel={sublabel ? (d.size > 1 ? `${sublabel} · ${d.size}U` : sublabel) : ""}
            linkState={linkState}
            isSelected={isSel} isHover={isHover}
            dimmed={isDimmed} alwaysShowDot={t === "patch"}
          />
        </g>
      </g>
    );
  };

  return (
    <g key={rack.key}>
      <path d={`M ${x + 2} ${y + RACK_HEAD - 8} H ${x + w - 2}`} stroke={SEPARATOR_LINE} />
      <text x={x + 14} y={y + 21} fontSize={13} fontWeight={700}
        fontFamily="Space Grotesk, sans-serif" fill={TEXT_HEADING}>
        {rack.label}
      </text>
      <text x={x + 14} y={y + 36} fontSize={9} fontFamily="IBM Plex Mono, monospace" fill={TEXT_TERTIARY}>
        {units}U · {rack.slots.length} mounted{rack.slots.length === 0 ? " · empty" : ""}
      </text>
      <line x1={x + 9} y1={cy} x2={x + 9} y2={railBottom} stroke={RAIL_STROKE} strokeWidth={1.2} />
      <line x1={contentX + contentW + 5} y1={cy} x2={contentX + contentW + 5} y2={railBottom} stroke={RAIL_STROKE} strokeWidth={1.2} />
      {Array.from({ length: units }, (_, i) => {
        const dataU = i + 1;
        const uy = rackUOrder === "bottom"
          ? cy + (units - dataU) * U_H
          : cy + (dataU - 1) * U_H;
        const occupied = rack.slots.some((s) => dataU >= s.u && dataU < s.u + s.device.size);
        const canAdd = !occupied && onAddDeviceToRack;
        return (
          <g key={dataU}
            className={canAdd ? "cursor-context-menu" : undefined}
            onContextMenu={canAdd ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onSetCtxMenu({
                x: e.clientX, y: e.clientY,
                items: [{
                  label: "Add device",
                  icon: <IconPlus className="h-3.5 w-3.5" size={14} />,
                  onClick: () => onAddDeviceToRack!(rack.key, dataU),
                }],
              });
            } : undefined}>
            <circle cx={x + 9} cy={uy + U_H / 2} r={1} fill={RAIL_SCREW} />
            <circle cx={x + w - 9} cy={uy + U_H / 2} r={1} fill={RAIL_SCREW} />
            <text x={x + 19.5} y={uy + U_H / 2 + 2.5} fontSize={7.5}
              fontFamily="IBM Plex Mono, monospace"
              fill={occupied ? TEXT_TERTIARY : TEXT_EMPTY_SLOT} textAnchor="middle">
              {dataU}
            </text>
            {rackUOrder === "bottom"
              ? (dataU < units && <line x1={contentX} y1={uy} x2={contentX + contentW} y2={uy} stroke={U_ROW_LINE} />)
              : (dataU > 1 && <line x1={contentX} y1={uy} x2={contentX + contentW} y2={uy} stroke={U_ROW_LINE} />)}
            {canAdd && (
              <rect x={contentX} y={uy} width={contentW} height={U_H}
                fill="transparent" pointerEvents="all" />
            )}
          </g>
        );
      })}
      {rack.slots.map((s, i) => renderSlot(s, i))}
      {/* Drop target highlight during drag */}
      {dragInfo.isDropTarget && (() => {
        const hlY = rackUOrder === "bottom"
          ? cy + (units - dragInfo.dropU - dragInfo.dropSize + 1) * U_H
          : cy + (dragInfo.dropU - 1) * U_H;
        const hlH = dragInfo.dropSize * U_H;
        return dragInfo.isSwap ? (
          <g pointerEvents="none">
            <rect x={contentX} y={hlY} width={contentW} height={hlH} rx={4}
              fill="url(#drag-warning-stripes)" />
            <rect x={contentX} y={hlY} width={contentW} height={hlH} rx={4}
              fill="none" stroke={DRAG_SWAP_STRIPE} strokeWidth={1.5} strokeDasharray="4 3" />
          </g>
        ) : (
          <rect x={contentX} y={hlY} width={contentW} height={hlH} rx={4}
            fill={DRAG_DROP_TARGET} fillOpacity={0.15}
            stroke={DRAG_DROP_TARGET} strokeWidth={1.5} strokeDasharray="4 3"
            pointerEvents="none" />
        );
      })()}
      {/* Source slot indicator during drag */}
      {dragInfo.isSource && (
        <rect x={contentX}
          y={rackUOrder === "bottom"
            ? cy + (units - dragInfo.sourceU - dragInfo.sourceSize + 1) * U_H
            : cy + (dragInfo.sourceU - 1) * U_H}
          width={contentW}
          height={dragInfo.sourceSize * U_H} rx={4}
          fill="none" stroke={DRAG_SOURCE} strokeWidth={1.5}
          strokeDasharray="6 3" pointerEvents="none" />
      )}
      {/* Hover tooltip for devices in this rack */}
      {hoveredSlotDevice && (() => {
        const d = hoveredSlotDevice.device;
        const t = inferType(d.name, d.model);
        return (
          <DeviceHoverCard
            device={d}
            type={t}
            mouseX={mouseX}
            mouseY={mouseY}
            connections={connections}
            location={`${rack.group} · ${rack.label} · ${uRange(hoveredSlotDevice)}${d.size > 1 ? ` (${d.size}U)` : ""}`}
          />
        );
      })()}
    </g>
  );
}, (prev, next) => {
  return (
    prev.rack === next.rack ||
    (prev.rack.key === next.rack.key &&
     prev.rack.slots.length === next.rack.slots.length &&
     prev.rack.slots.every((s, i) => s.device.id === next.rack.slots[i].device.id && s.u === next.rack.slots[i].u) &&
     prev.rack.x === next.rack.x && prev.rack.y === next.rack.y &&
     prev.rack.w === next.rack.w && prev.rack.h === next.rack.h &&
     prev.rack.units === next.rack.units)
  ) &&
  prev.groupX === next.groupX &&
  prev.groupY === next.groupY &&
  prev.isHovered === next.isHovered &&
  prev.hoveredDeviceId === next.hoveredDeviceId &&
  prev.selectedId === next.selectedId &&
  prev.dragInfo.isDropTarget === next.dragInfo.isDropTarget &&
  prev.dragInfo.isSource === next.dragInfo.isSource &&
  prev.dragInfo.dropU === next.dragInfo.dropU &&
  prev.dragInfo.dropSize === next.dragInfo.dropSize &&
  prev.dragInfo.isSwap === next.dragInfo.isSwap &&
  prev.dragInfo.sourceU === next.dragInfo.sourceU &&
  prev.dragInfo.sourceSize === next.dragInfo.sourceSize &&
  prev.connections === next.connections &&
  prev.devices === next.devices &&
  prev.cableStyle === next.cableStyle &&
  prev.rackUOrder === next.rackUOrder &&
  prev.rackLabelMode === next.rackLabelMode;
});

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
  rackUOrder?: "top" | "bottom";
  rackLabelMode?: "name" | "model";
  onEditDevice?: (device: Device) => void;
  onEditConnections?: (device: Device) => void;
  onEditRackGroup?: (groupName: string) => void;
  onAddDeviceToRack?: (rackId: string, mountIndex: number) => void;
  onCloneDevice?: (device: Device) => void;
  onQuickCloneDevice?: (device: Device) => void;
  onDeleteDevice?: (device: Device) => void;
  onMoveDevice?: (deviceId: string, rackId: string | undefined, mountIndex: number | undefined) => void;
}

export default function RackCanvas({ devices, connections, selectedId, onSelect, externalHoverConnId, drawerOpen, drawerWidth, cableStyle = "bezier", layout, rackUOrder = "bottom", rackLabelMode = "name", onEditDevice, onEditConnections, onEditRackGroup, onAddDeviceToRack, onCloneDevice, onQuickCloneDevice, onDeleteDevice, onMoveDevice }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverPairKey, setHoverPairKey] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const mountRef = useRef(false);
  useEffect(() => { mountRef.current = true; }, []);

  const {
    dragVisuals, dragActive, screenToSvg, startDrag,
    handleSlotPointerDown, handleSlotPointerMove, handleSlotPointerUp,
    handleSvgDragPointerMove, handleSvgDragPointerUp, resetDrag, getDragInfo,
  } = useRackDrag({ svgRef, layout, rackUOrder, cableStyle, devices, onSelect, onMoveDevice });

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
    [layout.rackCount, unrackedEntries.length],
    (e) => {
      const target = e.target as Element | null;
      if (!target || !target.closest("[data-node]")) onSelect(null);
    }
  );

  const hoverUnracked = useMemo(
    () => unrackedEntries.find((u) => u.device.id === hoverId) ?? null,
    [hoverId, unrackedEntries]
  );

  const hoverType = hoverUnracked
    ? inferType(hoverUnracked.device.name, hoverUnracked.device.model)
    : null;
  const showTooltip = !!hoverUnracked && !panRef.current && !dragVisuals;

  const { activeConnections, connectionPairs, connPath, anchorPath } = useConnectionRouting({
    devices, connections, selectedId, layout, rackUOrder, cableStyle, unrackedEntries,
  });

  /** All connections in the hovered pair. */
  const hoveredPair = useMemo(() => {
    if (!hoverPairKey) return [];
    return activeConnections.filter((x) => x.pairKey === hoverPairKey);
  }, [hoverPairKey, activeConnections]);

  const renderUnrackedDevice = (u: UnrackedEntry, idx: number) => {
    const d = u.device;
    const displayName = rackLabelMode === "model" && d.model ? d.model : d.name;
    const isDimmed = rackLabelMode === "model" && !d.model;
    const t = inferType(d.name, d.model);
    const sublabel = getDeviceSublabel(d, connections, t);
    const linkState = getDeviceLinkState(d, connections, t);
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
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.button !== 0) return;
          const svgPt = screenToSvg(e.clientX, e.clientY);
          startDrag(d.id, svgPt.x, svgPt.y, u.x, u.y, d.size);
          (e.target as Element).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => handleSlotPointerMove(e, d.id)}
        onPointerUp={(e) => handleSlotPointerUp(e, d.id)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(d.id);
        }}
        onContextMenu={(e) => {
          if (!onEditDevice && !onEditConnections && !onCloneDevice) return;
          e.preventDefault();
          e.stopPropagation();
          const items: ContextMenuItem[] = [];
          if (onEditDevice) items.push({ label: "Edit device", icon: <IconEdit className="h-3.5 w-3.5" size={14} />, onClick: () => onEditDevice(d) });
          if (onEditConnections) items.push({ label: "Edit connections", icon: <IconFibre className="h-3.5 w-3.5" size={14} />, onClick: () => onEditConnections(d) });
          if (onCloneDevice) items.push({ label: "Clone", icon: <IconCopy className="h-3.5 w-3.5" size={14} />, onClick: () => onCloneDevice(d) });
          setCtxMenu({ x: e.clientX, y: e.clientY, items });
        }}
        onMouseEnter={() => { if (!dragActive) setHoverId(d.id); }}
        onMouseLeave={() => setHoverId((h) => (h === d.id ? null : h))}
      >
        <g className={!mountRef.current ? "unit-in" : undefined} style={{ animationDelay: `${Math.min(idx, 22) * 28}ms` }}>
          <DeviceCard
            width={cw} height={bh} type={t} name={displayName}
            sublabel={sublabel} linkState={linkState}
            isSelected={isSel} isHover={isHover}
            dimmed={isDimmed} alwaysShowDot={t === "patch"}
          />
        </g>
      </g>
    );
  };

  // ---- Derive hovered rack key for memo ----
  const hoveredRackKey = useMemo(() => {
    if (!hoverId) return null;
    for (const g of layout.groups)
      for (const r of g.racks)
        for (const s of r.slots)
          if (s.device.id === hoverId) return r.key;
    return null;
  }, [hoverId, layout]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <svg
        ref={svgRef}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => {
          if (dragActive) {
            handleSvgDragPointerMove(e);
            return;
          }
          if (!panRef.current) setMouse({ x: e.clientX, y: e.clientY });
          onPointerMove(e);
        }}
        onPointerUp={(e) => {
          if (dragActive) {
            handleSvgDragPointerUp(e);
            return;
          }
          onPointerUp(e);
        }}
        onPointerLeave={() => {
          resetDrag();
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
          <pattern id="drag-warning-stripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="8" fill={DRAG_SWAP_STRIPE} fillOpacity={0.25} />
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
            {/* Full backdrop */}
            <rect
              width={g.w}
              height={g.h}
              rx={18}
              fill={hoveredGroup === g.name ? CONTAINER_FILL_HOVER : CONTAINER_FILL}
              fillOpacity={0.5}
              stroke={CONTAINER_STROKE}
              strokeWidth={1.4}
              strokeDasharray="1 7"
              strokeLinecap="round"
            />
            {/* Interactive header */}
            {onEditRackGroup ? (
              <g
                className="cursor-context-menu"
                onMouseEnter={() => setHoveredGroup(g.name)}
                onMouseLeave={() => setHoveredGroup((h) => (h === g.name ? null : h))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCtxMenu({
                    x: e.clientX,
                    y: e.clientY,
                    items: [{
                      label: "Edit rack group",
                      icon: <IconEdit className="h-3.5 w-3.5" size={14} />,
                      onClick: () => onEditRackGroup(g.name),
                    }],
                  });
                }}
              >
                <path
                  d={`M 0 18 Q 0 0 18 0 H ${g.w - 18} Q ${g.w} 0 ${g.w} 18 V ${g.rowY} H 0 Z`}
                  fill={hoveredGroup === g.name ? CONTAINER_HEADER_FILL_HOVER : CONTAINER_HEADER_FILL}
                  fillOpacity={0.7}
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
              </g>
            ) : (
              <>
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
              </>
            )}

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

            {g.racks.map((rack) => (
              <RackColumn
                key={rack.key}
                rack={rack}
                groupX={g.x}
                groupY={g.y}
                connections={connections}
                hoveredDeviceId={hoverId}
                selectedId={selectedId}
                mouseX={mouse.x}
                mouseY={mouse.y}
                dragInfo={getDragInfo(rack)}
                cableStyle={cableStyle}
                rackUOrder={rackUOrder}
                rackLabelMode={rackLabelMode}
                isHovered={hoveredRackKey === rack.key}
                devices={devices}
                onSlotPointerDown={handleSlotPointerDown}
                onSlotPointerMove={handleSlotPointerMove}
                onSlotPointerUp={handleSlotPointerUp}
                onSelect={onSelect}
                onEditDevice={onEditDevice}
                onEditConnections={onEditConnections}
                onAddDeviceToRack={onAddDeviceToRack}
                onCloneDevice={onCloneDevice}
                onQuickCloneDevice={onQuickCloneDevice}
                onDeleteDevice={onDeleteDevice}
                onHoverDevice={setHoverId}
                onSetCtxMenu={setCtxMenu}
              />
            ))}

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

        {/* Drag ghost — floating card that follows the cursor */}
        {dragVisuals && (() => {
          const dev = devices.find(d => d.id === dragVisuals.deviceId);
          if (!dev) return null;
          const ghostLabel = rackLabelMode === "model" && dev.model ? dev.model : dev.name;
          const ghostDimmed = rackLabelMode === "model" && !dev.model;
          const t = inferType(dev.name, dev.model);
          const col = TYPE_META[t].color;
          const ghostW = 182;
          const ghostH = dev.size * U_H - 6;
          return (
            <g transform={`translate(${dragVisuals.ghostX} ${dragVisuals.ghostY})`} pointerEvents="none" opacity={0.7}>
              <rect width={ghostW} height={ghostH} rx={4} fill={CARD_FILL} stroke={col} strokeWidth={1.5} />
              <rect width={3.5} height={ghostH} rx={1.75} fill={col} />
              <g transform={`translate(9 ${(ghostH - 13) / 2})`} color={col}>
                <TypeIcon type={t} size={13} className="h-[13px] w-[13px]" />
              </g>
              <text
                x={30}
                y={ghostH / 2 + 4}
                fontSize={11.5}
                fontWeight={600}
                fontFamily="IBM Plex Sans, sans-serif"
                fill={ghostDimmed ? TEXT_TERTIARY : TEXT_NAME}
              >
                {fitText(ghostLabel, ghostW - 48, NAME_FONT)}
              </text>
            </g>
          );
        })()}
      </svg>

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

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
