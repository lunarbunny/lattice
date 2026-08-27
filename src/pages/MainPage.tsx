import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useDatastore } from "../store";
import { useToast } from "../components/Toast";
import TopologyCanvas from "../components/layout/TopologyCanvas";
import RackCanvas from "../components/layout/RackCanvas";
import { buildRackView } from "../lib/layout/rack";
import DeviceDrawer from "../components/device/DeviceDrawer";
import { parseCidr } from "../lib/cidr";
import { getPrimaryIp } from "../lib/helpers";
import { navigate } from "../lib/router";
import { inferType } from "../lib/layout/topology";
import { resolveRack } from "../lib/importer";
import { TYPE_META, TYPE_ORDER } from "../lib/types";
import type { Device } from "../lib/types";
import { notifyImport } from "../lib/helpers";
import ConfirmDialog from "../components/ConfirmDialog";
import NetworkCanvas from "../components/layout/NetworkCanvas";
import ViewControlBar from "../components/ViewControlBar";
import DeviceEditModal from "../components/device/DeviceEditModal";
import RackGroupEditModal from "../components/rack/RackGroupEditModal";
import ConnectionEditModal from "../components/connection/ConnectionEditModal";
import { IconUpload, IconList, IconTree, IconNetwork, IconRack } from "../components/Icons";
import {
  ILLUSTRATION_LINE, ILLUSTRATION_NODE, INTERNET_COLOUR,
  DOT_CONNECTED, CABLE_ETHERNET, CABLE_FIBRE, CABLE_MIXED,
} from "../lib/colours";

type ViewMode = "hierarchy" | "network" | "rack";

const VIEW_KEY = "lattice.view.v1";
const LAYOUT_KEY = "lattice.layout.v1";
const V_SPACING_KEY = "lattice.vSpacing.v1";
const H_SPACING_KEY = "lattice.hSpacing.v1";
const CABLE_STYLE_KEY = "lattice.cableStyle.v1";
const RACK_ALIGN_KEY = "lattice.rackAlign.v1";
const RACK_U_ORDER_KEY = "lattice.rackUOrder.v1";
const RACK_LABEL_MODE_KEY = "lattice.rackLabelMode.v1";

function loadView(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "rack" || v === "network") return v;
    return "hierarchy";
  } catch {
    return "hierarchy";
  }
}

function loadBool(key: string, fallback: boolean): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return fallback;
  }
}

function loadNum(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    return v != null ? Number(v) || fallback : fallback;
  } catch {
    return fallback;
  }
}

type CableStyle = "bezier" | "orthogonal";
type RackAlign = "top" | "bottom";
type RackUOrder = "top" | "bottom";
type RackLabelMode = "name" | "model";

function loadRackAlign(): RackAlign {
  try {
    const v = localStorage.getItem(RACK_ALIGN_KEY);
    if (v === "top" || v === "bottom") return v;
    return "bottom";
  } catch {
    return "bottom";
  }
}

function loadRackUOrder(): RackUOrder {
  try {
    const v = localStorage.getItem(RACK_U_ORDER_KEY);
    if (v === "top" || v === "bottom") return v;
    return "bottom";
  } catch {
    return "bottom";
  }
}

function loadCableStyle(): CableStyle {
  try {
    const v = localStorage.getItem(CABLE_STYLE_KEY);
    if (v === "bezier" || v === "orthogonal") return v;
    return "bezier";
  } catch {
    return "bezier";
  }
}

