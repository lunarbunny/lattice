import type { Device, DeviceType } from "../lib/types";
import { TYPE_META } from "../lib/types";
import { TypeIcon } from "./icons";

interface Props {
  device: Device;
  type: DeviceType;
  mouseX: number;
  mouseY: number;
  /** Optional location/context line (e.g., rack info, subnet, location breadcrumb) */
  location?: string;
}

export default function DeviceHoverCard({ device, type, mouseX, mouseY, location }: Props) {
  const meta = TYPE_META[type];

  return (
    <div
      className="pointer-events-none fixed z-50 w-64 rounded-lg border border-line bg-raised/95 p-3 shadow-xl shadow-black/50 backdrop-blur"
      style={{
        left: Math.min(mouseX + 16, window.innerWidth - 270),
        top: Math.min(mouseY + 14, window.innerHeight - 150),
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{
            color: meta.color,
            background: `${meta.color}1f`,
          }}
        >
          <TypeIcon type={type} size={16} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-txt">{device.name}</p>
          {device.ip && <p className="font-mono text-[11px] text-mute">{device.ip}</p>}
        </div>
      </div>
      {device.notes && (
        <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-mute">
          {device.notes}
        </p>
      )}
      {device.model && (
        <p className="mt-1.5 truncate font-mono text-[10.5px] text-mute">
          <span className="text-faint">model · </span>
          {device.model}
        </p>
      )}
      {location && (
        <p className="mt-2 font-mono text-[10.5px] text-brand">
          {location}
        </p>
      )}
      <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-faint">
        click to inspect
      </p>
    </div>
  );
}
