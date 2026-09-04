import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useDatastore } from "../store";
import { useToast } from "../components/Toast";
import TopologyCanvas from "../components/layout/TopologyCanvas";
import RackCanvas from "../components/layout/RackCanvas";
import { buildRackView } from "../lib/layout/rack";
import DeviceDrawer from "../components/device/DeviceDrawer";
import { getPrimaryIp, notifyImport, findNextRackSlot } from "../lib/helpers";
import { navigate } from "../lib/router";
import { inferType } from "../lib/layout/topology";
import { resolveRack } from "../lib/importer";
import { parseCidr } from "../lib/cidr";
import type { Device } from "../lib/types";
import { usePersistedState } from "../lib/usePersistedState";
import type { ViewMode } from "../lib/storage";
import {
  KEY_VIEW, KEY_TOPOLOGY_LAYOUT, KEY_TOPOLOGY_V_SPACING, KEY_TOPOLOGY_H_SPACING,
  KEY_RACK_CABLE_STYLE, KEY_RACK_ALIGN, KEY_RACK_U_ORDER, KEY_RACK_LABEL_MODE,
} from "../lib/storage";
import ConfirmDialog from "../components/ConfirmDialog";
import NetworkCanvas from "../components/layout/NetworkCanvas";
import ViewControlBar from "../components/ViewControlBar";
import DeviceEditModal from "../components/device/DeviceEditModal";
import RackGroupEditModal from "../components/rack/RackGroupEditModal";
import ConnectionEditModal from "../components/connection/ConnectionEditModal";
import Legend from "../components/layout/Legend";
import { IconUpload, IconList, IconTree, IconNetwork, IconRack } from "../components/Icons";
import {
  ILLUSTRATION_LINE, ILLUSTRATION_NODE, INTERNET_COLOUR,
  DOT_CONNECTED,
} from "../lib/colours";

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
      {btn("topology", "Topology", <IconTree className="h-3.5 w-3.5" size={14} />)}
      {btn("network", "Network", <IconNetwork className="h-3.5 w-3.5" size={14} />)}
      {btn("rack", "Racks", <IconRack className="h-3.5 w-3.5" size={14} />)}
    </div>
  );
}

export default function MainPage({ focusId }: { focusId: string | null }) {
  const { devices, racks, connections, importText, updateDevice, addDevice, removeDevice } = useDatastore();
  const { push } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [view, setView] = usePersistedState<ViewMode>(KEY_VIEW, "topology", (v) =>
    v === "rack" || v === "network" ? v as ViewMode : "topology",
  );
  const [topologyHorizontal, setTopologyHorizontal] = usePersistedState(KEY_TOPOLOGY_LAYOUT, false, (v) => v === "1");
  const [topologyVSpacing, setTopologyVSpacing] = usePersistedState(KEY_TOPOLOGY_V_SPACING, 138, Number);
  const [topologyHSpacing, setTopologyHSpacing] = usePersistedState(KEY_TOPOLOGY_H_SPACING, 90, Number);
  const [rackCableStyle, setRackCableStyle] = usePersistedState<"bezier" | "orthogonal">(KEY_RACK_CABLE_STYLE, "bezier", (v) =>
    v === "orthogonal" ? "orthogonal" : "bezier",
  );
  const [rackAlign, setRackAlign] = usePersistedState<"top" | "bottom">(KEY_RACK_ALIGN, "bottom", (v) =>
    v === "top" ? "top" : "bottom",
  );
  const [rackUOrder, setRackUOrder] = usePersistedState<"top" | "bottom">(KEY_RACK_U_ORDER, "bottom", (v) =>
    v === "top" ? "top" : "bottom",
  );
  const [rackLabelMode, setRackLabelMode] = usePersistedState<"name" | "model">(KEY_RACK_LABEL_MODE, "name", (v) =>
    v === "model" ? "model" : "name",
  );
  const leafSpacing = topologyHorizontal ? topologyHSpacing : topologyVSpacing;
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
    () => buildRackView(devices, racks, rackCableStyle, rackAlign, rackUOrder),
    [devices, racks, rackCableStyle, rackAlign, rackUOrder],
  );

  useEffect(() => {
    if (focusId) setSelectedId(focusId);
  }, [focusId]);

  // Reset to bezier when switching to network or topology view
  useEffect(() => {
    if (view !== "rack" && rackCableStyle !== "bezier") {
      setRackCableStyle("bezier");
    }
  }, [view, rackCableStyle, setRackCableStyle]);

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
  }, [devices, racks, connections]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    notifyImport(importText(text, file.name), push, file.name);
  };

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
              — and it will draw the whole network as a live topology and rack elevations.
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
          {view === "topology" ? (
            <TopologyCanvas devices={devices} connections={connections} selectedId={selectedId} onSelect={setSelectedId} externalHoverDeviceId={hoveredConnRemoteId} isHorizontal={topologyHorizontal} leafSpacing={leafSpacing} drawerOpen={!!selected} drawerWidth={drawerWidth} />
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
              cableStyle={rackCableStyle}
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
                const targetU = findNextRackSlot(rack, devices, d.mountIndex, d.size, rackUOrder);
                if (targetU === null) return;
                addDevice({ name: d.name, notes: d.notes, model: d.model, rackId: d.rackId, mountIndex: targetU, size: d.size, isGateway: d.isGateway });
              }}
              onMoveDevice={(deviceId, rackId, mountIndex) => updateDevice(deviceId, { rackId, mountIndex })}
              onDeleteDevice={(d) => setDeleteDevice(d)}
            />
          )}

          <Legend
            connections={connections}
            deviceCount={devices.length}
            presentTypes={stats.types}
            view={view}
            rackCount={stats.racks}
            groupCount={stats.groups}
            subnetCount={stats.subnets}
            sourceCount={stats.sources}
            selectedHasConnections={selectedHasConnections}
          />

          <div
            className="pointer-events-none absolute top-4 transition-[right] duration-200"
            style={{ right: selected ? `${drawerWidth + 16}px` : "1rem" }}
          >
            <div className="pointer-events-auto">
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>

          <ViewControlBar
            view={view}
            isHorizontal={topologyHorizontal}
            onToggleLayout={() => setTopologyHorizontal((v) => !v)}
            leafSpacing={leafSpacing}
            onSpacingChange={(value) => topologyHorizontal ? setTopologyHSpacing(value) : setTopologyVSpacing(value)}
            cableStyle={rackCableStyle}
            onCableStyleChange={setRackCableStyle}
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
