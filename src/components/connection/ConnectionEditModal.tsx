import { useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDatastore } from "../../store";
import { useToast } from "../Toast";
import type { CableMedium, Connection, Device, VlanSubConnection } from "../../lib/types";
import { IconX, IconPlus, IconFibre, IconEthernet } from "../Icons";
import { Colour } from "../../lib/colours";
import SuggestionInput from "../fields/SuggestionInput";
import Checkbox from "../fields/Checkbox";
import { getDevicePorts, portOrderComparator } from "../../lib/ports";
import { expandRange } from "../../lib/rangeExpand";
import HoverInfo from "../HoverInfo";

interface VlanFormEntry {
  key: string;
  vlanId: string;
  srcIp: string;
  dstIp: string;
  notes: string;
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

/** Wraps a single child element with a portal-based tooltip shown on hover. */
function Tooltip({ text, children }: { text: string | null; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const onEnter = useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
    setShow(true);
  }, []);

  const onLeave = useCallback(() => setShow(false), []);

  return (
    <div ref={ref} className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
      {text && show && createPortal(
        <div
          className="pointer-events-none fixed z-50 w-max max-w-sm -translate-x-1/2 rounded-lg border border-brand/30 bg-raised/95 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-mute shadow-lg shadow-black/30 backdrop-blur"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
        </div>,
        document.body,
      )}
    </div>
  );
}

const ROW_GRID = "grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1.3fr)_24px] items-center gap-2";
const ROW_GRID_BUNDLE = "grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1.3fr)_1rem_24px] items-center gap-2";

interface Props {
  device: Device;
  onClose: () => void;
  filterRemoteDevice?: string;
}

