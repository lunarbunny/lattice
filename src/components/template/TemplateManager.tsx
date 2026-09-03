import { useMemo, useState } from "react";
import { useDatastore } from "../../store";
import type { PortTemplate } from "../../lib/types";
import { expandPorts } from "../../lib/ports";
import ConfirmDialog from "../ConfirmDialog";
import PortTemplateEditModal from "./PortTemplateEditModal";
import { IconEdit, IconPlus, IconTrash } from "../Icons";

export default function TemplateManager() {
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

  const openNew = () => { setEditingName(null); setShowModal(true); };
  const openEdit = (name: string) => { setEditingName(name); setShowModal(true); };

  return (
    <section>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-brand" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1.5" y="3.5" width="13" height="9" rx="1.2" />
            <path d="M4.5 6.5h1.5M8 6.5h1.5M11.5 6.5H13M4.5 9.5h1.5M8 9.5h1.5M11.5 9.5H13" />
          </svg>
          <h2 className="font-display text-lg font-bold text-txt">Port templates</h2>
          <span className="font-mono text-[11px] text-faint">
            {portTemplates.length} template{portTemplates.length === 1 ? "" : "s"}
          </span>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-raised/70 px-3 py-1.5 text-[12px] font-semibold text-txt transition-all hover:border-brand/50 hover:bg-brand/10 hover:text-brand active:scale-[0.97]"
        >
          <IconPlus className="h-3.5 w-3.5" size={14} />
          New template
        </button>
      </div>

      {portTemplates.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-line bg-surface/40 px-6 py-8 text-center">
          <p className="text-[13px] text-mute">
            No port templates yet. Create one to power port pickers and bulk cable creation.
          </p>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {portTemplates.map((t, idx) => {
            const used = usage.get(t.name) ?? 0;
            return (
              <div
                key={t.name}
                className="rise rounded-xl border border-line bg-surface/60 px-3.5 py-3 transition-all hover:border-brand/30 hover:bg-raised/50"
                style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-[13px] font-semibold text-txt">{t.name}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => openEdit(t.name)}
                      title="Edit template"
                      className="rounded-md p-1 text-faint transition-colors hover:bg-brand/10 hover:text-brand"
                    >
                      <IconEdit className="h-3.5 w-3.5" size={14} />
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
                      <IconTrash className="h-3.5 w-3.5" size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 truncate font-mono text-[10.5px] text-faint" title={t.ports.join("\n")}>
                  {t.ports.join("  ")}
                </p>
                <p className="mt-2 font-mono text-[10.5px] text-mute">
                  <span className="text-brand">{expandPorts(t.ports).length}</span> ports ·{" "}
                  {used} device{used === 1 ? "" : "s"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Create / edit modal ---- */}
      {showModal && (
        <PortTemplateEditModal
          key={editingName ?? "new"}
          editName={editingName ?? undefined}
          onClose={() => { setShowModal(false); setEditingName(null); }}
        />
      )}

      {/* ---- Delete confirmation ---- */}
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
    </section>
  );
}
