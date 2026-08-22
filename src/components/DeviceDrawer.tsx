import type { Device } from "../lib/types";
import { TYPE_META } from "../lib/types";
import { inferType } from "../lib/topology";
import { parseCidr } from "../lib/cidr";
import { resolveRack } from "../lib/importer";
import { useDevices } from "../store";
import { TypeIcon, IconX } from "./icons";

interface Props {
  device: Device;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-linesoft/60 py-1.5 last:border-0">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">{label}</span>
      <span className="truncate text-right font-mono text-[12.5px] text-txt">{value}</span>
    </div>
  );
}

export default function DeviceDrawer({ device, onClose }: Props) {
  const { racks } = useDevices();
  const cidr = parseCidr(device.ip);
  const inferred = inferType(device.name, device.model);
  const meta = TYPE_META[inferred];
  const rack = resolveRack(device, racks);
  const hasPlacement = !!(device.rackId || device.mountIndex != null || rack);

  return (
    <aside className="slide-in absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-line bg-deep/95 shadow-2xl shadow-black/60 backdrop-blur-md sm:w-[350px]">
      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            color: meta.color,
            background: `${meta.color}1c`,
            border: `1px solid ${meta.color}40`,
          }}
        >
          <TypeIcon type={inferred} className="h-5.5 w-5.5" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-bold leading-tight text-txt">
            {device.name}
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-mute">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: meta.color }}
            />
            {meta.label}
            <span className="text-faint">·</span>
            <span className="flex items-center gap-1">
              <span className="blink inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              tracked
            </span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-faint transition-colors hover:bg-raised hover:text-txt"
          aria-label="Close inspector"
        >
          <IconX className="h-4 w-4" size={16} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div
          className="rounded-xl border px-4 py-3"
          style={{ borderColor: `${meta.color}38`, background: `${meta.color}0d` }}
        >
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">address</p>
          <p
            className="mt-1 font-mono text-[22px] font-semibold leading-none"
            style={{ color: meta.color }}
          >
            {device.ip}
          </p>
        </div>

        {/* notes sit directly under the address; omitted entirely when empty */}
        {device.notes && (
          <div className="mt-5">
            <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
              notes
            </p>
            <p className="rounded-lg border border-line bg-surface/60 px-3 py-2 text-[12.5px] leading-relaxed text-mute">
              {device.notes}
            </p>
          </div>
        )}

        {device.model && (
          <div className="mt-5">
            <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
              model
            </p>
            <p className="rounded-lg border border-line bg-surface/60 px-3 py-1.5 font-mono text-[11.5px] text-txt">
              {device.model}
            </p>
          </div>
        )}

        <div className="mt-5">
          <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
            physical location
          </p>
          {hasPlacement ? (
            <div className="rounded-xl border border-line bg-surface/70 px-4 py-1">
              <Row label="Rack id" value={device.rackId || rack?.id || "—"} />
              <Row label="Rack group" value={rack?.name || "—"} />
              <Row label="Rack" value={rack?.number != null ? `Rack ${rack.number}` : "—"} />
              <Row
                label="Mount"
                value={
                  device.mountIndex != null
                    ? device.size > 1
                      ? `U${device.mountIndex}–U${device.mountIndex + device.size - 1} from top`
                      : `U${device.mountIndex} from top`
                    : "auto"
                }
              />
              <Row label="Height" value={`${device.size}U`} />
            </div>
          ) : (
            <p className="text-[13px] italic text-faint">
              Not racked — no physical placement recorded.
            </p>
          )}
        </div>

        {cidr && (
          <div className="mt-5">
            <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
              subnet breakdown
            </p>
            <div className="rounded-xl border border-line bg-surface/70 px-4 py-1">
              <Row label="Network" value={`${cidr.network}/${cidr.prefix}`} />
              <Row label="Netmask" value={cidr.mask} />
              <Row label="Broadcast" value={cidr.broadcast} />
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-line px-5 py-3">
        <p className="font-mono text-[10.5px] text-faint">
          source <span className="text-mute">{device.source}</span> · imported{" "}
          <span className="text-mute">
            {new Date(device.importedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </p>
      </footer>
    </aside>
  );
}
