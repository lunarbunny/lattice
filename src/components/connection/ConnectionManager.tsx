import { useState } from "react";
import { createPortal } from "react-dom";
import { useDatastore } from "../../store";
import type { Connection, Device } from "../../lib/types";
import { IconEdit } from "../Icons";
import { CABLE_FIBRE, CABLE_ETHERNET } from "../../lib/colours";
import ConnectionGroup from "../connection/ConnectionGroup";
import ContextMenu from "../ContextMenu";
import ConnectionEditModal from "../connection/ConnectionEditModal";

function getLocalPort(conn: Connection, deviceName: string): string {
  return conn.srcDevice.toLowerCase() === deviceName.toLowerCase() ? conn.srcPort : conn.dstPort;
}

function getRemotePort(conn: Connection, deviceName: string): string {
  return conn.srcDevice.toLowerCase() === deviceName.toLowerCase() ? conn.dstPort : conn.srcPort;
}

function getLocalIp(conn: Connection, deviceName: string): string {
  return conn.srcDevice.toLowerCase() === deviceName.toLowerCase() ? (conn.srcIp ?? "") : (conn.dstIp ?? "");
}

function getRemoteIp(conn: Connection, deviceName: string): string {
  return conn.srcDevice.toLowerCase() === deviceName.toLowerCase() ? (conn.dstIp ?? "") : (conn.srcIp ?? "");
}

function getLocalIsPrimary(conn: Connection, deviceName: string): boolean {
  return conn.srcDevice.toLowerCase() === deviceName.toLowerCase()
    ? conn.srcIsPrimary === true
    : conn.dstIsPrimary === true;
}

function getRemote(conn: Connection, deviceName: string): string {
  return conn.srcDevice.toLowerCase() === deviceName.toLowerCase() ? conn.dstDevice : conn.srcDevice;
}

export default function ConnectionManager({ device }: { device: Device }) {
  const { connections } = useDatastore();
  const [showEditModal, setShowEditModal] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; remoteDevice: string } | null>(null);

  const deviceConns = connections.filter(
    (c) => c.srcDevice.toLowerCase() === device.name.toLowerCase() || c.dstDevice.toLowerCase() === device.name.toLowerCase()
  );

  /* ---- group by medium → remote device ---- */

  const byMedium = new Map<string, Connection[]>();
  for (const c of deviceConns) {
    const list = byMedium.get(c.medium) ?? [];
    list.push(c);
    byMedium.set(c.medium, list);
  }
  const ordered = (["fibre", "ethernet"] as const).filter((m) => byMedium.has(m));

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
          connections
          {deviceConns.length > 0 && <span className="ml-1.5 text-brand">{deviceConns.length}</span>}
        </p>
        <button
          onClick={() => setShowEditModal(true)}
          className="flex items-center gap-1 rounded-md border border-line bg-raised/50 px-2 py-0.5 text-[11px] font-semibold text-mute transition-all hover:border-brand/50 hover:text-brand active:scale-[0.97]"
        >
          <IconEdit className="h-3 w-3" size={12} />
          Edit connections
        </button>
      </div>

      {deviceConns.length === 0 ? (
        <p className="mt-1.5 text-[12px] italic text-faint">No connections yet.</p>
      ) : (
        <div className="mt-2 space-y-3">
          {ordered.map((medium) => {
            const items = byMedium.get(medium)!;
            const groups = new Map<string, Connection[]>();
            for (const c of items) {
              const remote = getRemote(c, device.name);
              const key = remote.toLowerCase();
              const list = groups.get(key) ?? [];
              list.push(c);
              groups.set(key, list);
            }

            return (
              <div key={medium} className={medium !== ordered[0] ? "border-t border-line pt-2.5" : ""}>
                <p
                  className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: medium === "fibre" ? CABLE_FIBRE : CABLE_ETHERNET }}
                >
                  {medium}
                </p>
                <div className="space-y-2.5">
                  {[...groups.entries()].map(([remoteKey, groupConns]) => {
                    const remoteName = getRemote(groupConns[0], device.name);
                    const connData = groupConns.map((c) => ({
                      id: c.id,
                      localPort: getLocalPort(c, device.name),
                      localIp: getLocalIp(c, device.name),
                      remotePort: getRemotePort(c, device.name),
                      remoteIp: getRemoteIp(c, device.name),
                    }));

                    return (
                      <div
                        key={remoteKey}
                        className="rounded-lg border border-line/40 bg-surface/30 px-2 py-2 transition-colors hover:bg-brand/8"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setCtxMenu({ x: e.clientX, y: e.clientY, remoteDevice: remoteName });
                        }}
                      >
                        <ConnectionGroup
                          localDeviceName={device.name}
                          remoteDeviceName={remoteName}
                          connections={connData}
                          arrow="⟷"
                          centerTag={null}
                          noTruncate
                          dimLocalName={false}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Edit connections modal ---- */}
      {showEditModal && (
        <ConnectionEditModal
          device={device}
          onClose={() => { setShowEditModal(false); setCtxMenu(null); }}
          filterRemoteDevice={ctxMenu?.remoteDevice}
        />
      )}

      {/* ---- Context menu ---- */}
      {ctxMenu && createPortal(
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            {
              label: "Edit device pair connections",
              icon: <IconEdit className="h-3.5 w-3.5" size={14} />,
              onClick: () => setShowEditModal(true),
            },
          ]}
        />,
        document.body,
      )}
    </div>
  );
}
