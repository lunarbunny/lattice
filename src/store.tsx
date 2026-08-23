import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Connection, Device, RackDecl } from "./lib/types";
import { parseImportPayload } from "./lib/importer";
import type { ImportSummary } from "./lib/importer";
import { SAMPLE_SOURCE, generateSampleFile } from "./lib/sample";

const DEVICES_KEY = "lattice.devices.v4";
const RACKS_KEY = "lattice.racks.v3";
const CONNECTIONS_KEY = "lattice.connections.v2";

function readDevices(): Device[] {
  try {
    const raw = localStorage.getItem(DEVICES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as Record<string, unknown>[])
      .map(migrateDevice)
      .filter((d): d is Device => d !== null);
  } catch {
    return [];
  }
}

/** Normalise and migrate persisted records (drops fields removed from the schema). */
function migrateDevice(d: Record<string, unknown>): Device | null {
  if (
    typeof d.id !== "string" ||
    typeof d.name !== "string"
  )
    return null;

  const sizeNum = Number(d.size);
  const size = Number.isInteger(sizeNum) && sizeNum >= 1 ? sizeNum : 1;

  const mountNum = Number(d.mountIndex);

  return {
    id: d.id,
    name: d.name,
    notes: typeof d.notes === "string" ? d.notes : "",
    model: typeof d.model === "string" && d.model.trim() ? d.model.trim() : undefined,
    rackId: typeof d.rackId === "string" && d.rackId.trim() ? d.rackId.trim() : undefined,
    mountIndex: Number.isInteger(mountNum) && mountNum >= 1 ? mountNum : undefined,
    size,
    isGateway: d.isGateway === true ? true : undefined,
    source: typeof d.source === "string" ? d.source : "unknown",
    importedAt: Number.isFinite(Number(d.importedAt)) ? Number(d.importedAt) : Date.now(),
  };
}

function readRacks(): RackDecl[] {
  try {
    const raw = localStorage.getItem(RACKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as Record<string, unknown>[])
      .filter(
        (r) =>
          typeof r.id === "string" &&
          r.id.trim() !== "" &&
          typeof r.name === "string" &&
          r.name.trim() !== ""
      )
      .map((r) => {
        const u = Number(r.units);
        return {
          id: (r.id as string).trim(),
          name: (r.name as string).trim(),
          number:
            typeof r.number === "string" && r.number.trim() !== ""
              ? r.number.trim()
              : undefined,
          units: Number.isInteger(u) && u >= 1 ? u : 12,
        };
      });
  } catch {
    return [];
  }
}

function readConnections(): Connection[] {
  try {
    const raw = localStorage.getItem(CONNECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as Record<string, unknown>[])
      .filter(
        (c) =>
          typeof c.id === "string" &&
          typeof c.srcDevice === "string" &&
          typeof c.dstDevice === "string"
      )
      .map((c) => ({
        id: c.id as string,
        srcDevice: c.srcDevice as string,
        dstDevice: c.dstDevice as string,
        srcPort: typeof c.srcPort === "string" ? c.srcPort : "",
        dstPort: typeof c.dstPort === "string" ? c.dstPort : "",
        medium: c.medium === "fibre" ? "fibre" as const : "ethernet" as const,
        srcIp: typeof c.srcIp === "string" && c.srcIp.trim() ? c.srcIp.trim() : undefined,
        dstIp: typeof c.dstIp === "string" && c.dstIp.trim() ? c.dstIp.trim() : undefined,
        srcIsPrimary: c.srcIsPrimary === true ? true : undefined,
        dstIsPrimary: c.dstIsPrimary === true ? true : undefined,
      }));
  } catch {
    return [];
  }
}

interface DevicesCtx {
  devices: Device[];
  racks: RackDecl[];
  connections: Connection[];
  importText: (
    text: string,
    source: string
  ) => { error?: string; summary?: ImportSummary };
  loadSample: () => { error?: string; summary?: ImportSummary };
  removeDevice: (id: string) => void;
  updateDevice: (id: string, updates: Partial<Device>) => void;
  clearAll: () => void;
}

const Ctx = createContext<DevicesCtx | null>(null);

export function useDevices(): DevicesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDevices must be used inside <DevicesProvider>");
  return ctx;
}

export function DevicesProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<Device[]>(readDevices);
  const [racks, setRacks] = useState<RackDecl[]>(readRacks);
  const [connections, setConnections] = useState<Connection[]>(readConnections);

  useEffect(() => {
    try { localStorage.setItem(DEVICES_KEY, JSON.stringify(devices)); } catch { /* */ }
  }, [devices]);

  useEffect(() => {
    try { localStorage.setItem(RACKS_KEY, JSON.stringify(racks)); } catch { /* */ }
  }, [racks]);

  useEffect(() => {
    try { localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(connections)); } catch { /* */ }
  }, [connections]);

  const applySummary = useCallback((s: ImportSummary) => {
    if (s.racksAdded.length > 0) {
      setRacks((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        for (const r of s.racksAdded) map.set(r.id, r);
        return [...map.values()];
      });
    }
    if (s.added.length > 0) setDevices((prev) => [...prev, ...s.added]);
    if (s.connectionsAdded.length > 0) setConnections((prev) => [...prev, ...s.connectionsAdded]);
  }, []);

  const value = useMemo<DevicesCtx>(
    () => ({
      devices,
      racks,
      connections,
      importText: (text, source) => {
        const res = parseImportPayload(text, source, devices, racks);
        if (res.error || !res.summary) return { error: res.error ?? "Import failed" };
        applySummary(res.summary);
        return res;
      },
      loadSample: () => {
        const json = JSON.stringify(generateSampleFile(), null, 2);
        const res = parseImportPayload(json, SAMPLE_SOURCE, devices, racks);
        if (res.error || !res.summary) return { error: res.error ?? "Import failed" };
        applySummary(res.summary);
        return res;
      },
      removeDevice: (id) => {
        setDevices((prev) => prev.filter((d) => d.id !== id));
        setConnections((prev) => prev.filter((c) => {
          const dev = devices.find((d) => d.id === id);
          if (!dev) return true;
          return c.srcDevice !== dev.name && c.dstDevice !== dev.name;
        }));
      },
      updateDevice: (id, updates) => {
        setDevices((prev) => prev.map((d) => d.id === id ? { ...d, ...updates } : d));
      },
      clearAll: () => {
        setDevices([]);
        setRacks([]);
        setConnections([]);
      },
    }),
    [devices, racks, connections, applySummary]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
