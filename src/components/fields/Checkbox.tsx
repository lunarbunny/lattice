interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}

export default function Checkbox({ checked, onChange, disabled, title, className }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
        disabled
          ? "cursor-not-allowed border-line/40 bg-surface/40"
          : checked
            ? "border-brand/60 bg-brand/20"
            : "border-line bg-surface hover:border-brand/40"
      } ${className ?? ""}`}
    >
      {checked && (
        <svg
          viewBox="0 0 10 8"
          className="h-2.5 w-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: disabled ? "var(--color-faint)" : "var(--color-brand)" }}
        >
          <path d="M1 4.5 L3.5 7 L9 1" />
        </svg>
      )}
    </button>
  );
}
