import type { ReactNode } from "react";

export default function ConfirmDialog({
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  danger = true,
}: {
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="relative mx-4 w-full max-w-sm rounded-xl border border-line bg-deep shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4">
          <h3 className="font-display text-base font-bold text-txt">{title}</h3>
          <div className="mt-2 text-[13px] leading-relaxed text-mute">{children}</div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-line bg-raised/70 px-4 py-1.5 text-[12.5px] font-semibold text-mute transition-all hover:border-danger/50 hover:text-danger active:scale-[0.97]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-1.5 text-[12.5px] font-semibold shadow-lg transition-all active:scale-[0.97] ${
              danger
                ? "bg-danger text-white shadow-danger/20 hover:bg-danger/90"
                : "bg-brand text-abyss shadow-brand/20 hover:bg-brandsoft"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
