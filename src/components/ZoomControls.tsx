import { IconZoomIn, IconZoomOut, IconFit } from "./Icons";

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  rightOffset?: string;
}

const BTN =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-raised/90 text-mute shadow-lg shadow-black/30 backdrop-blur transition-all hover:border-brand/60 hover:text-txt active:scale-95";

export default function ZoomControls({ onZoomIn, onZoomOut, onFit, rightOffset }: Props) {
  return (
    <div className="absolute bottom-4 flex items-center gap-1.5 transition-[right] duration-200" style={{ right: rightOffset ?? "1rem" }}>
      <button onClick={onZoomIn} className={BTN} aria-label="Zoom in">
        <IconZoomIn className="h-4.5 w-4.5" size={18} />
      </button>
      <button onClick={onZoomOut} className={BTN} aria-label="Zoom out">
        <IconZoomOut className="h-4.5 w-4.5" size={18} />
      </button>
      <button onClick={onFit} className={BTN} aria-label="Fit diagram to screen">
        <IconFit className="h-4.5 w-4.5" size={18} />
      </button>
    </div>
  );
}