export default function ConnectionEditModal({ device, onClose, filterRemoteDevice }: Props) {
  const { devices, connections, portTemplates, addConnection, updateConnection, removeConnection, updateDevice } = useDatastore();
  const { push } = useToast();

  const otherDevices = devices.filter((d) => d.id !== device.id);

  /* ---- port template panel state ---- */
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [templateOverrides, setTemplateOverrides] = useState<Record<string, string>>({});

  const setDeviceTemplate = (deviceName: string, templateName: string) => {
    setTemplateOverrides((prev) => ({ ...prev, [deviceName]: templateName }));
  };

  /** Effective template for a device, merging local overrides with stored data. */
  const effectiveTemplateFor = useCallback((dev: Device | undefined): string | undefined => {
    if (!dev) return undefined;
    const override = templateOverrides[dev.name];
    if (override !== undefined) return override || undefined;
    return dev.portTemplate;
  }, [templateOverrides]);

  /** Create a device copy with effective template (override or stored). */
  const withEffectiveTemplate = useCallback((dev: Device | undefined): Device | undefined => {
    if (!dev) return undefined;
    const tpl = effectiveTemplateFor(dev);
    if (tpl === dev.portTemplate) return dev;
    return { ...dev, portTemplate: tpl };
  }, [effectiveTemplateFor]);

  const localPorts = useMemo(() => getDevicePorts(withEffectiveTemplate(device), portTemplates), [device, portTemplates, withEffectiveTemplate]);

  const deviceConns = useMemo(() => {
    const name = device.name.toLowerCase();
    const filtered = connections.filter((c) => {
      const isLocal = c.srcDevice.toLowerCase() === name || c.dstDevice.toLowerCase() === name;
      if (!isLocal) return false;
      if (!filterRemoteDevice) return true;
      const remote = getRemote(c, device.name);
      return remote.toLowerCase() === filterRemoteDevice.toLowerCase();
    });
    const cmp = portOrderComparator(localPorts);
    return filtered.sort((a, b) => {
      const aPort = a.srcDevice.toLowerCase() === name ? a.srcPort : a.dstPort;
      const bPort = b.srcDevice.toLowerCase() === name ? b.srcPort : b.dstPort;
      return cmp(aPort, bPort);
    });
  }, [connections, device, filterRemoteDevice, localPorts]);

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
        notes: v.notes ?? "",
      })),
      bundleId: conn.bundleId ?? "",
      bundleProtocol: conn.bundleProtocol ?? "",
      selected: false,
    }));
    return existingEntries.length > 0 ? existingEntries : [{ ...emptyForm, key: nextConnKey() }];
  });

  /* ---- bulk add state ---- */
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkLocalPort, setBulkLocalPort] = useState("");
  const [bulkLocalIp, setBulkLocalIp] = useState("");
  const [bulkRemote, setBulkRemote] = useState("");
  const [bulkRemotePort, setBulkRemotePort] = useState("");
  const [bulkRemoteIp, setBulkRemoteIp] = useState("");
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

  /* ---- bulk add expansion logic ---- */
  interface BulkPreviewRow {
    localPort: string;
    localIp: string;
    remotePort: string;
    remoteIp: string;
  }

  const bulkExpansion = useMemo<{ rows: BulkPreviewRow[]; error: string | null; warning: string | null; count: number }>(() => {
    const lp = expandRange(bulkLocalPort.trim() || " ");
    const rp = expandRange(bulkRemotePort.trim() || " ");
    const li = expandRange(bulkLocalIp.trim() || " ");
    const ri = expandRange(bulkRemoteIp.trim() || " ");

    const hasLocalPort = bulkLocalPort.trim().length > 0;
    const hasRemotePort = bulkRemotePort.trim().length > 0;
    const hasLocalIp = bulkLocalIp.trim().length > 0;
    const hasRemoteIp = bulkRemoteIp.trim().length > 0;

    const rangeLengths = [
      hasLocalPort ? lp.length : 1,
      hasRemotePort ? rp.length : 1,
      hasLocalIp ? li.length : 1,
      hasRemoteIp ? ri.length : 1,
    ];

    const maxLen = Math.max(...rangeLengths);

    // Check for range length mismatch (warning, not blocking)
    const distinctLengths = new Set(rangeLengths.filter((l) => l > 1));
    let warning: string | null = null;
    if (distinctLengths.size > 1) {
      warning = "Ranges have different lengths — missing values shown as —";
    }

    if (hasLocalIp) {
      const cidrMatch = bulkLocalIp.match(/\/(\d+)$/);
      if (cidrMatch) {
        const prefix = parseInt(cidrMatch[1], 10);
        const subnetSize = Math.pow(2, 32 - prefix);
        if (li.length > subnetSize) {
          return { rows: [], error: `Local IP range (${li.length}) exceeds /${prefix} subnet size (${subnetSize}).`, warning: null, count: 0 };
        }
      }
    }

    if (hasRemoteIp) {
      const cidrMatch = bulkRemoteIp.match(/\/(\d+)$/);
      if (cidrMatch) {
        const prefix = parseInt(cidrMatch[1], 10);
        const subnetSize = Math.pow(2, 32 - prefix);
        if (ri.length > subnetSize) {
          return { rows: [], error: `Remote IP range (${ri.length}) exceeds /${prefix} subnet size (${subnetSize}).`, warning: null, count: 0 };
        }
      }
    }

    if (maxLen <= 1 && !hasLocalPort && !hasRemotePort) {
      return { rows: [{ localPort: "", localIp: "", remotePort: "", remoteIp: "" }], error: null, warning: null, count: 0 };
    }

    const rows: BulkPreviewRow[] = [];
    for (let i = 0; i < maxLen; i++) {
      rows.push({
        localPort: hasLocalPort ? (i < lp.length ? lp[i] : "") : "",
        localIp: hasLocalIp ? (i < li.length ? li[i] : "") : "",
        remotePort: hasRemotePort ? (i < rp.length ? rp[i] : "") : "",
        remoteIp: hasRemoteIp ? (i < ri.length ? ri[i] : "") : "",
      });
    }

    return { rows, error: null, warning, count: maxLen };
  }, [bulkLocalPort, bulkRemotePort, bulkLocalIp, bulkRemoteIp]);

  /** Find the first pair of ports with consecutive trailing numbers and return expansion syntax. */
  const suggestBulkPortPrefix = (ports: string[]): string => {
    for (let i = 0; i < ports.length - 1; i++) {
      const a = ports[i], b = ports[i + 1];
      const aMatch = a.match(/^(.*?)(\d+)$/);
      const bMatch = b.match(/^(.*?)(\d+)$/);
      if (!aMatch || !bMatch) continue;
      if (aMatch[1] !== bMatch[1]) continue;
      const numA = parseInt(aMatch[2], 10);
      const numB = parseInt(bMatch[2], 10);
      if (numB !== numA + 1) continue;
      const pad = aMatch[2].length > 1 ? aMatch[2].length : 0;
      const start = pad ? String(numA).padStart(pad, "0") : String(numA);
      const end = pad ? String(numB).padStart(pad, "0") : String(numB);
      return `${aMatch[1]}{${start}-${end}}`;
    }
    return "";
  };

  const resetBulk = () => {
    setBulkLocalPort("");
    setBulkLocalIp("");
    setBulkRemote("");
    setBulkRemotePort("");
    setBulkRemoteIp("");
    setBulkMedium("ethernet");
  };

  /** Format expanded values for tooltip display, truncating long lists. */
  const formatExpandedTooltip = (values: string[]): string => {
    if (values.length <= 1) return values[0];
    if (values.length <= 6) return values.join(", ");
    return `${values.slice(0, 3).join(", ")}, … , ${values.slice(-2).join(", ")} (${values.length} values)`;
  };

  /** Tooltip text for an expansion field, or null if no expansion syntax. */
  const expansionTooltip = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || !/\{\d+-\d+\}/.test(trimmed)) return null;
    const expanded = expandRange(trimmed);
    if (expanded.length <= 1 && expanded[0] === trimmed) return null;
    return formatExpandedTooltip(expanded);
  };

  const applyBulk = () => {
    if (bulkExpansion.error || !bulkRemote.trim()) return;
    const validRows = bulkExpansion.rows.filter((r) => r.localPort || r.remotePort);
    if (validRows.length === 0) return;
    const newEntries: ConnFormState[] = validRows.map((row) => ({
      key: nextConnKey(),
      remoteDevice: bulkRemote.trim(),
      localPort: row.localPort,
      remotePort: row.remotePort,
      medium: bulkMedium,
      localIp: row.localIp,
      remoteIp: row.remoteIp,
      localIsPrimary: false,
      vlans: [],
      bundleId: "",
      bundleProtocol: "",
      selected: false,
    }));
    setEntries((prev) => [...prev, ...newEntries]);
    resetBulk();
    setBulkOpen(false);
  };

  /* ---- VLAN sub-entry helpers ---- */
  const addVlanEntry = (connKey: string) => {
    updateEntry(connKey, (f) => ({
      ...f,
      vlans: [...f.vlans, { key: nextVlanKey(), vlanId: "", srcIp: "", dstIp: "", notes: "" }],
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
    // Persist port template overrides
    for (const [devName, tplName] of Object.entries(templateOverrides)) {
      const dev = devices.find((d) => d.name === devName);
      if (dev) updateDevice(dev.id, { portTemplate: tplName || undefined });
    }

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
            notes: v.notes.trim() || undefined,
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
    if (newCount > 0) parts.push(`${newCount} added`);
    if (updateCount > 0) parts.push(`${updateCount} updated`);
    if (deleteCount > 0) parts.push(`${deleteCount} removed`);

    push("success", `Connections: ${parts.join(", ") || "no changes"}`);
    onClose();
  };

  const renderRow = (form: ConnFormState) => {
    const setForm = (updater: (prev: ConnFormState) => ConnFormState) => updateEntry(form.key, updater);
    const remoteDev = devices.find((d) => d.name === form.remoteDevice);
    const remotePorts = getDevicePorts(withEffectiveTemplate(remoteDev), portTemplates);
    const hasBundle = !!form.bundleId;
    const bundleColor = hasBundle ? bundleColorMap.get(form.bundleId) : undefined;
    const rowGrid = bundleMode ? ROW_GRID_BUNDLE : ROW_GRID;

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
              color: form.medium === "fibre" ? Colour.cableFibre : Colour.cableEthernet,
              background: `${form.medium === "fibre" ? Colour.cableFibre : Colour.cableEthernet}14`,
            }}
          >
            {form.medium === "fibre" ? (
              <IconFibre className="h-4 w-4" size={16} />
            ) : (
              <IconEthernet className="h-4 w-4" size={16} />
            )}
          </button>

          <SuggestionInput
            value={form.localPort}
            onChange={(v) => setForm((f) => ({ ...f, localPort: v }))}
            suggestions={localPorts.length > 0 ? localPorts : undefined}
            placeholder="e.g. eth0"
            renderOption={({ value: name }) => {
              const inUse = localUsedPorts?.has(name.toLowerCase()) ?? false;
              return (
                <>
                  <span className="truncate">{name}</span>
                  {inUse && <span className="shrink-0 text-[9px] uppercase tracking-wider text-faint">in use</span>}
                </>
              );
            }}
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

          <SuggestionInput
            value={form.remoteDevice}
            onChange={(name) => setForm((f) => ({ ...f, remoteDevice: name }))}
            suggestions={otherDevices.map((d) => d.name)}
            placeholder="Remote Device"
          />

          <SuggestionInput
            value={form.remotePort}
            onChange={(v) => setForm((f) => ({ ...f, remotePort: v }))}
            suggestions={remotePorts.length > 0 ? remotePorts : undefined}
            placeholder="e.g. eth48"
            renderOption={({ value: name }) => {
              const inUse = (form.remoteDevice.trim() ? usedPortsFor(form.remoteDevice) : undefined)?.has(name.toLowerCase()) ?? false;
              return (
                <>
                  <span className="truncate">{name}</span>
                  {inUse && <span className="shrink-0 text-[9px] uppercase tracking-wider text-faint">in use</span>}
                </>
              );
            }}
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

        {/* ---- inline VLAN trunk editor (subif mode or existing VLANs) ---- */}
        {(subifMode || form.vlans.length > 0) && (
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
                <div className="grid grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_24px] items-center gap-2">
                  <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-faint">
                    vlan
                    <HoverInfo>802.1Q VLAN ID (1–4094) for this tagged sub-interface</HoverInfo>
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-faint">
                    src svi
                    <HoverInfo>Layer 3 SVI IP on the local device for this VLAN</HoverInfo>
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-faint">
                    dst svi
                    <HoverInfo>Layer 3 SVI IP on the remote device for this VLAN</HoverInfo>
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-faint">
                    notes
                    <HoverInfo>Optional description of what this VLAN carries</HoverInfo>
                  </span>
                  <span />
                </div>
                {form.vlans.map((v) => (
                  <div key={v.key} className="grid grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_24px] items-center gap-2">
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
                    <input
                      className="h-7 rounded-lg border border-line bg-surface px-2 text-[11.5px] text-txt outline-none transition-colors focus:border-brand/60"
                      value={v.notes}
                      onChange={(e) => updateVlanEntry(form.key, v.key, (ve) => ({ ...ve, notes: e.target.value }))}
                      placeholder="notes"
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
                onClick={() => setBulkOpen((v) => {
                  if (v) resetBulk();
                  else setBulkLocalPort(suggestBulkPortPrefix(localPorts));
                  return !v;
                })}
                className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  bulkOpen
                    ? "bg-brand/10 text-brand"
                    : "text-brand hover:bg-brand/10"
                }`}
              >
                bulk add
              </button>
              {portTemplates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTemplatePanelOpen((v) => !v)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    templatePanelOpen
                      ? "bg-brand/10 text-brand"
                      : "text-faint hover:bg-brand/10 hover:text-mute"
                  }`}
                >
                  port template
                </button>
              )}
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

          {/* ---- port template panel ---- */}
          {templatePanelOpen && portTemplates.length > 0 && (() => {
            const remoteNames = new Set(entries.map((e) => e.remoteDevice.trim()).filter(Boolean));
            const allDevices = [
              { dev: device, label: `${device.name} (local)` },
              ...[...remoteNames].sort().map((name) => ({
                dev: devices.find((d) => d.name === name),
                label: name,
              })).filter((d) => d.dev),
            ];
            return (
              <div className="mt-3 rounded-lg border border-brand/30 bg-brand/5 p-3">
                <p className={labelClass}>
                  port templates
                  <span className="ml-1.5 text-brand">{allDevices.length}</span>
                </p>
                <div className="mt-2 space-y-1.5">
                  {allDevices.map(({ dev, label }) => {
                    const current = effectiveTemplateFor(dev) ?? "";
                    return (
                      <div key={dev!.name} className="flex items-center gap-3">
                        <span className="w-40 shrink-0 truncate font-mono text-[11px] text-mute">{label}</span>
                        <select
                          className="h-7 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 font-mono text-[11px] text-txt outline-none transition-colors focus:border-brand/60"
                          value={current}
                          onChange={(e) => setDeviceTemplate(dev!.name, e.target.value)}
                        >
                          <option value="">None</option>
                          {portTemplates.map((t) => (
                            <option key={t.name} value={t.name}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ---- bulk add panel ---- */}
          {bulkOpen && (
            <div className="mt-3 flex flex-col rounded-lg border border-brand/30 bg-brand/5 p-3">
              <div className="mb-2.5 flex items-center gap-1.5">
                <span className={labelClass}>bulk add</span>
                <HoverInfo>
                  Use {"{start-end}"} syntax in port and IP fields to expand ranges. E.g. eth{"{1-5}"} generates eth1 through eth5. All ranges must produce the same count, or be a single value.
                </HoverInfo>
              </div>

              {/* ---- form row ---- */}
              <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.45fr)_minmax(0,1.3fr)_minmax(0,1.3fr)] items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBulkMedium((m) => m === "ethernet" ? "fibre" : "ethernet")}
                  title={bulkMedium === "ethernet" ? "Medium: ethernet — click to switch to fibre" : "Medium: fibre — click to switch to ethernet"}
                  className="flex h-8 w-full items-center justify-center rounded-lg border border-line transition-colors hover:border-brand/40"
                  style={{
                    color: bulkMedium === "fibre" ? Colour.cableFibre : Colour.cableEthernet,
                    background: `${bulkMedium === "fibre" ? Colour.cableFibre : Colour.cableEthernet}14`,
                  }}
                >
                  {bulkMedium === "fibre" ? (
                    <IconFibre className="h-4 w-4" size={16} />
                  ) : (
                    <IconEthernet className="h-4 w-4" size={16} />
                  )}
                </button>

                <Tooltip text={expansionTooltip(bulkLocalPort)}>
                  <input
                    className="h-8 w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 font-mono text-[12px] text-txt outline-none transition-colors focus:border-brand/60"
                    value={bulkLocalPort}
                    onChange={(e) => setBulkLocalPort(e.target.value)}
                    placeholder="eth{1-5}"
                  />
                </Tooltip>

                <Tooltip text={expansionTooltip(bulkLocalIp)}>
                  <input
                    className="h-8 w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 font-mono text-[12px] text-txt outline-none transition-colors focus:border-brand/60"
                    value={bulkLocalIp}
                    onChange={(e) => setBulkLocalIp(e.target.value)}
                    placeholder="10.0.0.{1-5}/24"
                  />
                </Tooltip>

                <SuggestionInput
                  value={bulkRemote}
                  onChange={(name) => {
                    setBulkRemote(name);
                    const dev = devices.find((d) => d.name === name);
                    setBulkRemotePort(suggestBulkPortPrefix(getDevicePorts(withEffectiveTemplate(dev), portTemplates)));
                  }}
                  suggestions={otherDevices.map((d) => d.name)}
                  placeholder="Remote Device"
                />

                <Tooltip text={expansionTooltip(bulkRemotePort)}>
                  <input
                    className="h-8 w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 font-mono text-[12px] text-txt outline-none transition-colors focus:border-brand/60"
                    value={bulkRemotePort}
                    onChange={(e) => setBulkRemotePort(e.target.value)}
                    placeholder="eth{1-5}"
                  />
                </Tooltip>

                <Tooltip text={expansionTooltip(bulkRemoteIp)}>
                  <input
                    className="h-8 w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 font-mono text-[12px] text-txt outline-none transition-colors focus:border-brand/60"
                    value={bulkRemoteIp}
                    onChange={(e) => setBulkRemoteIp(e.target.value)}
                    placeholder="10.0.0.{1-5}/24"
                  />
                </Tooltip>
              </div>

              {/* ---- preview table ---- */}
              <div className="mt-3">
                <p className={labelClass}>
                  preview
                  {!bulkExpansion.error && (() => {
                    const validCount = bulkExpansion.rows.filter((r) => r.localPort || r.remotePort).length;
                    return validCount > 0 ? (
                      <span className="ml-1.5 text-brand">{validCount} connection{validCount === 1 ? "" : "s"}</span>
                    ) : null;
                  })()}
                </p>
                <div className="mt-1.5 max-h-[150px] overflow-y-auto rounded-lg border border-line/30">
                  <table className="w-full font-mono text-[11.5px]">
                    <thead className="sticky top-0 bg-deep">
                      <tr className="border-b border-line/30">
                        <th className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-faint w-10">#</th>
                        <th className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-faint">local port</th>
                        <th className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-faint">local IP</th>
                        <th className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-faint">remote port</th>
                        <th className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-faint">remote IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkExpansion.rows.map((row, i) => (
                        <tr key={i} className={`border-b border-line/10 ${bulkExpansion.error ? "text-faint/50" : "text-mute"}`}>
                          <td className="px-2 py-1 text-faint">{i + 1}</td>
                          <td className="px-2 py-1">{row.localPort || "—"}</td>
                          <td className="px-2 py-1">{row.localIp || "—"}</td>
                          <td className="px-2 py-1">{row.remotePort || "—"}</td>
                          <td className="px-2 py-1">{row.remoteIp || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ---- error/warning + add button ---- */}
              {(() => {
                const msg = bulkExpansion.error ?? bulkExpansion.warning;
                const msgClass = bulkExpansion.error ? "text-danger" : bulkExpansion.warning ? "text-amber-500" : "text-transparent";
                const validCount = bulkExpansion.rows.filter((r) => r.localPort || r.remotePort).length;
                return (
                  <div className="mt-3 flex items-center justify-between">
                    <p className={`font-mono text-[11.5px] ${msgClass}`}>
                      {msg || "\u00A0"}
                    </p>
                    <button
                      type="button"
                      disabled={bulkExpansion.error !== null || validCount === 0 || !bulkRemote.trim()}
                      onClick={applyBulk}
                      title={
                        bulkExpansion.error !== null
                          ? bulkExpansion.error
                          : validCount === 0
                            ? "Enter at least one port range"
                            : !bulkRemote.trim()
                              ? "Select a remote device"
                              : undefined
                      }
                      className="rounded-lg bg-brand px-4 py-1.5 text-[12px] font-semibold text-abyss shadow-lg shadow-brand/20 transition-all hover:bg-brandsoft active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    >
                      Add {validCount || ""} cable{validCount === 1 ? "" : "s"}
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ---- bundle toolbar ---- */}
          {bundleMode && (
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
            const headerGrid = bundleMode ? ROW_GRID_BUNDLE : ROW_GRID;
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
