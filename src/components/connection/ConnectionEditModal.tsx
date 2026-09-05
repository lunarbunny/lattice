import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDatastore } from "../../store";
import { useToast } from "../Toast";
import type { CableMedium, Connection, Device, VlanSubConnection } from "../../lib/types";
import { IconX, IconPlus, IconFibre, IconEthernet } from "../Icons";
import { CABLE_ETHERNET, CABLE_FIBRE } from "../../lib/colours";
import AutoCompleteInputField from "../AutoCompleteInputField";
import { SegmentedText } from "../OptionSelector";
import PortField from "../PortField";
import Checkbox from "../Checkbox";
import { getDevicePorts } from "../../lib/ports";
import { incrementTrailingNumber } from "../../lib/helpers";

interface VlanFormEntry {
  key: string;
  vlanId: string;
  srcIp: string;
  dstIp: string;
}

let vlanKeyCounter = 0;
function nextVlanKey() {
  return `vlan-${++vlanKeyCounter}`;
}

interface ConnFormState {
  key: string;
  connectionId?: string;
  remoteDevice: string;
  localPort: string;
  remotePort: string;
  medium: CableMedium;
  localIp: string;
  remoteIp: string;
  localIsPrimary: boolean;
  vlans: VlanFormEntry[];
  bundleId: string;
  bundleProtocol: string;
  selected: boolean;
}

let connCounter = 0;
function nextConnKey() {
  return `ce-${++connCounter}`;
}

const emptyForm: ConnFormState = {
  key: nextConnKey(),
  remoteDevice: "",
  localPort: "",
  remotePort: "",
  medium: "ethernet",
  localIp: "",
  remoteIp: "",
  localIsPrimary: false,
  vlans: [],
  bundleId: "",
  bundleProtocol: "",
  selected: false,
};

const BUNDLE_PRESETS = ["802.3ad", "active-passive", "balance-rr"];

const BUNDLE_COLORS = [
  "#38BDF8", // sky
  "#A78BFA", // violet
  "#34D399", // emerald
  "#FB923C", // orange
  "#F472B6", // pink
  "#FBBF24", // amber
];

function getLocalPort(conn: Connection, deviceName: string): string {
  return conn.srcDevice.toLowerCase() === deviceName.toLowerCase() ? conn.srcPort : conn.dstPort;
}

function getRemotePort(conn: Connection, deviceName: string): string {
  return conn.srcDevice.toLowerCase() === deviceName.toLowerCase() ? conn.dstPort : conn.srcPort;
}

function getLocalIp(conn: Connection, deviceName: string): string {
  return conn.srcDevice.toLowerCase() === deviceName.toLowerCase() ? (conn.srcIp ?? "") : (conn.dstIp ?? "");
}

function getRemoteIp(conn: Connection, deviceName: string): string {
  return conn.srcDevice.toLowerCase() === deviceName.toLowerCase() ? (conn.dstIp ?? "") : (conn.srcIp ?? "");
}

function getLocalIsPrimary(conn: Connection, deviceName: string): boolean {
  return conn.srcDevice.toLowerCase() === deviceName.toLowerCase()
    ? conn.srcIsPrimary === true
    : conn.dstIsPrimary === true;
}

function getRemote(conn: Connection, deviceName: string): string {
  return conn.srcDevice.toLowerCase() === deviceName.toLowerCase() ? conn.dstDevice : conn.srcDevice;
}

/**
 * Build the grid template based on active modes.
 * Columns: medium | local port | local IP | remote device | remote port | remote IP | [bundle] | delete
 */
function buildRowGrid(bundle: boolean): string {
  const cols = [
    "2.75rem",
    "minmax(0,1fr)",
    "minmax(0,1.3fr)",
    "minmax(0,1.45fr)",
    "minmax(0,1fr)",
    "minmax(0,1.3fr)",
  ];
  if (bundle) cols.push("2rem");
  cols.push("24px");
  return `grid grid-cols-[${cols.join("_")}] items-center gap-2`;
}

interface Props {
  device: Device;
  onClose: () => void;
  filterRemoteDevice?: string;
}

