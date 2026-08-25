import { useState } from "react";
import { useDevices } from "../store";
import { useToast } from "./Toast";
import { inferType } from "../lib/layout/topology";
import { resolveRack } from "../lib/importer";
import type { Device } from "../lib/types";
import { TYPE_META } from "../lib/types";
import { navigate } from "../lib/router";
import { formatDate } from "../lib/helpers";
import ConnectionEditor from "./ConnectionEditor";
import ConfirmDialog from "./ConfirmDialog";
import ContextMenu from "./ContextMenu";
import HoverInfo from "./HoverInfo";
import {
  IconTrash,
  IconChevronDown,
  IconLocate,
  IconEdit,
  IconServer,
  IconX,
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
  const [showModal, setShowModal] = useState(false);
  const [addForm, setAddForm] = useState<DeviceFormState>({ ...emptyForm });
  const [multiMode, setMultiMode] = useState(false);
  const [addedDeviceIds, setAddedDeviceIds] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<DeviceFormState>({ ...emptyForm });
  const [editDeviceId, setEditDeviceId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [filterRack, setFilterRack] = useState("");
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; device: Device } | null>(null);

  const filteredDevices = filterRack
    ? devices.filter((d) => d.rackId === filterRack)
    : devices;

  const openAddModal = () => {
    setAddForm({ ...emptyForm });
    setMultiMode(false);
    setAddedDeviceIds([]);
    setShowModal(true);
  };

  const closeAddModal = () => {
    setShowModal(false);
    setAddForm({ ...emptyForm });
    setMultiMode(false);
    setAddedDeviceIds([]);
  };

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
    if (multiMode) {
      setAddedDeviceIds((prev) => [...prev, newDevice.id]);
      setAddForm((f) => ({ ...f, name: "", mountIndex: undefined }));
      push("success", `Added device "${name}"`);
    } else {
      setAddForm({ ...emptyForm });
      setShowModal(false);
      setExpandedId(newDevice.id);
      push("success", `Added device "${name}"`);
    }
  };

  const removeAddedDevice = (id: string) => {
    removeDevice(id);
    setAddedDeviceIds((prev) => prev.filter((x) => x !== id));
    const d = devices.find((x) => x.id === id);
    push("success", `Removed ${d?.name ?? "device"}`);
  };

  const openEditModal = (d: Device) => {
    setEditDeviceId(d.id);
    setEditForm({
      name: d.name,
      model: d.model ?? "",
      notes: d.notes,
      rackId: d.rackId ?? "",
      mountIndex: d.mountIndex,
      size: d.size,
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditDeviceId(null);
    setEditForm({ ...emptyForm });
  };

  const handleSaveEdit = () => {
    if (!editDeviceId) return;
    const name = editForm.name.trim();
    if (!name) { push("error", "Name is required"); return; }
    const size = Number(editForm.size) || 1;
    const mountIndex = editForm.mountIndex != null ? Number(editForm.mountIndex) : undefined;
    updateDevice(editDeviceId, {
      name,
      model: editForm.model?.trim() || undefined,
      notes: editForm.notes ?? "",
      rackId: editForm.rackId?.trim() || undefined,
      mountIndex: mountIndex != null && Number.isInteger(mountIndex) && mountIndex >= 1 ? mountIndex : undefined,
      size: Number.isInteger(size) && size >= 1 ? size : 1,
    });
    closeEditModal();
    push("success", `Updated ${name}`);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    removeDevice(deleteTarget.id);
    if (expandedId === deleteTarget.id) setExpandedId(null);
    push("success", `Removed ${deleteTarget.name}`);
    setDeleteTarget(null);
  };

  const renderDeviceForm = (
    form: DeviceFormState,
    setForm: React.Dispatch<React.SetStateAction<DeviceFormState>>,
    onSave: () => void,
    onCancel: () => void,
    saveLabel: string,
    inModal = false,
  ) => {
    const selectedRack = racks.find((r) => r.id === form.rackId);
    const rackUnits = selectedRack?.units ?? 0;

    const allSlots = (() => {
      if (!selectedRack || rackUnits === 0) return [] as { u: number; available: boolean; label: string }[];
      const size = form.size || 1;
      const occupiedMap = new Map<number, string>();
      for (const d of devices) {
        if (d.rackId !== selectedRack.id) continue;
        if (editDeviceId && d.id === editDeviceId) continue;
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
      <div className={inModal ? "space-y-3" : "rise border-t border-linesoft/70 bg-deep/50 px-4 py-4 md:px-[70px]"}>
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

        {!inModal && (
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
        )}
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
            onClick={openAddModal}
            className="rounded-lg border border-line bg-raised/70 px-3 py-1.5 text-[12px] font-semibold text-txt transition-all hover:border-brand/50 hover:bg-brand/10 hover:text-brand active:scale-[0.97]"
          >
            + Add device
          </button>
        </div>
      </div>

      {/* ---- Add device modal ---- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={closeAddModal}>
          <div
            className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-line bg-deep shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h3 className="font-display text-base font-bold text-txt">
                {multiMode && addedDeviceIds.length > 0
                  ? `Add devices (${addedDeviceIds.length} added)`
                  : "New device"}
              </h3>
              <button
                onClick={closeAddModal}
                className="rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-txt"
              >
                <IconX className="h-4 w-4" size={16} />
              </button>
            </div>

            {/* body */}
            <div className="flex-1 overflow-y-auto p-5">
              {renderDeviceForm(addForm, setAddForm, handleAdd, closeAddModal, "Add device", true)}

              {/* chips for multi-device mode */}
              {multiMode && addedDeviceIds.length > 0 && (
                <div className="mt-4">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">added devices</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {addedDeviceIds.map((id) => {
                      const d = devices.find((x) => x.id === id);
                      if (!d) return null;
                      return (
                        <span
                          key={id}
                          className="select-none flex items-center gap-1 rounded-md bg-brand/12 px-1.5 py-0.5 text-[11px] font-medium text-brand"
                        >
                          {d.name}
                          <button
                            type="button"
                            onClick={() => removeAddedDevice(id)}
                            className="rounded-sm transition-colors hover:text-danger"
                          >
                            <IconX className="h-3 w-3" size={12} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* footer */}
            <div className="flex items-center justify-between border-t border-line px-5 py-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMultiMode((m) => !m)}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                    multiMode
                      ? "bg-brand/15 text-brand"
                      : "text-faint hover:bg-raised hover:text-txt"
                  }`}
                >
                  <span className={`inline-block h-3 w-5 rounded-full border transition-colors ${multiMode ? "border-brand/50 bg-brand/30" : "border-line bg-surface"}`}>
                    <span className={`block h-2 w-2 rounded-full transition-transform ${multiMode ? "translate-x-2.5 bg-brand" : "translate-x-0.5 bg-faint"}`} style={{ marginTop: "1px" }} />
                  </span>
                  multi-device
                </button>
                <HoverInfo>
                  Keep the form open to add multiple devices in sequence. Each click of "Add device" saves the current form and resets it for the next entry.
                </HoverInfo>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={closeAddModal}
                  className="rounded-lg border border-line bg-raised/70 px-4 py-1.5 text-[12.5px] font-semibold text-mute transition-all hover:border-danger/50 hover:text-danger active:scale-[0.97]"
                >
                  {multiMode ? "Close" : "Cancel"}
                </button>
                <button
                  onClick={handleAdd}
                  className="rounded-lg bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-abyss shadow-lg shadow-brand/20 transition-all hover:bg-brandsoft active:scale-[0.97]"
                >
                  Add device
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Edit device modal ---- */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={closeEditModal}>
          <div
            className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-line bg-deep shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h3 className="font-display text-base font-bold text-txt">Edit device</h3>
              <button
                onClick={closeEditModal}
                className="rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-txt"
              >
                <IconX className="h-4 w-4" size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {renderDeviceForm(editForm, setEditForm, handleSaveEdit, closeEditModal, "Save changes", true)}
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
              <button
                onClick={closeEditModal}
                className="rounded-lg border border-line bg-raised/70 px-4 py-1.5 text-[12.5px] font-semibold text-mute transition-all hover:border-danger/50 hover:text-danger active:scale-[0.97]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="rounded-lg bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-abyss shadow-lg shadow-brand/20 transition-all hover:bg-brandsoft active:scale-[0.97]"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Context menu ---- */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            {
              label: "Edit device",
              icon: <IconEdit className="h-3.5 w-3.5" size={14} />,
              onClick: () => openEditModal(ctxMenu.device),
            },
            {
              label: "Locate in fabric",
              icon: <IconLocate className="h-3.5 w-3.5" size={14} />,
              onClick: () => navigate(`/?focus=${ctxMenu.device.id}`),
            },
            {
              label: "Remove",
              icon: <IconTrash className="h-3.5 w-3.5" size={14} />,
              danger: true,
              onClick: () => {
                setCtxMenu(null);
                setDeleteTarget(ctxMenu.device);
              },
            },
          ]}
        />
      )}

      {/* ---- Delete confirmation modal ---- */}
      {deleteTarget && (
        <ConfirmDialog
          title="Remove device"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Remove"
        >
          <p>Are you sure you want to remove <span className="font-semibold text-txt">{deleteTarget.name}</span>?</p>
          <p className="mt-1.5 text-danger">All connections to this device will be removed.</p>
        </ConfirmDialog>
      )}

      {devices.length === 0 && !showModal ? (
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
            <span>model</span>
            <span className="text-right">actions</span>
          </div>

          {filteredDevices.map((d, idx) => {
            const t = inferType(d.name, d.model);
            const meta = TYPE_META[t];
            const open = expandedId === d.id;
            const isAutoSlot = !!d.rackId && d.mountIndex == null;
            const location = (() => {
              const r = resolveRack(d, racks);
              if (r) {
                const bits = [r.name];
                if (r.number) bits.push(`rack ${r.number}`);
                if (d.mountIndex != null) bits.push(`U${d.mountIndex}`);
                else bits.push("auto");
                return bits.join(" · ");
              }
              return "unracked";
            })();
            return (
              <div key={d.id} className="border-b border-linesoft/70 last:border-0">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(open ? null : d.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedId(open ? null : d.id);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCtxMenu({ x: e.clientX, y: e.clientY, device: d });
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
                  <span className={`hidden truncate font-mono text-[12.5px] md:block ${isAutoSlot ? "text-brand" : "text-txt"}`}>
                    {location}
                  </span>
                  <span className="hidden truncate text-[12.5px] text-mute md:block">
                    {d.model || <span className="italic text-faint">—</span>}
                  </span>
                  <span className="flex items-center justify-end">
                    <IconChevronDown
                      className={`h-4 w-4 text-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      size={16}
                    />
                  </span>
                </div>

                {open && (
                  <div className={`rise border-t border-linesoft/70 bg-deep/50 px-4 pb-4 md:px-[70px] ${d.notes ? "pt-4" : "pt-2"}`}>
                    {d.notes && (
                      <div className="mb-3">
                        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">notes</p>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-mute">{d.notes}</p>
                      </div>
                    )}
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
