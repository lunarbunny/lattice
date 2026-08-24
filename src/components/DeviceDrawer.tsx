import { useMemo, useCallback, useRef, type ReactNode } from "react";
import type { Device } from "../lib/types";
import { TYPE_META } from "../lib/types";
import { inferType } from "../lib/layout/topology";
import { parseCidr } from "../lib/cidr";
import { resolveRack } from "../lib/importer";
import { formatDate, getPrimaryIp, getConnectionIp } from "../lib/helpers";
import { useDevices } from "../store";
import { TypeIcon, IconX, IconInfo } from "./Icons";
import ConnectionGroup from "./ConnectionGroup";

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;

interface Props {
  device: Device;
  onClose: () => void;
  onConnectionHover?: (connId: string | null) => void;
  hideGateway?: boolean;
  width: number;
  onWidthChange: (width: number) => void;
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

export default function DeviceDrawer({ device, onClose, onConnectionHover, hideGateway, width, onWidthChange }: Props) {
  const { racks, connections, devices, updateDevice } = useDevices();
  const primaryIp = getPrimaryIp(device, connections);
  const cidr = parseCidr(primaryIp);
  const inferred = inferType(device.name, device.model);
  const meta = TYPE_META[inferred];
  const rack = resolveRack(device, racks);
  const hasPlacement = !!(device.rackId || device.mountIndex != null || rack);

  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };

    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startWidth + delta));
      onWidthChange(newWidth);
    };

    const handleUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [width, onWidthChange]);

  const subnetInfo = useMemo(() => {
    const empty = { isExplicitGateway: false, isHeuristicGateway: false, heuristicGatewayName: null as string | null, explicitGatewayName: null as string | null, hasNoGateway: false };
    if (!cidr) return empty;

    const subnetDevices = devices.filter((d) => {
      const dCidr = parseCidr(getPrimaryIp(d, connections));
      return dCidr && dCidr.key === cidr.key;
    });

    if (device.isGateway) return { ...empty, isExplicitGateway: true };

    const explicitGw = subnetDevices.find((d) => d.isGateway);
    if (explicitGw) return { ...empty, explicitGatewayName: explicitGw.name };

    const candidates = subnetDevices
      .filter((d) => {
        const t = inferType(d.name, d.model);
        return t === "router" || t === "firewall";
      })
      .sort((a, b) => (parseCidr(getPrimaryIp(a, connections))?.hostId ?? 999) - (parseCidr(getPrimaryIp(b, connections))?.hostId ?? 999));

    if (candidates.length > 0) {
      const gw = candidates[0];
      return {
        isExplicitGateway: false,
        isHeuristicGateway: gw.id === device.id,
        heuristicGatewayName: gw.id !== device.id ? gw.name : null,
        explicitGatewayName: null,
        hasNoGateway: false,
      };
    }

    return { ...empty, hasNoGateway: true };
  }, [device, devices, connections, cidr]);

  const deviceConns = useMemo(() => {
    const name = device.name.toLowerCase();
    return connections.filter(
      (c) => c.srcDevice.toLowerCase() === name || c.dstDevice.toLowerCase() === name
    );
  }, [connections, device.name]);

  return (
    <aside
      className="slide-in absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-line bg-deep/95 shadow-2xl shadow-black/60 backdrop-blur-md sm:w-auto"
      style={{ width: `min(${width}px, 100%)` }}
    >
      <div
        className="absolute inset-y-0 left-0 w-1.5 cursor-col-resize bg-transparent hover:bg-brand/40 transition-colors z-10"
        onMouseDown={handleResizeStart}
      />
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
            {primaryIp ?? "—"}
          </p>
          {!hideGateway && (
            <div className="mt-2.5 border-t border-white/8 pt-2.5">
              <div className="group/gw relative">
                <div className="flex cursor-help items-center justify-between gap-2">
                  <span className={`flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150 ${
                    subnetInfo.isHeuristicGateway || subnetInfo.heuristicGatewayName || subnetInfo.hasNoGateway
                      ? "text-amber-400 group-hover/gw:text-amber-300"
                      : "text-faint group-hover/gw:text-brand"
                  }`}>
                    gateway
                    <IconInfo
                      className={`h-3 w-3 shrink-0 transition-colors duration-150 ${
                        subnetInfo.isHeuristicGateway || subnetInfo.heuristicGatewayName || subnetInfo.hasNoGateway
                          ? "text-amber-400 group-hover/gw:text-amber-300"
                          : "text-faint group-hover/gw:text-brand"
                      }`}
                      size={12}
                    />
                  </span>
                  <label className="relative inline-flex shrink-0 cursor-pointer items-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={device.isGateway ?? false}
                      onChange={(e) => updateDevice(device.id, { isGateway: e.target.checked ? true : undefined })}
                      className="peer sr-only"
                    />
                    <div className="h-4 w-7 rounded-full bg-line transition-colors peer-checked:bg-brand" />
                    <div className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-txt shadow-sm transition-transform peer-checked:translate-x-3" />
                  </label>
                </div>
                <div className={`pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-60 translate-y-1 rounded-lg border bg-raised/95 p-3 opacity-0 shadow-xl shadow-black/60 backdrop-blur transition-all duration-150 group-hover/gw:translate-y-0 group-hover/gw:opacity-100 ${
                  subnetInfo.isHeuristicGateway || subnetInfo.heuristicGatewayName || subnetInfo.hasNoGateway
                    ? "border-amber-500/30"
                    : "border-brand/30"
                }`}>
                  {subnetInfo.isExplicitGateway && (
                    <p className="text-[11.5px] leading-snug text-brand">
                      This device is the gateway for this subnet
                    </p>
                  )}
                  {subnetInfo.explicitGatewayName && (
                    <p className="text-[11.5px] leading-snug text-brand">
                      <span className="font-semibold">{subnetInfo.explicitGatewayName}</span> is the designated gateway for this subnet
                    </p>
                  )}
                  {subnetInfo.isHeuristicGateway && (
                    <p className="text-[11.5px] leading-snug text-amber-300">
                      Heuristically selected as gateway — no explicit gateway set for this subnet
                    </p>
                  )}
                  {subnetInfo.heuristicGatewayName && (
                    <p className="text-[11.5px] leading-snug text-amber-300">
                      <span className="font-semibold">{subnetInfo.heuristicGatewayName}</span> was heuristically selected — no explicit gateway set for this subnet
                    </p>
                  )}
                  {subnetInfo.hasNoGateway && (
                    <p className="text-[11.5px] leading-snug text-amber-300">
                      No gateway for this subnet — designate one or add a router/firewall
                    </p>
                  )}
                </div>
              </div>
            </div>
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
              {(() => {
                const byMedium = new Map<string, typeof deviceConns>();
                for (const c of deviceConns) {
                  const list = byMedium.get(c.medium) ?? [];
                  list.push(c);
                  byMedium.set(c.medium, list);
                }
                const ordered = ["fibre", "ethernet"].filter((m) => byMedium.has(m as "fibre" | "ethernet"));
                return ordered.map((medium) => {
                  const conns = byMedium.get(medium)!;
                  const groups = new Map<string, typeof conns>();
                  for (const c of conns) {
                    const name = device.name.toLowerCase();
                    const isSrc = c.srcDevice.toLowerCase() === name;
                    const remote = isSrc ? c.dstDevice : c.srcDevice;
                    const key = remote.toLowerCase();
                    const list = groups.get(key) ?? [];
                    list.push(c);
                    groups.set(key, list);
                  }
                  return (
                    <div key={medium} className={medium !== ordered[0] ? "mt-3 border-t border-line pt-3" : ""}>
                      <p
                        className="mb-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: medium === "fibre" ? "#FBBF24" : "#3B82F6" }}
                      >
                        {medium}
                      </p>
                      <div className="space-y-3">
                        {[...groups.entries()].map(([remoteKey, groupConns]) => {
                          const remoteName = groupConns[0].srcDevice.toLowerCase() === device.name.toLowerCase()
                            ? groupConns[0].dstDevice
                            : groupConns[0].srcDevice;
                          const connData = groupConns.map((c) => {
                            const name = device.name.toLowerCase();
                            const isSrc = c.srcDevice.toLowerCase() === name;
                            return {
                              id: c.id,
                              localPort: isSrc ? c.srcPort : c.dstPort,
                              localIp: getConnectionIp(device, c),
                              remotePort: isSrc ? c.dstPort : c.srcPort,
                              remoteIp: isSrc ? c.dstIp : c.srcIp,
                            };
                          });
                          return (
                            <ConnectionGroup
                              key={remoteKey}
                              localDeviceName={device.name}
                              remoteDeviceName={remoteName}
                              connections={connData}
                              onConnectionHover={onConnectionHover}
                              showBar
                              barColor={meta.color}
                              primaryIp={primaryIp}
                              primaryColor={meta.color}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
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

      </div>

      <footer className="border-t border-line px-5 py-3">
        <p className="truncate font-mono text-[10.5px] text-faint">
          source <span className="text-mute">{device.source}</span> · imported{" "}
          <span className="text-mute">{formatDate(device.importedAt)}</span>
        </p>
      </footer>
    </aside>
  );
}
