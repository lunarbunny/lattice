import type { ReactNode } from "react";
import { IconInfo } from "./Icons";

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
  return (
    <span className="group/info relative inline-flex cursor-help items-center">
      {icon ?? (
        <IconInfo
          className={`${className} text-faint transition-colors duration-150 group-hover/info:text-brand`}
          size={size}
        />
      )}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-52 -translate-x-1/2 translate-y-1 rounded-lg border border-brand/30 bg-raised/95 p-2.5 text-[11.5px] leading-relaxed text-mute opacity-0 shadow-xl shadow-black/60 backdrop-blur transition-all duration-150 group-hover/info:translate-y-0 group-hover/info:opacity-100">
        {children}
      </span>
    </span>
  );
}
