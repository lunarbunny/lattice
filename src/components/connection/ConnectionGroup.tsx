import type { ReactNode } from "react";
import { parseCidr } from "../../lib/cidr";
import type { VlanSubConnection } from "../../lib/types";

interface ConnectionData {
  id: string;
  localPort: string;
  localIp?: string;
  remotePort: string;
  remoteIp?: string;
  vlans?: VlanSubConnection[];
  bundleId?: string;
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
  bundleProtocol?: string;
  bundleCount?: number;
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
  bundleProtocol,
  bundleCount,
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

  const hasBundle = !!bundleProtocol;

  return (
    <div className="rounded">
      {hasBundle && (
        <div className="mb-1 flex justify-center">
          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-400">
            {bundleProtocol}{bundleCount != null && bundleCount > 1 ? ` ×${bundleCount}` : ""}
          </span>
        </div>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
        <p className={`${truncateClass} font-mono text-[11.5px] leading-tight ${localNameColor}`}>{localDeviceName}</p>
        <span className="shrink-0 text-[11.5px] leading-tight text-faint">{arrow}</span>
        <p className={`${truncateClass} font-mono text-[11.5px] leading-tight font-medium text-txt text-right`}>{remoteDeviceName}</p>
      </div>
      <div className="mt-1.5 space-y-1">
        {(() => {
          const groups: { bundleId: string | null; items: ConnectionData[] }[] = [];
          for (const c of connections) {
            if (c.bundleId) {
              const existing = groups.find((g) => g.bundleId === c.bundleId);
              if (existing) existing.items.push(c);
              else groups.push({ bundleId: c.bundleId, items: [c] });
            } else {
              groups.push({ bundleId: null, items: [c] });
            }
          }
          return groups.map((group, gi) => {
            const isBundled = group.bundleId !== null && group.items.length > 1;
            const renderRowCells = (c: ConnectionData, bundlePos: "first" | "last" | "middle" | "single", isMain: boolean) => {
              const isPrimary = !!primaryIp && c.localIp === primaryIp;
              const radiusClass = bundlePos === "single" ? "rounded" : bundlePos === "first" ? "rounded-t" : bundlePos === "last" ? "rounded-b" : "";
              const barRadiusClass = bundlePos === "single" ? "rounded-full" : bundlePos === "first" ? "rounded-t" : bundlePos === "last" ? "rounded-b" : "";
              const cells = [
                showBar && barColor ? (
                  <span key={`bar-${c.id}`} className={`w-0.5 self-stretch ${barRadiusClass}`} style={{ background: barColor }} />
                ) : <div key={`bar-${c.id}`} />,
                <div key={`port-${c.id}`} className="flex"><span className={`${radiusClass} bg-brand/12 px-1.5 py-0.5 text-brand`}>{c.localPort}</span></div>,
                c.localIp ? (
                  <span key={`lip-${c.id}`} className={`${ipTruncateClass} text-[9px] ${isPrimary ? "font-semibold" : "text-faint"}`}
                    style={isPrimary ? { color: primaryColor } : undefined}>
                    {c.localIp}
                  </span>
                ) : <div key={`lip-${c.id}`} />,
                <div key={`center-${c.id}`} className="flex items-center justify-center">{groupHasL3}</div>,
                c.remoteIp ? (
                  <span key={`rip-${c.id}`} className={`${ipTruncateClass} text-[9px] text-faint text-right`}>{c.remoteIp}</span>
                ) : <div key={`rip-${c.id}`} />,
                <div key={`rport-${c.id}`} className="flex justify-end"><span className={`${radiusClass} bg-brand/12 px-1.5 py-0.5 text-brand`}>{c.remotePort}</span></div>,
              ];
              if (!isMain) return cells;
              return (
                <div key={`main-${c.id}`} className="contents cursor-pointer"
                  onMouseEnter={() => onConnectionHover?.(c.id)}
                  onMouseLeave={() => onConnectionHover?.(null)}>
                  {cells}
                </div>
              );
            };
            const renderVlanCells = (c: ConnectionData, v: VlanSubConnection) => [
              <div key={`vbar-${c.id}-${v.vlanId}`} />,
              <div key={`vbadge-${c.id}-${v.vlanId}`} className="flex justify-end"><span className="rounded bg-violet-500/12 px-1.5 py-0.5 text-violet-400">{v.vlanId}</span></div>,
              v.srcIp ? <span key={`vsip-${c.id}-${v.vlanId}`} className={`${ipTruncateClass} text-[9px] text-faint`}>{v.srcIp}</span> : <div key={`vsip-${c.id}-${v.vlanId}`} />,
              <div key={`vcenter-${c.id}-${v.vlanId}`} />,
              v.dstIp ? <span key={`vdip-${c.id}-${v.vlanId}`} className={`${ipTruncateClass} text-[9px] text-faint text-right`}>{v.dstIp}</span> : <div key={`vdip-${c.id}-${v.vlanId}`} />,
              <div key={`vvlan-${c.id}-${v.vlanId}`} className="flex justify-end"><span className="rounded bg-violet-500/12 px-1.5 py-0.5 text-violet-400">VLAN</span></div>,
            ];
            if (isBundled) {
              return (
                <div key={group.bundleId ?? gi} className="grid grid-cols-[2px_auto_1fr_auto_1fr_auto] items-center gap-x-1 gap-y-0.5 font-mono text-[10.5px]">
                  {group.items.flatMap((c, ri) => {
                    const pos = ri === 0 ? "first" : ri === group.items.length - 1 ? "last" : "middle";
                    const mainCells = renderRowCells(c, pos, true);
                    const vlanCells = c.vlans ? c.vlans.flatMap(v => renderVlanCells(c, v)) : [];
                    return [mainCells, ...vlanCells];
                  })}
                </div>
              );
            }
            return group.items.map((c) => (
              <div key={c.id} className="grid grid-cols-[2px_auto_1fr_auto_1fr_auto] items-center gap-x-1 gap-y-0.5 font-mono text-[10.5px]">
                {renderRowCells(c, "single", true)}
                {c.vlans?.flatMap(v => renderVlanCells(c, v))}
              </div>
            ));
          });
        })()}
      </div>
    </div>
  );
}
