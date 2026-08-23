import { useMemo, type ReactNode } from "react";
import type { Device } from "../lib/types";
import { TYPE_META } from "../lib/types";
import { inferType } from "../lib/topology";
import { parseCidr } from "../lib/cidr";
import { resolveRack } from "../lib/importer";
import { formatDate } from "../lib/helpers";
import { useDevices } from "../store";
import { TypeIcon, IconX, IconInfo } from "./icons";

interface Props {
  device: Device;
  onClose: () => void;
  onConnectionHover?: (connId: string | null) => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-linesoft/60 py-1.5 last:border-0">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">{label}</span>
      <span className="truncate text-right font-mono text-[12.5px] text-txt">{value}</span>
    </div>
  );
}

/** Row with an info glyph; hovering reveals a popover with extra detail. */
function InfoRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div className="group relative">
      <div className="flex cursor-help items-baseline justify-between gap-3 border-b border-linesoft/60 py-1.5 last:border-0">
        <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint transition-colors duration-150 group-hover:text-brand">
          {label}
          <IconInfo
            className="h-3.5 w-3.5 shrink-0 self-center text-faint transition-colors duration-150 group-hover:text-brand"
            size={14}
          />
        </span>
        <span className="truncate text-right font-mono text-[12.5px] text-txt">{value}</span>
      </div>
      <div className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-60 translate-y-1 rounded-lg border border-brand/30 bg-raised/95 p-3 opacity-0 shadow-xl shadow-black/60 backdrop-blur transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
        {children}
      </div>
    </div>
  );
}