export default function ConnectionEditModal({ device, onClose, filterRemoteDevice }: Props) {
  const { devices, connections, portTemplates, addConnection, updateConnection, removeConnection } = useDatastore();
  const { push } = useToast();

  const deviceConns = connections.filter((c) => {
    const isLocal =
      c.srcDevice.toLowerCase() === device.name.toLowerCase() ||
      c.dstDevice.toLowerCase() === device.name.toLowerCase();
    if (!isLocal) return false;
    if (!filterRemoteDevice) return true;
    const remote = getRemote(c, device.name);
    return remote.toLowerCase() === filterRemoteDevice.toLowerCase();
  });

  const otherDevices = devices.filter((d) => d.id !== device.id);
  const localPorts = useMemo(() => getDevicePorts(device, portTemplates), [device, portTemplates]);

  const [entries, setEntries] = useState<ConnFormState[]>(() => {
    const existingEntries: ConnFormState[] = deviceConns.map((conn) => ({
      key: nextConnKey(),
      connectionId: conn.id,
      remoteDevice: getRemote(conn, device.name),
      localPort: getLocalPort(conn, device.name),
      remotePort: getRemotePort(conn, device.name),
      medium: conn.medium,
      localIp: getLocalIp(conn, device.name),
      remoteIp: getRemoteIp(conn, device.name),
      localIsPrimary: getLocalIsPrimary(conn, device.name),
      vlans: (conn.vlans ?? []).map((v) => ({
        key: nextVlanKey(),
        vlanId: String(v.vlanId),
        srcIp: v.srcIp ?? "",
        dstIp: v.dstIp ?? "",
      })),
      bundleId: conn.bundleId ?? "",
      bundleProtocol: conn.bundleProtocol ?? "",
      selected: false,
    }));
    return existingEntries.length > 0 ? existingEntries : [{ ...emptyForm, key: nextConnKey() }];
  });

  /* ---- bulk add state ---- */
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPorts, setBulkPorts] = useState<Set<string>>(new Set());
  const [bulkQuery, setBulkQuery] = useState("");
  const [bulkRemote, setBulkRemote] = useState("");
  const [bulkRemotePort, setBulkRemotePort] = useState("");
  const [bulkMedium, setBulkMedium] = useState<CableMedium>("ethernet");

  /* ---- mode toolbar state (mutually exclusive) ---- */
  type EditMode = "off" | "subif" | "bundle";
  const [editMode, setEditMode] = useState<EditMode>("off");
  const [bundleProtocolInput, setBundleProtocolInput] = useState("");
  const [bundleCustomOpen, setBundleCustomOpen] = useState(false);

  const subifMode = editMode === "subif";
  const bundleMode = editMode === "bundle";

  const switchMode = (mode: EditMode) => {
    setEditMode((prev) => (prev === mode ? "off" : mode));
    if (mode !== "bundle") {
      setEntries((prev) => prev.map((e) => ({ ...e, selected: false })));
    }
  };

  /** Assign a stable colour to each distinct bundleId. */
  const bundleColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const e of entries) {
      if (e.bundleId && !map.has(e.bundleId)) {
        map.set(e.bundleId, BUNDLE_COLORS[idx % BUNDLE_COLORS.length]);
        idx++;
      }
    }
    return map;
  }, [entries]);

  const addEntry = () => {
    setEntries((prev) => [...prev, { ...emptyForm, key: nextConnKey() }]);
  };

  const removeEntry = (key: string) => {
    setEntries((prev) => prev.filter((e) => e.key !== key));
  };

  const updateEntry = (key: string, updater: (prev: ConnFormState) => ConnFormState) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? updater(e) : e)));
  };

  /** Lowercase port names already occupied by the given device (saved cables + rows being edited). */
  const usedPortsFor = (name: string): Set<string> => {
    const key = name.trim().toLowerCase();
    const used = new Set<string>();
    if (!key) return used;
    for (const c of connections) {
      if (c.srcDevice.toLowerCase() === key && c.srcPort) used.add(c.srcPort.toLowerCase());
      if (c.dstDevice.toLowerCase() === key && c.dstPort) used.add(c.dstPort.toLowerCase());
    }
    for (const e of entries) {
      if (e.localPort.trim() && device.name.toLowerCase() === key) used.add(e.localPort.trim().toLowerCase());
      if (e.remotePort.trim() && e.remoteDevice.trim().toLowerCase() === key) used.add(e.remotePort.trim().toLowerCase());
    }
    return used;
  };

  const localUsedPorts = usedPortsFor(device.name);

  const applyBulk = () => {
    const selected = localPorts.filter((p) => bulkPorts.has(p));
    if (selected.length === 0 || !bulkRemote.trim()) return;
    const remote = bulkRemote.trim();
    const newEntries: ConnFormState[] = [];
    let remotePort = bulkRemotePort.trim();
    for (let i = 0; i < selected.length; i++) {
      if (i > 0 && remotePort) remotePort = incrementTrailingNumber(remotePort);
      newEntries.push({
        key: nextConnKey(),
        remoteDevice: remote,
        localPort: selected[i],
        remotePort,
        medium: bulkMedium,
        localIp: "",
        remoteIp: "",
        localIsPrimary: false,
        vlans: [],
        bundleId: "",
        bundleProtocol: "",
        selected: false,
      });
    }
    setEntries((prev) => [...prev, ...newEntries]);
    setBulkPorts(new Set());
    setBulkQuery("");
    setBulkRemotePort("");
    setBulkOpen(false);
  };

  /* ---- VLAN sub-entry helpers ---- */
  const addVlanEntry = (connKey: string) => {
    updateEntry(connKey, (f) => ({
      ...f,
      vlans: [...f.vlans, { key: nextVlanKey(), vlanId: "", srcIp: "", dstIp: "" }],
    }));
  };

  const removeVlanEntry = (connKey: string, vlanKey: string) => {
    updateEntry(connKey, (f) => ({
      ...f,
      vlans: f.vlans.filter((v) => v.key !== vlanKey),
    }));
  };

  const updateVlanEntry = (connKey: string, vlanKey: string, updater: (v: VlanFormEntry) => VlanFormEntry) => {
    updateEntry(connKey, (f) => ({
      ...f,
      vlans: f.vlans.map((v) => (v.key === vlanKey ? updater(v) : v)),
    }));
  };

  /* ---- Bundle actions ---- */
  const selectedEntries = entries.filter((e) => e.selected && e.remoteDevice.trim());
  const selectedCount = selectedEntries.length;

  const applyBundle = (protocol: string) => {
    if (selectedCount < 2) return;
    const id = crypto.randomUUID();
    setEntries((prev) =>
      prev.map((e) =>
        e.selected && e.remoteDevice.trim()
          ? { ...e, bundleId: id, bundleProtocol: protocol, selected: false }
          : { ...e, selected: false },
      ),
    );
  };

  const removeFromBundle = (key: string) => {
    updateEntry(key, (f) => ({ ...f, bundleId: "", bundleProtocol: "" }));
  };

  const toggleSelectAll = () => {
    const allSelected = entries.filter((e) => e.remoteDevice.trim()).every((e) => e.selected);
    setEntries((prev) =>
      prev.map((e) => (e.remoteDevice.trim() ? { ...e, selected: !allSelected } : e)),
    );
  };

  const handleSave = () => {
    const validEntries = entries.filter((e) => e.remoteDevice.trim());

    for (const entry of validEntries) {
      const localPort = entry.localPort.trim();
      const remotePort = entry.remotePort.trim();
      if (!localPort && !remotePort) { push("error", "Enter at least one port per cable"); return; }
    }

    // Validate VLAN entries
    for (const entry of validEntries) {
      for (const v of entry.vlans) {
        const id = Number(v.vlanId);
        if (!v.vlanId.trim() || !Number.isInteger(id) || id < 1 || id > 4094) {
          push("error", `VLAN ID must be an integer 1–4094`);
          return;
        }
      }
    }

    const existingIds = new Set(entries.filter((e) => e.connectionId).map((e) => e.connectionId!));
    const processedIds = new Set<string>();

    // Build a map of bundleId → shared VLAN config for propagation
    const bundleVlanMap = new Map<string, VlanSubConnection[] | undefined>();
    for (const entry of validEntries) {
      if (entry.bundleId) {
        if (!bundleVlanMap.has(entry.bundleId)) {
          const parsedVlans = entry.vlans
            .filter((v) => v.vlanId.trim())
            .map((v) => ({
              vlanId: Number(v.vlanId),
              srcIp: v.srcIp.trim() || undefined,
              dstIp: v.dstIp.trim() || undefined,
            }));
          bundleVlanMap.set(entry.bundleId, parsedVlans.length > 0 ? parsedVlans : undefined);
        }
      }
    }

    for (const entry of validEntries) {
      // Determine VLAN config: use bundle-shared config if bundled, else own
      let vlans: VlanSubConnection[] | undefined;

      if (entry.bundleId && bundleVlanMap.has(entry.bundleId)) {
        vlans = bundleVlanMap.get(entry.bundleId);
      } else {
        vlans = entry.vlans
          .filter((v) => v.vlanId.trim())
          .map((v) => ({
            vlanId: Number(v.vlanId),
            srcIp: v.srcIp.trim() || undefined,
            dstIp: v.dstIp.trim() || undefined,
          }));
        if (vlans.length === 0) vlans = undefined;
      }

      const bundleId = entry.bundleId || undefined;
      const bundleProtocol = entry.bundleProtocol || undefined;

      if (entry.connectionId) {
        const conn = connections.find((c) => c.id === entry.connectionId);
        if (!conn) continue;

        const isSrc = conn.srcDevice.toLowerCase() === device.name.toLowerCase();
        const updates: Partial<Connection> = {
          medium: entry.medium,
          vlans,
          bundleId,
          bundleProtocol,
        };

        if (isSrc) {
          updates.dstDevice = entry.remoteDevice.trim();
          updates.srcPort = entry.localPort.trim();
          updates.dstPort = entry.remotePort.trim();
          updates.srcIp = entry.localIp.trim() || undefined;
          updates.dstIp = entry.remoteIp.trim() || undefined;
          updates.srcIsPrimary = entry.localIsPrimary || undefined;
        } else {
          updates.srcDevice = entry.remoteDevice.trim();
          updates.dstPort = entry.localPort.trim();
          updates.srcPort = entry.remotePort.trim();
          updates.dstIp = entry.localIp.trim() || undefined;
          updates.srcIp = entry.remoteIp.trim() || undefined;
          updates.dstIsPrimary = entry.localIsPrimary || undefined;
        }

        updateConnection(entry.connectionId, updates);
        processedIds.add(entry.connectionId);
      } else {
        addConnection({
          srcDevice: device.name,
          dstDevice: entry.remoteDevice.trim(),
          srcPort: entry.localPort.trim(),
          dstPort: entry.remotePort.trim(),
          medium: entry.medium,
          srcIp: entry.localIp.trim() || undefined,
          dstIp: entry.remoteIp.trim() || undefined,
          srcIsPrimary: entry.localIsPrimary || undefined,
          vlans,
          bundleId,
          bundleProtocol,
        });
      }
    }

    for (const id of existingIds) {
      if (!processedIds.has(id)) {
        removeConnection(id);
      }
    }

    const newCount = validEntries.filter((e) => !e.connectionId).length;
    const updateCount = validEntries.filter((e) => e.connectionId && processedIds.has(e.connectionId)).length;
    const deleteCount = existingIds.size - processedIds.size;

    const parts: string[] = [];
    if (newCount > 0) parts.push(`added ${newCount}`);
    if (updateCount > 0) parts.push(`updated ${updateCount}`);
    if (deleteCount > 0) parts.push(`removed ${deleteCount}`);

    push("success", `Connections: ${parts.join(", ") || "no changes"}`);
    onClose();
  };

  const renderRow = (form: ConnFormState) => {
    const setForm = (updater: (prev: ConnFormState) => ConnFormState) => updateEntry(form.key, updater);
    const remoteDev = devices.find((d) => d.name === form.remoteDevice);
    const remotePorts = getDevicePorts(remoteDev, portTemplates);
    const hasBundle = !!form.bundleId;
    const bundleColor = hasBundle ? bundleColorMap.get(form.bundleId) : undefined;
    const rowGrid = buildRowGrid(bundleMode);

    return (
      <div key={form.key} className="relative">
        {/* bundle colour indicator */}
        {hasBundle && bundleColor && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-full"
            style={{ background: bundleColor }}
          />
        )}
        {/* ---- main row ---- */}
        <div className={rowGrid}>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, medium: f.medium === "ethernet" ? "fibre" : "ethernet" }))}
            title={
              form.medium === "ethernet"
                ? "Medium: ethernet — click to switch to fibre"
                : "Medium: fibre — click to switch to ethernet"
            }
            className="flex h-8 w-full items-center justify-center rounded-lg border border-line transition-colors hover:border-brand/40"
            style={{
              color: form.medium === "fibre" ? CABLE_FIBRE : CABLE_ETHERNET,
              background: `${form.medium === "fibre" ? CABLE_FIBRE : CABLE_ETHERNET}14`,
            }}
          >
            {form.medium === "fibre" ? (
              <IconFibre className="h-4 w-4" size={16} />
            ) : (
              <IconEthernet className="h-4 w-4" size={16} />
            )}
          </button>

          <PortField
            value={form.localPort}
            onChange={(v) => setForm((f) => ({ ...f, localPort: v }))}
            suggestions={localPorts.length > 0 ? localPorts : undefined}
            usedPorts={localUsedPorts}
            placeholder="e.g. eth0"
          />

          <div className="flex items-center gap-1.5">
            <input
              className="h-8 w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 font-mono text-[12px] text-txt outline-none transition-colors focus:border-brand/60"
              value={form.localIp}
              onChange={(e) => setForm((f) => ({ ...f, localIp: e.target.value }))}
              placeholder="10.0.0.1/24"
            />
            <button
              type="button"
              disabled={!form.localIp.trim()}
              title={form.localIp.trim() ? "Primary IP for subnet grouping" : "Set a local IP to mark it primary"}
              onClick={() => togglePrimary(form.key)}
              className={`h-8 w-7 shrink-0 rounded-lg border font-mono text-[10px] font-bold transition-colors ${
                form.localIp.trim() && primaryIps.has(form.localIp.trim().toLowerCase())
                  ? "border-brand/50 bg-brand/15 text-brand"
                  : form.localIp.trim()
                    ? "border-line bg-surface text-faint hover:border-brand/30 hover:text-mute"
                    : "cursor-not-allowed border-line/50 bg-surface/40 text-faint/30"
              }`}
            >
              P
            </button>
          </div>

          <AutoCompleteInputField
            value={form.remoteDevice}
            onChange={(name) => setForm((f) => ({ ...f, remoteDevice: name }))}
            options={otherDevices.map((d) => d.name)}
            placeholder="Device…"
          />

          <PortField
            value={form.remotePort}
            onChange={(v) => setForm((f) => ({ ...f, remotePort: v }))}
            suggestions={remotePorts.length > 0 ? remotePorts : undefined}
            usedPorts={form.remoteDevice.trim() ? usedPortsFor(form.remoteDevice) : undefined}
            placeholder="e.g. eth48"
          />

          <input
            className="h-8 w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 font-mono text-[12px] text-txt outline-none transition-colors focus:border-brand/60"
            value={form.remoteIp}
            onChange={(e) => setForm((f) => ({ ...f, remoteIp: e.target.value }))}
            placeholder="10.0.0.2/24"
          />

          {bundleMode && (
            <Checkbox
              checked={form.selected}
              onChange={(v) => setForm((f) => ({ ...f, selected: v }))}
              title="Select for bundling"
            />
          )}

          <button
            type="button"
            onClick={() => removeEntry(form.key)}
            title="Remove cable"
            className="flex h-8 items-center justify-center rounded-md text-danger/60 transition-colors hover:bg-danger/15 hover:text-danger"
          >
            <IconX className="h-3.5 w-3.5" size={14} />
          </button>
        </div>

        {/* ---- bundle indicator (when in bundle mode and bundled) ---- */}
        {hasBundle && bundleMode && (
          <div className="mt-0.5 flex items-center gap-2 pl-[2rem]">
            <span
              className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
              style={{ background: `${bundleColor}20`, color: bundleColor }}
            >
              {form.bundleProtocol}
            </span>
            <button
              type="button"
              onClick={() => removeFromBundle(form.key)}
              className="font-mono text-[10px] text-danger/50 transition-colors hover:text-danger"
            >
              leave bundle
            </button>
          </div>
        )}

        {/* ---- inline VLAN trunk editor (subif mode) ---- */}
        {subifMode && (
          <div className="ml-[3.25rem] mr-[2rem] mt-1 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                VLANs
                {form.vlans.length > 0 && <span className="ml-1.5 text-brand">{form.vlans.length}</span>}
              </label>
              <button
                type="button"
                onClick={() => addVlanEntry(form.key)}
                className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold text-brand transition-colors hover:bg-brand/10"
              >
                <IconPlus className="h-2.5 w-2.5" size={10} />
                add VLAN
              </button>
            </div>

            {form.vlans.length > 0 && (
              <div className="mt-1.5 space-y-1">
                <div className="grid grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)_24px] items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">VLAN ID</span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">src SVI IP</span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">dst SVI IP</span>
                  <span />
                </div>
                {form.vlans.map((v) => (
                  <div key={v.key} className="grid grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)_24px] items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={4094}
                      className="h-7 rounded-lg border border-line bg-surface px-2 font-mono text-[11.5px] text-txt outline-none transition-colors focus:border-brand/60"
                      value={v.vlanId}
                      onChange={(e) => updateVlanEntry(form.key, v.key, (ve) => ({ ...ve, vlanId: e.target.value }))}
                      placeholder="1–4094"
                    />
                    <input
                      className="h-7 rounded-lg border border-line bg-surface px-2 font-mono text-[11.5px] text-txt outline-none transition-colors focus:border-brand/60"
                      value={v.srcIp}
                      onChange={(e) => updateVlanEntry(form.key, v.key, (ve) => ({ ...ve, srcIp: e.target.value }))}
                      placeholder="10.0.0.1/24"
                    />
                    <input
                      className="h-7 rounded-lg border border-line bg-surface px-2 font-mono text-[11.5px] text-txt outline-none transition-colors focus:border-brand/60"
                      value={v.dstIp}
                      onChange={(e) => updateVlanEntry(form.key, v.key, (ve) => ({ ...ve, dstIp: e.target.value }))}
                      placeholder="10.0.0.2/24"
                    />
                    <button
                      type="button"
                      onClick={() => removeVlanEntry(form.key, v.key)}
                      title="Remove VLAN"
                      className="flex h-7 items-center justify-center rounded-md text-danger/60 transition-colors hover:bg-danger/15 hover:text-danger"
                    >
                      <IconX className="h-3 w-3" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const labelClass = "font-mono text-[10px] uppercase tracking-[0.18em] text-faint";
  const bulkVisiblePorts = localPorts.filter((p) => p.toLowerCase().includes(bulkQuery.trim().toLowerCase()));

  /** IPs that are currently marked primary across all entries. */
  const primaryIps = useMemo(() => {
    const ips = new Set<string>();
    for (const e of entries) {
      if (e.localIsPrimary && e.localIp.trim()) ips.add(e.localIp.trim().toLowerCase());
    }
    return ips;
  }, [entries]);

  const togglePrimary = (key: string) => {
    const target = entries.find((e) => e.key === key);
    if (!target?.localIp.trim()) return;
    const targetIp = target.localIp.trim().toLowerCase();
    const wasPrimary = primaryIps.has(targetIp);
    setEntries((prev) =>
      prev.map((e) => {
        if (wasPrimary) {
          return e.localIp.trim().toLowerCase() === targetIp ? { ...e, localIsPrimary: false } : e;
        } else {
          return { ...e, localIsPrimary: e.localIp.trim().toLowerCase() === targetIp };
        }
      }),
    );
  };

  const hasAnyEntries = entries.some((e) => e.remoteDevice.trim());

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-line bg-deep shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-display text-base font-bold text-txt">
            Edit connections <span className="ml-1.5 font-mono text-[13px] font-normal text-brand">{device.name}</span>
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-txt"
          >
            <IconX className="h-4 w-4" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* ---- toolbar ---- */}
          <div className="flex items-center justify-between">
            <p className={labelClass}>
              cables
              {entries.length > 0 && <span className="ml-1.5 text-brand">{entries.length}</span>}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={localPorts.length === 0}
                onClick={() => setBulkOpen((v) => !v)}
                title={localPorts.length === 0 ? "Assign a port template to this device to enable bulk add" : undefined}
                className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  localPorts.length === 0
                    ? "cursor-not-allowed text-faint/40"
                    : bulkOpen
                      ? "bg-brand/10 text-brand"
                      : "text-brand hover:bg-brand/10"
                }`}
              >
                bulk add
              </button>
              <button
                type="button"
                onClick={() => switchMode("subif")}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  subifMode
                    ? "bg-violet-500/15 text-violet-400"
                    : "text-faint hover:bg-violet-500/10 hover:text-violet-400"
                }`}
              >
                subif
              </button>
              <button
                type="button"
                onClick={() => switchMode("bundle")}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  bundleMode
                    ? "bg-sky-500/15 text-sky-400"
                    : "text-faint hover:bg-sky-500/10 hover:text-sky-400"
                }`}
              >
                bundles
              </button>
              <button
                type="button"
                onClick={addEntry}
                className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-brand transition-colors hover:bg-brand/10"
              >
                <IconPlus className="h-3 w-3" size={12} />
                add cable
              </button>
            </div>
          </div>

          {/* ---- bulk add panel ---- */}
          {bulkOpen && localPorts.length > 0 && (
            <div className="mt-3 rounded-lg border border-brand/30 bg-brand/5 p-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={labelClass}>local ports</span>
                    <input
                      className="h-7 w-40 rounded-lg border border-line bg-surface px-2 font-mono text-[11.5px] text-txt outline-none transition-colors focus:border-brand/60"
                      value={bulkQuery}
                      onChange={(e) => setBulkQuery(e.target.value)}
                      placeholder="filter…"
                    />
                    {bulkPorts.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setBulkPorts(new Set())}
                        className="text-[10.5px] font-semibold text-faint transition-colors hover:text-danger"
                      >
                        clear
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid max-h-36 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto pr-1 sm:grid-cols-3">
                    {bulkVisiblePorts.map((p) => {
                      const inUse = localUsedPorts.has(p.toLowerCase());
                      return (
                        <label
                          key={p}
                          className={`flex items-center gap-1.5 font-mono text-[11.5px] ${
                            inUse ? "cursor-not-allowed text-faint/50" : "cursor-pointer text-mute hover:text-txt"
                          }`}
                          title={inUse ? "Already cabled on this device" : undefined}
                        >
                          <Checkbox
                            checked={bulkPorts.has(p)}
                            onChange={(v) => {
                              setBulkPorts((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(p);
                                else next.delete(p);
                                return next;
                              });
                            }}
                            disabled={inUse}
                          />
                          <span className="truncate">{p}</span>
                          {inUse && <span className="shrink-0 text-[8.5px] uppercase tracking-wider text-faint">used</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <AutoCompleteInputField
                    value={bulkRemote}
                    onChange={(name) => setBulkRemote(name)}
                    options={otherDevices.map((d) => d.name)}
                    label="remote device"
                    placeholder="Device…"
                  />
                  <div>
                    <label className={labelClass}>remote port base</label>
                    <input
                      className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2.5 font-mono text-[12px] text-txt outline-none transition-colors focus:border-brand/60"
                      value={bulkRemotePort}
                      onChange={(e) => setBulkRemotePort(e.target.value)}
                      placeholder="e.g. eth0 — auto-increments"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>medium</label>
                    <div className="mt-1">
                      <SegmentedText
                        options={[{ label: "Eth", value: "ethernet" }, { label: "Fibre", value: "fibre" }]}
                        value={bulkMedium}
                        onChange={setBulkMedium}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={bulkPorts.size === 0 || !bulkRemote.trim()}
                    onClick={applyBulk}
                    title={
                      bulkPorts.size === 0
                        ? "Select at least one local port"
                        : !bulkRemote.trim()
                          ? "Select a remote device"
                          : undefined
                    }
                    className="w-full rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-abyss shadow-lg shadow-brand/20 transition-all hover:bg-brandsoft active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    Add {bulkPorts.size > 0 ? bulkPorts.size : ""} cable{bulkPorts.size === 1 ? "" : "s"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---- bundle toolbar ---- */}
          {bundleMode && hasAnyEntries && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-line/30 bg-surface/10 px-3 py-2">
              {selectedCount >= 2 ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-mute">
                    {selectedCount} selected
                  </span>
                  <div className="flex items-center gap-1">
                    {BUNDLE_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => applyBundle(p)}
                        className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-400 transition-colors hover:bg-sky-500/20"
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBundleCustomOpen((v) => !v)}
                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                        bundleCustomOpen
                          ? "border-brand/50 bg-brand/10 text-brand"
                          : "border-line bg-surface text-faint hover:border-brand/30 hover:text-mute"
                      }`}
                    >
                      custom…
                    </button>
                  </div>
                  {bundleCustomOpen && (
                    <input
                      className="h-7 w-36 rounded-lg border border-line bg-surface px-2 font-mono text-[11px] text-txt outline-none transition-colors focus:border-brand/60"
                      value={bundleProtocolInput}
                      onChange={(e) => setBundleProtocolInput(e.target.value)}
                      placeholder="protocol name"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && bundleProtocolInput.trim()) {
                          applyBundle(bundleProtocolInput.trim());
                          setBundleCustomOpen(false);
                        }
                      }}
                    />
                  )}
                  {bundleCustomOpen && bundleProtocolInput.trim() && (
                    <button
                      type="button"
                      onClick={() => { applyBundle(bundleProtocolInput.trim()); setBundleCustomOpen(false); }}
                      className="rounded-md bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-400 transition-colors hover:bg-sky-500/30"
                    >
                      apply
                    </button>
                  )}
                </div>
              ) : (
                <span className="font-mono text-[10px] italic text-faint/60">
                  select 2+ cables to create a bundle
                </span>
              )}

              <div
                className="ml-auto flex cursor-pointer select-none items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint"
                onClick={() => toggleSelectAll()}
              >
                select all
                <Checkbox
                  checked={entries.filter((e) => e.remoteDevice.trim()).length > 0 && entries.filter((e) => e.remoteDevice.trim()).every((e) => e.selected)}
                  onChange={() => toggleSelectAll()}
                />
              </div>
            </div>
          )}

          {/* ---- table header ---- */}
          {entries.length > 0 && (() => {
            const headerGrid = buildRowGrid(bundleMode);
            return (
              <div className={`sticky top-0 z-10 mt-3 ${headerGrid} bg-deep pb-1.5`}>
                <span className={labelClass}>medium</span>
                <span className={labelClass}>local port</span>
                <span className={labelClass}>local IP</span>
                <span className={labelClass}>remote device</span>
                <span className={labelClass}>remote port</span>
                <span className={labelClass}>remote IP</span>
                {bundleMode && <span />}
                <span />
              </div>
            );
          })()}

          {/* ---- cable rows ---- */}
          {entries.length > 0 ? (
            <div className="space-y-2.5">{entries.map(renderRow)}</div>
          ) : (
            <p className="mt-4 text-[12px] italic text-faint">No cables. Use "add cable" or "bulk add".</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-line bg-raised/70 px-4 py-1.5 text-[12.5px] font-semibold text-mute transition-all hover:border-danger/50 hover:text-danger active:scale-[0.97]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-abyss shadow-lg shadow-brand/20 transition-all hover:bg-brandsoft active:scale-[0.97]"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
