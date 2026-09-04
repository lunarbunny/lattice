import { useMemo, useState } from "react";
import { useDatastore } from "../../store";
import { useToast } from "../Toast";
import type { Rack } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";
import ContextMenu from "../ContextMenu";
import RackGroupEditModal from "../rack/RackGroupEditModal";
import { IconEdit, IconTrash } from "../Icons";
import { TEXT_TERTIARY, TEXT_EMPTY_SLOT } from "../../lib/colours";

interface RackGroup {
  name: string;
  racks: Rack[];
}

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
    <svg viewBox={`0 0 ${vw} ${vh}`} className="h-full w-full" aria-hidden="true">
      <rect x={frameX} y={frameY} width={frameW} height={frameH} rx="1.5" fill="none" stroke={TEXT_TERTIARY} strokeWidth="2" />
      {Array.from({ length: numDividers }, (_, i) => {
        const y = frameY + ((i + 1) / (numDividers + 1)) * frameH;
        return <line key={i} x1={frameX + 3} y1={y} x2={frameX + frameW - 3} y2={y} stroke={TEXT_EMPTY_SLOT} strokeWidth="0.6" />;
      })}
      <rect x={frameX + 2} y={frameY + frameH + 2} width={footW} height={footH} rx="1" fill={TEXT_TERTIARY} />
      <rect x={frameX + frameW - footW - 2} y={frameY + frameH + 2} width={footW} height={footH} rx="1" fill={TEXT_TERTIARY} />
    </svg>
  );
}

interface RackManagerProps {
  onNewGroup: () => void;
}

export default function RackManager({ onNewGroup }: RackManagerProps) {
  const { racks, devices, removeRack, updateDevice } = useDatastore();
  const { push } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RackGroup | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; group: RackGroup } | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<RackGroup | null>(null);

  const groups = useMemo(() => groupRacks(racks), [racks]);

  const openEdit = (group: RackGroup) => { setEditingGroup(group); setShowModal(true); };

  const confirmDeleteGroup = () => {
    if (!deleteGroup) return;
    const rackIds = new Set(deleteGroup.racks.map((r) => r.id));
    for (const d of devices) {
      if (d.rackId && rackIds.has(d.rackId)) {
        updateDevice(d.id, { rackId: undefined, mountIndex: undefined });
      }
    }
    for (const r of deleteGroup.racks) {
      removeRack(r.id);
    }
    push("success", `Removed "${deleteGroup.name}"`);
    setDeleteGroup(null);
  };

  if (groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-line bg-surface/40 p-4 text-center">
        <div>
          <p className="text-[13px] text-mute">No rack groups yet.</p>
          <button
            onClick={onNewGroup}
            className="mt-2 text-[12px] font-semibold text-brand transition-colors hover:text-brandsoft"
          >
            Create one →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          Rack groups
          <span className="ml-1.5 text-brand">{groups.length}</span>
        </p>
        <button
          onClick={onNewGroup}
          className="rounded-md p-1 text-faint transition-colors hover:bg-brand/10 hover:text-brand"
          title="New rack group"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
          {groups.map((group) => {
            const totalU = group.racks.reduce((sum, r) => sum + r.units, 0);
            return (
              <div
                key={group.name}
                className="flex flex-col items-center rounded-lg border border-line bg-surface/60 px-2 pt-2 pb-1.5 transition-all hover:border-brand/30 hover:bg-raised/50"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, group });
                }}
              >
                <div className="aspect-[3/5] w-full max-h-[120px]">
                  <RackVisual units={group.racks[0]?.units ?? 42} />
                </div>
                <p className="mt-1 text-center text-[11px] font-semibold text-txt leading-tight truncate w-full">
                  {group.name}
                </p>
                <p className="font-mono text-[9px] text-faint">
                  {group.racks.length} rack{group.racks.length === 1 ? "" : "s"} · {totalU}U
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <RackGroupEditModal
          key={editingGroup ? editingGroup.name : "new"}
          editGroupName={editingGroup?.name}
          onClose={() => { setShowModal(false); setEditingGroup(null); }}
        />
      )}

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
    </div>
  );
}
