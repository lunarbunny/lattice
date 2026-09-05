import { ToggleSwitch, SegmentedText, SegmentedIcons } from "./OptionSelector";
import { IconLayoutHorizontal, IconLayoutVertical, IconBezierLine, IconOrthogonalLine, IconAlignTop, IconAlignBottom } from "./Icons";

import type { ViewMode } from "../lib/storage";
type CableStyle = "bezier" | "orthogonal";
type RackAlign = "top" | "bottom";
type RackUOrder = "top" | "bottom";
type RackLabelMode = "name" | "model";

const SPACING_OPTIONS = {
  horizontal: [
    { label: "Compact", value: 72 },
    { label: "Default", value: 90 },
    { label: "Spacious", value: 120 },
  ] as const,
  vertical: [
    { label: "Compact", value: 110 },
    { label: "Default", value: 138 },
    { label: "Spacious", value: 190 },
  ] as const,
};

interface ViewControlBarProps {
  view: ViewMode;
  // Topology controls
  isHorizontal?: boolean;
  onToggleLayout?: () => void;
  leafSpacing?: number;
  onSpacingChange?: (spacing: number) => void;
  // Rack controls
  cableStyle?: CableStyle;
  onCableStyleChange?: (style: CableStyle) => void;
  rackAlign?: RackAlign;
  onRackAlignChange?: (align: RackAlign) => void;
  rackUOrder?: RackUOrder;
  onRackUOrderChange?: (order: RackUOrder) => void;
  rackLabelMode?: RackLabelMode;
  onRackLabelModeChange?: (mode: RackLabelMode) => void;
}

export default function ViewControlBar({
  view,
  isHorizontal,
  onToggleLayout,
  leafSpacing,
  onSpacingChange,
  cableStyle,
  onCableStyleChange,
  rackAlign,
  onRackAlignChange,
  rackUOrder,
  onRackUOrderChange,
  rackLabelMode,
  onRackLabelModeChange,
}: ViewControlBarProps) {
  const hasControls =
    (view === "topology" && onToggleLayout && onSpacingChange) ||
    (view === "rack" && onCableStyleChange);

  return (
    <>
      {hasControls && (
        <div className="pointer-events-none absolute bottom-10 left-1/2 hidden -translate-x-1/2 items-center gap-2 md:flex">
          <div className="pointer-events-auto">
            {view === "topology" && isHorizontal !== undefined && onToggleLayout && leafSpacing !== undefined && onSpacingChange && (
              <div className="flex items-center gap-2">
                <ToggleSwitch
                  checked={isHorizontal}
                  onChange={onToggleLayout}
                  startIcon={
                    <IconLayoutHorizontal
                      className={`h-3.5 w-3.5 transition-colors duration-150 ${!isHorizontal ? "text-brand" : "text-faint"}`}
                      size={14}
                    />
                  }
                  endIcon={
                    <IconLayoutVertical
                      className={`h-3.5 w-3.5 transition-colors duration-150 ${isHorizontal ? "text-brand" : "text-faint"}`}
                      size={14}
                    />
                  }
                />
                <SegmentedText
                  options={isHorizontal ? SPACING_OPTIONS.horizontal : SPACING_OPTIONS.vertical}
                  value={leafSpacing}
                  onChange={onSpacingChange}
                />
              </div>
            )}
            {view === "rack" && cableStyle !== undefined && onCableStyleChange && (
              <div className="flex items-center gap-2">
                <SegmentedIcons
                  options={[
                    { icon: <IconBezierLine className="h-3.5 w-3.5" />, value: "bezier" as CableStyle },
                    { icon: <IconOrthogonalLine className="h-3.5 w-3.5" />, value: "orthogonal" as CableStyle },
                  ]}
                  value={cableStyle}
                  onChange={onCableStyleChange}
                />
                {rackAlign !== undefined && onRackAlignChange && (
                  <SegmentedIcons
                    options={[
                      { icon: <IconAlignTop className="h-3.5 w-3.5" />, value: "top" as RackAlign },
                      { icon: <IconAlignBottom className="h-3.5 w-3.5" />, value: "bottom" as RackAlign },
                    ]}
                    value={rackAlign}
                    onChange={onRackAlignChange}
                  />
                )}
                {rackUOrder !== undefined && onRackUOrderChange && (
                  <SegmentedText
                    options={[
                      { label: "U ↑", value: "bottom" as RackUOrder },
                      { label: "U ↓", value: "top" as RackUOrder },
                    ]}
                    value={rackUOrder}
                    onChange={onRackUOrderChange}
                  />
                )}
                {rackLabelMode !== undefined && onRackLabelModeChange && (
                  <SegmentedText
                    options={[
                      { label: "Name", value: "name" as RackLabelMode },
                      { label: "Model", value: "model" as RackLabelMode },
                    ]}
                    value={rackLabelMode}
                    onChange={onRackLabelModeChange}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <p className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint md:block">
        {view === "network"
          ? "click a row to inspect · right-click to edit"
          : "drag to pan · scroll to zoom · click a node"}
      </p>
    </>
  );
}
