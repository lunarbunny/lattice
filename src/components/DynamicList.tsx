import type { ReactNode } from "react";
import { IconPlus, IconX } from "./Icons";

export default function DynamicList<T extends { key: string }>({
  label,
  addLabel,
  onAdd,
  entries,
  onRemove,
  isRemoveDisabled,
  extraActions,
  children,
}: {
  label: string;
  addLabel: string;
  onAdd: () => void;
  entries: T[];
  onRemove: (key: string) => void;
  isRemoveDisabled?: (key: string) => boolean;
  extraActions?: ReactNode;
  children: (entry: T, index: number) => ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {extraActions}
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-brand transition-colors hover:bg-brand/10"
          >
            <IconPlus className="h-3 w-3" size={12} />
            {addLabel}
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-2">
        {entries.map((entry, idx) => {
          const disabled = isRemoveDisabled?.(entry.key) ?? false;
          return (
            <div key={entry.key} className="rounded-lg border border-line/60 bg-deep/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[12px] font-semibold text-txt">
                  #{idx + 1}
                </span>
                {entries.length > 1 && (
                  <button
                    type="button"
                    onClick={disabled ? undefined : () => onRemove(entry.key)}
                    disabled={disabled}
                    className={`rounded-md p-1 transition-all ${
                      disabled
                        ? "cursor-not-allowed text-faint/30"
                        : "text-faint hover:bg-danger/15 hover:text-danger"
                    }`}
                  >
                    <IconX className="h-3.5 w-3.5" size={14} />
                  </button>
                )}
              </div>
              {children(entry, idx)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
