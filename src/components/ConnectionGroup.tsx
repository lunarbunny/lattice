import type { ReactNode } from "react";
import { parseCidr } from "../lib/cidr";

interface ConnectionData {
  id: string;
  localPort: string;
  localIp?: string;
  remotePort: string;
  remoteIp?: string;
}

interface Props {
  localDeviceName: string;
  remoteDeviceName: string;
  connections: ConnectionData[];
  arrow?: string;
  centerTag?: ReactNode;
  onConnectionHover?: (connId: string | null) => void;
  showBar?: boolean;
  barColor?: string;
  primaryIp?: string;
  primaryColor?: string;
  noTruncate?: boolean;
  dimLocalName?: boolean;
}

export default function ConnectionGroup({
  localDeviceName,
  remoteDeviceName,
  connections,
  arrow = "→",
  centerTag,
  onConnectionHover,
  showBar,
  barColor,
  primaryIp,
  primaryColor,
  noTruncate,
  dimLocalName = true,
}: Props) {
  const truncateClass = noTruncate ? "" : "min-w-0 truncate";
  const ipTruncateClass = noTruncate ? "" : "min-w-0 truncate";
  const localNameColor = dimLocalName ? "text-mute" : "text-txt";
  const groupHasL3 = centerTag !== undefined ? centerTag : (connections.some((c) => {
    const a = parseCidr(c.localIp);
    const b = parseCidr(c.remoteIp);
    return !!(a && b && a.key !== b.key);
  }) ? (
    <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400">L3</span>
  ) : null);

  return (
    <div className="rounded">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
        <p className={`${truncateClass} font-mono text-[11.5px] leading-tight ${localNameColor}`}>{localDeviceName}</p>
        <span className="shrink-0 text-[11.5px] leading-tight text-faint">{arrow}</span>
        <p className={`${truncateClass} font-mono text-[11.5px] leading-tight font-medium text-txt text-right`}>{remoteDeviceName}</p>
      </div>
      <div className="mt-1.5 space-y-1">
        {connections.map((c) => {
          const isPrimary = !!primaryIp && c.localIp === primaryIp;
          return (
            <div
              key={c.id}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 font-mono text-[10.5px] cursor-pointer"
              onMouseEnter={() => onConnectionHover?.(c.id)}
              onMouseLeave={() => onConnectionHover?.(null)}
            >
              <div className={`${noTruncate ? "" : "min-w-0"} flex items-center gap-1`}>
                {showBar && barColor && (
                  <span className="shrink-0 w-0.5 self-stretch rounded-full" style={{ background: barColor }} />
                )}
                <span className="shrink-0 rounded bg-brand/12 px-1.5 py-0.5 text-brand">{c.localPort}</span>
                {c.localIp && (
                  <span
                    className={`${ipTruncateClass} text-[9px] ${isPrimary ? "font-semibold" : "text-faint"}`}
                    style={isPrimary ? { color: primaryColor } : undefined}
                  >
                    {c.localIp}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center px-1">
                {groupHasL3}
              </div>
              <div className={`${noTruncate ? "" : "min-w-0"} flex items-center gap-1 justify-end`}>
                {c.remoteIp && <span className={`${ipTruncateClass} text-[9px] text-faint`}>{c.remoteIp}</span>}
                <span className="shrink-0 rounded bg-brand/12 px-1.5 py-0.5 text-brand">{c.remotePort}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
