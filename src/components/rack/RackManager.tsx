import { useMemo, useState } from "react";
import { useDevices } from "../../store";
import { useToast } from "../Toast";
import type { Rack } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";
import ContextMenu from "../ContextMenu";
import RackGroupEditModal from "../rack/RackGroupEditModal";
import { IconEdit, IconPlus, IconTrash } from "../Icons";
import { TEXT_TERTIARY, TEXT_EMPTY_SLOT } from "../../lib/colours";

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                    */
/* ------------------------------------------------------------------ */

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
/*  Main RackManager                                                   */
/* ------------------------------------------------------------------ */

export default function RackManager() {
  const { racks, devices, removeRack, updateDevice } = useDevices();
  const { push } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RackGroup | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; group: RackGroup } | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<RackGroup | null>(null);

  const groups = useMemo(() => groupRacks(racks), [racks]);

  const openNew = () => { setEditingGroup(null); setShowModal(true); };
  const openEdit = (group: RackGroup) => { setEditingGroup(group); setShowModal(true); };

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
        <RackGroupEditModal
          key={editingGroup ? editingGroup.name : "new"}
          editGroupName={editingGroup?.name}
          onClose={() => { setShowModal(false); setEditingGroup(null); }}
        />
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
