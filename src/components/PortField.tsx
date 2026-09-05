import { useState, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

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
  const [query, setQuery] = useState("");
  const anchorRef = useRef<HTMLDivElement>(null);
  const [portalRect, setPortalRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const updatePortalPosition = useCallback(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPortalRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, []);

  useLayoutEffect(() => {
    if (open) updatePortalPosition();
  }, [open, updatePortalPosition]);

  const input = (
    <input
      className="mt-0 h-8 w-full rounded-lg border border-line bg-surface px-2.5 font-mono text-[12px] text-txt outline-none transition-colors focus:border-brand/60"
      value={query || value}
      placeholder={placeholder}
      onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
      onFocus={() => { setQuery(""); setOpen(true); }}
      onBlur={() => setTimeout(() => { setOpen(false); setQuery(""); }, 150)}
    />
  );

  if (!suggestions || suggestions.length === 0) return input;

  const filter = query.trim().toLowerCase();
  const filtered = suggestions
    .filter((s) => !filter || s.toLowerCase().includes(filter))
    .slice(0, 50);

  return (
    <div ref={anchorRef} className="relative">
      {input}
      {open && filtered.length > 0 && portalRect && createPortal(
        <div
          className="fixed z-50 max-h-40 overflow-y-auto rounded-lg border border-line bg-deep shadow-xl"
          style={{ top: portalRect.top, left: portalRect.left, width: portalRect.width }}
        >
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
                  setQuery("");
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
        </div>,
        document.body,
      )}
    </div>
  );
}
