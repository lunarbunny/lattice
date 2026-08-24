import { useRef, useLayoutEffect, useState } from "react";
import type { Connection } from "../lib/types";
import ConnectionGroup from "./ConnectionGroup";

interface Props {
  connections: Connection[];
  selectedDeviceName: string;
  mouseX: number;
  mouseY: number;
}

export default function ConnectionHoverCard({ connections, selectedDeviceName, mouseX, mouseY }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (cardRef.current) {
      const { offsetWidth, offsetHeight } = cardRef.current;
      setCardSize({ width: offsetWidth, height: offsetHeight });
    }
  }, [connections, selectedDeviceName]);

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
      ref={cardRef}
      className="pointer-events-none fixed z-50 max-w-[90vw] rounded-lg border border-emerald-400/30 bg-raised/95 p-3 shadow-xl shadow-black/50 backdrop-blur"
      style={{
        left: Math.min(mouseX + 16, window.innerWidth - cardSize.width - 20),
        top: Math.min(mouseY + 14, window.innerHeight - cardSize.height - 20),
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
                  const connData = groupConns.map((c) => {
                    const selLower = selName.toLowerCase();
                    const isSrc = c.srcDevice.toLowerCase() === selLower;
                    return {
                      id: c.id,
                      localPort: isSrc ? c.srcPort : c.dstPort,
                      localIp: isSrc ? c.srcIp : c.dstIp,
                      remotePort: isSrc ? c.dstPort : c.srcPort,
                      remoteIp: isSrc ? c.dstIp : c.srcIp,
                    };
                  });
                  return (
                    <ConnectionGroup
                      key={remoteKey}
                      localDeviceName={selName}
                      remoteDeviceName={remoteName}
                      connections={connData}
                      arrow="⟷"
                      centerTag={null}
                      noTruncate
                      dimLocalName={false}
                    />
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
