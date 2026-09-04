import { useMemo, useState } from "react";
import { useDatastore } from "../../store";
import type { PortTemplate } from "../../lib/types";
import { expandPorts } from "../../lib/ports";
import ConfirmDialog from "../ConfirmDialog";
import PortTemplateEditModal from "./PortTemplateEditModal";
import { IconEdit, IconTrash } from "../Icons";

interface TemplateManagerProps {
  onNewTemplate: () => void;
}

export default function TemplateManager({ onNewTemplate }: TemplateManagerProps) {
  const { portTemplates, devices, removePortTemplate } = useDatastore();
  const [showModal, setShowModal] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PortTemplate | null>(null);

  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of devices) {
      if (d.portTemplate) map.set(d.portTemplate, (map.get(d.portTemplate) ?? 0) + 1);
    }
    return map;
  }, [devices]);

  const openEdit = (name: string) => { setEditingName(name); setShowModal(true); };

  if (portTemplates.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-line bg-surface/40 p-4 text-center">
        <div>
          <p className="text-[13px] text-mute">No port templates yet.</p>
          <button
            onClick={onNewTemplate}
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
          Port templates
          <span className="ml-1.5 text-brand">{portTemplates.length}</span>
        </p>
        <button
          onClick={onNewTemplate}
          className="rounded-md p-1 text-faint transition-colors hover:bg-brand/10 hover:text-brand"
          title="New template"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        <div className="space-y-0.5">
          {portTemplates.map((t) => {
            const used = usage.get(t.name) ?? 0;
            const portCount = expandPorts(t.ports).length;
            return (
              <div
                key={t.name}
                className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-raised/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-txt">{t.name}</p>
                  <p className="truncate font-mono text-[10px] text-faint">
                    {portCount} ports · {used} device{used === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(t.name)}
                    title="Edit template"
                    className="rounded-md p-1 text-faint transition-colors hover:bg-brand/10 hover:text-brand"
                  >
                    <IconEdit className="h-3 w-3" size={12} />
                  </button>
                  <button
                    onClick={used > 0 ? undefined : () => setDeleting(t)}
                    disabled={used > 0}
                    title={used > 0 ? `Used by ${used} device${used === 1 ? "" : "s"} — unassign it first` : "Delete template"}
                    className={`rounded-md p-1 transition-colors ${
                      used > 0
                        ? "cursor-not-allowed text-faint/30"
                        : "text-danger/60 hover:bg-danger/15 hover:text-danger"
                    }`}
                  >
                    <IconTrash className="h-3 w-3" size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <PortTemplateEditModal
          key={editingName ?? "new"}
          editName={editingName ?? undefined}
          onClose={() => { setShowModal(false); setEditingName(null); }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete port template"
          confirmLabel="Delete"
          onConfirm={() => {
            removePortTemplate(deleting.name);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        >
          <p>Are you sure you want to delete <span className="font-semibold text-txt">{deleting.name}</span>?</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
