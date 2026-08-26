import { useState } from "react";
import { createPortal } from "react-dom";
import { useDevices } from "../../store";
import { useToast } from "../Toast";
import type { CableMedium, Connection, Device } from "../../lib/types";
import { IconX } from "../Icons";
import AutoCompleteInputField from "../AutoCompleteInputField";
import { SegmentedText } from "../OptionSelector";
import DynamicList from "../DynamicList";

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

interface Props {
  device: Device;
  onClose: () => void;
}

export default function ConnectionEditModal({ device, onClose }: Props) {
  const { devices, connections, addConnection, updateConnection, removeConnection } = useDevices();
  const { push } = useToast();

  const deviceConns = connections.filter(
    (c) => c.srcDevice.toLowerCase() === device.name.toLowerCase() || c.dstDevice.toLowerCase() === device.name.toLowerCase()
  );

  const otherDevices = devices.filter((d) => d.id !== device.id);

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

  const addEntry = () => {
    setEntries((prev) => [...prev, { ...emptyForm, key: nextConnKey() }]);
  };

  const removeEntry = (key: string) => {
    setEntries((prev) => prev.filter((e) => e.key !== key));
  };

  const updateEntry = (key: string, updater: (prev: ConnFormState) => ConnFormState) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? updater(e) : e)));
  };

  const handleSave = () => {
    const validEntries = entries.filter((e) => e.remoteDevice.trim());
    if (validEntries.length === 0) { push("error", "Select at least one remote device"); return; }

    for (const entry of validEntries) {
      const localPort = entry.localPort.trim();
      const remotePort = entry.remotePort.trim();
      if (!localPort && !remotePort) { push("error", "Enter at least one port per entry"); return; }
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

  const renderConnFields = (
    form: ConnFormState,
    setForm: React.Dispatch<React.SetStateAction<ConnFormState>>,
  ) => (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">source device</label>
          <input
            className="mt-1 h-8 w-full rounded-lg border border-line bg-surface/50 px-2.5 text-[12.5px] text-mute cursor-not-allowed"
            value={device.name}
            disabled
          />
        </div>
        <AutoCompleteInputField
          value={form.remoteDevice}
          onChange={(name) => setForm((f) => ({ ...f, remoteDevice: name }))}
          options={otherDevices.map((d) => d.name)}
          label="target device"
        />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <div className="space-y-2.5">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">local port</label>
            <input
              className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-txt outline-none transition-colors focus:border-brand/60"
              value={form.localPort}
              onChange={(e) => setForm((f) => ({ ...f, localPort: e.target.value }))}
              placeholder="e.g. eth0"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">local IP (CIDR)</label>
            <input
              className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2.5 font-mono text-[12.5px] text-txt outline-none transition-colors focus:border-brand/60"
              value={form.localIp}
              onChange={(e) => setForm((f) => ({ ...f, localIp: e.target.value }))}
              placeholder="e.g. 10.0.0.1/24"
            />
          </div>
          {form.localIp && (
            <label className="flex items-center gap-2 text-[11px] text-mute">
              <input
                type="checkbox"
                checked={form.localIsPrimary}
                onChange={(e) => setForm((f) => ({ ...f, localIsPrimary: e.target.checked }))}
                className="accent-brand"
              />
              Primary IP
            </label>
          )}
        </div>

        <div className="pb-0.5">
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">medium</label>
          <div className="mt-1">
            <SegmentedText
              options={[{ label: "Ethernet", value: "ethernet" }, { label: "Fibre", value: "fibre" }]}
              value={form.medium}
              onChange={(v) => setForm((f) => ({ ...f, medium: v }))}
            />
          </div>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">remote port</label>
            <input
              className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-txt outline-none transition-colors focus:border-brand/60"
              value={form.remotePort}
              onChange={(e) => setForm((f) => ({ ...f, remotePort: e.target.value }))}
              placeholder="e.g. eth48"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">remote IP (CIDR)</label>
            <input
              className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2.5 font-mono text-[12.5px] text-txt outline-none transition-colors focus:border-brand/60"
              value={form.remoteIp}
              onChange={(e) => setForm((f) => ({ ...f, remoteIp: e.target.value }))}
              placeholder="e.g. 10.0.0.2/24"
            />
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-line bg-deep shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-display text-base font-bold text-txt">Edit connections</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-txt"
          >
            <IconX className="h-4 w-4" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <DynamicList
            label="cables"
            addLabel="add cable"
            onAdd={addEntry}
            entries={entries}
            onRemove={removeEntry}
          >
            {(entry) =>
              renderConnFields(
                entry,
                (updater) => updateEntry(entry.key, typeof updater === "function" ? updater : () => updater),
              )
            }
          </DynamicList>
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
