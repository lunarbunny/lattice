import type { Connection, Device, RackDecl } from "./types";
import { parseCidr } from "./cidr";

export interface ImportSummary {
  added: Device[];
  racksAdded: RackDecl[];
  connectionsAdded: Connection[];
  duplicates: number;
  invalid: string[];
  /** Non-fatal field problems that were ignored */
  warnings: string[];
}

export function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function rackKey(name: string, number?: string): string {
  return `${name}#${number ?? ""}`;
}

/** Resolve the rack declaration a device refers to via its rackId. */
export function resolveRack(device: Device, decls: RackDecl[]): RackDecl | null {
  if (device.rackId) {
    const byId = decls.find((r) => r.id === device.rackId);
    if (byId) return byId;
  }
  return null;
}

function optionalInt(
  value: unknown,
  field: string,
  name: string,
  warnings: string[]
): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1) return n;
  warnings.push(`"${name}": ${field} must be an integer ≥ 1 — ignored`);
  return undefined;
}

/** Parse and validate the `racks` declarations of the import file. */
function parseRackDecls(raw: unknown, warnings: string[]): RackDecl[] {
  if (!Array.isArray(raw)) {
    if (raw != null) warnings.push("racks must be an array — ignored");
    return [];
  }
  const decls: RackDecl[] = [];
  const seen = new Set<string>();
  raw.forEach((entry, i) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      warnings.push(`racks[${i}] is not an object — ignored`);
      return;
    }
    const obj = entry as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id.trim() : "";
    if (!id) {
      warnings.push(`racks[${i}] is missing "id" — ignored`);
      return;
    }
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    if (!name) {
      warnings.push(`racks[${i}] ("${id}") is missing "name" — ignored`);
      return;
    }
    let number: string | undefined;
    if (typeof obj.number === "string") {
      if (obj.number.trim()) number = obj.number.trim();
    } else if (typeof obj.number === "number" && Number.isFinite(obj.number)) {
      number = String(obj.number);
    } else if (obj.number != null) {
      warnings.push(`"${id}": number must be a string — ignored`);
    }
    const u = Number(obj.units);
    const units = Number.isInteger(u) && u >= 1 ? u : 12;
    if (!(Number.isInteger(u) && u >= 1))
      warnings.push(`"${id}": units must be an integer ≥ 1 — defaulting to 12`);
    if (seen.has(id)) {
      warnings.push(`racks[${i}]: duplicate id "${id}" — ignored`);
      return;
    }
    seen.add(id);
    decls.push({ id, name, number, units });
  });
  return decls;
}

/** Parse and validate the `connections` array of the import file. */
function parseConnections(raw: unknown, deviceNames: Set<string>, warnings: string[]): Connection[] {
  if (!Array.isArray(raw)) {
    if (raw != null) warnings.push("connections must be an array — ignored");
    return [];
  }
  const conns: Connection[] = [];
  raw.forEach((entry, i) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      warnings.push(`connections[${i}] is not an object — ignored`);
      return;
    }
    const obj = entry as Record<string, unknown>;
    const srcDevice = typeof obj.srcDevice === "string" ? obj.srcDevice.trim() : "";
    const dstDevice = typeof obj.dstDevice === "string" ? obj.dstDevice.trim() : "";
    if (!srcDevice || !dstDevice) {
      warnings.push(`connections[${i}]: srcDevice and dstDevice are required — ignored`);
      return;
    }
    if (!deviceNames.has(srcDevice.toLowerCase())) {
      warnings.push(`connections[${i}]: srcDevice "${srcDevice}" does not match any device — ignored`);
      return;
    }
    if (!deviceNames.has(dstDevice.toLowerCase())) {
      warnings.push(`connections[${i}]: dstDevice "${dstDevice}" does not match any device — ignored`);
      return;
    }
    const srcPort = typeof obj.srcPort === "string" ? obj.srcPort.trim() : "";
    const dstPort = typeof obj.dstPort === "string" ? obj.dstPort.trim() : "";
    if (!srcPort || !dstPort) {
      warnings.push(`connections[${i}]: srcPort and dstPort are required — ignored`);
      return;
    }
    const mediumRaw = typeof obj.medium === "string" ? obj.medium.trim().toLowerCase() : "ethernet";
    const medium: Connection["medium"] = mediumRaw === "fibre" || mediumRaw === "fiber" ? "fibre" : "ethernet";
    conns.push({ id: makeId(), srcDevice, dstDevice, srcPort, dstPort, medium });
  });
  return conns;
}

/**
 * Validate an imported JSON payload.
 * Expected shape:
 * {
 *   racks:       [{ id, name, number?, units }],
 *   devices:     [{ name, ip, notes?, model?, rackId?, mountIndex?, size? }],
 *   connections: [{ srcDevice, dstDevice, srcPort, dstPort, medium? }]
 * }
 * A bare array is still accepted as a devices-only payload.
 */
