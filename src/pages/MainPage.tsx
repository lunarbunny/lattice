import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useDevices } from "../store";
import { useToast } from "../components/Toast";
import TopologyCanvas from "../components/TopologyCanvas";
import RackCanvas from "../components/RackCanvas";
import DeviceDrawer from "../components/DeviceDrawer";
import { parseCidr } from "../lib/cidr";
import { navigate } from "../lib/router";
import { inferType } from "../lib/topology";
import { resolveRack } from "../lib/importer";
import { TYPE_META, TYPE_ORDER } from "../lib/types";
import { notifyImport } from "../lib/helpers";
import NetworkCanvas from "../components/NetworkCanvas";
import { IconUpload, IconBraces, IconList, IconTree, IconNetwork, IconRack, IconLayoutHorizontal, IconLayoutVertical } from "../components/icons";

type ViewMode = "hierarchy" | "network" | "rack";

const VIEW_KEY = "lattice.view.v1";
const LAYOUT_KEY = "lattice.layout.v1";
const V_SPACING_KEY = "lattice.vSpacing.v1";
const H_SPACING_KEY = "lattice.hSpacing.v1";

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

function EmptyIllustration() {
  return (
    <svg viewBox="0 0 260 150" width={260} height={150} className="h-36 w-auto" fill="none" aria-hidden="true">
      <path
        d="M130 42v26m0 0-62 34m62-34 62 34"
        stroke="#2E3C63"
        strokeWidth="1.6"
        className="empty-dash"
      />
      <circle cx="130" cy="30" r="16" fill="#0E1730" stroke="#38BDF8" strokeWidth="1.6" />
      <path
        d="M124 33a8.5 8.5 0 0 1 12 0M126.5 35.7a5 5 0 0 1 7 0"
        stroke="#38BDF8"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="129" cy="30" r="1.1" fill="#38BDF8" />
      <circle cx="56" cy="112" r="14" fill="#0E1730" stroke="#2DD4BF" strokeWidth="1.6" />
      <rect x="50" y="106" width="12" height="5.5" rx="1.2" stroke="#2DD4BF" strokeWidth="1.3" />
      <path d="M52 114.8h8" stroke="#2DD4BF" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="130" cy="112" r="14" fill="#0E1730" stroke="#F5A524" strokeWidth="1.6" />
      <circle cx="130" cy="112" r="4" stroke="#F5A524" strokeWidth="1.3" />
      <path
        d="M130 103.5V106M130 118v2.5M121.5 112H124M136 112h2.5"
        stroke="#F5A524"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="204" cy="112" r="14" fill="#0E1730" stroke="#A78BFA" strokeWidth="1.6" />
      <rect x="198" y="105.5" width="12" height="5" rx="1" stroke="#A78BFA" strokeWidth="1.2" />
      <rect x="198" y="112.5" width="12" height="5" rx="1" stroke="#A78BFA" strokeWidth="1.2" />
      <circle cx="66" cy="102" r="2.4" fill="#4ADE80" className="blink" />
      <circle cx="140" cy="102" r="2.4" fill="#4ADE80" className="blink" style={{ animationDelay: "0.7s" }} />
      <circle cx="214" cy="102" r="2.4" fill="#4ADE80" className="blink" style={{ animationDelay: "1.3s" }} />
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
  const { devices, racks, connections, importText, loadSample } = useDevices();
  const { push } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [view, setView] = useState<ViewMode>(loadView);
  const [isHorizontal, setIsHorizontal] = useState(() => loadBool(LAYOUT_KEY, false));
  const [verticalSpacing, setVerticalSpacing] = useState(() => loadNum(V_SPACING_KEY, 138));
  const [horizontalSpacing, setHorizontalSpacing] = useState(() => loadNum(H_SPACING_KEY, 90));
  const leafSpacing = isHorizontal ? horizontalSpacing : verticalSpacing;
  const [hoveredConnId, setHoveredConnId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    const subnets = new Set(devices.map((d) => parseCidr(d.ip)?.key ?? "?"));
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
              <button
                onClick={() => notifyImport(loadSample(), push, "sample-network.json")}
                className="flex items-center gap-2 rounded-lg border border-line bg-raised/70 px-5 py-2.5 text-[14px] font-semibold text-txt transition-all hover:border-brand/50 hover:bg-brand/10 active:scale-[0.97]"
              >
                <IconBraces className="h-4 w-4 text-brand" size={16} />
                Load sample network
              </button>
            </div>
            <button
              onClick={() => navigate("/devices")}
              className="group mt-6 flex items-center gap-1.5 text-[13px] font-medium text-faint transition-colors hover:text-brand"
            >
              <IconList className="h-3.5 w-3.5" size={14} />
              Open device registry
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {view === "hierarchy" ? (
            <TopologyCanvas devices={devices} selectedId={selectedId} onSelect={setSelectedId} externalHoverDeviceId={hoveredConnRemoteId} isHorizontal={isHorizontal} leafSpacing={leafSpacing} />
          ) : view === "network" ? (
            <NetworkCanvas devices={devices} connections={connections} selectedId={selectedId} onSelect={setSelectedId} externalHoverDeviceId={hoveredConnRemoteId} />
          ) : (
            <RackCanvas
              devices={devices}
              racks={racks}
              connections={connections}
              selectedId={selectedId}
              onSelect={setSelectedId}
              externalHoverConnId={hoveredConnId}
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
          <div className="pointer-events-none absolute right-4 top-4">
            <div className="pointer-events-auto">
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>

          {/* legends */}
          <div className="pointer-events-none absolute bottom-4 left-4 hidden flex-col gap-2 sm:flex">
            {selectedHasConnections && view === "rack" && (
              <div className="pointer-events-auto rounded-xl border border-line bg-deep/85 px-3.5 py-3 shadow-lg shadow-black/20 backdrop-blur">
                <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint">
                  cables
                </p>
                <div className="flex flex-col gap-y-1.5">
                  <span className="flex items-center gap-2 text-[11px] text-mute">
                    <svg width="28" height="6" className="shrink-0">
                      <line x1="0" y1="3" x2="28" y2="3" stroke="#3B82F6" strokeWidth="1.5" />
                    </svg>
                    Ethernet
                  </span>
                  <span className="flex items-center gap-2 text-[11px] text-mute">
                    <svg width="28" height="6" className="shrink-0">
                      <line x1="0" y1="3" x2="28" y2="3" stroke="#FBBF24" strokeWidth="1.5" strokeDasharray="6 4" />
                    </svg>
                    Fibre
                  </span>
                  <span className="flex items-center gap-2 text-[11px] text-mute">
                    <svg width="28" height="6" className="shrink-0">
                      <line x1="0" y1="3" x2="28" y2="3" stroke="#A78BFA" strokeWidth="1.5" strokeDasharray="4 3 2 3" />
                    </svg>
                    Mixed
                  </span>
                  <span className="flex items-center gap-2 text-[11px] text-mute">
                    <svg width="28" height="6" className="shrink-0">
                      <line x1="0" y1="3" x2="28" y2="3" stroke="#3B82F6" strokeWidth="3.5" />
                    </svg>
                    Multi-link
                  </span>
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

          {view === "hierarchy" && (
            <div className="absolute bottom-10 left-1/2 hidden -translate-x-1/2 items-center gap-2 lg:flex">
              <IconLayoutHorizontal className={`h-3.5 w-3.5 transition-colors duration-150 ${!isHorizontal ? "text-brand" : "text-faint"}`} size={14} />
              <button
                onClick={() => setIsHorizontal((v) => !v)}
                className="relative h-5 w-9 rounded-full bg-line transition-colors"
              >
                <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-txt shadow-sm transition-transform duration-200 ${isHorizontal ? "translate-x-4" : ""}`} />
              </button>
              <IconLayoutVertical className={`h-3.5 w-3.5 transition-colors duration-150 ${isHorizontal ? "text-brand" : "text-faint"}`} size={14} />
              <div className="flex items-center rounded-lg border border-line bg-raised/80 p-0.5">
                {(isHorizontal
                  ? [["Compact", 72], ["Default", 90], ["Spacious", 120]] as const
                  : [["Compact", 110], ["Default", 138], ["Spacious", 190]] as const
                ).map(([label, value]) => (
                  <button
                    key={label}
                    onClick={() => isHorizontal ? setHorizontalSpacing(value) : setVerticalSpacing(value)}
                    className={`rounded-md px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
                      leafSpacing === value
                        ? "bg-brand/15 text-brand"
                        : "text-faint hover:text-mute"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint lg:block">
            drag to pan · scroll to zoom · click a node
          </p>

          {selected && <DeviceDrawer device={selected} onClose={() => setSelectedId(null)} onConnectionHover={setHoveredConnId} hideGateway={view === "rack"} />}
        </>
      )}
    </div>
  );
}
