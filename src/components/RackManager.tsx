import { useMemo, useRef, useState } from "react";
import { useDevices } from "../store";
import { useToast } from "./Toast";
import type { Device, Rack } from "../lib/types";
import ConfirmDialog from "./ConfirmDialog";
import ContextMenu from "./ContextMenu";
import { IconEdit, IconPlus, IconTrash, IconX } from "./Icons";
import FormEntryList from "./FormEntryList";
import { TEXT_TERTIARY, TEXT_EMPTY_SLOT } from "../lib/colours";

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                    */
/* ------------------------------------------------------------------ */

interface RackGroup {
  name: string;
  racks: Rack[];
}

interface FormEntry {
  key: string;
  id: string | null;
  units: number;
  deviceNames: string[];
}

const COMMON_SIZES = [6, 12, 16, 24, 42, 48];

function groupRacks(racks: Rack[]): RackGroup[] {
  const map = new Map<string, Rack[]>();
  for (const r of racks) {
    const list = map.get(r.name);
    if (list) list.push(r);
    else map.set(r.name, [r]);
  }
  return Array.from(map.entries()).map(([name, racks]) => ({
    name,
    racks: racks.sort((a, b) => {
      const na = a.number ?? "";
      const nb = b.number ?? "";
      return na.localeCompare(nb, undefined, { numeric: true });
    }),
  }));
}

let formCounter = 0;
function nextKey() {
  return `new-${++formCounter}`;
}

/* ------------------------------------------------------------------ */
/*  Rack SVG visualization                                             */
/* ------------------------------------------------------------------ */

function RackVisual({ units }: { units: number }) {
  const vw = 60;
  const vh = 100;
  const frameX = 6;
  const frameY = 4;
  const frameW = vw - 12;
  const frameH = vh - 20;
  const footW = 10;
  const footH = 6;
  const numDividers = Math.min(Math.max(2, Math.round(units / 8)), 8);

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} className="w-full h-full" aria-hidden="true">
      {/* frame */}
      <rect x={frameX} y={frameY} width={frameW} height={frameH} rx="1.5" fill="none" stroke={TEXT_TERTIARY} strokeWidth="2" />

      {/* U dividers */}
      {Array.from({ length: numDividers }, (_, i) => {
        const y = frameY + ((i + 1) / (numDividers + 1)) * frameH;
        return <line key={i} x1={frameX + 3} y1={y} x2={frameX + frameW - 3} y2={y} stroke={TEXT_EMPTY_SLOT} strokeWidth="0.6" />;
      })}

      {/* feet */}
      <rect x={frameX + 2} y={frameY + frameH + 2} width={footW} height={footH} rx="1" fill={TEXT_TERTIARY} />
      <rect x={frameX + frameW - footW - 2} y={frameY + frameH + 2} width={footW} height={footH} rx="1" fill={TEXT_TERTIARY} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Device multiselect (per rack entry)                                */
/* ------------------------------------------------------------------ */

