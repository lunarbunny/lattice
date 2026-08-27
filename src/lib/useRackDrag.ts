import { useMemo, useRef, useState, useEffect } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Device } from "./types";
import type { RackView, PositionedRack } from "./layout/rack";
import { RACK_FOOT, U_H, SLOT_PAD, CABLE_HW } from "./layout/rack";

interface DropTarget {
  rackKey: string;
  rackId: string;
  u: number;
  swapDeviceId?: string;
}

export interface DragVisuals {
  deviceId: string;
  ghostX: number;
  ghostY: number;
  dropTarget: DropTarget | null;
}

export interface RackDragInfo {
  isDropTarget: boolean;
  isSource: boolean;
  dropU: number;
  dropSize: number;
  isSwap: boolean;
  sourceU: number;
  sourceSize: number;
}

const DRAG_THRESHOLD = 5;

interface UseRackDragParams {
  svgRef: React.RefObject<SVGSVGElement | null>;
  layout: RackView;
  rackUOrder: "top" | "bottom";
  cableStyle: "bezier" | "orthogonal";
  devices: Device[];
  onSelect: (id: string | null) => void;
  onMoveDevice?: (deviceId: string, rackId: string | undefined, mountIndex: number | undefined) => void;
}

interface UseRackDragResult {
  dragVisuals: DragVisuals | null;
  /** True while a drag gesture is in progress (past threshold). Reactive state. */
  dragActive: boolean;
  /** Convert screen coords to SVG root coords. */
  screenToSvg: (clientX: number, clientY: number) => { x: number; y: number };
  /** Begin tracking a potential drag from a slot or unracked device. */
  startDrag: (deviceId: string, svgX: number, svgY: number, originX: number, originY: number, size: number) => void;
  /** Stable pointer-down handler for memoised RackColumn slots. */
  handleSlotPointerDown: (e: ReactPointerEvent, deviceId: string, groupX: number, groupY: number, rackX: number, slotY: number, size: number) => void;
  /** Stable pointer-move handler for memoised RackColumn slots. */
  handleSlotPointerMove: (e: ReactPointerEvent, deviceId: string) => void;
  /** Stable pointer-up handler for memoised RackColumn slots. */
  handleSlotPointerUp: (e: ReactPointerEvent, deviceId: string) => void;
  /** SVG-level pointer-move handler for drag tracking. */
  handleSvgDragPointerMove: (e: ReactPointerEvent) => void;
  /** SVG-level pointer-up handler for drop handling. */
  handleSvgDragPointerUp: (e: ReactPointerEvent) => void;
  /** Reset all drag state (e.g. on pointer leave). */
  resetDrag: () => void;
  /** Compute per-rack drag info for the memoised RackColumn. */
  getDragInfo: (rack: PositionedRack) => RackDragInfo;
}

