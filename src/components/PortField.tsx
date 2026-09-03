import { useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Port names offered as suggestions (from a port template). Free text is always allowed. */
  suggestions?: string[];
  /** Lowercase port names already occupied on this device — shown dimmed with a hint. */
  usedPorts?: Set<string>;
  placeholder?: string;
}

export default function PortField({ value, onChange, suggestions, usedPorts, placeholder }: Props) {
  const [open, setOpen] = useState(false);

  const input = (
    <input
      className="mt-0 h-8 w-full rounded-lg border border-line bg-surface px-2.5 font-mono text-[12px] text-txt outline-none transition-colors focus:border-brand/60"
      value={value}
      placeholder={placeholder}
      onChange={(e) => { onChange(e.target.value); setOpen(true); }}
      onFocus={() => setOpen(true)}
      onBlur={() => setTimeout(() => setOpen(false), 150)}
    />
  );

  if (!suggestions || suggestions.length === 0) return input;

  const query = value.trim().toLowerCase();
  const filtered = suggestions
    .filter((s) => !query || s.toLowerCase().includes(query))
    .slice(0, 50);

  return (
    <div className="relative">
      {input}
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-y-auto rounded-lg border border-line bg-deep shadow-xl">
          {filtered.map((name) => {
            const inUse = usedPorts?.has(name.toLowerCase()) ?? false;
            return (
              <button
                key={name}
                type="button"
                className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left font-mono text-[11.5px] transition-colors hover:bg-brand/10 ${
                  inUse ? "text-faint" : "text-txt"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(name);
                  setOpen(false);
                }}
              >
                <span className="truncate">{name}</span>
                {inUse && (
                  <span className="shrink-0 text-[9px] uppercase tracking-wider text-faint">in use</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
