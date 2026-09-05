import { useMemo } from "react";
import type { Connection, DeviceType } from "../../lib/types";
import { TYPE_META, TYPE_ORDER } from "../../lib/types";
import { CABLE_ETHERNET, CABLE_FIBRE, CABLE_MIXED } from "../../lib/colours";

import type { ViewMode } from "../../lib/storage";

interface LegendProps {
  connections: Connection[];
  deviceCount: number;
  presentTypes: Set<DeviceType>;
  view: ViewMode;
  rackCount: number;
  groupCount: number;
  subnetCount: number;
  sourceCount: number;
  selectedHasConnections: boolean;
}

function CableLegend({ connections, visible }: { connections: Connection[]; visible: boolean }) {
  const items = useMemo(() => {
    const pairs = new Map<string, { hasFibre: boolean; hasEth: boolean; count: number }>();
    for (const c of connections) {
      const key = [c.srcDevice.toLowerCase(), c.dstDevice.toLowerCase()].sort().join("|");
      const entry = pairs.get(key) ?? { hasFibre: false, hasEth: false, count: 0 };
      if (c.medium === "fibre") entry.hasFibre = true;
      else entry.hasEth = true;
      entry.count++;
      pairs.set(key, entry);
    }
    const result: { label: string; color: string; width: number; dash?: string }[] = [];
    const seen = new Set<string>();
    for (const [, p] of pairs) {
      const multi = p.count > 1;
      const prefix = multi ? "multi-link " : "";
      let label: string;
      let color: string;
      let dash: string | undefined;
      if (p.hasFibre && p.hasEth) {
        label = `${prefix}mixed`;
        color = CABLE_MIXED;
        dash = "4 3 2 3";
      } else if (p.hasFibre) {
        label = `${prefix}fibre`;
        color = CABLE_FIBRE;
        dash = "6 4";
      } else {
        label = `${prefix}ethernet`;
        color = CABLE_ETHERNET;
      }
      const key = label;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ label, color, width: multi ? 3.5 : 1.5, dash });
    }
    return result;
  }, [connections]);

  if (!visible || items.length === 0) return null;

  return (
    <div className="pointer-events-auto rounded-xl border border-line bg-deep/85 px-3.5 py-3 shadow-lg shadow-black/20 backdrop-blur">
      <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint">cables</p>
      <div className="flex flex-col gap-y-1.5">
        {items.map((item) => (
          <span key={item.label} className="flex items-center gap-2 text-[11px] text-mute">
            <svg width="28" height="6" className="shrink-0">
              <line
                x1="0" y1="3" x2="28" y2="3"
                stroke={item.color}
                strokeWidth={item.width}
                strokeDasharray={item.dash}
              />
            </svg>
            <span className="capitalize">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Legend({
  connections, deviceCount, presentTypes, view,
  rackCount, groupCount, subnetCount, sourceCount,
  selectedHasConnections,
}: LegendProps) {
  const chips = view === "rack"
    ? [
        { n: deviceCount, label: deviceCount === 1 ? "device" : "devices" },
        { n: rackCount, label: rackCount === 1 ? "rack" : "racks" },
        { n: groupCount, label: groupCount === 1 ? "group" : "groups" },
      ]
    : [
        { n: deviceCount, label: deviceCount === 1 ? "device" : "devices" },
        { n: subnetCount, label: subnetCount === 1 ? "subnet" : "subnets" },
        { n: sourceCount, label: sourceCount === 1 ? "source" : "sources" },
      ];

  const types = TYPE_ORDER.filter((t) => presentTypes.has(t));

  return (
    <>
      {view !== "network" && (
        <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap items-start gap-2">
          {chips.map((c) => (
            <span
              key={c.label}
              className="rounded-full border border-line bg-deep/85 px-3 py-1.5 font-mono text-[11px] text-mute shadow-lg shadow-black/20 backdrop-blur"
            >
              <span className="font-semibold text-txt">{c.n}</span> {c.label}
            </span>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 hidden flex-col gap-2 sm:flex">
        <CableLegend connections={connections} visible={selectedHasConnections && view === "rack"} />
        {view !== "network" && (
          <div className="pointer-events-auto rounded-xl border border-line bg-deep/85 px-3.5 py-3 shadow-lg shadow-black/20 backdrop-blur">
            <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint">node types</p>
            <div className="flex flex-col gap-y-1.5">
              {types.map((t) => (
                <span key={t} className="flex items-center gap-2 text-[11px] text-mute">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: TYPE_META[t].color }}
                  />
                  {TYPE_META[t].label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
