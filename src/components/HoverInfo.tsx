import { useRef, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconInfo } from "./Icons";

const GAP = 8;

export default function HoverInfo({
  children,
  icon,
  className = "h-3.5 w-3.5",
  size = 14,
}: {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  size?: number;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({ top: 0, left: 0 });

  const onEnter = useCallback(() => {
    if (!triggerRef.current) return;
    const tr = triggerRef.current.getBoundingClientRect();
    const tt = tooltipRef.current;
    const ttW = tt?.offsetWidth ?? 208;
    const ttH = tt?.offsetHeight ?? 80;
    const vw = window.innerWidth;

    const centerX = tr.left + tr.width / 2;
    const clampedX = Math.min(Math.max(centerX, ttW / 2 + GAP), vw - ttW / 2 - GAP);

    const showBelow = tr.top - ttH - GAP < 0;
    const top = showBelow ? tr.bottom + GAP : tr.top - ttH - GAP;

    setStyle({ top, left: clampedX });
    setHovered(true);
  }, []);

  const onLeave = useCallback(() => setHovered(false), []);

  const defaultIcon = (
    <IconInfo
      className={`${className} text-faint transition-colors duration-150 ${hovered ? "text-brand" : ""}`}
      size={size}
    />
  );

  return (
    <span
      ref={triggerRef}
      className="inline-flex cursor-help items-center"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {icon ?? defaultIcon}
      {createPortal(
        <span
          ref={tooltipRef}
          className={`pointer-events-none fixed z-50 w-52 -translate-x-1/2 rounded-lg border border-brand/30 bg-raised/95 p-2.5 text-[11.5px] leading-relaxed text-mute shadow-lg shadow-black/30 backdrop-blur transition-all duration-150 ${
            hovered ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          }`}
          style={style}
        >
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}
