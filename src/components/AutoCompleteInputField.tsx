import { useState, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { IconX } from "./Icons";

interface SingleProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label?: string;
  placeholder?: string;
}

interface MultiProps {
  multiple: true;
  value: string[];
  onChange: (values: string[]) => void;
  options: string[];
  label?: string;
  placeholder?: string;
}

type Props = SingleProps | MultiProps;

export default function AutoCompleteInputField(props: Props) {
  const { options, label, multiple } = props;
  const placeholder = props.placeholder ?? (multiple ? "Add…" : "Select…");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
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

  const filtered = options
    .filter((o) => {
      if (multiple && props.value.includes(o)) return false;
      return o.toLowerCase().includes(query.toLowerCase());
    })
    .slice(0, 20);

  const handleSelect = (name: string) => {
    if (multiple) {
      props.onChange([...props.value, name]);
    } else {
      props.onChange(name);
    }
    setQuery("");
    setOpen(false);
  };

  const handleRemove = (name: string) => {
    if (multiple) {
      props.onChange(props.value.filter((n) => n !== name));
    }
  };

  /* ---- multi-select mode ---- */
  if (multiple) {
    const selected = props.value;
    return (
      <div ref={anchorRef} className="relative">
        {label && (
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{label}</label>
        )}
        <div
          className="mt-1 flex min-h-[34px] flex-wrap items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-brand/60"
          onClick={() => setOpen(true)}
        >
          {selected.map((name) => (
            <span
              key={name}
              className="select-none flex items-center gap-1 rounded-md bg-brand/12 px-1.5 py-0.5 text-[11px] font-medium text-brand"
              onClick={(e) => e.stopPropagation()}
            >
              {name}
              <button
                type="button"
                onClick={() => handleRemove(name)}
                className="rounded-sm transition-colors hover:text-danger"
              >
                <IconX className="h-3 w-3" size={12} />
              </button>
            </span>
          ))}
          <input
            className="min-w-[60px] flex-1 bg-transparent py-0.5 text-[12px] text-txt outline-none placeholder:text-faint"
            placeholder={selected.length > 0 ? "Add more…" : placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
        </div>
        {open && filtered.length > 0 && portalRect && createPortal(
          <div
            className="fixed z-50 max-h-40 overflow-y-auto rounded-lg border border-line bg-deep shadow-xl"
            style={{ top: portalRect.top, left: portalRect.left, width: portalRect.width }}
          >
            {filtered.map((name) => (
              <button
                key={name}
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-[12px] text-txt transition-colors hover:bg-brand/10"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(name);
                }}
              >
                {name}
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>
    );
  }

  /* ---- single-select mode ---- */
  const value = props.value;
  return (
    <div ref={anchorRef} className="relative">
      {label && (
        <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{label}</label>
      )}
      <input
        className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-txt outline-none transition-colors focus:border-brand/60"
        value={query || value}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setQuery(""); setOpen(true); }}
        onBlur={() => setTimeout(() => { setOpen(false); setQuery(""); }, 150)}
      />
      {open && filtered.length > 0 && portalRect && createPortal(
        <div
          className="fixed z-50 max-h-40 overflow-y-auto rounded-lg border border-line bg-deep shadow-xl"
          style={{ top: portalRect.top, left: portalRect.left, width: portalRect.width }}
        >
          {filtered.map((name) => (
            <button
              key={name}
              type="button"
              className="flex w-full items-center px-3 py-1.5 text-left text-[12px] text-txt transition-colors hover:bg-brand/10"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(name);
              }}
            >
              {name}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
