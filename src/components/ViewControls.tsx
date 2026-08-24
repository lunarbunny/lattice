import type { ReactNode } from "react";
import { IconLayoutHorizontal, IconLayoutVertical, IconBezierLine, IconOrthogonalLine } from "./Icons";

type ViewMode = "hierarchy" | "network" | "rack";
type CableStyle = "bezier" | "orthogonal";

interface ViewControlsProps {
  view: ViewMode;
  // Topology controls
  isHorizontal?: boolean;
  onToggleLayout?: () => void;
  leafSpacing?: number;
  onSpacingChange?: (spacing: number) => void;
  // Rack controls
  cableStyle?: CableStyle;
  onCableStyleChange?: (style: CableStyle) => void;
}

function ControlGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center rounded-lg border border-line bg-raised/80 p-0.5">
      {children}
    </div>
  );
}

function TopologyControls({
  isHorizontal,
  onToggleLayout,
  leafSpacing,
  onSpacingChange,
}: {
  isHorizontal: boolean;
  onToggleLayout: () => void;
  leafSpacing: number;
  onSpacingChange: (spacing: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <IconLayoutHorizontal
        className={`h-3.5 w-3.5 transition-colors duration-150 ${!isHorizontal ? "text-brand" : "text-faint"}`}
        size={14}
      />
      <button
        onClick={onToggleLayout}
        className="relative h-5 w-9 rounded-full bg-line transition-colors"
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-txt shadow-sm transition-transform duration-200 ${
            isHorizontal ? "translate-x-4" : ""
          }`}
        />
      </button>
      <IconLayoutVertical
        className={`h-3.5 w-3.5 transition-colors duration-150 ${isHorizontal ? "text-brand" : "text-faint"}`}
        size={14}
      />
      <ControlGroup>
        {(isHorizontal
          ? [["Compact", 72], ["Default", 90], ["Spacious", 120]] as const
          : [["Compact", 110], ["Default", 138], ["Spacious", 190]] as const
        ).map(([label, value]) => (
          <button
            key={label}
            onClick={() => onSpacingChange(value)}
            className={`rounded-md px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
              leafSpacing === value
                ? "bg-brand/15 text-brand"
                : "text-faint hover:text-mute"
            }`}
          >
            {label}
          </button>
        ))}
      </ControlGroup>
    </div>
  );
}

function RackControls({
  cableStyle,
  onCableStyleChange,
}: {
  cableStyle: CableStyle;
  onCableStyleChange: (style: CableStyle) => void;
}) {
  return (
    <ControlGroup>
      <button
        onClick={() => onCableStyleChange("bezier")}
        className={`rounded-md p-1 transition-colors ${
          cableStyle === "bezier" ? "bg-brand/15 text-brand" : "text-faint hover:text-mute"
        }`}
      >
        <IconBezierLine className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => onCableStyleChange("orthogonal")}
        className={`rounded-md p-1 transition-colors ${
          cableStyle === "orthogonal" ? "bg-brand/15 text-brand" : "text-faint hover:text-mute"
        }`}
      >
        <IconOrthogonalLine className="h-3.5 w-3.5" />
      </button>
    </ControlGroup>
  );
}

export default function ViewControls({
  view,
  isHorizontal,
  onToggleLayout,
  leafSpacing,
  onSpacingChange,
  cableStyle,
  onCableStyleChange,
}: ViewControlsProps) {
  const hasControls =
    (view === "hierarchy" && onToggleLayout && onSpacingChange) ||
    (view === "rack" && onCableStyleChange);

  return (
    <>
      {hasControls && (
        <div className="pointer-events-none absolute bottom-10 left-1/2 hidden -translate-x-1/2 items-center gap-2 lg:flex">
          <div className="pointer-events-auto">
            {view === "hierarchy" && isHorizontal !== undefined && onToggleLayout && leafSpacing !== undefined && onSpacingChange && (
              <TopologyControls
                isHorizontal={isHorizontal}
                onToggleLayout={onToggleLayout}
                leafSpacing={leafSpacing}
                onSpacingChange={onSpacingChange}
              />
            )}
            {view === "rack" && cableStyle !== undefined && onCableStyleChange && (
              <RackControls cableStyle={cableStyle} onCableStyleChange={onCableStyleChange} />
            )}
          </div>
        </div>
      )}
      <p className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint lg:block">
        drag to pan · scroll to zoom · click a node
      </p>
    </>
  );
}
