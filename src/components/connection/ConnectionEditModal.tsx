import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDatastore } from "../../store";
import { useToast } from "../Toast";
import type { CableMedium, Connection, Device } from "../../lib/types";
import { IconX, IconPlus, IconFibre, IconEthernet } from "../Icons";
import { CABLE_ETHERNET, CABLE_FIBRE } from "../../lib/colours";
import AutoCompleteInputField from "../AutoCompleteInputField";
import { SegmentedText } from "../OptionSelector";
import PortField from "../PortField";
import { getDevicePorts } from "../../lib/ports";
import { incrementTrailingNumber } from "../../lib/helpers";

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
};

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
 * Column template shared by the header row and every cable row.
 * Tracks are fixed or zero-min fractions so the two independent grids resolve
 * to identical column geometry — an `auto` track would size to each grid's own
 * content (label text vs segmented control) and drift the columns apart.
 */
const ROW_GRID =
  "grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1.3fr)_24px] items-center gap-2";

interface Props {
  device: Device;
  onClose: () => void;
}

export default function ConnectionEditModal({ device, onClose }: Props) {
  const { devices, connections, portTemplates, addConnection, updateConnection, removeConnection } = useDatastore();
  const { push } = useToast();

  const deviceConns = connections.filter(
    (c) => c.srcDevice.toLowerCase() === device.name.toLowerCase() || c.dstDevice.toLowerCase() === device.name.toLowerCase()
  );

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
      });
    }
    setEntries((prev) => [...prev, ...newEntries]);
    setBulkPorts(new Set());
    setBulkQuery("");
    setBulkRemotePort("");
    setBulkOpen(false);
  };

  const handleSave = () => {
    const validEntries = entries.filter((e) => e.remoteDevice.trim());

    for (const entry of validEntries) {
      const localPort = entry.localPort.trim();
      const remotePort = entry.remotePort.trim();
      if (!localPort && !remotePort) { push("error", "Enter at least one port per cable"); return; }
    }

    const existingIds = new Set(entries.filter((e) => e.connectionId).map((e) => e.connectionId!));
    const processedIds = new Set<string>();

    for (const entry of validEntries) {
      if (entry.connectionId) {
        const conn = connections.find((c) => c.id === entry.connectionId);
        if (!conn) continue;

        const isSrc = conn.srcDevice.toLowerCase() === device.name.toLowerCase();
        const updates: Partial<Connection> = { medium: entry.medium };

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

    return (
      <div key={form.key} className={ROW_GRID}>
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

        <button
          type="button"
          onClick={() => removeEntry(form.key)}
          title="Remove cable"
          className="flex h-8 items-center justify-center rounded-md text-danger/60 transition-colors hover:bg-danger/15 hover:text-danger"
        >
          <IconX className="h-3.5 w-3.5" size={14} />
        </button>
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
          // unmark all entries sharing this IP
          return e.localIp.trim().toLowerCase() === targetIp ? { ...e, localIsPrimary: false } : e;
        } else {
          // mark entries sharing this IP, unmark all others
          return { ...e, localIsPrimary: e.localIp.trim().toLowerCase() === targetIp };
        }
      }),
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-line bg-deep shadow-2xl"
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
                          <input
                            type="checkbox"
                            className="accent-brand"
                            disabled={inUse}
                            checked={bulkPorts.has(p)}
                            onChange={(e) => {
                              setBulkPorts((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(p);
                                else next.delete(p);
                                return next;
                              });
                            }}
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

          {/* ---- table header ---- */}
          {entries.length > 0 && (
            <div className={`sticky top-0 z-10 mt-3 ${ROW_GRID} bg-deep pb-1.5`}>
              <span className={labelClass}>medium</span>
              <span className={labelClass}>local port</span>
              <span className={labelClass}>local IP</span>
              <span className={labelClass}>remote device</span>
              <span className={labelClass}>remote port</span>
              <span className={labelClass}>remote IP</span>
              <span />
            </div>
          )}

          {/* ---- cable rows ---- */}
          {entries.length > 0 ? (
            <div className="space-y-1.5">{entries.map(renderRow)}</div>
          ) : (
            <p className="mt-4 text-[12px] italic text-faint">No cables. Use “add cable” or “bulk add”.</p>
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
