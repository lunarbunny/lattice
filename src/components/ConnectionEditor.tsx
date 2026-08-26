import { useRef, useState } from "react";
import { useDevices } from "../store";
import { useToast } from "./Toast";
import type { CableMedium, Connection, Device } from "../lib/types";
import { IconTrash, IconEdit } from "./Icons";
import { CABLE_FIBRE, CABLE_ETHERNET } from "../lib/colours";
import ConnectionGroup from "./ConnectionGroup";

interface ConnFormState {
  remoteDevice: string;
  localPort: string;
  remotePort: string;
  medium: CableMedium;
  localIp: string;
  remoteIp: string;
  localIsPrimary: boolean;
}

const emptyForm: ConnFormState = {
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

export default function ConnectionEditor({ device }: { device: Device }) {
  const { devices, connections, addConnection, updateConnection, removeConnection } = useDevices();
  const { push } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<ConnFormState>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ConnFormState>({ ...emptyForm });
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const disarmTimer = useRef<number | null>(null);

  const deviceConns = connections.filter(
    (c) => c.srcDevice.toLowerCase() === device.name.toLowerCase() || c.dstDevice.toLowerCase() === device.name.toLowerCase()
  );

  const otherDevices = devices.filter((d) => d.id !== device.id);

  const handleAdd = () => {
    const remote = addForm.remoteDevice.trim();
    if (!remote) { push("error", "Select a remote device"); return; }
    const localPort = addForm.localPort.trim();
    const remotePort = addForm.remotePort.trim();
    if (!localPort && !remotePort) { push("error", "Enter at least one port"); return; }

    addConnection({
      srcDevice: device.name,
      dstDevice: remote,
      srcPort: localPort,
      dstPort: remotePort,
      medium: addForm.medium,
      srcIp: addForm.localIp.trim() || undefined,
      dstIp: addForm.remoteIp.trim() || undefined,
      srcIsPrimary: addForm.localIsPrimary || undefined,
    });
    setShowAdd(false);
    setAddForm({ ...emptyForm });
    push("success", `Connected ${device.name} → ${remote}`);
  };

  const startEdit = (conn: Connection) => {
    setEditingId(conn.id);
    setEditForm({
      remoteDevice: getRemote(conn, device.name),
      localPort: getLocalPort(conn, device.name),
      remotePort: getRemotePort(conn, device.name),
      medium: conn.medium,
      localIp: getLocalIp(conn, device.name),
      remoteIp: getRemoteIp(conn, device.name),
      localIsPrimary: getLocalIsPrimary(conn, device.name),
    });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const conn = connections.find((c) => c.id === editingId);
    if (!conn) return;

    const remote = editForm.remoteDevice.trim();
    if (!remote) { push("error", "Select a remote device"); return; }

    const isSrc = conn.srcDevice.toLowerCase() === device.name.toLowerCase();
    const updates: Partial<Connection> = { medium: editForm.medium };

    if (isSrc) {
      updates.dstDevice = remote;
      updates.srcPort = editForm.localPort.trim();
      updates.dstPort = editForm.remotePort.trim();
      updates.srcIp = editForm.localIp.trim() || undefined;
      updates.dstIp = editForm.remoteIp.trim() || undefined;
      updates.srcIsPrimary = editForm.localIsPrimary || undefined;
    } else {
      updates.srcDevice = remote;
      updates.dstPort = editForm.localPort.trim();
      updates.srcPort = editForm.remotePort.trim();
      updates.dstIp = editForm.localIp.trim() || undefined;
      updates.srcIp = editForm.remoteIp.trim() || undefined;
      updates.dstIsPrimary = editForm.localIsPrimary || undefined;
    }

    updateConnection(editingId, updates);
    setEditingId(null);
    push("success", "Connection updated");
  };

  const armDelete = (id: string) => {
    if (armedDelete === id) {
      removeConnection(id);
      setArmedDelete(null);
      push("success", "Connection removed");
      return;
    }
    setArmedDelete(id);
    if (disarmTimer.current) window.clearTimeout(disarmTimer.current);
    disarmTimer.current = window.setTimeout(() => setArmedDelete(null), 2600);
  };

  /* group by medium → remote device */
  const byMedium = new Map<string, Connection[]>();
  for (const c of deviceConns) {
    const list = byMedium.get(c.medium) ?? [];
    list.push(c);
    byMedium.set(c.medium, list);
  }
  const ordered = (["fibre", "ethernet"] as const).filter((m) => byMedium.has(m));

  const renderForm = (
    form: ConnFormState,
    setForm: React.Dispatch<React.SetStateAction<ConnFormState>>,
    onSave: () => void,
    onCancel: () => void,
  ) => (
    <div className="mt-2 rounded-lg border border-brand/20 bg-deep/40 p-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">remote device</label>
          <select
            className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-txt outline-none transition-colors focus:border-brand/60"
            value={form.remoteDevice}
            onChange={(e) => setForm((f) => ({ ...f, remoteDevice: e.target.value }))}
          >
            <option value="">Select device…</option>
            {otherDevices.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">medium</label>
          <select
            className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-txt outline-none transition-colors focus:border-brand/60"
            value={form.medium}
            onChange={(e) => setForm((f) => ({ ...f, medium: e.target.value as CableMedium }))}
          >
            <option value="ethernet">Ethernet</option>
            <option value="fibre">Fibre</option>
          </select>
        </div>
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
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">remote port</label>
          <input
            className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-txt outline-none transition-colors focus:border-brand/60"
            value={form.remotePort}
            onChange={(e) => setForm((f) => ({ ...f, remotePort: e.target.value }))}
            placeholder="e.g. eth48"
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
      {form.localIp && (
        <label className="mt-2 flex items-center gap-2 text-[12px] text-mute">
          <input
            type="checkbox"
            checked={form.localIsPrimary}
            onChange={(e) => setForm((f) => ({ ...f, localIsPrimary: e.target.checked }))}
            className="accent-brand"
          />
          Primary IP for this device
        </label>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-line bg-raised/70 px-3 py-1 text-[11.5px] font-semibold text-mute transition-all hover:border-danger/50 hover:text-danger active:scale-[0.97]"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="rounded-lg bg-brand px-3 py-1 text-[11.5px] font-semibold text-abyss shadow-lg shadow-brand/20 transition-all hover:bg-brandsoft active:scale-[0.97]"
        >
          Save
        </button>
      </div>
    </div>
  );

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
          connections
          {deviceConns.length > 0 && <span className="ml-1.5 text-brand">{deviceConns.length}</span>}
        </p>
        <button
          onClick={() => {
            if (showAdd) { setShowAdd(false); }
            else { setAddForm({ ...emptyForm }); setShowAdd(true); }
          }}
          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-all active:scale-[0.97] ${
            showAdd
              ? "border-danger/40 bg-danger/10 text-danger"
              : "border-line bg-raised/50 text-mute hover:border-brand/50 hover:text-brand"
          }`}
        >
          {showAdd ? "− Add cable" : "+ Add cable"}
        </button>
      </div>

      {showAdd && renderForm(addForm, setAddForm, handleAdd, () => setShowAdd(false))}

      {deviceConns.length === 0 && !showAdd ? (
        <p className="mt-1.5 text-[12px] italic text-faint">No connections yet.</p>
      ) : (
        <div className="mt-2 space-y-3">
          {ordered.map((medium) => {
            const items = byMedium.get(medium)!;
            const groups = new Map<string, Connection[]>();
            for (const c of items) {
              const remote = getRemote(c, device.name);
              const key = remote.toLowerCase();
              const list = groups.get(key) ?? [];
              list.push(c);
              groups.set(key, list);
            }

            return (
              <div key={medium} className={medium !== ordered[0] ? "border-t border-line pt-2.5" : ""}>
                <p
                  className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: medium === "fibre" ? CABLE_FIBRE : CABLE_ETHERNET }}
                >
                  {medium}
                </p>
                <div className="space-y-2.5">
                  {[...groups.entries()].map(([remoteKey, groupConns]) => {
                    const remoteName = getRemote(groupConns[0], device.name);
                    const connData = groupConns.map((c) => ({
                      id: c.id,
                      localPort: getLocalPort(c, device.name),
                      localIp: getLocalIp(c, device.name),
                      remotePort: getRemotePort(c, device.name),
                      remoteIp: getRemoteIp(c, device.name),
                    }));

                    return (
                      <div key={remoteKey}>
                        {groupConns.map((c) => editingId === c.id && (
                          <div key={c.id}>
                            {renderForm(editForm, setEditForm, handleSaveEdit, () => setEditingId(null))}
                          </div>
                        ))}
                        {editingId !== groupConns[0]?.id && (
                          <div className="group/conn">
                            <ConnectionGroup
                              localDeviceName={device.name}
                              remoteDeviceName={remoteName}
                              connections={connData}
                              arrow="⟷"
                              centerTag={null}
                              noTruncate
                              dimLocalName={false}
                            />
                            <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover/conn:opacity-100">
                              {groupConns.map((c) => (
                                <div key={c.id} className="flex items-center gap-0.5">
                                  <button
                                    title="Edit"
                                    onClick={() => startEdit(c)}
                                    className="rounded p-0.5 text-faint transition-colors hover:bg-brand/15 hover:text-brand"
                                  >
                                    <IconEdit className="h-3 w-3" size={12} />
                                  </button>
                                  <button
                                    onClick={() => armDelete(c.id)}
                                    className={`rounded p-0.5 transition-all ${
                                      armedDelete === c.id
                                        ? "bg-danger/20 text-danger"
                                        : "text-faint hover:bg-danger/15 hover:text-danger"
                                    }`}
                                    title={armedDelete === c.id ? "Click again" : "Remove"}
                                  >
                                    {armedDelete === c.id ? (
                                      <span className="px-0.5 font-mono text-[8px] font-semibold uppercase">sure?</span>
                                    ) : (
                                      <IconTrash className="h-3 w-3" size={12} />
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