export function parseImportPayload(
  text: string,
  source: string,
  existing: Device[],
  existingRacks: RackDecl[] = []
): { error?: string; summary?: ImportSummary } {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    return {
      error: `Invalid JSON — ${e instanceof Error ? e.message : "could not parse file"}`,
    };
  }

  const warnings: string[] = [];
  let rackDecls: RackDecl[] = [];
  let deviceList: unknown;
  let connectionsRaw: unknown;

  if (Array.isArray(payload)) {
    warnings.push("Legacy payload: expected { racks, devices } — treated as devices-only");
    deviceList = payload;
  } else if (typeof payload === "object" && payload !== null) {
    const root = payload as Record<string, unknown>;
    rackDecls = parseRackDecls(root.racks, warnings);
    deviceList = root.devices;
    connectionsRaw = root.connections;
    if (!Array.isArray(deviceList)) {
      return {
        error: "Unexpected format — \"devices\" must be an array of device objects.",
      };
    }
  } else {
    return {
      error: "Unexpected format — expected { racks, devices } with a devices array.",
    };
  }
  if (!Array.isArray(deviceList)) deviceList = [];

  const knownRackIds = new Set<string>([
    ...existingRacks.map((r) => r.id),
    ...rackDecls.map((r) => r.id),
  ]);
  // Merge new declarations over existing ones (same id → newer wins).
  const mergedDecls = [...existingRacks];
  for (const r of rackDecls) {
    const i = mergedDecls.findIndex((e) => e.id === r.id);
    if (i >= 0) mergedDecls[i] = r;
    else mergedDecls.push(r);
  }

  const seen = new Set(
    existing.map((d) => `${d.name.trim().toLowerCase()}|${d.ip.replace(/\s+/g, "")}`)
  );
  const added: Device[] = [];
  const invalid: string[] = [];
  let duplicates = 0;
  const now = Date.now();

  (deviceList as unknown[]).forEach((entry, i) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      invalid.push(`entry #${i + 1} is not an object`);
      return;
    }
    const obj = entry as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const ip = typeof obj.ip === "string" ? obj.ip.trim() : "";
    if (!name) {
      invalid.push(`entry #${i + 1} is missing "name"`);
      return;
    }
    if (!ip) {
      invalid.push(`"${name}" is missing "ip"`);
      return;
    }
    const cidr = parseCidr(ip);
    if (!cidr) {
      invalid.push(`"${name}": "${ip}" is not valid IPv4 CIDR`);
      return;
    }
    const normIp = `${cidr.ip}/${cidr.prefix}`;
    const key = `${name.toLowerCase()}|${normIp}`;
    if (seen.has(key)) {
      duplicates++;
      return;
    }
    seen.add(key);

    // Rack reference — must point at a declared rack id (this file or already registered).
    let rackId: string | undefined;
    if (typeof obj.rackId === "string") {
      const trimmed = obj.rackId.trim();
      if (trimmed) {
        if (knownRackIds.has(trimmed)) rackId = trimmed;
        else warnings.push(`"${name}": rackId "${trimmed}" does not match any declared rack`);
      }
    } else if (obj.rackId != null) {
      warnings.push(`"${name}": rackId must be a string — ignored`);
    }
    if (obj.rackName != null || obj.rackNumber != null) {
      warnings.push(
        `"${name}": rackName/rackNumber are no longer supported — link the device with "rackId" instead`
      );
    }

    // model: secondary metadata, treated like notes
    let model: string | undefined;
    if (typeof obj.model === "string") {
      if (obj.model.trim()) model = obj.model.trim();
    } else if (obj.model != null) {
      warnings.push(`"${name}": model must be a string — ignored`);
    }

    const mountIndex = optionalInt(obj.mountIndex, "mountIndex", name, warnings);

    // size: how many U the device occupies, defaults to 1
    let size = 1;
    if (obj.size != null && obj.size !== "") {
      const n = Number(obj.size);
      if (Number.isInteger(n) && n >= 1) size = n;
      else warnings.push(`"${name}": size must be an integer ≥ 1 — defaulting to 1U`);
    }

    added.push({
      id: makeId(),
      name,
      ip: normIp,
      notes:
        typeof obj.notes === "string"
          ? obj.notes
          : obj.notes == null
            ? ""
            : String(obj.notes),
      model,
      rackId,
      mountIndex,
      size,
      isGateway: obj.isGateway === true ? true : undefined,
      source,
      importedAt: now,
    });
  });

  const deviceNames = new Set<string>([
    ...existing.map((d) => d.name.trim().toLowerCase()),
    ...added.map((d) => d.name.trim().toLowerCase()),
  ]);
  const connectionsAdded = parseConnections(connectionsRaw, deviceNames, warnings);

  return { summary: { added, racksAdded: rackDecls, connectionsAdded, duplicates, invalid, warnings } };
}
