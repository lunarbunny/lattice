import { useMemo, useState } from "react";
import { useDevices } from "../../store";
import { useToast } from "../Toast";
import type { Device } from "../../lib/types";
import { IconX, IconPlus } from "../Icons";
import AutoCompleteInputField from "../AutoCompleteInputField";
import FormEntryList from "../FormEntryList";

interface FormEntry {
  key: string;
  id: string | null;
  units: number;
  deviceNames: string[];
}

const COMMON_SIZES = [6, 12, 16, 24, 42, 48];

let formCounter = 0;
function nextKey() {
  return `rg-${++formCounter}`;
}

interface Props {
  /** Rack group name to edit. If empty/null, creates a new group. */
  editGroupName?: string;
  onClose: () => void;
}

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

      <AutoCompleteInputField
        multiple
        value={entry.deviceNames}
        onChange={onDevicesChange}
        options={availableDevices.map((d) => d.name)}
      />
    </>
  );
}

export default function RackGroupEditModal({ editGroupName, onClose }: Props) {
  const { racks, devices, addRack, updateRack, removeRack, updateDevice } = useDevices();
  const { push } = useToast();

  const isEditing = !!editGroupName;

  const [groupName, setGroupName] = useState(editGroupName ?? "");
  const [entries, setEntries] = useState<FormEntry[]>(() => {
    if (editGroupName) {
      const groupRacks = racks
        .filter((r) => r.name === editGroupName)
        .sort((a, b) => {
          const na = a.number ?? "";
          const nb = b.number ?? "";
          return na.localeCompare(nb, undefined, { numeric: true });
        });
      return groupRacks.map((r) => ({
        key: r.id,
        id: r.id,
        units: r.units,
        deviceNames: devices
          .filter((d) => d.rackId === r.id)
          .map((d) => d.name),
      }));
    }
    return [{ key: nextKey(), id: null, units: 42, deviceNames: [] }];
  });

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

  const addEntry = () => {
    setEntries((prev) => [...prev, { key: nextKey(), id: null, units: 42, deviceNames: [] }]);
  };

  const removeEntry = (key: string) => {
    setEntries((prev) => prev.filter((e) => e.key !== key));
  };

  const updateEntryUnits = (key: string, units: number) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, units } : e)));
  };

  const updateEntryDevices = (key: string, deviceNames: string[]) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, deviceNames } : e)));
  };

  const handleSave = () => {
    const name = groupName.trim();
    if (!name) { push("error", "Group name is required"); return; }
    if (entries.length === 0) { push("error", "Add at least one rack"); return; }

    const createdRackIds: string[] = [];

    if (!isEditing) {
      for (let i = 0; i < entries.length; i++) {
        const r = addRack({ name, units: entries[i].units, number: String(i + 1) });
        createdRackIds.push(r.id);
      }
    } else {
      const originalRacks = racks.filter((r) => r.name === editGroupName);
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

    const rackIdsForEntries: string[] = [];
    let createdIdx = 0;
    for (const e of entries) {
      if (e.id) {
        rackIdsForEntries.push(e.id);
      } else {
        rackIdsForEntries.push(createdRackIds[createdIdx++]);
      }
    }

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
    push("success", isEditing ? `Updated "${name}"${deviceMsg}` : `Created "${name}" with ${entries.length} rack${entries.length === 1 ? "" : "s"}${deviceMsg}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-line bg-deep shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-display text-base font-bold text-txt">
            {isEditing ? `Edit "${editGroupName}"` : "New rack group"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-txt"
          >
            <IconX className="h-4 w-4" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
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

          <div className="mt-5">
            <FormEntryList
              label="racks"
              addLabel="add rack"
              onAdd={addEntry}
              entries={entries}
              onRemove={removeEntry}
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

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">
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
            {isEditing ? "Save changes" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}
