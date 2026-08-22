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
import { IconUpload, IconBraces, IconList, IconTree, IconRack } from "../components/icons";

type ViewMode = "hierarchy" | "rack";

const VIEW_KEY = "lattice.view.v1";

function loadView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "rack" ? "rack" : "hierarchy";
  } catch {
    return "hierarchy";
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
      {btn("rack", "Racks", <IconRack className="h-3.5 w-3.5" size={14} />)}
    </div>
  );
}

export default function GalleryPage({ focusId }: { focusId: string | null }) {
  const { devices, racks, importText, loadSample } = useDevices();
  const { push } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [view, setView] = useState<ViewMode>(loadView);
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

  const selected = useMemo(
    () => devices.find((d) => d.id === selectedId) ?? null,
    [devices, selectedId]
  );

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
    view === "hierarchy"
      ? [
          { n: devices.length, label: devices.length === 1 ? "device" : "devices" },
          { n: stats.subnets, label: stats.subnets === 1 ? "subnet" : "subnets" },
          { n: stats.sources, label: stats.sources === 1 ? "source" : "sources" },
        ]
      : [
          { n: devices.length, label: devices.length === 1 ? "device" : "devices" },
          { n: stats.racks, label: stats.racks === 1 ? "rack" : "racks" },
          { n: stats.groups, label: stats.groups === 1 ? "group" : "groups" },
        ];

  return (
    <div className="relative h-full">
      {devices.length === 0 ? (
        <div className="flex h-full overflow-y-auto px-6">
          <div className="rise m-auto flex max-w-lg flex-col items-center py-12 text-center">
            <EmptyIllustration />
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.28em] text-brand">
              gallery · empty
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-txt sm:text-[44px] sm:leading-[1.05]">
              Nothing on the wire yet.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-mute">
              Feed Lattice a JSON inventory —{" "}
              <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[13px] text-brand">
                &#123; racks, devices &#125;
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
            <TopologyCanvas devices={devices} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <RackCanvas
              devices={devices}
              racks={racks}
              selectedId={selectedId}
              onSelect={setSelectedId}
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

          {/* legend */}
          <div className="pointer-events-none absolute bottom-4 left-4 hidden rounded-xl border border-line bg-deep/85 px-3.5 py-3 shadow-lg shadow-black/20 backdrop-blur sm:block">
            <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint">
              node types
            </p>
            <div className="flex max-w-64 flex-wrap gap-x-3.5 gap-y-1.5">
              {presentTypes.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[11.5px] text-mute">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: TYPE_META[t].color }}
                  />
                  {TYPE_META[t].label}
                </span>
              ))}
            </div>
          </div>

          <p className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint lg:block">
            drag to pan · scroll to zoom · click a node
          </p>

          {selected && <DeviceDrawer device={selected} onClose={() => setSelectedId(null)} />}
        </>
      )}
    </div>
  );
}