function DeviceMultiselect({
  selected,
  onChange,
  available,
}: {
  selected: string[];
  onChange: (names: string[]) => void;
  available: Device[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = available
    .filter((d) => !selected.includes(d.name))
    .filter((d) => (query ? d.name.toLowerCase().includes(query.toLowerCase()) : true))
    .slice(0, 20);

  return (
    <div className="relative">
      <div
        className="flex min-h-[34px] flex-wrap items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-brand/60"
        onClick={() => setOpen(true)}
      >
        {selected.map((name) => (
          <span
            key={name}
            className="select-none flex items-center gap-1 rounded-md bg-brand/12 px-1.5 py-0.5 text-[11px] font-medium text-brand"
            onClick={(e) => e.stopPropagation()}
          >
            {name}
            <button
              type="button"
              onClick={() => onChange(selected.filter((n) => n !== name))}
              className="rounded-sm transition-colors hover:text-danger"
            >
              <IconX className="h-3 w-3" size={12} />
            </button>
          </span>
        ))}
        <input
          className="min-w-[60px] flex-1 bg-transparent py-0.5 text-[12px] text-txt outline-none placeholder:text-faint"
          placeholder={selected.length > 0 ? "Add more…" : "Assign devices…"}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-y-auto rounded-lg border border-line bg-deep shadow-xl">
          {filtered.map((d) => (
            <button
              key={d.id}
              type="button"
              className="flex w-full items-center px-3 py-1.5 text-left text-[12px] text-txt transition-colors hover:bg-brand/10"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange([...selected, d.name]);
                setQuery("");
              }}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rack entry (shared form component)                                 */
/* ------------------------------------------------------------------ */

function RackFormEntry({
  entry,
  onUnitsChange,
  onDevicesChange,
  availableDevices,
}: {
  entry: FormEntry;
  onUnitsChange: (units: number) => void;
  onDevicesChange: (names: string[]) => void;
  availableDevices: Device[];
}) {
  const [showSizes, setShowSizes] = useState(false);

  return (
    <>
      {/* size selector */}
      <div className="relative mb-2.5">
        <button
          type="button"
          onClick={() => setShowSizes((s) => !s)}
          className="flex h-9 w-full items-center justify-between rounded-lg border border-line bg-surface px-3 font-mono text-[13px] text-txt transition-colors hover:border-brand/40"
        >
          <span>{entry.units}U</span>
          <span className="text-[10px] text-faint">▼</span>
        </button>
        {showSizes && (
          <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-line bg-deep shadow-xl">
            {COMMON_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                className={`flex w-full items-center px-3 py-1.5 text-left font-mono text-[12.5px] transition-colors hover:bg-brand/10 ${
                  s === entry.units ? "text-brand" : "text-txt"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onUnitsChange(s);
                  setShowSizes(false);
                }}
              >
                {s}U
              </button>
            ))}
            <div className="border-t border-line">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Custom…"
                className="w-full bg-transparent px-3 py-1.5 font-mono text-[12.5px] text-txt outline-none placeholder:text-faint"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = Number((e.target as HTMLInputElement).value);
                    if (v >= 1) { onUnitsChange(v); setShowSizes(false); }
                  }
                }}
                autoFocus
              />
            </div>
          </div>
        )}
      </div>

      {/* device multiselect */}
      <DeviceMultiselect
        selected={entry.deviceNames}
        onChange={onDevicesChange}
        available={availableDevices}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main RackManager                                                   */
/* ------------------------------------------------------------------ */

export default function RackManager() {
  const { racks, devices, addRack, updateRack, removeRack, updateDevice } = useDevices();
  const { push } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [entries, setEntries] = useState<FormEntry[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; group: RackGroup } | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<RackGroup | null>(null);

  const groups = useMemo(() => groupRacks(racks), [racks]);

  /* ---- compute unracked devices ---- */

  const unrackedDevices = useMemo(() => {
    const assignedInForm = new Set<string>();
    for (const e of entries) {
      for (const n of e.deviceNames) assignedInForm.add(n);
    }
    return devices.filter((d) => !d.rackId && !assignedInForm.has(d.name));
  }, [devices, entries]);

  const getAvailableForEntry = (entryKey: string): Device[] => {
    const entry = entries.find((e) => e.key === entryKey);
    if (!entry) return unrackedDevices;
    const selectedSet = new Set(entry.deviceNames);
    return [...unrackedDevices, ...devices.filter((d) => selectedSet.has(d.name))];
  };

  /* ---- modal open/close ---- */

  const openNew = () => {
    setEditingGroup(null);
    setGroupName("");
    setEntries([{ key: nextKey(), id: null, units: 42, deviceNames: [] }]);
    setShowModal(true);
  };

  const openEdit = (group: RackGroup) => {
    setEditingGroup(group.name);
    setGroupName(group.name);
    setEntries(
      group.racks.map((r) => ({
        key: r.id,
        id: r.id,
        units: r.units,
        deviceNames: devices
          .filter((d) => d.rackId === r.id)
          .map((d) => d.name),
      }))
    );
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingGroup(null);
    setGroupName("");
    setEntries([]);
  };

  const confirmDeleteGroup = () => {
    if (!deleteGroup) return;
    const rackIds = new Set(deleteGroup.racks.map((r) => r.id));
    // Unrack all devices in this group
    for (const d of devices) {
      if (d.rackId && rackIds.has(d.rackId)) {
        updateDevice(d.id, { rackId: undefined, mountIndex: undefined });
      }
    }
    // Remove all racks
    for (const r of deleteGroup.racks) {
      removeRack(r.id);
    }
    push("success", `Removed "${deleteGroup.name}"`);
    setDeleteGroup(null);
  };

  /* ---- form mutations ---- */

  const addEntry = () => {
    setEntries((prev) => [...prev, { key: nextKey(), id: null, units: 42, deviceNames: [] }]);
  };

  const updateEntryUnits = (key: string, units: number) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, units } : e)));
  };

  const updateEntryDevices = (key: string, deviceNames: string[]) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, deviceNames } : e)));
  };

  const removeEntry = (key: string) => {
    setEntries((prev) => prev.filter((e) => e.key !== key));
  };

  /* ---- save ---- */

  const handleSave = () => {
    const name = groupName.trim();
    if (!name) { push("error", "Group name is required"); return; }
    if (entries.length === 0) { push("error", "Add at least one rack"); return; }

    const createdRackIds: string[] = [];

    if (editingGroup === null) {
      for (let i = 0; i < entries.length; i++) {
        const r = addRack({ name, units: entries[i].units, number: String(i + 1) });
        createdRackIds.push(r.id);
      }
    } else {
      const originalRacks = racks.filter((r) => r.name === editingGroup);
      const originalIds = new Set(originalRacks.map((r) => r.id));
      const keptIds = new Set(entries.filter((e) => e.id).map((e) => e.id!));

      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (e.id) {
          updateRack(e.id, { name, units: e.units });
        } else {
          const r = addRack({ name, units: e.units, number: String(i + 1) });
          createdRackIds.push(r.id);
        }
      }

      for (const id of originalIds) {
        if (!keptIds.has(id)) removeRack(id);
      }
    }

    /* build final rack id list for each entry */
    const rackIdsForEntries: string[] = [];
    let createdIdx = 0;
    for (const e of entries) {
      if (e.id) {
        rackIdsForEntries.push(e.id);
      } else {
        rackIdsForEntries.push(createdRackIds[createdIdx++]);
      }
    }

    /* assign devices to racks */
    for (let i = 0; i < entries.length; i++) {
      const rackId = rackIdsForEntries[i];
      if (!rackId) continue;
      for (const deviceName of entries[i].deviceNames) {
        const dev = devices.find((d) => d.name.toLowerCase() === deviceName.toLowerCase());
        if (dev && dev.rackId !== rackId) {
          updateDevice(dev.id, { rackId });
        }
      }
    }

    const totalDevices = entries.reduce((sum, e) => sum + e.deviceNames.length, 0);
    const deviceMsg = totalDevices > 0 ? ` and assigned ${totalDevices} device${totalDevices === 1 ? "" : "s"}` : "";
    push("success", editingGroup ? `Updated "${name}"${deviceMsg}` : `Created "${name}" with ${entries.length} rack${entries.length === 1 ? "" : "s"}${deviceMsg}`);
    closeModal();
  };

  /* ---- render ---- */

  return (
    <section>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-brand" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3.5" y="1.5" width="9" height="13" rx="1.2" />
            <path d="M3.5 6h9M3.5 10.5h9" />
          </svg>
          <h2 className="font-display text-lg font-bold text-txt">Racks</h2>
          <span className="font-mono text-[11px] text-faint">
            {groups.length} group{groups.length === 1 ? "" : "s"} · {racks.length} rack{racks.length === 1 ? "" : "s"}
          </span>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-raised/70 px-3 py-1.5 text-[12px] font-semibold text-txt transition-all hover:border-brand/50 hover:bg-brand/10 hover:text-brand active:scale-[0.97]"
        >
          <IconPlus className="h-3.5 w-3.5" size={14} />
          New rack group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-line bg-surface/40 px-6 py-8 text-center">
          <p className="text-[13px] text-mute">No rack groups yet. Create one to start organising devices.</p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-5 gap-3">
          {groups.map((group, idx) => {
            const totalU = group.racks.reduce((sum, r) => sum + r.units, 0);
            return (
              <div
                key={group.name}
                className="rise group relative flex flex-col items-center rounded-xl border border-line bg-surface/60 px-3 pt-3 pb-3 transition-all hover:border-brand/30 hover:bg-raised/50"
                style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, group });
                }}
              >
                <div className="w-full max-h-[100px]">
                  <RackVisual units={group.racks[0]?.units ?? 42} />
                </div>
                <p className="mt-1.5 text-center text-[12px] font-semibold text-txt leading-tight">
                  {group.name}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-faint">
                  {group.racks.length} rack{group.racks.length === 1 ? "" : "s"} · {totalU}U total
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Edit / Create modal ---- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={closeModal}>
          <div
            className="relative mx-4 flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-line bg-deep shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h3 className="font-display text-base font-bold text-txt">
                {editingGroup ? `Edit "${editingGroup}"` : "New rack group"}
              </h3>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-txt"
              >
                <IconX className="h-4 w-4" size={16} />
              </button>
            </div>

            {/* body */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* group name */}
              <div>
                <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
                  rack group
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Server Room A"
                  autoFocus
                />
              </div>

              {/* racks */}
              <div className="mt-5">
                <FormEntryList
                  label="racks"
                  addLabel="add rack"
                  onAdd={addEntry}
                  entries={entries}
                  onRemove={(key) => removeEntry(key)}
                  isRemoveDisabled={(key) => {
                    const entry = entries.find((e) => e.key === key);
                    return entry ? entry.deviceNames.length > 0 : false;
                  }}
                >
                  {(entry) => (
                    <RackFormEntry
                      entry={entry}
                      onUnitsChange={(u) => updateEntryUnits(entry.key, u)}
                      onDevicesChange={(names) => updateEntryDevices(entry.key, names)}
                      availableDevices={getAvailableForEntry(entry.key)}
                    />
                  )}
                </FormEntryList>
              </div>
            </div>

            {/* footer */}
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">
              <button
                onClick={closeModal}
                className="rounded-lg border border-line bg-raised/70 px-4 py-1.5 text-[12.5px] font-semibold text-mute transition-all hover:border-danger/50 hover:text-danger active:scale-[0.97]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded-lg bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-abyss shadow-lg shadow-brand/20 transition-all hover:bg-brandsoft active:scale-[0.97]"
              >
                {editingGroup ? "Save changes" : "Create group"}
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
              label: "Edit rack group",
              icon: <IconEdit className="h-3.5 w-3.5" size={14} />,
              onClick: () => openEdit(ctxMenu.group),
            },
            {
              label: "Delete",
              icon: <IconTrash className="h-3.5 w-3.5" size={14} />,
              danger: true,
              onClick: () => {
                setCtxMenu(null);
                setDeleteGroup(ctxMenu.group);
              },
            },
          ]}
        />
      )}

      {/* ---- Delete confirmation ---- */}
      {deleteGroup && (
        <ConfirmDialog
          title="Delete rack group"
          onConfirm={confirmDeleteGroup}
          onCancel={() => setDeleteGroup(null)}
          confirmLabel="Delete"
        >
          <p>Are you sure you want to delete <span className="font-semibold text-txt">{deleteGroup.name}</span>?</p>
          <p className="mt-1.5 text-danger">All devices in this rack group will be unracked.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