export default function DeviceDrawer({ device, onClose, onConnectionHover }: Props) {
  const { racks, connections, devices, updateDevice } = useDevices();
  const cidr = parseCidr(device.ip);
  const inferred = inferType(device.name, device.model);
  const meta = TYPE_META[inferred];
  const rack = resolveRack(device, racks);
  const hasPlacement = !!(device.rackId || device.mountIndex != null || rack);

  const subnetInfo = useMemo(() => {
    const empty = { isExplicitGateway: false, isHeuristicGateway: false, heuristicGatewayName: null as string | null, hasNoGateway: false };
    if (!cidr) return empty;

    const subnetDevices = devices.filter((d) => {
      const dCidr = parseCidr(d.ip);
      return dCidr && dCidr.key === cidr.key;
    });

    if (device.isGateway) return { ...empty, isExplicitGateway: true };

    if (subnetDevices.some((d) => d.isGateway)) return empty;

    const candidates = subnetDevices
      .filter((d) => {
        const t = inferType(d.name, d.model);
        return t === "router" || t === "firewall";
      })
      .sort((a, b) => (parseCidr(a.ip)?.hostId ?? 999) - (parseCidr(b.ip)?.hostId ?? 999));

    if (candidates.length > 0) {
      const gw = candidates[0];
      return {
        isExplicitGateway: false,
        isHeuristicGateway: gw.id === device.id,
        heuristicGatewayName: gw.id !== device.id ? gw.name : null,
        hasNoGateway: false,
      };
    }

    return { ...empty, hasNoGateway: true };
  }, [device, devices, cidr]);

  const deviceConns = useMemo(() => {
    const name = device.name.toLowerCase();
    return connections.filter(
      (c) => c.srcDevice.toLowerCase() === name || c.dstDevice.toLowerCase() === name
    );
  }, [connections, device.name]);

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

        <div className="mt-4 rounded-lg border border-line bg-surface/60 px-3.5 py-2.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">gateway</p>
              <p className="mt-0.5 text-[11px] text-mute">Designate as network gateway</p>
            </div>
            <label className="relative inline-flex shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                checked={device.isGateway ?? false}
                onChange={(e) => updateDevice(device.id, { isGateway: e.target.checked ? true : undefined })}
                className="peer sr-only"
              />
              <div className="h-5 w-9 rounded-full bg-line transition-colors peer-checked:bg-brand" />
              <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-txt shadow-sm transition-transform peer-checked:translate-x-4" />
            </label>
          </div>
          {subnetInfo.isHeuristicGateway && (
            <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-1.5 text-[10.5px] leading-snug text-amber-300">
              Heuristically selected as gateway — no explicit gateway set for this subnet
            </p>
          )}
          {subnetInfo.heuristicGatewayName && (
            <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-1.5 text-[10.5px] leading-snug text-amber-300">
              Gateway <span className="font-semibold">{subnetInfo.heuristicGatewayName}</span> was heuristically selected — no explicit gateway set for this subnet
            </p>
          )}
          {subnetInfo.hasNoGateway && (
            <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-1.5 text-[10.5px] leading-snug text-amber-300">
              No gateway for this subnet — designate one or add a router/firewall
            </p>
          )}
        </div>

        {/* notes sit directly under the address; omitted entirely when empty */}
        {device.notes && (
          <div className="mt-5 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-3.5 py-2.5">
            <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              notes
            </p>
            <p className="text-[12.5px] leading-relaxed text-mute">{device.notes}</p>
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
            connections
          </p>
          {deviceConns.length > 0 ? (
            <div className="rounded-xl border border-line bg-surface/70 px-4 py-2.5">
              <div className="space-y-3">
              {(() => {
                const groups = new Map<string, typeof deviceConns>();
                for (const c of deviceConns) {
                  const name = device.name.toLowerCase();
                  const isSrc = c.srcDevice.toLowerCase() === name;
                  const remote = isSrc ? c.dstDevice : c.srcDevice;
                  const key = remote.toLowerCase();
                  const list = groups.get(key) ?? [];
                  list.push(c);
                  groups.set(key, list);
                }
                return [...groups.entries()].map(([remoteKey, conns]) => {
                  const remoteName = conns[0].srcDevice.toLowerCase() === device.name.toLowerCase()
                    ? conns[0].dstDevice
                    : conns[0].srcDevice;
                  return (
                    <div key={remoteKey}>
                      <div className="relative flex items-center">
                        <p className="truncate font-mono text-[11.5px] font-medium text-txt">{device.name}</p>
                        <span className="absolute left-1/2 -translate-x-1/2 shrink-0 px-1 text-faint">⟷</span>
                        <span className="flex-1" />
                        <p className="truncate font-mono text-[11.5px] font-medium text-txt">{remoteName}</p>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {conns.map((c) => {
                          const name = device.name.toLowerCase();
                          const isSrc = c.srcDevice.toLowerCase() === name;
                          const localPort = isSrc ? c.srcPort : c.dstPort;
                          const remotePort = isSrc ? c.dstPort : c.srcPort;
                          return (
                            <div
                              key={c.id}
                              className="relative flex items-center font-mono text-[10.5px] cursor-pointer rounded px-1 -mx-1 transition-colors hover:bg-brand/8"
                              onMouseEnter={() => onConnectionHover?.(c.id)}
                              onMouseLeave={() => onConnectionHover?.(null)}
                            >
                              <span className="rounded bg-brand/12 px-1.5 py-0.5 text-brand">{localPort}</span>
                              <span
                                className="absolute left-1/2 -translate-x-1/2 shrink-0 rounded px-1 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider"
                                style={{
                                  background: c.medium === "fibre" ? "#FBBF2418" : "#3B82F618",
                                  color: c.medium === "fibre" ? "#FBBF24" : "#3B82F6",
                                }}
                              >
                                {c.medium}
                              </span>
                              <span className="flex-1" />
                              <span className="rounded bg-brand/12 px-1.5 py-0.5 text-brand">{remotePort}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
              </div>
            </div>
          ) : (
            <p className="text-[13px] italic text-faint">No connections recorded.</p>
          )}
        </div>

        <div className="mt-5">
          <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
            physical location
          </p>
          {hasPlacement ? (
            <div className="rounded-xl border border-line bg-surface/70 px-4 py-1">
              {rack && (
                <InfoRow
                  label="Rack"
                  value={rack.number ? `${rack.name} - Rack ${rack.number}` : rack.name}
                >
                  <p className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-brand">
                    <IconInfo className="h-3 w-3 shrink-0" size={12} />
                    rack detail
                  </p>
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-baseline justify-between gap-5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                        name
                      </span>
                      <span className="font-mono text-[12.5px] font-medium text-txt">
                        {rack.name}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                        number
                      </span>
                      <span className="font-mono text-[12.5px] font-medium text-txt">
                        {rack.number ?? "—"}
                      </span>
                    </div>
                  </div>
                </InfoRow>
              )}
              <Row
                label="Mount"
                value={
                  device.mountIndex != null
                    ? device.size > 1
                      ? `U${device.mountIndex}–U${device.mountIndex + device.size - 1}`
                      : `U${device.mountIndex}`
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
              {/* Network row — hovering reveals the usable host range */}
              <InfoRow label="Network" value={`${cidr.network}/${cidr.prefix}`}>
                <p className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-brand">
                  <IconInfo className="h-3 w-3 shrink-0" size={12} />
                  usable range
                </p>
                <p className="mt-1.5 font-mono text-[12.5px] font-medium text-txt">
                  {cidr.firstHost} – {cidr.lastHost}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-mute">
                  {cidr.usable} usable host{cidr.usable === 1 ? "" : "s"} in this subnet
                </p>
              </InfoRow>
              <Row label="Netmask" value={cidr.mask} />
              <Row label="Broadcast" value={cidr.broadcast} />
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-line px-5 py-3">
        <p className="font-mono text-[10.5px] text-faint">
          source <span className="text-mute">{device.source}</span> · imported{" "}
          <span className="text-mute">{formatDate(device.importedAt)}</span>
        </p>
      </footer>
    </aside>
  );
}
