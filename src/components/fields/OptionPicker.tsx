import type { ReactNode } from "react";

export function ToggleSwitch({
  checked,
  onChange,
  startIcon,
  endIcon,
}: {
  checked: boolean;
  onChange: () => void;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {startIcon}
      <button
        onClick={onChange}
        className="relative h-5 w-9 rounded-full bg-line transition-colors"
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-txt shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
      {endIcon}
    </div>
  );
}

export function SegmentedText<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-line bg-raised/80 p-0.5">
      {options.map(({ label, value: v }) => (
        <button
          key={label}
          onClick={() => onChange(v)}
          className={`rounded-md px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
            value === v ? "bg-brand/15 text-brand" : "text-faint hover:text-mute"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function SegmentedIcons<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { icon: ReactNode; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-line bg-raised/80 p-0.5">
      {options.map(({ icon, value: v }) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`rounded-md p-1 transition-colors ${
            value === v ? "bg-brand/15 text-brand" : "text-faint hover:text-mute"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
