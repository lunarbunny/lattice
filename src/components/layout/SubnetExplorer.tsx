import { useEffect, useMemo, useRef, useState } from "react";
import type { Connection, Device, Rack } from "../../lib/types";
import { TYPE_META } from "../../lib/types";
import { buildNetworkView, hostLabel } from "../../lib/layout/network";
import type { GroupedSubnet, SubnetIssue } from "../../lib/layout/network";
import ContextMenu from "../ContextMenu";
import type { ContextMenuItem } from "../ContextMenu";
import HoverInfo from "../HoverInfo";
import { TypeIcon, IconEdit, IconFibre, IconAlert, IconLocate } from "../Icons";
import {
  INTERNET_COLOUR,
  GW_EXPLICIT_TEXT, GW_EXPLICIT_STROKE,
  GW_IMPLICIT_TEXT, GW_IMPLICIT_STROKE,
} from "../../lib/colours";

const GRID_COLS = "grid-cols-[72px_150px_minmax(0,1fr)_150px_32px]";

interface Props {
  devices: Device[];
  connections: Connection[];
  racks: Rack[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  externalHoverDeviceId?: string | null;
  drawerOpen?: boolean;
  drawerWidth?: number;
  onEditDevice?: (device: Device) => void;
  onEditConnections?: (device: Device) => void;
}

function GatewayChip({ subnet }: { subnet: GroupedSubnet }) {
  if (!subnet.gateway) return null;
  return (
    <span
      title={subnet.gatewayExplicit ? "Marked gateway" : "Inferred gateway (router/firewall)"}
      className="rounded-full border px-2 py-0.5 font-mono text-[10px]"
      style={{
        color: subnet.gatewayExplicit ? GW_EXPLICIT_TEXT : GW_IMPLICIT_TEXT,
        borderColor: subnet.gatewayExplicit ? GW_EXPLICIT_STROKE : GW_IMPLICIT_STROKE,
      }}
    >
      GW {subnet.gateway.name}
    </span>
  );
}

export default function SubnetExplorer({
  devices,
  connections,
  racks,
  selectedId,
  onSelect,
  externalHoverDeviceId,
  drawerOpen,
  drawerWidth,
  onEditDevice,
  onEditConnections,
}: Props) {
  const layout = useMemo(
    () => buildNetworkView(devices, connections, racks),
    [devices, connections, racks],
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(
    () => layout.subnets[0]?.key ?? null,
  );
  const [showIssues, setShowIssues] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [flash, setFlash] = useState<{ id: string; tick: number } | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, []);

  // Keep the selected subnet valid as data changes; default to the first.
  useEffect(() => {
    if (layout.subnets.length === 0) {
      if (selectedKey !== null) setSelectedKey(null);
      return;
    }
    if (!selectedKey || !layout.subnets.some((s) => s.key === selectedKey)) {
      setSelectedKey(layout.subnets[0].key);
    }
  }, [layout, selectedKey]);

  useEffect(() => {
    if (!flash) return;
    rowRefs.current.get(flash.id)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [flash]);

  const issueById = useMemo(
    () => new Map(layout.issues.map((i) => [i.id, i])),
    [layout],
  );

  // Header badges carry only subnet-level issues — those with no specific
  // device target (no-gateway, subnet-overlap). Device-level issues
  // (ip-conflict, no-ip, reserved-address) are shown on the offending row,
  // so surfacing them at the title would misreport one device's problem as
  // the whole subnet's.
  const issuesBySubnet = useMemo(() => {
    const m = new Map<string, SubnetIssue[]>();
    for (const issue of layout.issues) {
      if (issue.deviceIds.length > 0) continue;
      for (const key of issue.subnetKeys) {
        const list = m.get(key) ?? [];
        list.push(issue);
        m.set(key, list);
      }
    }
    return m;
  }, [layout]);

  const subnetOfDevice = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of layout.subnets) {
      for (const row of s.rows) {
        if (row.kind === "device") m.set(row.device.id, s.key);
      }
    }
    return m;
  }, [layout]);

  const linkedNames = useMemo(() => {
    const s = new Set<string>();
    for (const c of connections) {
      s.add(c.srcDevice.toLowerCase());
      s.add(c.dstDevice.toLowerCase());
    }
    return s;
  }, [connections]);

  const sortedIssues = useMemo(
    () =>
      [...layout.issues].sort(
        (a, b) =>
          (a.severity === b.severity
            ? 0
            : a.severity === "error"
              ? -1
              : 1) || a.message.localeCompare(b.message),
      ),
    [layout],
  );

  const sourceCount = useMemo(
    () => new Set(devices.map((d) => d.source)).size,
    [devices],
  );

  const selected = layout.subnets.find((s) => s.key === selectedKey) ?? null;
  const selectedIssues = selected ? (issuesBySubnet.get(selected.key) ?? []) : [];

  const jumpToDevice = (id: string) => {
    const key = subnetOfDevice.get(id);
    if (key) setSelectedKey(key);
    onSelect(id);
    setFlash((prev) => ({ id, tick: (prev?.tick ?? 0) + 1 }));
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1700);
  };

  const renderSubnetRow = (subnet: GroupedSubnet) => {
    const isSel = subnet.key === selectedKey;
    const issues = issuesBySubnet.get(subnet.key) ?? [];
    const hasError = issues.some((i) => i.severity === "error");
    const info = subnet.info;
    const freeCount = Math.max(0, subnet.usable - subnet.usedCount);
    return (
      <button
        key={subnet.key}
        onClick={() => setSelectedKey(subnet.key)}
        className={`block w-full border-b border-linesoft/60 px-3 py-2.5 text-left transition-colors ${
          isSel ? "bg-raised/70" : "hover:bg-raised/40"
        }`}
      >
        <span className="flex items-center gap-2">
          <span
            className="shrink-0"
            style={info ? { color: INTERNET_COLOUR } : undefined}
          >
            <TypeIcon type="subnet" size={13} className="h-[13px] w-[13px]" />
          </span>
          <span className="truncate font-mono text-[12px] font-semibold text-txt">
            {info ? subnet.key : "No IP address"}
          </span>
          {issues.length > 0 && (
            <IconAlert
              className={`h-3 w-3 shrink-0 ${hasError ? "text-danger" : "text-warn"}`}
              size={12}
            />
          )}
        </span>
        <span className="mt-0.5 block pl-[21px] font-mono text-[10px] text-faint">
          {info
            ? `/${info.prefix} · ${subnet.usedCount} used · ${freeCount} free`
            : `${subnet.usedCount} device${subnet.usedCount === 1 ? "" : "s"}`}
        </span>
      </button>
    );
  };

  const renderRow = (subnet: GroupedSubnet, rowIdx: number) => {
    const row = subnet.rows[rowIdx];
    if (row.kind === "free") {
      // The engine only emits free runs for real subnets, never the unknown bucket.
      const info = subnet.info!;
      const count = row.to - row.from + 1;
      const label =
        row.from === row.to
          ? hostLabel(info, row.from)
          : `${hostLabel(info, row.from)}–${hostLabel(info, row.to)}`;
      return (
        <div
          key={`free-${row.from}`}
          className={`grid ${GRID_COLS} items-center border-t border-linesoft/60 px-4 py-1 text-[11px] text-faint/80`}
        >
          <span className="font-mono">{label}</span>
          <span />
          <span className="italic">free ({count})</span>
          <span />
          <span />
        </div>
      );
    }

    const d = row.device;
    const meta = TYPE_META[row.type];
    const isSel = selectedId === d.id;
    const isHover = externalHoverDeviceId === d.id;
    const isFlash = flash?.id === d.id;
    const rowIssues = row.issueIds
      .map((id) => issueById.get(id))
      .filter((i): i is SubnetIssue => !!i);
    const hasError = rowIssues.some((i) => i.severity === "error");
    const hasConnections = linkedNames.has(d.name.toLowerCase());

    return (
      <div
        key={d.id}
        ref={(el) => {
          if (el) rowRefs.current.set(d.id, el);
          else rowRefs.current.delete(d.id);
        }}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(d.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(d.id);
          }
        }}
        onContextMenu={(e) => {
          if (!onEditDevice && !onEditConnections) return;
          e.preventDefault();
          const items: ContextMenuItem[] = [];
          if (onEditDevice) {
            items.push({
              label: "Edit device",
              icon: <IconEdit className="h-3.5 w-3.5" size={14} />,
              onClick: () => onEditDevice(d),
            });
          }
          if (onEditConnections && hasConnections) {
            items.push({
              label: "Edit connections",
              icon: <IconFibre className="h-3.5 w-3.5" size={14} />,
              onClick: () => onEditConnections(d),
            });
          }
          if (items.length > 0) setCtxMenu({ x: e.clientX, y: e.clientY, items });
        }}
        className={`grid ${GRID_COLS} cursor-pointer items-center border-t border-linesoft/60 px-4 py-2 text-[12px] outline-none transition-colors ${
          isFlash ? "row-flash" : isSel ? "bg-brand/10" : isHover ? "bg-raised/60" : "hover:bg-raised/40"
        }`}
      >
        <span className="font-mono text-[11.5px] text-mute">
          {row.hostId != null && subnet.info ? hostLabel(subnet.info, row.hostId) : "—"}
        </span>
        <span className="font-mono text-[11.5px] text-txt">{row.ip ?? "—"}</span>
        <span className="flex min-w-0 items-center gap-2">
          <span style={{ color: meta.color }}>
            <TypeIcon type={row.type} size={14} className="h-3.5 w-3.5" />
          </span>
          <span className="truncate font-semibold text-txt">{d.name}</span>
          <span className="shrink-0 text-[11px] text-faint">{meta.label}</span>
        </span>
        <span className="truncate font-mono text-[11px] text-mute">{row.location}</span>
        <span className="flex justify-center">
          {rowIssues.length > 0 && (
            <HoverInfo
              icon={
                <IconAlert
                  className={hasError ? "h-3.5 w-3.5 text-danger" : "h-3.5 w-3.5 text-warn"}
                  size={14}
                />
              }
            >
              {rowIssues.map((i) => (
                <span key={i.id} className="block">
                  {i.message}
                </span>
              ))}
            </HoverInfo>
          )}
        </span>
      </div>
    );
  };

  const headerRange = (subnet: GroupedSubnet): string | null => {
    const info = subnet.info;
    if (!info) return null;
    const size = info.broadcastInt - info.networkInt + 1;
    const lo = info.prefix >= 31 ? 0 : 1;
    const hi = info.prefix >= 31 ? size - 1 : size - 2;
    return `${hostLabel(info, lo)}–${hostLabel(info, hi)}`;
  };

  return (
    <div
      className="absolute inset-0 flex flex-col transition-[padding-right] duration-200"
      style={drawerOpen && drawerWidth ? { paddingRight: drawerWidth + 32 } : undefined}
    >
      {/* ---- Toolbar ---- */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2">
        <p className="font-mono text-[10px] text-faint">
          {devices.length} device{devices.length === 1 ? "" : "s"} · {layout.subnets.length} subnet{layout.subnets.length === 1 ? "" : "s"} · {sourceCount} source{sourceCount === 1 ? "" : "s"}
        </p>
        {layout.issues.length > 0 && (
          <button
            onClick={() => setShowIssues((v) => !v)}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10.5px] font-semibold transition-all active:scale-[0.97] ${
              showIssues
                ? "border-danger/60 bg-danger/20 text-danger"
                : "border-danger/40 bg-danger/10 text-danger hover:bg-danger/15"
            }`}
          >
            <IconAlert className="h-3 w-3" size={12} />
            {layout.issues.length} issue{layout.issues.length === 1 ? "" : "s"}
          </button>
        )}
      </div>

      {/* ---- Issues panel ---- */}
      {showIssues && layout.issues.length > 0 && (
        <div className="max-h-44 shrink-0 divide-y divide-linesoft/60 overflow-y-auto border-b border-line bg-deep/60">
          {sortedIssues.map((issue) => {
            const jumpable = issue.deviceIds.length > 0;
            const inner = (
              <>
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${issue.severity === "error" ? "bg-danger" : "bg-warn"}`}
                />
                <span className="flex-1 text-[12px] text-mute">{issue.message}</span>
                {jumpable && <IconLocate className="h-3.5 w-3.5 shrink-0 text-faint" size={14} />}
              </>
            );
            return jumpable ? (
              <button
                key={issue.id}
                onClick={() => jumpToDevice(issue.deviceIds[0])}
                className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-raised/50"
              >
                {inner}
              </button>
            ) : (
              <div key={issue.id} className="flex w-full items-center gap-3 px-4 py-2">
                {inner}
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Panes ---- */}
      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)]">
        {/* Left — subnet list */}
        <div className="flex min-h-0 flex-col border-r border-line">
          <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              Subnets
              <span className="ml-1.5 text-brand">{layout.subnets.length}</span>
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {layout.subnets.map(renderSubnetRow)}
          </div>
        </div>

        {/* Right — address plan */}
        <div className="flex min-h-0 flex-col">
          {selected ? (
            <>
              <div className="shrink-0 border-b border-line px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="shrink-0"
                    style={selected.info ? { color: INTERNET_COLOUR } : undefined}
                  >
                    <TypeIcon type="subnet" size={16} className="h-4 w-4" />
                  </span>
                  <h2 className="font-display text-[15px] font-bold tracking-tight text-txt">
                    {selected.info ? selected.key : "No IP address"}
                  </h2>
                  {selectedIssues.length > 0 && (
                    <HoverInfo
                      icon={
                        <IconAlert
                          className={
                            selectedIssues.some((i) => i.severity === "error")
                              ? "h-3.5 w-3.5 text-danger"
                              : "h-3.5 w-3.5 text-warn"
                          }
                          size={14}
                        />
                      }
                    >
                      {selectedIssues.map((i) => (
                        <span key={i.id} className="block">
                          {i.message}
                        </span>
                      ))}
                    </HoverInfo>
                  )}
                  {/* Inline (not pushed right): the top-right corner is
                      occupied by the floating view toggle. */}
                  <GatewayChip subnet={selected} />
                </div>
                <p className="mt-1 font-mono text-[10.5px] text-faint">
                  {selected.info
                    ? `/${selected.info.prefix} · hosts ${headerRange(selected)} · ${selected.usedCount} used · ${Math.max(0, selected.usable - selected.usedCount)} free of ${selected.usable}`
                    : `${selected.usedCount} device${selected.usedCount === 1 ? "" : "s"} without an IP address`}
                </p>
              </div>
              <div
                className={`grid ${GRID_COLS} shrink-0 border-b border-line px-4 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint`}
              >
                <span>Host</span>
                <span>Address</span>
                <span>Device</span>
                <span>Location</span>
                <span />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {selected.rows.map((_, i) => renderRow(selected, i))}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="font-mono text-[11px] text-faint">Select a subnet to view its address plan</p>
            </div>
          )}
        </div>
      </div>

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
