import { useRef, useState } from "react";
import { useDevices } from "../store";
import { useToast } from "./Toast";
import { inferType } from "../lib/layout/topology";
import { resolveRack } from "../lib/importer";
import type { Device } from "../lib/types";
import { TYPE_META } from "../lib/types";
import { navigate } from "../lib/router";
import { formatDate } from "../lib/helpers";
import ConnectionEditor from "./ConnectionEditor";
import {
  IconTrash,
  IconChevronDown,
  IconLocate,
  IconEdit,
  IconServer,
  TypeIcon,
} from "./Icons";

interface DeviceFormState {
  name: string;
  model: string;
  notes: string;
  rackId: string;
  mountIndex: number | undefined;
  size: number;
}

const emptyForm: DeviceFormState = { name: "", model: "", notes: "", rackId: "", mountIndex: undefined, size: 1 };

export default function DeviceManager() {
  const { devices, racks, connections, addDevice, updateDevice, removeDevice } = useDevices();
  const { push } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<DeviceFormState>({ ...emptyForm });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DeviceFormState>({ ...emptyForm });
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [filterRack, setFilterRack] = useState("");
  const disarmTimer = useRef<number | null>(null);

  const filteredDevices = filterRack
    ? devices.filter((d) => d.rackId === filterRack)
    : devices;

  const handleAdd = () => {
    const name = addForm.name.trim();
    if (!name) { push("error", "Device name is required"); return; }
    const size = Number.isInteger(addForm.size) && addForm.size >= 1 ? addForm.size : 1;
    const mountIndex = addForm.mountIndex != null && Number.isInteger(addForm.mountIndex) && addForm.mountIndex >= 1
      ? addForm.mountIndex : undefined;
    const newDevice = addDevice({
      name,
      model: addForm.model.trim() || undefined,
      notes: addForm.notes,
      rackId: addForm.rackId.trim() || undefined,
      mountIndex,
      size,
    });
    setAddForm({ ...emptyForm });
    setShowAdd(false);
    setExpandedId(newDevice.id);
    push("success", `Added device "${name}"`);
  };

  const startEdit = (d: Device) => {
    setEditingId(d.id);
    setExpandedId(d.id);
    setEditForm({
      name: d.name,
      model: d.model ?? "",
      notes: d.notes,
      rackId: d.rackId ?? "",
      mountIndex: d.mountIndex,
      size: d.size,
    });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const name = editForm.name.trim();
    if (!name) { push("error", "Name is required"); return; }
    const size = Number(editForm.size) || 1;
    const mountIndex = editForm.mountIndex != null ? Number(editForm.mountIndex) : undefined;
    updateDevice(editingId, {
      name,
      model: editForm.model?.trim() || undefined,
      notes: editForm.notes ?? "",
      rackId: editForm.rackId?.trim() || undefined,
      mountIndex: mountIndex != null && Number.isInteger(mountIndex) && mountIndex >= 1 ? mountIndex : undefined,
      size: Number.isInteger(size) && size >= 1 ? size : 1,
    });
    setEditingId(null);
    push("success", `Updated ${name}`);
  };

  const armDelete = (id: string) => {
    if (armedDelete === id) {
      const d = devices.find((x) => x.id === id);
      removeDevice(id);
      setArmedDelete(null);
      if (expandedId === id) setExpandedId(null);
      push("success", `Removed ${d ? d.name : "device"}`);
      return;
    }
    setArmedDelete(id);
    if (disarmTimer.current) window.clearTimeout(disarmTimer.current);
    disarmTimer.current = window.setTimeout(() => setArmedDelete(null), 2600);
  };

  const renderDeviceForm = (
    form: DeviceFormState,
    setForm: React.Dispatch<React.SetStateAction<DeviceFormState>>,
    onSave: () => void,
    onCancel: () => void,
    saveLabel: string,
  ) => {
    const selectedRack = racks.find((r) => r.id === form.rackId);
    const rackUnits = selectedRack?.units ?? 0;

    const allSlots = (() => {
      if (!selectedRack || rackUnits === 0) return [] as { u: number; available: boolean; label: string }[];
      const size = form.size || 1;
      const occupiedMap = new Map<number, string>();
      for (const d of devices) {
        if (d.rackId !== selectedRack.id) continue;
        if (editingId && d.id === editingId) continue;
        if (d.mountIndex != null) {
          for (let u = d.mountIndex; u < d.mountIndex + d.size; u++) occupiedMap.set(u, d.name);
        }
      }
      const slots: { u: number; available: boolean; label: string }[] = [];
      for (let u = 1; u <= rackUnits; u++) {
        const occupant = occupiedMap.get(u);
        if (occupant) {
          slots.push({ u, available: false, label: `U${u} — ${occupant}` });
        } else {
          let fits = true;
          for (let j = 1; j < size; j++) {
            if (occupiedMap.has(u + j)) { fits = false; break; }
          }
          if (fits && u + size - 1 <= rackUnits) {
            slots.push({ u, available: true, label: size > 1 ? `U${u}–${u + size - 1}` : `U${u}` });
          } else if (!fits || u + size - 1 > rackUnits) {
            slots.push({ u, available: false, label: `U${u}` });
          }
        }
      }
      return slots;
    })();

    return (
      <div className="rise border-t border-linesoft/70 bg-deep/50 px-4 py-4 md:px-[70px]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">name</label>
              <input
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">model</label>
              <input
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="e.g. Cisco ISR 4321"
              />
            </div>
          </div>

          <div>
            <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">notes</label>
            <textarea
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes…"
            />
          </div>

          <div>
            <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">rack</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, rackId: "", mountIndex: undefined }))}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-all ${
                  !form.rackId
                    ? "border-brand/50 bg-brand/15 text-brand"
                    : "border-line bg-surface text-mute hover:border-brand/30 hover:text-txt"
                }`}
              >
                Unracked
              </button>
              {racks.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setForm((f) => ({
                    ...f,
                    rackId: r.id,
                    mountIndex: undefined,
                  }))}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-all ${
                    form.rackId === r.id
                      ? "border-brand/50 bg-brand/15 text-brand"
                      : "border-line bg-surface text-mute hover:border-brand/30 hover:text-txt"
                  }`}
                >
                  {r.name}{r.number ? ` #${r.number}` : ""}
                </button>
              ))}
            </div>
          </div>

          {form.rackId && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">rack slot</label>
                <select
                  className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 font-mono text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                  value={form.mountIndex ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, mountIndex: e.target.value === "" ? undefined : Number(e.target.value) }))}
                >
                  <option value="">Auto</option>
                  {allSlots.map((s) => (
                    <option key={s.u} value={s.available ? s.u : ""} disabled={!s.available}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">size (U)</label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 font-mono text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                  value={form.size}
                  onChange={(e) => setForm((f) => ({ ...f, size: Number(e.target.value), mountIndex: undefined }))}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-line bg-raised/70 px-4 py-1.5 text-[12.5px] font-semibold text-mute transition-all hover:border-danger/50 hover:text-danger active:scale-[0.97]"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="rounded-lg bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-abyss shadow-lg shadow-brand/20 transition-all hover:bg-brandsoft active:scale-[0.97]"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconServer className="h-4 w-4 text-brand" size={16} />
          <h2 className="font-display text-lg font-bold text-txt">Devices</h2>
          <span className="font-mono text-[11px] text-faint">{devices.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {racks.length > 0 && (
            <select
              className="h-8 rounded-lg border border-line bg-raised/70 px-2.5 text-[12px] text-txt outline-none transition-colors focus:border-brand/60"
              value={filterRack}
              onChange={(e) => setFilterRack(e.target.value)}
            >
              <option value="">All racks</option>
              {racks.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.number ? ` — ${r.number}` : ""}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowAdd((s) => !s)}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-[0.97] ${
              showAdd
                ? "border-danger/40 bg-danger/10 text-danger"
                : "border-line bg-raised/70 text-txt hover:border-brand/50 hover:bg-brand/10 hover:text-brand"
            }`}
          >
            {showAdd ? "− Add device" : "+ Add device"}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mt-3 overflow-hidden rounded-xl border border-brand/30 bg-surface/60">
          <div className="px-4 pt-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-brand">new device</p>
          </div>
          {renderDeviceForm(addForm, setAddForm, handleAdd, () => setShowAdd(false), "Add device")}
        </div>
      )}

      {devices.length === 0 && !showAdd ? (
        <div className="mt-3 rounded-xl border border-dashed border-line bg-surface/40 px-6 py-14 text-center">
          <p className="font-display text-lg font-bold text-txt">No devices yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-mute">
            Add devices manually or import a JSON file to start building your inventory.
          </p>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-line bg-surface/40 px-6 py-8 text-center">
          <p className="text-[13px] text-mute">No devices in this rack.</p>
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface/60">
          <div className="hidden grid-cols-[minmax(0,1.2fr)_200px_minmax(0,1fr)_92px] items-center gap-3 border-b border-line bg-deep/60 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint md:grid">
            <span>device</span>
            <span>location</span>
            <span>notes</span>
            <span className="text-right">actions</span>
          </div>

          {filteredDevices.map((d, idx) => {
            const t = inferType(d.name, d.model);
            const meta = TYPE_META[t];
            const open = expandedId === d.id;
            const location = (() => {
              const r = resolveRack(d, racks);
              if (r) {
                const bits = [r.name];
                if (r.number) bits.push(`rack ${r.number}`);
                return bits.join(" · ");
              }
              return "unracked";
            })();
            const locationFull = (() => {
              const r = resolveRack(d, racks);
              if (r) {
                const bits = [r.name];
                if (r.number) bits.push(`rack ${r.number}`);
                if (d.mountIndex != null) bits.push(`U${d.mountIndex}`);
                if (d.size > 1) bits.push(`(${d.size}U)`);
                return bits.join(" · ");
              }
              return "unracked";
            })();
            return (
              <div key={d.id} className="border-b border-linesoft/70 last:border-0">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (editingId === d.id) { setEditingId(null); return; }
                    setExpandedId(open ? null : d.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (editingId === d.id) { setEditingId(null); return; }
                      setExpandedId(open ? null : d.id);
                    }
                  }}
                  className="rise grid cursor-pointer grid-cols-[minmax(0,1fr)_92px] items-center gap-3 px-4 py-3 transition-colors hover:bg-raised/50 md:grid-cols-[minmax(0,1.2fr)_200px_minmax(0,1fr)_92px]"
                  style={{ animationDelay: `${Math.min(idx, 14) * 30}ms` }}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        color: meta.color,
                        background: `${meta.color}1a`,
                        border: `1px solid ${meta.color}38`,
                      }}
                    >
                      <TypeIcon type={t} className="h-4 w-4" size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-txt">
                        {d.name}
                      </span>
                      <span className="block font-mono text-[10.5px] text-faint">
                        {meta.label}
                        {d.size > 1 ? ` · ${d.size}U` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="hidden truncate font-mono text-[12.5px] text-txt md:block">
                    {location}
                  </span>
                  <span className="hidden truncate text-[12.5px] text-mute md:block">
                    {d.notes || <span className="italic text-faint">—</span>}
                  </span>
                  <span className="flex items-center justify-end gap-1">
                    <button
                      title={editingId === d.id ? "Cancel edit" : "Edit device"}
                      aria-label={editingId === d.id ? "Cancel edit" : `Edit ${d.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editingId === d.id) { setEditingId(null); }
                        else { startEdit(d); }
                      }}
                      className={`rounded-md p-1.5 transition-colors ${
                        editingId === d.id
                          ? "bg-brand/15 text-brand"
                          : "text-faint hover:bg-brand/15 hover:text-brand"
                      }`}
                    >
                      <IconEdit className="h-4 w-4" size={16} />
                    </button>
                    <button
                      title="Locate in topology"
                      aria-label={`Locate ${d.name} in topology`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/?focus=${d.id}`);
                      }}
                      className="rounded-md p-1.5 text-faint transition-colors hover:bg-brand/15 hover:text-brand"
                    >
                      <IconLocate className="h-4 w-4" size={16} />
                    </button>
                    <button
                      aria-label={armedDelete === d.id ? `Confirm removing ${d.name}` : `Remove ${d.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        armDelete(d.id);
                      }}
                      className={`rounded-md p-1.5 transition-all ${
                        armedDelete === d.id
                          ? "bg-danger/20 text-danger"
                          : "text-faint hover:bg-danger/15 hover:text-danger"
                      }`}
                      title={armedDelete === d.id ? "Click again to remove" : "Remove device"}
                    >
                      {armedDelete === d.id ? (
                        <span className="px-0.5 font-mono text-[10px] font-semibold uppercase">sure?</span>
                      ) : (
                        <IconTrash className="h-4 w-4" size={16} />
                      )}
                    </button>
                    <IconChevronDown
                      className={`h-4 w-4 text-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      size={16}
                    />
                  </span>
                </div>

                {editingId === d.id ? (
                  renderDeviceForm(editForm, setEditForm, handleSaveEdit, () => setEditingId(null), "Save changes")
                ) : open && (
                  <div className="rise border-t border-linesoft/70 bg-deep/50 px-4 py-4 md:px-[70px]">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">notes</p>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
                          {d.notes || <span className="italic text-faint">No notes recorded.</span>}
                        </p>
                      </div>
                      <div className="flex flex-col gap-3">
                        {d.model && (
                          <div>
                            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">model</p>
                            <p className="mt-1.5 font-mono text-[12.5px] text-txt">{d.model}</p>
                          </div>
                        )}
                        <div>
                          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">location</p>
                          <p className="mt-1.5 font-mono text-[12.5px] text-brand">{locationFull}</p>
                        </div>
                      </div>
                    </div>
                    <ConnectionEditor device={d} />
                    <p className="mt-3 font-mono text-[10px] text-faint/70">
                      {d.source} · {formatDate(d.importedAt)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
