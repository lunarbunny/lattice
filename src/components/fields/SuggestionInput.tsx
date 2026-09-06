import { useState, useRef, useCallback, useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconX, IconChevronDown } from "../Icons";

interface SingleProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
}

interface MultiProps {
  multiple: true;
  value: string[];
  onChange: (values: string[]) => void;
}

interface BaseProps {
  suggestions?: string[];
  label?: string;
  placeholder?: string;
  renderOption?: (item: { value: string; index: number }) => ReactNode;
}

type Props = (SingleProps | MultiProps) & BaseProps;

export default function SuggestionInput(props: Props) {
  const { suggestions, label, multiple, renderOption } = props;
  const placeholder = props.placeholder ?? (multiple ? "Add…" : "Select…");
  const hasSuggestions = suggestions != null && suggestions.length > 0;
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

  const filtered = (suggestions ?? []).filter((o) => {
    if (multiple && (props as MultiProps).value.includes(o)) return false;
    return o.toLowerCase().includes(query.toLowerCase());
  });

  const handleSelect = (name: string) => {
    if (multiple) {
      (props as MultiProps).onChange([...(props as MultiProps).value, name]);
    } else {
      (props as SingleProps).onChange(name);
    }
    setQuery("");
    setOpen(false);
  };

  const handleRemove = (name: string) => {
    if (multiple) {
      (props as MultiProps).onChange((props as MultiProps).value.filter((n) => n !== name));
    }
  };

  /* ---- multi-select mode ---- */
  if (multiple) {
    const selected = (props as MultiProps).value;
    return (
      <div ref={anchorRef} className="relative">
        {label && (
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{label}</label>
        )}
        <div
          className={`${label ? "mt-1" : ""} flex min-h-[34px] flex-wrap items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-brand/60`}
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
            className="min-w-[60px] flex-1 bg-transparent py-0.5 font-mono text-[12px] text-txt outline-none placeholder:text-faint"
            placeholder={selected.length > 0 ? "Add more…" : placeholder}
            value={query}
            onClick={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {hasSuggestions && (
            <IconChevronDown className="pointer-events-none shrink-0 text-faint" size={14} />
          )}
        </div>
        {open && filtered.length > 0 && portalRect && createPortal(
          <div
            className="fixed z-50 max-h-40 overflow-y-auto rounded-lg border border-line bg-deep shadow-xl"
            style={{ top: portalRect.top, left: portalRect.left, width: portalRect.width }}
          >
            {filtered.map((name, i) => (
              <button
                key={name}
                type="button"
                className={`flex w-full items-center px-3 py-1.5 text-left font-mono text-[12px] text-txt transition-colors hover:bg-brand/10 ${renderOption ? "justify-between gap-2" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(name);
                }}
              >
                {renderOption ? renderOption({ value: name, index: i }) : name}
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>
    );
  }

  /* ---- single-select mode ---- */
  const value = (props as SingleProps).value;
  return (
    <div ref={anchorRef} className="relative">
      {label && (
        <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{label}</label>
      )}
      <input
        className={`h-8 w-full rounded-lg border border-line bg-surface font-mono text-[12px] text-txt outline-none transition-colors focus:border-brand/60 ${hasSuggestions ? "pr-8 pl-2.5" : "px-2.5"}`}
        value={query || value}
        placeholder={placeholder}
        onClick={() => { setQuery(""); setOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setQuery(""); setOpen(true); }}
        onBlur={() => setTimeout(() => { setOpen(false); setQuery(""); }, 150)}
      />
      {hasSuggestions && (
        <IconChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" size={14} />
      )}
      {open && filtered.length > 0 && portalRect && createPortal(
        <div
          className="fixed z-50 max-h-40 overflow-y-auto rounded-lg border border-line bg-deep shadow-xl"
          style={{ top: portalRect.top, left: portalRect.left, width: portalRect.width }}
        >
          {filtered.map((name, i) => (
            <button
              key={name}
              type="button"
              className={`flex w-full items-center px-3 py-1.5 text-left font-mono text-[12px] text-txt transition-colors hover:bg-brand/10 ${renderOption ? "justify-between gap-2" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(name);
              }}
            >
              {renderOption ? renderOption({ value: name, index: i }) : name}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