function EmptyIllustration() {
  return (
    <svg viewBox="0 0 260 150" width={260} height={150} className="h-36 w-auto" fill="none" aria-hidden="true">
      <path
        d="M130 42v26m0 0-62 34m62-34 62 34"
        stroke={ILLUSTRATION_LINE}
        strokeWidth="1.6"
        className="empty-dash"
      />
      <circle cx="130" cy="30" r="16" fill={ILLUSTRATION_NODE} stroke={INTERNET_COLOUR} strokeWidth="1.6" />
      <path
        d="M124 33a8.5 8.5 0 0 1 12 0M126.5 35.7a5 5 0 0 1 7 0"
        stroke={INTERNET_COLOUR}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="129" cy="30" r="1.1" fill={INTERNET_COLOUR} />
      <circle cx="56" cy="112" r="14" fill={ILLUSTRATION_NODE} stroke="#2DD4BF" strokeWidth="1.6" />
      <rect x="50" y="106" width="12" height="5.5" rx="1.2" stroke="#2DD4BF" strokeWidth="1.3" />
      <path d="M52 114.8h8" stroke="#2DD4BF" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="130" cy="112" r="14" fill={ILLUSTRATION_NODE} stroke="#F5A524" strokeWidth="1.6" />
      <circle cx="130" cy="112" r="4" stroke="#F5A524" strokeWidth="1.3" />
      <path
        d="M130 103.5V106M130 118v2.5M121.5 112H124M136 112h2.5"
        stroke="#F5A524"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="204" cy="112" r="14" fill={ILLUSTRATION_NODE} stroke="#A78BFA" strokeWidth="1.6" />
      <rect x="198" y="105.5" width="12" height="5" rx="1" stroke="#A78BFA" strokeWidth="1.2" />
      <rect x="198" y="112.5" width="12" height="5" rx="1" stroke="#A78BFA" strokeWidth="1.2" />
      <circle cx="66" cy="102" r="2.4" fill={DOT_CONNECTED} className="blink" />
      <circle cx="140" cy="102" r="2.4" fill={DOT_CONNECTED} className="blink" style={{ animationDelay: "0.7s" }} />
      <circle cx="214" cy="102" r="2.4" fill={DOT_CONNECTED} className="blink" style={{ animationDelay: "1.3s" }} />
    </svg>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const btn = (mode: ViewMode, label: string, icon: ReactNode) => (
    <button
      onClick={() => onChange(mode)}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-all ${
        view === mode
          ? "bg-brand text-abyss shadow-lg shadow-brand/25"
          : "text-mute hover:bg-raised hover:text-txt"
      }`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface/80 p-1 shadow-lg shadow-black/20 backdrop-blur">
      {btn("hierarchy", "Topology", <IconTree className="h-3.5 w-3.5" size={14} />)}
      {btn("network", "Network", <IconNetwork className="h-3.5 w-3.5" size={14} />)}
      {btn("rack", "Racks", <IconRack className="h-3.5 w-3.5" size={14} />)}
    </div>
  );
}

export default function MainPage({ focusId }: { focusId: string | null }) {
  const { devices, racks, connections, importText, updateDevice, addDevice, removeDevice } = useDatastore();
  const { push } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [view, setView] = useState<ViewMode>(loadView);
  const [isHorizontal, setIsHorizontal] = useState(() => loadBool(LAYOUT_KEY, false));
  const [verticalSpacing, setVerticalSpacing] = useState(() => loadNum(V_SPACING_KEY, 138));
  const [horizontalSpacing, setHorizontalSpacing] = useState(() => loadNum(H_SPACING_KEY, 90));
  const [cableStyle, setCableStyle] = useState<CableStyle>(loadCableStyle);
  const [rackAlign, setRackAlign] = useState<RackAlign>(loadRackAlign);
  const [rackUOrder, setRackUOrder] = useState<RackUOrder>(loadRackUOrder);
  const [rackLabelMode, setRackLabelMode] = useState<RackLabelMode>(() => (localStorage.getItem(RACK_LABEL_MODE_KEY) as RackLabelMode) || "name");
  const leafSpacing = isHorizontal ? horizontalSpacing : verticalSpacing;
  const [hoveredConnId, setHoveredConnId] = useState<string | null>(null);
  const [drawerWidth, setDrawerWidth] = useState(380);
  const [editDeviceId, setEditDeviceId] = useState<string | null>(null);
  const [editRackGroup, setEditRackGroup] = useState<string | null>(null);
  const [connEditDeviceId, setConnEditDeviceId] = useState<string | null>(null);
  const [addDeviceToRack, setAddDeviceToRack] = useState<{ rackId: string; mountIndex: number } | null>(null);
  const [cloneDeviceId, setCloneDeviceId] = useState<string | null>(null);
  const [deleteDevice, setDeleteDevice] = useState<Device | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rackLayout = useMemo(
    () => buildRackView(devices, racks, cableStyle, rackAlign, rackUOrder),
    [devices, racks, cableStyle, rackAlign, rackUOrder],
  );

  useEffect(() => {
    if (focusId) setSelectedId(focusId);
  }, [focusId]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* private mode — view simply won't persist */
    }
  }, [view]);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, isHorizontal ? "1" : "0");
    } catch { /* ignore */ }
  }, [isHorizontal]);

  useEffect(() => {
    try {
      localStorage.setItem(V_SPACING_KEY, String(verticalSpacing));
    } catch { /* ignore */ }
  }, [verticalSpacing]);

  useEffect(() => {
    try {
      localStorage.setItem(H_SPACING_KEY, String(horizontalSpacing));
    } catch { /* ignore */ }
  }, [horizontalSpacing]);

  useEffect(() => {
    try {
      localStorage.setItem(CABLE_STYLE_KEY, cableStyle);
    } catch { /* ignore */ }
  }, [cableStyle]);

  useEffect(() => {
    try {
      localStorage.setItem(RACK_ALIGN_KEY, rackAlign);
    } catch { /* ignore */ }
  }, [rackAlign]);

  useEffect(() => {
    try {
      localStorage.setItem(RACK_U_ORDER_KEY, rackUOrder);
    } catch { /* ignore */ }
  }, [rackUOrder]);

  useEffect(() => {
    try {
      localStorage.setItem(RACK_LABEL_MODE_KEY, rackLabelMode);
    } catch { /* ignore */ }
  }, [rackLabelMode]);

  // Reset to bezier when switching to network or hierarchy view
  useEffect(() => {
    if (view !== "rack" && cableStyle !== "bezier") {
      setCableStyle("bezier");
    }
  }, [view, cableStyle]);

  const selected = useMemo(
    () => devices.find((d) => d.id === selectedId) ?? null,
    [devices, selectedId]
  );

  const selectedHasConnections = useMemo(() => {
    if (!selected) return false;
    const name = selected.name.toLowerCase();
    return connections.some(
      (c) => c.srcDevice.toLowerCase() === name || c.dstDevice.toLowerCase() === name
    );
  }, [selected, connections]);

  /** When hovering a connection in the device panel, resolve the remote device. */
  const hoveredConnRemoteId = useMemo(() => {
    if (!hoveredConnId || !selected) return null;
    const conn = connections.find((c) => c.id === hoveredConnId);
    if (!conn) return null;
    const selName = selected.name.toLowerCase();
    const remoteName = conn.srcDevice.toLowerCase() === selName ? conn.dstDevice : conn.srcDevice;
    return devices.find((d) => d.name.toLowerCase() === remoteName.toLowerCase())?.id ?? null;
  }, [hoveredConnId, selected, connections, devices]);

  const stats = useMemo(() => {
    const subnets = new Set(devices.map((d) => parseCidr(getPrimaryIp(d, connections))?.key ?? "?"));
    const sources = new Set(devices.map((d) => d.source));
    const types = new Set(devices.map((d) => inferType(d.name, d.model)));
    const rackKeys = new Set<string>(racks.map((r) => r.id));
    const groupNames = new Set<string>(racks.map((r) => r.name));
    for (const d of devices) {
      const r = resolveRack(d, racks);
      if (r) {
        rackKeys.add(r.id);
        groupNames.add(r.name);
      } else if (d.rackId) {
        rackKeys.add(d.rackId);
      }
    }
    return {
      subnets: subnets.size,
      sources: sources.size,
      types,
      racks: rackKeys.size,
      groups: groupNames.size,
    };
  }, [devices, racks]);

  const cableLegend = useMemo(() => {
    const pairs = new Map<string, { hasFibre: boolean; hasEth: boolean; count: number }>();
    for (const c of connections) {
      const key = [c.srcDevice.toLowerCase(), c.dstDevice.toLowerCase()].sort().join("|");
      const entry = pairs.get(key) ?? { hasFibre: false, hasEth: false, count: 0 };
      if (c.medium === "fibre") entry.hasFibre = true;
      else entry.hasEth = true;
      entry.count++;
      pairs.set(key, entry);
    }
    const show = { ethernet: false, fibre: false, mixed: false, multiEthernet: false, multiFibre: false, multiMixed: false };
    for (const [, p] of pairs) {
      if (p.count === 1) {
        if (p.hasFibre && p.hasEth) show.mixed = true;
        else if (p.hasFibre) show.fibre = true;
        else show.ethernet = true;
      } else {
        if (p.hasFibre && p.hasEth) show.multiMixed = true;
        else if (p.hasFibre) show.multiFibre = true;
        else show.multiEthernet = true;
      }
    }
    return show;
  }, [connections]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    notifyImport(importText(text, file.name), push, file.name);
  };

  const presentTypes = TYPE_ORDER.filter((t) => stats.types.has(t));

  const chips =
    view === "rack"
      ? [
          { n: devices.length, label: devices.length === 1 ? "device" : "devices" },
          { n: stats.racks, label: stats.racks === 1 ? "rack" : "racks" },
          { n: stats.groups, label: stats.groups === 1 ? "group" : "groups" },
        ]
      : [
          { n: devices.length, label: devices.length === 1 ? "device" : "devices" },
          { n: stats.subnets, label: stats.subnets === 1 ? "subnet" : "subnets" },
          { n: stats.sources, label: stats.sources === 1 ? "source" : "sources" },
        ];

  return (
    <div className="relative h-full">
      {devices.length === 0 ? (
        <div className="flex h-full overflow-y-auto px-6">
          <div className="rise m-auto flex max-w-lg flex-col items-center py-12 text-center">
            <EmptyIllustration />
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.28em] text-brand">
              fabric · empty
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-txt sm:text-[44px] sm:leading-[1.05]">
              Nothing on the wire yet.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-mute">
              Feed Lattice a JSON inventory —{" "}
              <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[13px] text-brand">
                &#123; racks, devices, connections &#125;
              </code>{" "}
              — and it will draw the whole network as a live hierarchy and rack elevations.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[14px] font-semibold text-abyss shadow-lg shadow-brand/20 transition-all hover:bg-brandsoft hover:shadow-brand/30 active:scale-[0.97]"
              >
                <IconUpload className="h-4 w-4" size={16} strokeWidth={2} />
                Import JSON
              </button>
            </div>
            <button
              onClick={() => navigate("/datacenter")}
              className="group mt-6 flex items-center gap-1.5 text-[13px] font-medium text-faint transition-colors hover:text-brand"
            >
              <IconList className="h-3.5 w-3.5" size={14} />
              Open datacenter
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {view === "hierarchy" ? (
            <TopologyCanvas devices={devices} connections={connections} selectedId={selectedId} onSelect={setSelectedId} externalHoverDeviceId={hoveredConnRemoteId} isHorizontal={isHorizontal} leafSpacing={leafSpacing} drawerOpen={!!selected} drawerWidth={drawerWidth} />
          ) : view === "network" ? (
            <NetworkCanvas devices={devices} connections={connections} selectedId={selectedId} onSelect={setSelectedId} externalHoverDeviceId={hoveredConnRemoteId} drawerOpen={!!selected} drawerWidth={drawerWidth} onEditDevice={(d) => setEditDeviceId(d.id)} onEditConnections={(d) => setConnEditDeviceId(d.id)} />
          ) : (
            <RackCanvas
              devices={devices}
              connections={connections}
              selectedId={selectedId}
              onSelect={setSelectedId}
              externalHoverConnId={hoveredConnId}
              drawerOpen={!!selected}
              drawerWidth={drawerWidth}
              cableStyle={cableStyle}
              layout={rackLayout}
              rackUOrder={rackUOrder}
              rackLabelMode={rackLabelMode}
              onEditDevice={(d) => setEditDeviceId(d.id)}
              onEditConnections={(d) => setConnEditDeviceId(d.id)}
              onEditRackGroup={(name) => setEditRackGroup(name)}
              onAddDeviceToRack={(rackId, mountIndex) => setAddDeviceToRack({ rackId, mountIndex })}
              onCloneDevice={(d) => setCloneDeviceId(d.id)}
              onQuickCloneDevice={(d) => {
                if (!d.rackId || !d.mountIndex) return;
                const rack = racks.find(r => r.id === d.rackId);
                if (!rack) return;
                // Find first available slot visually below, then above if needed
                const occupied = new Set<number>();
                for (const dev of devices) {
                  if (dev.rackId !== d.rackId || dev.id === d.id || !dev.mountIndex) continue;
                  for (let u = dev.mountIndex; u < dev.mountIndex + dev.size; u++) occupied.add(u);
                }
                let targetU: number | null = null;
                // Search below first
                if (rackUOrder === "bottom") {
                  for (let u = d.mountIndex - 1; u >= 1; u--) {
                    let fits = true;
                    for (let k = 0; k < d.size; k++) { if (occupied.has(u - k)) { fits = false; break; } }
                    if (fits && u - d.size + 1 >= 1) { targetU = u - d.size + 1; break; }
                  }
                } else {
                  for (let u = d.mountIndex + d.size; u + d.size - 1 <= rack.units; u++) {
                    let fits = true;
                    for (let k = 0; k < d.size; k++) { if (occupied.has(u + k)) { fits = false; break; } }
                    if (fits) { targetU = u; break; }
                  }
                }
                // If no space below, search above
                if (targetU === null) {
                  if (rackUOrder === "bottom") {
                    for (let u = d.mountIndex + d.size; u + d.size - 1 <= rack.units; u++) {
                      let fits = true;
                      for (let k = 0; k < d.size; k++) { if (occupied.has(u + k)) { fits = false; break; } }
                      if (fits) { targetU = u; break; }
                    }
                  } else {
                    for (let u = d.mountIndex - 1; u >= 1; u--) {
                      let fits = true;
                      for (let k = 0; k < d.size; k++) { if (occupied.has(u - k)) { fits = false; break; } }
                      if (fits && u - d.size + 1 >= 1) { targetU = u - d.size + 1; break; }
                    }
                  }
                }
                if (targetU === null) return;
                addDevice({ name: d.name, notes: d.notes, model: d.model, rackId: d.rackId, mountIndex: targetU, size: d.size, isGateway: d.isGateway });
              }}
              onMoveDevice={(deviceId, rackId, mountIndex) => updateDevice(deviceId, { rackId, mountIndex })}
              onDeleteDevice={(d) => setDeleteDevice(d)}
            />
          )}

          {/* stat chips + view toggle */}
          <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap items-start gap-2">
            {chips.map((c) => (
              <span
                key={c.label}
                className="rounded-full border border-line bg-deep/85 px-3 py-1.5 font-mono text-[11px] text-mute shadow-lg shadow-black/20 backdrop-blur"
              >
                <span className="font-semibold text-txt">{c.n}</span> {c.label}
              </span>
            ))}
          </div>
          <div
            className="pointer-events-none absolute top-4 transition-[right] duration-200"
            style={{ right: selected ? `${drawerWidth + 16}px` : "1rem" }}
          >
            <div className="pointer-events-auto">
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>

          {/* legends */}
          <div className="pointer-events-none absolute bottom-4 left-4 hidden flex-col gap-2 sm:flex">
            {selectedHasConnections && (view === "rack" || view === "network") && (cableLegend.ethernet || cableLegend.fibre || cableLegend.mixed || cableLegend.multiEthernet || cableLegend.multiFibre || cableLegend.multiMixed) && (
              <div className="pointer-events-auto rounded-xl border border-line bg-deep/85 px-3.5 py-3 shadow-lg shadow-black/20 backdrop-blur">
                <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint">
                  cables
                </p>
                <div className="flex flex-col gap-y-1.5">
                  {cableLegend.ethernet && (
                    <span className="flex items-center gap-2 text-[11px] text-mute">
                      <svg width="28" height="6" className="shrink-0">
                        <line x1="0" y1="3" x2="28" y2="3" stroke={CABLE_ETHERNET} strokeWidth="1.5" />
                      </svg>
                      Ethernet
                    </span>
                  )}
                  {cableLegend.fibre && (
                    <span className="flex items-center gap-2 text-[11px] text-mute">
                      <svg width="28" height="6" className="shrink-0">
                        <line x1="0" y1="3" x2="28" y2="3" stroke={CABLE_FIBRE} strokeWidth="1.5" strokeDasharray="6 4" />
                      </svg>
                      Fibre
                    </span>
                  )}
                  {cableLegend.mixed && (
                    <span className="flex items-center gap-2 text-[11px] text-mute">
                      <svg width="28" height="6" className="shrink-0">
                        <line x1="0" y1="3" x2="28" y2="3" stroke={CABLE_MIXED} strokeWidth="1.5" strokeDasharray="4 3 2 3" />
                      </svg>
                      Mixed
                    </span>
                  )}
                  {cableLegend.multiEthernet && (
                    <span className="flex items-center gap-2 text-[11px] text-mute">
                      <svg width="28" height="6" className="shrink-0">
                        <line x1="0" y1="3" x2="28" y2="3" stroke={CABLE_ETHERNET} strokeWidth="3.5" />
                      </svg>
                      Multi-link Ethernet
                    </span>
                  )}
                  {cableLegend.multiFibre && (
                    <span className="flex items-center gap-2 text-[11px] text-mute">
                      <svg width="28" height="6" className="shrink-0">
                        <line x1="0" y1="3" x2="28" y2="3" stroke={CABLE_FIBRE} strokeWidth="3.5" strokeDasharray="6 4" />
                      </svg>
                      Multi-link Fibre
                    </span>
                  )}
                  {cableLegend.multiMixed && (
                    <span className="flex items-center gap-2 text-[11px] text-mute">
                      <svg width="28" height="6" className="shrink-0">
                        <line x1="0" y1="3" x2="28" y2="3" stroke={CABLE_MIXED} strokeWidth="3.5" strokeDasharray="4 3 2 3" />
                      </svg>
                      Multi-link Mixed
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="pointer-events-auto rounded-xl border border-line bg-deep/85 px-3.5 py-3 shadow-lg shadow-black/20 backdrop-blur">
              <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint">
                node types
              </p>
              <div className="flex flex-col gap-y-1.5">
                {presentTypes.map((t) => (
                  <span key={t} className="flex items-center gap-2 text-[11px] text-mute">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: TYPE_META[t].color }}
                    />
                    {TYPE_META[t].label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <ViewControlBar
            view={view}
            isHorizontal={isHorizontal}
            onToggleLayout={() => setIsHorizontal((v) => !v)}
            leafSpacing={leafSpacing}
            onSpacingChange={(value) => isHorizontal ? setHorizontalSpacing(value) : setVerticalSpacing(value)}
            cableStyle={cableStyle}
            onCableStyleChange={setCableStyle}
            rackAlign={rackLayout.hasMixedHeights ? rackAlign : undefined}
            onRackAlignChange={rackLayout.hasMixedHeights ? setRackAlign : undefined}
            rackUOrder={rackUOrder}
            onRackUOrderChange={setRackUOrder}
            rackLabelMode={rackLabelMode}
            onRackLabelModeChange={setRackLabelMode}
          />

          {selected && <DeviceDrawer device={selected} onClose={() => setSelectedId(null)} onConnectionHover={setHoveredConnId} hideGateway={view === "rack"} width={drawerWidth} onWidthChange={setDrawerWidth} />}

          {editDeviceId && (
            <DeviceEditModal
              device={devices.find((d) => d.id === editDeviceId)!}
              rackUOrder={rackUOrder}
              onClose={() => setEditDeviceId(null)}
            />
          )}

          {addDeviceToRack && (
            <DeviceEditModal
              defaultRackId={addDeviceToRack.rackId}
              defaultMountIndex={addDeviceToRack.mountIndex}
              rackUOrder={rackUOrder}
              onClose={() => setAddDeviceToRack(null)}
            />
          )}

          {cloneDeviceId && (
            <DeviceEditModal
              cloneFrom={devices.find((d) => d.id === cloneDeviceId)!}
              rackUOrder={rackUOrder}
              onClose={() => setCloneDeviceId(null)}
            />
          )}

          {editRackGroup !== null && (
            <RackGroupEditModal
              key={editRackGroup}
              editGroupName={editRackGroup}
              onClose={() => setEditRackGroup(null)}
            />
          )}

          {connEditDeviceId && (
            <ConnectionEditModal
              device={devices.find((d) => d.id === connEditDeviceId)!}
              onClose={() => setConnEditDeviceId(null)}
            />
          )}

          {deleteDevice && (
            <ConfirmDialog
              title="Delete device"
              confirmLabel="Delete"
              onConfirm={() => {
                removeDevice(deleteDevice.id);
                if (selectedId === deleteDevice.id) setSelectedId(null);
                push("success", `Removed ${deleteDevice.name}`);
                setDeleteDevice(null);
              }}
              onCancel={() => setDeleteDevice(null)}
            >
              <p>Are you sure you want to delete <span className="font-semibold text-txt">{deleteDevice.name}</span>?</p>
              <p className="mt-1.5 text-danger">All connections to this device will be removed.</p>
            </ConfirmDialog>
          )}
        </>
      )}
    </div>
  );
}
