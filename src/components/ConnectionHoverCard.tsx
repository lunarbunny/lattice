import type { Connection } from "../lib/types";

interface Props {
  connections: Connection[];
  selectedDeviceName: string;
  mouseX: number;
  mouseY: number;
}

export default function ConnectionHoverCard({ connections, selectedDeviceName, mouseX, mouseY }: Props) {
  if (connections.length === 0) return null;

  const selName = selectedDeviceName;
  const byMedium = new Map<string, Connection[]>();
  for (const c of connections) {
    const list = byMedium.get(c.medium) ?? [];
    list.push(c);
    byMedium.set(c.medium, list);
  }
  const ordered = ["fibre", "ethernet"].filter((m) => byMedium.has(m as "fibre" | "ethernet"));

  return (
    <div
      className="pointer-events-none fixed z-50 w-72 rounded-lg border border-emerald-400/30 bg-raised/95 p-3 shadow-xl shadow-black/50 backdrop-blur"
      style={{
        left: Math.min(mouseX + 16, window.innerWidth - 310),
        top: Math.min(mouseY + 14, window.innerHeight - 200),
      }}
    >
      <div className="space-y-2.5">
        {ordered.map((medium) => {
          const items = byMedium.get(medium)!;
          const groups = new Map<string, Connection[]>();
          for (const c of items) {
            const selLower = selName.toLowerCase();
            const isSrc = c.srcDevice.toLowerCase() === selLower;
            const remote = isSrc ? c.dstDevice : c.srcDevice;
            const key = remote.toLowerCase();
            const list = groups.get(key) ?? [];
            list.push(c);
            groups.set(key, list);
          }
          return (
            <div key={medium} className={medium !== ordered[0] ? "border-t border-line pt-2.5" : ""}>
              <p
                className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: medium === "fibre" ? "#FBBF24" : "#3B82F6" }}
              >
                {medium}
              </p>
              <div className="space-y-2.5">
                {[...groups.entries()].map(([remoteKey, groupConns]) => {
                  const remoteName = groupConns[0].srcDevice.toLowerCase() === selName.toLowerCase()
                    ? groupConns[0].dstDevice
                    : groupConns[0].srcDevice;
                  return (
                    <div key={remoteKey}>
                      <div className="relative flex items-center">
                        <p className="truncate font-mono text-[11.5px] font-medium text-txt">{selName}</p>
                        <span className="absolute left-1/2 -translate-x-1/2 shrink-0 px-1 text-faint text-[10px]">⟷</span>
                        <span className="flex-1" />
                        <p className="truncate font-mono text-[11.5px] font-medium text-txt">{remoteName}</p>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {groupConns.map((c) => {
                          const selLower = selName.toLowerCase();
                          const isSrc = c.srcDevice.toLowerCase() === selLower;
                          const localPort = isSrc ? c.srcPort : c.dstPort;
                          const remotePort = isSrc ? c.dstPort : c.srcPort;
                          const localIp = isSrc ? c.srcIp : c.dstIp;
                          const remoteIp = isSrc ? c.dstIp : c.srcIp;
                          return (
                            <div key={c.id} className="flex items-center gap-1 font-mono text-[10px]">
                              <span className="rounded bg-brand/12 px-1 py-0.5 text-brand">{localPort}</span>
                              {localIp && <span className="text-[8.5px] text-faint">{localIp}</span>}
                              <span className="flex-1" />
                              {remoteIp && <span className="text-[8.5px] text-faint">{remoteIp}</span>}
                              <span className="rounded bg-brand/12 px-1 py-0.5 text-brand">{remotePort}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
