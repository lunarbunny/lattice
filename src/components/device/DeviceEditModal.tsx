import { useState, useMemo, useEffect } from "react";
import { useDatastore } from "../../store";
import { useToast } from "../Toast";
import type { Device } from "../../lib/types";
import { findNextRackSlot, incrementTrailingNumber } from "../../lib/helpers";
import DynamicList from "../DynamicList";
import { IconX, IconChevronDown, IconPlus } from "../Icons";

interface DeviceFormState {
  key: string;
  name: string;
  model: string;
  notes: string;
  rackId: string;
  mountIndex: number | undefined;
  size: number;
  portTemplate: string;
  showNotes: boolean;
  customModel: boolean;
  swapDeviceId?: string;
}

let entryCounter = 0;
function nextEntryKey() {
  return `dev-${++entryCounter}`;
}

const emptyForm: DeviceFormState = { key: nextEntryKey(), name: "", model: "", notes: "", rackId: "", mountIndex: undefined, size: 1, portTemplate: "", showNotes: false, customModel: false };

interface Props {
  device?: Device;
  defaultRackId?: string;
  defaultMountIndex?: number;
  cloneFrom?: Device;
  rackUOrder?: "top" | "bottom";
  onClose: () => void;
}

export default function DeviceEditModal({ device, defaultRackId, defaultMountIndex, cloneFrom, rackUOrder = "bottom", onClose }: Props) {
  const { devices, racks, portTemplates, updateDevice, addDevice } = useDatastore();
  const { push } = useToast();
  const isCreate = !device;

  const uniqueModels = useMemo(
    () => [...new Set(devices.map((d) => d.model).filter((m): m is string => !!m))].sort(),
    [devices],
  );

  // Single device form state (for edit mode)
  const [form, setForm] = useState<DeviceFormState>({
    key: "edit",
    name: device?.name ?? "",
    model: device?.model ?? "",
    notes: device?.notes ?? "",
    rackId: device?.rackId ?? defaultRackId ?? "",
    mountIndex: device?.mountIndex ?? defaultMountIndex,
    size: device?.size ?? 1,
    portTemplate: device?.portTemplate ?? "",
    showNotes: !!device?.notes,
    customModel: !!device?.model && !uniqueModels.includes(device.model),
  });

  // Multi-device form state (for create mode)
  const [addEntries, setAddEntries] = useState<DeviceFormState[]>(() => {
    if (!isCreate) return [];
    const entry = { ...emptyForm, key: nextEntryKey() };
    if (cloneFrom) {
      entry.name = cloneFrom.name;
      entry.model = cloneFrom.model ?? "";
      entry.notes = cloneFrom.notes;
      entry.size = cloneFrom.size;
      entry.rackId = cloneFrom.rackId ?? defaultRackId ?? "";
      entry.portTemplate = cloneFrom.portTemplate ?? "";
      entry.showNotes = !!cloneFrom.notes;
      entry.customModel = !!cloneFrom.model && !uniqueModels.includes(cloneFrom.model);
    } else if (defaultRackId) {
      entry.rackId = defaultRackId;
      entry.mountIndex = defaultMountIndex;
    }
    return [entry];
  });
  const [sharedRackId, setSharedRackId] = useState(cloneFrom?.rackId ?? defaultRackId ?? "");
  const [clonedKey, setClonedKey] = useState<string | null>(null);

  // Edit mode save
  const handleSave = () => {
    if (!isCreate && device) {
      const name = form.name.trim();
      if (!name) { push("error", "Name is required"); return; }
      const size = Number(form.size) || 1;
      const mountIndex = form.mountIndex != null ? Number(form.mountIndex) : undefined;
      const rackId = form.rackId?.trim() || undefined;
      const model = form.model?.trim() || undefined;
      const notes = form.showNotes ? form.notes : "";
      const cleanMountIndex = mountIndex != null && Number.isInteger(mountIndex) && mountIndex >= 1 ? mountIndex : undefined;
      const cleanSize = Number.isInteger(size) && size >= 1 ? size : 1;

      // Handle swap if a swap target is selected
      if (form.swapDeviceId && cleanMountIndex != null && device.mountIndex != null) {
        const swapDevice = devices.find((d) => d.id === form.swapDeviceId);
        if (swapDevice && swapDevice.mountIndex != null) {
          // Swap: give the other device our current mountIndex
          updateDevice(swapDevice.id, { mountIndex: device.mountIndex });
        }
      }

      updateDevice(device.id, {
        name,
        model,
        notes,
        rackId,
        mountIndex: cleanMountIndex,
        size: cleanSize,
        portTemplate: form.portTemplate.trim() || undefined,
      });
      push("success", `Updated ${name}`);
      onClose();
    }
  };

  // Create mode save (multi-device)
  const handleAddAll = () => {
    const validEntries = addEntries.filter((e) => e.name.trim());
    if (validEntries.length === 0) { push("error", "At least one device name is required"); return; }

    const rackId = sharedRackId.trim() || undefined;
    const newIds: string[] = [];
    for (const entry of validEntries) {
      const size = Number.isInteger(entry.size) && entry.size >= 1 ? entry.size : 1;
      const mountIndex = entry.mountIndex != null && Number.isInteger(entry.mountIndex) && entry.mountIndex >= 1
        ? entry.mountIndex : undefined;
      const newDevice = addDevice({
        name: entry.name.trim(),
        model: entry.model.trim() || undefined,
        notes: entry.showNotes ? entry.notes : "",
        rackId,
        mountIndex,
        size,
        portTemplate: entry.portTemplate.trim() || undefined,
      });
      newIds.push(newDevice.id);
    }

    push("success", `Added ${newIds.length} device${newIds.length === 1 ? "" : "s"}`);
    onClose();
  };

  const updateAddEntry = (key: string, updater: (prev: DeviceFormState) => DeviceFormState) => {
    setAddEntries((prev) => prev.map((e) => (e.key === key ? updater(e) : e)));
  };

  // Check if a device can fit at a given mountIndex with a given size
  const canFitAtSlot = (rackId: string, mountIndex: number, size: number, excludeDeviceId?: string): boolean => {
    const rack = racks.find(r => r.id === rackId);
    if (!rack) return false;
    if (mountIndex + size - 1 > rack.units) return false;
    for (const dev of devices) {
      if (dev.rackId !== rackId || !dev.mountIndex) continue;
      if (excludeDeviceId && dev.id === excludeDeviceId) continue;
      // Check if this device overlaps with the target range
      const devEnd = dev.mountIndex + dev.size - 1;
      const targetEnd = mountIndex + size - 1;
      if (mountIndex <= devEnd && targetEnd >= dev.mountIndex) return false;
    }
    return true;
  };

  const addEntry = () => {
    setAddEntries((prev) => [...prev, { ...emptyForm, key: nextEntryKey() }]);
  };

  const cloneEntry = () => {
    const newKey = nextEntryKey();
    setAddEntries((prev) => {
      const last = prev[prev.length - 1];
      const newEntry = { ...last, key: newKey, name: incrementTrailingNumber(last.name), mountIndex: undefined as number | undefined };

      if (last.rackId && last.mountIndex) {
        const rack = racks.find(r => r.id === last.rackId);
        if (rack) {
          const slot = findNextRackSlot(rack, devices, last.mountIndex, last.size, rackUOrder);
          if (slot !== null) newEntry.mountIndex = slot;
        }
      }

      return [...prev, newEntry];
    });
    setClonedKey(newKey);
  };

  useEffect(() => {
    if (!clonedKey) return;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-entry-key="${clonedKey}"]`) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      }
      setClonedKey(null);
    });
  }, [clonedKey]);

  const removeAddEntry = (key: string) => {
    setAddEntries((prev) => prev.filter((e) => e.key !== key));
  };

  // Compute available slots for a given rack and form entry
  // If includeOccupied is false, occupied slots are excluded entirely (for create mode)
  // If includeOccupied is true, occupied slots are included but disabled (for edit mode, to allow swapping)
  const computeSlots = (rackId: string, entrySize: number, excludeDeviceId?: string, currentMountIndex?: number, includeOccupied: boolean = true) => {
    const selectedRack = racks.find((r) => r.id === rackId);
    if (!selectedRack || selectedRack.units === 0) return [] as { u: number; available: boolean; label: string; swapDeviceId?: string }[];
    const size = entrySize || 1;
    const occupiedMap = new Map<number, { name: string; deviceId: string; mountIndex: number; deviceSize: number }>();
    for (const d of devices) {
      if (d.rackId !== selectedRack.id) continue;
      if (excludeDeviceId && d.id === excludeDeviceId) continue;
      if (d.mountIndex != null) {
        for (let u = d.mountIndex; u < d.mountIndex + d.size; u++) {
          occupiedMap.set(u, { name: d.name, deviceId: d.id, mountIndex: d.mountIndex, deviceSize: d.size });
        }
      }
    }
    const slots: { u: number; available: boolean; label: string; swapDeviceId?: string }[] = [];
    for (let u = 1; u <= selectedRack.units; u++) {
      const occupant = occupiedMap.get(u);
      const isCurrent = currentMountIndex != null && u === currentMountIndex;
      if (occupant) {
        // If not including occupied slots, skip this slot entirely (unless it's the current slot)
        if (!includeOccupied && !isCurrent) continue;
        // Check if this slot can be swapped with (same size, both have explicit mountIndex)
        const canSwap = currentMountIndex != null && occupant.deviceSize === size && occupant.mountIndex != null;
        let label = `U${u} — ${occupant.name}`;
        if (isCurrent) label += " (current)";
        else if (canSwap) label += " (swap)";
        slots.push({
          u,
          available: canSwap || isCurrent,
          label,
          swapDeviceId: canSwap ? occupant.deviceId : undefined,
        });
      } else {
        let fits = true;
        for (let j = 1; j < size; j++) {
          if (occupiedMap.has(u + j)) { fits = false; break; }
        }
        if (fits && u + size - 1 <= selectedRack.units) {
          const baseLabel = size > 1 ? `U${u}–${u + size - 1}` : `U${u}`;
          slots.push({ u, available: true, label: isCurrent ? `${baseLabel} (current)` : baseLabel });
        } else if (!fits || u + size - 1 > selectedRack.units) {
          slots.push({ u, available: false, label: isCurrent ? `U${u} (current)` : `U${u}` });
        }
      }
    }
    // Reverse slot order when rackUOrder is "bottom" so topmost slot appears first
    if (rackUOrder === "bottom") {
      slots.reverse();
    }
    return slots;
  };

  // Render form fields for a single entry
  const renderFormFields = (
    entry: DeviceFormState,
    setEntry: React.Dispatch<React.SetStateAction<DeviceFormState>>,
    effectiveRackId: string,
    autoFocus = false,
  ) => {
    const allSlots = computeSlots(effectiveRackId, entry.size, undefined, entry.mountIndex, false);

    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">name</label>
            <input
              data-entry-key={entry.key}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
              value={entry.name}
              onChange={(e) => setEntry((f) => ({ ...f, name: e.target.value }))}
              autoFocus={autoFocus}
              onFocus={(e) => {
                if (cloneFrom) {
                  e.target.select();
                }
              }}
            />
          </div>
          <div>
            <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">model</label>
            {entry.customModel ? (
              <div className="mt-1 flex gap-1.5">
                <input
                  className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                  value={entry.model}
                  onChange={(e) => setEntry((f) => ({ ...f, model: e.target.value }))}
                  placeholder="e.g. Cisco ISR 4321"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setEntry((f) => ({ ...f, customModel: false, model: "" }))}
                  className="shrink-0 rounded-lg border border-line bg-surface px-2.5 text-[11px] font-semibold text-faint transition-colors hover:border-brand/30 hover:text-txt"
                >
                  <IconChevronDown className="h-3.5 w-3.5" size={14} />
                </button>
              </div>
            ) : (
              <select
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                value={entry.model}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setEntry((f) => ({ ...f, customModel: true, model: "" }));
                  } else {
                    setEntry((f) => ({ ...f, model: e.target.value }));
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

        {portTemplates.length > 0 && (
          <div>
            <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">port template</label>
            <select
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
              value={entry.portTemplate}
              onChange={(e) => setEntry((f) => ({ ...f, portTemplate: e.target.value }))}
            >
              <option value="">None</option>
              {portTemplates.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {effectiveRackId && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">rack slot</label>
              <select
                className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 font-mono text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                value={entry.mountIndex ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setEntry((f) => ({ ...f, mountIndex: undefined, swapDeviceId: undefined }));
                  } else {
                    const u = Number(value);
                    const slot = allSlots.find((s) => s.u === u);
                    setEntry((f) => ({ ...f, mountIndex: u, swapDeviceId: slot?.swapDeviceId }));
                  }
                }}
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
                value={entry.size}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  let newMountIndex = entry.mountIndex;

                  if (entry.mountIndex && entry.rackId) {
                    // Anchor at visually topmost slot and expand based on ordering
                    if (rackUOrder === "bottom") {
                      // Bottom-to-up: visually topmost is highest U, expand towards lower U
                      newMountIndex = entry.mountIndex - (newSize - entry.size);
                    }
                    // Top-to-bottom: visually topmost is lowest U, mountIndex stays the same

                    // Check if the new position fits
                    if (newMountIndex !== undefined && newMountIndex >= 1) {
                      if (!canFitAtSlot(entry.rackId, newMountIndex, newSize)) {
                        newMountIndex = undefined;
                      }
                    } else {
                      newMountIndex = undefined;
                    }
                  }

                  setEntry((f) => ({ ...f, size: newSize, mountIndex: newMountIndex }));
                }}
              />
            </div>
          </div>
        )}

        {!entry.showNotes ? (
          <button
            type="button"
            onClick={() => setEntry((f) => ({ ...f, showNotes: true }))}
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
                onClick={() => setEntry((f) => ({ ...f, showNotes: false, notes: "" }))}
                className="rounded-md p-0.5 text-faint transition-colors hover:text-danger"
              >
                <IconX className="h-3 w-3" size={12} />
              </button>
            </div>
            <textarea
              rows={2}
              className="mt-1.5 w-full resize-none rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
              value={entry.notes}
              onChange={(e) => setEntry((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes…"
            />
          </div>
        )}
      </div>
    );
  };

  // Edit mode: single device form with rack selector
  if (!isCreate && device) {
    const allSlots = computeSlots(form.rackId, form.size, device.id, form.mountIndex);

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

              {portTemplates.length > 0 && (
                <div>
                  <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">port template</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                    value={form.portTemplate}
                    onChange={(e) => setForm((f) => ({ ...f, portTemplate: e.target.value }))}
                  >
                    <option value="">None</option>
                    {portTemplates.map((t) => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

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
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          setForm((f) => ({ ...f, mountIndex: undefined, swapDeviceId: undefined }));
                        } else {
                          const u = Number(value);
                          const slot = allSlots.find((s) => s.u === u);
                          setForm((f) => ({ ...f, mountIndex: u, swapDeviceId: slot?.swapDeviceId }));
                        }
                      }}
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
                      onChange={(e) => {
                        const newSize = Number(e.target.value);
                        let newMountIndex = form.mountIndex;

                        if (form.mountIndex && form.rackId) {
                          // Anchor at visually topmost slot and expand based on ordering
                          if (rackUOrder === "bottom") {
                            // Bottom-to-up: visually topmost is highest U, expand towards lower U
                            newMountIndex = form.mountIndex - (newSize - form.size);
                          }
                          // Top-to-bottom: visually topmost is lowest U, mountIndex stays the same

                          // Check if the new position fits
                          if (newMountIndex !== undefined && newMountIndex >= 1) {
                            if (!canFitAtSlot(form.rackId, newMountIndex, newSize, device?.id)) {
                              newMountIndex = undefined;
                            }
                          } else {
                            newMountIndex = undefined;
                          }
                        }

                        setForm((f) => ({ ...f, size: newSize, mountIndex: newMountIndex }));
                      }}
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

  // Create mode: multi-device form with shared rack selector
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-line bg-deep shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-display text-base font-bold text-txt">
            {addEntries.length > 1 ? `New devices (${addEntries.length})` : "New device"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-txt"
          >
            <IconX className="h-4 w-4" size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {racks.length > 0 && (
            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">rack</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSharedRackId("");
                    setAddEntries((prev) => prev.map((e) => ({ ...e, mountIndex: undefined })));
                  }}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-all ${
                    !sharedRackId
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
                    onClick={() => {
                      setSharedRackId(r.id);
                      setAddEntries((prev) => prev.map((e) => ({ ...e, mountIndex: undefined })));
                    }}
                    className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-all ${
                      sharedRackId === r.id
                        ? "border-brand/50 bg-brand/15 text-brand"
                        : "border-line bg-surface text-mute hover:border-brand/30 hover:text-txt"
                    }`}
                  >
                    {r.name}{r.number ? ` #${r.number}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={racks.length > 0 ? "mt-5" : ""}>
            <DynamicList
              label="devices"
              addLabel="add device"
              onAdd={addEntry}
              entries={addEntries}
              onRemove={(key) => removeAddEntry(key)}
              extraActions={
                <button
                  type="button"
                  onClick={cloneEntry}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-faint transition-colors hover:bg-raised hover:text-txt"
                >
                  clone last
                </button>
              }
            >
              {(entry, idx) =>
                renderFormFields(
                  entry,
                  (updater) => updateAddEntry(entry.key, typeof updater === "function" ? updater : () => updater),
                  sharedRackId,
                  idx === 0,
                )
              }
            </DynamicList>
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
            onClick={handleAddAll}
            className="rounded-lg bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-abyss shadow-lg shadow-brand/20 transition-all hover:bg-brandsoft active:scale-[0.97]"
          >
            {addEntries.length > 1 ? `Create ${addEntries.length} devices` : "Create device"}
          </button>
        </div>
      </div>
    </div>
  );
}
