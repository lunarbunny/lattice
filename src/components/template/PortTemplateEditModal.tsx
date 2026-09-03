import { useMemo, useState } from "react";
import { useDatastore } from "../../store";
import { useToast } from "../Toast";
import { expandPorts } from "../../lib/ports";
import { IconX } from "../Icons";

interface Props {
  /** Template name to edit. Omit to create a new template. */
  editName?: string;
  onClose: () => void;
}

export default function PortTemplateEditModal({ editName, onClose }: Props) {
  const { portTemplates, addPortTemplate, updatePortTemplate } = useDatastore();
  const { push } = useToast();
  const editing = editName ? portTemplates.find((t) => t.name === editName) : undefined;

  const [name, setName] = useState(editing?.name ?? "");
  const [portsText, setPortsText] = useState((editing?.ports ?? []).join("\n"));

  const specs = useMemo(
    () => portsText.split("\n").map((l) => l.trim()).filter(Boolean),
    [portsText],
  );
  const expanded = useMemo(() => expandPorts(specs), [specs]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) { push("error", "Name is required"); return; }
    const clash = portTemplates.some(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase() && t.name !== editName
    );
    if (clash) { push("error", `A template named "${trimmed}" already exists`); return; }
    if (specs.length === 0) { push("error", "Add at least one port entry"); return; }

    if (editing) updatePortTemplate(editing.name, { name: trimmed, ports: specs });
    else addPortTemplate({ name: trimmed, ports: specs });
    push("success", editing ? `Updated ${trimmed}` : `Added ${trimmed}`);
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
            {editing ? "Edit port template" : "New port template"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-txt"
          >
            <IconX className="h-4 w-4" size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">name</label>
            <input
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. catalyst-48"
              autoFocus
            />
          </div>

          <div>
            <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">ports</label>
            <textarea
              rows={4}
              className="mt-1.5 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[12.5px] text-txt outline-none transition-colors focus:border-brand/60"
              value={portsText}
              onChange={(e) => setPortsText(e.target.value)}
              placeholder={"G1/0/{1-48}\nM{1-2}_P{1-24}\nmgmt0"}
            />
            <p className="mt-1.5 text-[11px] leading-snug text-faint">
              One entry per line. <span className="font-mono">{"{start-end}"}</span> expands as a range —
              e.g. <span className="font-mono">G1/0/{"{1-48}"}</span>.
            </p>

            {specs.length > 0 && (
              <div className="mt-2.5 rounded-lg border border-line/60 bg-deep/30 p-2.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                  expands to <span className="text-brand">{expanded.length}</span> port{expanded.length === 1 ? "" : "s"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {expanded.slice(0, 12).map((p) => (
                    <span key={p} className="rounded bg-brand/12 px-1.5 py-0.5 font-mono text-[10.5px] text-brand">
                      {p}
                    </span>
                  ))}
                  {expanded.length > 12 && (
                    <span className="px-1 py-0.5 font-mono text-[10.5px] text-faint">
                      +{expanded.length - 12} more
                    </span>
                  )}
                </div>
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
            {editing ? "Save changes" : "Create template"}
          </button>
        </div>
      </div>
    </div>
  );
}
