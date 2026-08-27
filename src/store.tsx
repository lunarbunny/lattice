import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Connection, Device, Rack } from "./lib/types";
import { parseImportPayload } from "./lib/importer";
import type { ImportSummary } from "./lib/importer";
import { getSample } from "./lib/sample";

function uid(): string {
  return crypto.randomUUID();
}

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

function readRacks(): Rack[] {
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

interface PreviewData {
  devices: Device[];
  racks: Rack[];
  connections: Connection[];
  sampleName: string;
}

interface DatastoreCtx {
  devices: Device[];
  racks: Rack[];
  connections: Connection[];
  isPreview: boolean;
  previewName: string | null;
  importText: (
    text: string,
    source: string
  ) => { error?: string; summary?: ImportSummary };
  enterPreview: (sampleId: string) => { error?: string; summary?: ImportSummary };
  exitPreview: () => void;
  removeDevice: (id: string) => void;
  updateDevice: (id: string, updates: Partial<Device>) => void;
  clearAll: () => void;
  addRack: (rack: Omit<Rack, "id">) => Rack;
  updateRack: (id: string, updates: Partial<Rack>) => void;
  removeRack: (id: string) => void;
  addDevice: (device: Omit<Device, "id" | "source" | "importedAt">) => Device;
  addConnection: (conn: Omit<Connection, "id">) => Connection;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  removeConnection: (id: string) => void;
}

const Ctx = createContext<DatastoreCtx | null>(null);

export function useDatastore(): DatastoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDatastore must be used inside <DatastoreProvider>");
  return ctx;
}

export function DatastoreProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<Device[]>(readDevices);
  const [racks, setRacks] = useState<Rack[]>(readRacks);
  const [connections, setConnections] = useState<Connection[]>(readConnections);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  useEffect(() => {
    if (preview) return;
    try { localStorage.setItem(DEVICES_KEY, JSON.stringify(devices)); } catch { /* */ }
  }, [devices, preview]);

  useEffect(() => {
    if (preview) return;
    try { localStorage.setItem(RACKS_KEY, JSON.stringify(racks)); } catch { /* */ }
  }, [racks, preview]);

  useEffect(() => {
    if (preview) return;
    try { localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(connections)); } catch { /* */ }
  }, [connections, preview]);

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

  const value = useMemo<DatastoreCtx>(
    () => ({
      devices: preview ? preview.devices : devices,
      racks: preview ? preview.racks : racks,
      connections: preview ? preview.connections : connections,
      isPreview: preview !== null,
      previewName: preview ? preview.sampleName : null,
      importText: (text, source) => {
        const res = parseImportPayload(text, source, devices, racks);
        if (res.error || !res.summary) return { error: res.error ?? "Import failed" };
        applySummary(res.summary);
        return res;
      },
      enterPreview: (sampleId) => {
        const sample = getSample(sampleId);
        if (!sample) return { error: "Unknown sample" };
        const json = JSON.stringify(sample.data, null, 2);
        const res = parseImportPayload(json, sample.source, [], []);
        if (res.error || !res.summary) return { error: res.error ?? "Import failed" };
        setPreview({
          devices: res.summary.added,
          racks: res.summary.racksAdded,
          connections: res.summary.connectionsAdded,
          sampleName: sample.name,
        });
        return res;
      },
      exitPreview: () => {
        setPreview(null);
        setDevices(readDevices());
        setRacks(readRacks());
        setConnections(readConnections());
      },
      removeDevice: (id) => {
        const dev = devices.find((d) => d.id === id);
        setDevices((prev) => prev.filter((d) => d.id !== id));
        if (dev) {
          setConnections((prev) =>
            prev.filter((c) => c.srcDevice !== dev.name && c.dstDevice !== dev.name)
          );
        }
      },
      updateDevice: (id, updates) => {
        const dev = devices.find((d) => d.id === id);
        setDevices((prev) => prev.map((d) => d.id === id ? { ...d, ...updates } : d));
        if (dev && updates.name && updates.name !== dev.name) {
          const oldName = dev.name;
          const newName = updates.name;
          setConnections((prev) =>
            prev.map((c) => ({
              ...c,
              srcDevice: c.srcDevice === oldName ? newName : c.srcDevice,
              dstDevice: c.dstDevice === oldName ? newName : c.dstDevice,
            }))
          );
        }
      },
      clearAll: () => {
        setDevices([]);
        setRacks([]);
        setConnections([]);
      },
      addRack: (rack) => {
        const newRack: Rack = { ...rack, id: uid() };
        setRacks((prev) => [...prev, newRack]);
        return newRack;
      },
      updateRack: (id, updates) => {
        setRacks((prev) => prev.map((r) => r.id === id ? { ...r, ...updates } : r));
      },
      removeRack: (id) => {
        setRacks((prev) => prev.filter((r) => r.id !== id));
        setDevices((prev) =>
          prev.map((d) => d.rackId === id ? { ...d, rackId: undefined, mountIndex: undefined } : d)
        );
      },
      addDevice: (device) => {
        const newDevice: Device = {
          ...device,
          id: uid(),
          source: "manual",
          importedAt: Date.now(),
        };
        setDevices((prev) => [...prev, newDevice]);
        return newDevice;
      },
      addConnection: (conn) => {
        const newConn: Connection = { ...conn, id: uid() };
        setConnections((prev) => [...prev, newConn]);
        return newConn;
      },
      updateConnection: (id, updates) => {
        setConnections((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c));
      },
      removeConnection: (id) => {
        setConnections((prev) => prev.filter((c) => c.id !== id));
      },
    }),
    [devices, racks, connections, preview, applySummary]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