export function useRackDrag({
  svgRef, layout, rackUOrder, cableStyle, devices, onSelect, onMoveDevice,
}: UseRackDragParams): UseRackDragResult {
  const [dragVisuals, setDragVisuals] = useState<DragVisuals | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const potentialDragRef = useRef<{ deviceId: string; startX: number; startY: number; grabOffsetX: number; grabOffsetY: number; size: number } | null>(null);
  const dragActiveRef = useRef(false);
  const mountRef = useRef(false);
  useEffect(() => { mountRef.current = true; }, []);

  // Stable callback refs so memoised RackColumn never re-renders from callback identity changes
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onMoveDeviceRef = useRef(onMoveDevice);
  onMoveDeviceRef.current = onMoveDevice;

  const screenToSvg = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  };

  const isRangeFree = (rack: PositionedRack, startU: number, size: number, excludeIds: string[]): boolean => {
    const excludeSet = new Set(excludeIds);
    for (let u = startU; u < startU + size; u++) {
      if (u < 1 || u > rack.units) return false;
      for (const s of rack.slots) {
        if (excludeSet.has(s.device.id)) continue;
        if (u >= s.u && u < s.u + s.device.size) return false;
      }
    }
    return true;
  };

  const isSwapValid = (rack: PositionedRack, dragId: string, dragSize: number, targetU: number, targetId: string, targetSize: number): boolean => {
    const dragDev = rack.slots.find(s => s.device.id === dragId);
    if (!dragDev) return false;
    if (!isRangeFree(rack, targetU, dragSize, [dragId, targetId])) return false;
    if (!isRangeFree(rack, dragDev.u, targetSize, [dragId, targetId])) return false;
    return true;
  };

  const computeDropTarget = (svgX: number, svgY: number, deviceId: string, deviceSize: number): DropTarget | null => {
    for (const g of layout.groups) {
      for (const r of g.racks) {
        if (!r.rackId) continue;
        const contentX = g.x + r.x + 30;
        const contentW = r.w - 44 - (cableStyle === "orthogonal" ? CABLE_HW : 0);
        if (svgX < contentX || svgX > contentX + contentW) continue;
        const cy = g.y + r.y + r.h - RACK_FOOT - r.units * U_H;
        const relY = svgY - cy;
        if (relY < 0 || relY > r.units * U_H) continue;
        const row = Math.floor(relY / U_H);
        const dataU = rackUOrder === "bottom" ? r.units - row : row + 1;
        if (dataU < 1 || dataU + deviceSize - 1 > r.units) continue;

        if (isRangeFree(r, dataU, deviceSize, [deviceId])) {
          return { rackKey: r.key, rackId: r.rackId, u: dataU };
        }

        const occupant = r.slots.find(s =>
          s.device.id !== deviceId && dataU >= s.u && dataU < s.u + s.device.size
        );
        if (occupant && isSwapValid(r, deviceId, deviceSize, occupant.u, occupant.device.id, occupant.device.size)) {
          return { rackKey: r.key, rackId: r.rackId, u: occupant.u, swapDeviceId: occupant.device.id };
        }
      }
    }
    return null;
  };

  const startDrag = (deviceId: string, svgX: number, svgY: number, originX: number, originY: number, size: number) => {
    potentialDragRef.current = {
      deviceId,
      startX: svgX,
      startY: svgY,
      grabOffsetX: svgX - originX,
      grabOffsetY: svgY - originY,
      size,
    };
    dragActiveRef.current = false;
    setDragActive(false);
  };

  // ---- Stable drag callbacks for memoised RackColumn ----

  const slotPointerDownCb = useRef<(e: ReactPointerEvent, deviceId: string, groupX: number, groupY: number, rackX: number, slotY: number, size: number) => void>(() => {});
  const slotPointerMoveCb = useRef<(e: ReactPointerEvent, deviceId: string) => void>(() => {});
  const slotPointerUpCb = useRef<(e: ReactPointerEvent, deviceId: string) => void>(() => {});

  slotPointerDownCb.current = (e, deviceId, groupX, groupY, rackX, slotY, size) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const svgPt = screenToSvg(e.clientX, e.clientY);
    const originX = groupX + rackX + 30;
    const originY = groupY + slotY;
    startDrag(deviceId, svgPt.x, svgPt.y, originX, originY, size);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  slotPointerMoveCb.current = (e, deviceId) => {
    const pd = potentialDragRef.current;
    if (!pd || pd.deviceId !== deviceId) return;
    if (dragActiveRef.current) return;
    const svgPt = screenToSvg(e.clientX, e.clientY);
    const dist = Math.abs(svgPt.x - pd.startX) + Math.abs(svgPt.y - pd.startY);
    if (dist > DRAG_THRESHOLD) {
      dragActiveRef.current = true;
      setDragActive(true);
      svgRef.current?.setPointerCapture(e.pointerId);
      setDragVisuals({ deviceId: pd.deviceId, ghostX: svgPt.x - pd.grabOffsetX, ghostY: svgPt.y - pd.grabOffsetY, dropTarget: null });
    }
  };

  slotPointerUpCb.current = (e, deviceId) => {
    const pd = potentialDragRef.current;
    potentialDragRef.current = null;
    if (dragActiveRef.current) {
      dragActiveRef.current = false;
      setDragActive(false);
      e.stopPropagation();
      return;
    }
    if (pd) onSelectRef.current(deviceId);
  };

  const handleSlotPointerDown = useMemo(() =>
    (e: ReactPointerEvent, deviceId: string, groupX: number, groupY: number, rackX: number, slotY: number, size: number) =>
      slotPointerDownCb.current(e, deviceId, groupX, groupY, rackX, slotY, size),
  []);

  const handleSlotPointerMove = useMemo(() =>
    (e: ReactPointerEvent, deviceId: string) =>
      slotPointerMoveCb.current(e, deviceId),
  []);

  const handleSlotPointerUp = useMemo(() =>
    (e: ReactPointerEvent, deviceId: string) =>
      slotPointerUpCb.current(e, deviceId),
  []);

  // ---- SVG-level drag handlers ----

  const handleSvgDragPointerMove = (e: ReactPointerEvent) => {
    if (!dragActiveRef.current || !potentialDragRef.current) return;
    const svgPt = screenToSvg(e.clientX, e.clientY);
    const pd = potentialDragRef.current;
    const ghostH = pd.size * U_H - 6;
    const ghostCenterY = svgPt.y - pd.grabOffsetY + ghostH / 2 + SLOT_PAD;
    const target = computeDropTarget(svgPt.x, ghostCenterY, pd.deviceId, pd.size);
    setDragVisuals({
      deviceId: pd.deviceId,
      ghostX: svgPt.x - pd.grabOffsetX,
      ghostY: svgPt.y - pd.grabOffsetY,
      dropTarget: target,
    });
  };

  const handleSvgDragPointerUp = (e: ReactPointerEvent) => {
    if (!dragActiveRef.current || !potentialDragRef.current) return;
    const pd = potentialDragRef.current;
    const svgPt = screenToSvg(e.clientX, e.clientY);
    const ghostH = pd.size * U_H - 6;
    const ghostCenterY = svgPt.y - pd.grabOffsetY + ghostH / 2 + SLOT_PAD;
    const target = computeDropTarget(svgPt.x, ghostCenterY, pd.deviceId, pd.size);
    if (target && onMoveDeviceRef.current) {
      if (target.swapDeviceId) {
        const dragDev = devices.find(d => d.id === pd.deviceId);
        const targetDev = devices.find(d => d.id === target.swapDeviceId);
        if (dragDev && targetDev) {
          onMoveDeviceRef.current(pd.deviceId, target.rackId, target.u);
          onMoveDeviceRef.current(target.swapDeviceId, dragDev.rackId, dragDev.mountIndex);
        }
      } else {
        onMoveDeviceRef.current(pd.deviceId, target.rackId, target.u);
      }
    }
    potentialDragRef.current = null;
    dragActiveRef.current = false;
    setDragActive(false);
    setDragVisuals(null);
  };

  const resetDrag = () => {
    if (dragActiveRef.current) {
      potentialDragRef.current = null;
      dragActiveRef.current = false;
      setDragActive(false);
      setDragVisuals(null);
    }
  };

  // ---- Per-rack drag info for memoised columns ----

  const emptyDragInfo: RackDragInfo = { isDropTarget: false, isSource: false, dropU: 0, dropSize: 0, isSwap: false, sourceU: 0, sourceSize: 0 };

  const getDragInfo = (rack: PositionedRack): RackDragInfo => {
    if (!dragVisuals) return emptyDragInfo;
    const srcDev = devices.find(d => d.id === dragVisuals.deviceId);
    const isSource = !!(srcDev && srcDev.rackId === rack.rackId && srcDev.mountIndex);
    const isDropTarget = dragVisuals.dropTarget?.rackKey === rack.key;
    if (!isSource && !isDropTarget) return emptyDragInfo;
    return {
      isDropTarget,
      isSource,
      dropU: dragVisuals.dropTarget?.u ?? 0,
      dropSize: srcDev?.size ?? 0,
      isSwap: !!dragVisuals.dropTarget?.swapDeviceId,
      sourceU: srcDev?.mountIndex ?? 0,
      sourceSize: srcDev?.size ?? 0,
    };
  };

  return {
    dragVisuals,
    dragActive,
    screenToSvg,
    startDrag,
    handleSlotPointerDown,
    handleSlotPointerMove,
    handleSlotPointerUp,
    handleSvgDragPointerMove,
    handleSvgDragPointerUp,
    resetDrag,
    getDragInfo,
  };
}
