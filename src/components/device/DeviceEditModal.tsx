import { useState, useMemo } from "react";
import { useDevices } from "../../store";
import { useToast } from "../Toast";
import type { Device } from "../../lib/types";
import { IconX, IconChevronDown, IconPlus } from "../Icons";

interface DeviceFormState {
  name: string;
  model: string;
  notes: string;
  rackId: string;
  mountIndex: number | undefined;
  size: number;
  showNotes: boolean;
  customModel: boolean;
}

interface Props {
  device: Device;
  onClose: () => void;
}

export default function DeviceEditModal({ device, onClose }: Props) {
  const { devices, racks, updateDevice } = useDevices();
  const { push } = useToast();

  const uniqueModels = useMemo(
    () => [...new Set(devices.map((d) => d.model).filter((m): m is string => !!m))].sort(),
    [devices],
  );

  const [form, setForm] = useState<DeviceFormState>({
    name: device.name,
    model: device.model ?? "",
    notes: device.notes,
    rackId: device.rackId ?? "",
    mountIndex: device.mountIndex,
    size: device.size,
    showNotes: !!device.notes,
    customModel: !!device.model && !uniqueModels.includes(device.model),
  });

  const handleSave = () => {
    const name = form.name.trim();
    if (!name) { push("error", "Name is required"); return; }
    const size = Number(form.size) || 1;
    const mountIndex = form.mountIndex != null ? Number(form.mountIndex) : undefined;
    updateDevice(device.id, {
      name,
      model: form.model?.trim() || undefined,
      notes: form.showNotes ? form.notes : "",
      rackId: form.rackId?.trim() || undefined,
      mountIndex: mountIndex != null && Number.isInteger(mountIndex) && mountIndex >= 1 ? mountIndex : undefined,
      size: Number.isInteger(size) && size >= 1 ? size : 1,
    });
    onClose();
    push("success", `Updated ${name}`);
  };

  const selectedRack = racks.find((r) => r.id === form.rackId);
  const rackUnits = selectedRack?.units ?? 0;

  const allSlots = (() => {
    if (!selectedRack || rackUnits === 0) return [] as { u: number; available: boolean; label: string }[];
    const size = form.size || 1;
    const occupiedMap = new Map<number, string>();
    for (const d of devices) {
      if (d.rackId !== selectedRack.id) continue;
      if (d.id === device.id) continue;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-line bg-deep shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-display text-base font-bold text-txt">Edit device</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-txt"
          >
            <IconX className="h-4 w-4" size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
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
                {form.customModel ? (
                  <div className="mt-1 flex gap-1.5">
                    <input
                      className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                      value={form.model}
                      onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                      placeholder="e.g. Cisco ISR 4321"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, customModel: false, model: "" }))}
                      className="shrink-0 rounded-lg border border-line bg-surface px-2.5 text-[11px] font-semibold text-faint transition-colors hover:border-brand/30 hover:text-txt"
                    >
                      <IconChevronDown className="h-3.5 w-3.5" size={14} />
                    </button>
                  </div>
                ) : (
                  <select
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                    value={form.model}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setForm((f) => ({ ...f, customModel: true, model: "" }));
                      } else {
                        setForm((f) => ({ ...f, model: e.target.value }));
                      }
                    }}
                  >
                    <option value="">None</option>
                    {uniqueModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    <option value="__custom__">Custom…</option>
                  </select>
                )}
              </div>
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

            {!form.showNotes ? (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, showNotes: true }))}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-faint transition-colors hover:bg-raised hover:text-txt"
              >
                <IconPlus className="h-3 w-3" size={12} />
                add notes
              </button>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">notes</span>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, showNotes: false, notes: "" }))}
                    className="rounded-md p-0.5 text-faint transition-colors hover:text-danger"
                  >
                    <IconX className="h-3 w-3" size={12} />
                  </button>
                </div>
                <textarea
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes…"
                />
              </div>
            )}
          </div>
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
    </div>
  );
}
