import { useEffect, useRef, useState } from "react";
import { useDevices } from "../store";
import { useToast } from "../components/Toast";
import { parseCidr } from "../lib/cidr";
import { inferType } from "../lib/topology";
import { resolveRack } from "../lib/importer";
import type { Device } from "../lib/types";
import { TYPE_META } from "../lib/types";
import { notifyImport, formatDate, getPrimaryIp } from "../lib/helpers";
import { navigate } from "../lib/router";
import { SAMPLE_SNIPPET } from "../lib/sample";
import {
  IconUpload,
  IconArrowLeft,
  IconTrash,
  IconChevronDown,
  IconLocate,
  IconInfo,
  IconEdit,
  IconDownload,
  IconCheck,
  IconX,
  TypeIcon,
} from "../components/Icons";

export default function DevicesPage() {
  const { devices, racks, connections, importText, removeDevice, updateDevice, clearAll } = useDevices();
  const { push } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Device>>({});
  const [showExportModal, setShowExportModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [armedClear, setArmedClear] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const disarmTimer = useRef<number | null>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    return () => {
      if (disarmTimer.current) window.clearTimeout(disarmTimer.current);
    };
  }, []);

  const armDelete = (id: string) => {
    if (armedDelete === id) {
      const d = devices.find((x) => x.id === id);
      removeDevice(id);
      setArmedDelete(null);
      push("success", `Removed ${d ? d.name : "device"} from the registry`);
      return;
    }
    setArmedDelete(id);
    if (disarmTimer.current) window.clearTimeout(disarmTimer.current);
    disarmTimer.current = window.setTimeout(() => setArmedDelete(null), 2600);
  };

  const handleClear = () => {
    if (!armedClear) {
      setArmedClear(true);
      if (disarmTimer.current) window.clearTimeout(disarmTimer.current);
      disarmTimer.current = window.setTimeout(() => setArmedClear(false), 2600);
      return;
    }
    clearAll();
    setArmedClear(false);
    push("success", "Registry cleared", "All devices and rack declarations were removed.");
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const name = (editForm.name ?? "").trim();
    if (!name) { push("error", "Name is required"); return; }
    const size = Number(editForm.size) || 1;
    const mountIndex = editForm.mountIndex != null ? Number(editForm.mountIndex) : undefined;
    updateDevice(editingId, {
      name,
      model: editForm.model?.trim() || undefined,
      notes: editForm.notes ?? "",
      rackId: editForm.rackId?.trim() || undefined,
      mountIndex: mountIndex != null && Number.isInteger(mountIndex) && mountIndex >= 1 ? mountIndex : undefined,
      size: Number.isInteger(size) && size >= 1 ? size : 1,
    });
    setEditingId(null);
    setEditForm({});
    push("success", `Updated ${name}`);
  };

  const startEdit = (d: Device) => {
    setEditingId(d.id);
    setExpandedId(d.id);
    setEditForm({
      name: d.name,
      model: d.model ?? "",
      notes: d.notes,
      rackId: d.rackId ?? "",
      mountIndex: d.mountIndex,
      size: d.size,
    });
  };

  const getExportPayload = () => ({
    racks: racks.map((r) => ({ id: r.id, name: r.name, ...(r.number ? { number: r.number } : {}), units: r.units })),
    devices: devices.map((d) => ({
      name: d.name,
      ...(d.notes ? { notes: d.notes } : {}),
      ...(d.model ? { model: d.model } : {}),
      ...(d.rackId ? { rackId: d.rackId } : {}),
      ...(d.mountIndex != null ? { mountIndex: d.mountIndex } : {}),
      ...(d.size > 1 ? { size: d.size } : {}),
    })),
    connections: connections.map((c) => ({
      srcDevice: c.srcDevice,
      dstDevice: c.dstDevice,
      srcPort: c.srcPort,
      dstPort: c.dstPort,
      medium: c.medium,
      ...(c.srcIp ? { srcIp: c.srcIp } : {}),
      ...(c.dstIp ? { dstIp: c.dstIp } : {}),
      ...(c.srcIsPrimary ? { srcIsPrimary: true } : {}),
      ...(c.dstIsPrimary ? { dstIsPrimary: true } : {}),
    })),
  });

  const getExportJson = () => JSON.stringify(getExportPayload(), null, 2);

  const handleExport = () => {
    const json = getExportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lattice-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    const json = getExportJson();
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      push("error", "Failed to copy to clipboard");
    }
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    notifyImport(importText(text, file.name), push, file.name);
  };

  return (
    <div
      className="relative h-full overflow-y-auto"
      onDragEnter={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("Files")) {
          dragDepth.current++;
          setDragActive(true);
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragActive(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void handleFile(f);
      }}
    >
      {dragActive && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand bg-surface/80 px-12 py-10">
            <IconUpload className="h-10 w-10 text-brand" size={40} strokeWidth={1.5} />
            <p className="font-display text-xl font-bold text-txt">Drop the JSON file</p>
            <p className="font-mono text-[12px] text-mute">
              <code className="text-brand">&#123; racks, devices &#125;</code> — it will be merged
              into the registry.
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        {/* header */}
        <div className="rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-brand">
              registry
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-txt">
              Devices
            </h1>
            <p className="mt-1.5 text-[13.5px] text-mute">
              {devices.length === 0
                ? "Nothing imported yet."
                : `${devices.length} device${devices.length === 1 ? "" : "s"} · ${racks.length} rack${
                    racks.length === 1 ? "" : "s"
                  }`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 rounded-lg border border-line bg-raised/70 px-4 py-2 text-[13px] font-semibold text-txt transition-all hover:border-brand/50 hover:bg-brand/10 active:scale-[0.97]"
            >
              <IconArrowLeft className="h-4 w-4" size={16} />
              Fabric
            </button>
            {devices.length > 0 && (
              <>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-2 rounded-lg border border-line bg-raised/70 px-4 py-2 text-[13px] font-semibold text-txt transition-all hover:border-brand/50 hover:bg-brand/10 active:scale-[0.97]"
                >
                  <IconDownload className="h-4 w-4" size={16} />
                  Export
                </button>
                <button
                  onClick={handleClear}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-[13px] font-semibold transition-all active:scale-[0.97] ${
                    armedClear
                      ? "border-danger/60 bg-danger/15 text-danger"
                      : "border-line bg-raised/70 text-mute hover:border-danger/50 hover:text-danger"
                  }`}
                >
                  <IconTrash className="h-4 w-4" size={16} />
                  {armedClear ? "Click again to clear" : "Clear all"}
                </button>
              </>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-abyss shadow-lg shadow-brand/20 transition-all hover:bg-brandsoft hover:shadow-brand/30 active:scale-[0.97]"
            >
              <IconUpload className="h-4 w-4" size={16} strokeWidth={2} />
              Import JSON
            </button>
          </div>
        </div>

        {/* format help */}
        <div className="mt-6">
          <button
            onClick={() => setShowFormat((s) => !s)}
            className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-faint transition-colors hover:text-brand"
          >
            <IconInfo className="h-3.5 w-3.5" size={14} />
            expected JSON format
            <IconChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${showFormat ? "rotate-180" : ""}`}
              size={14}
            />
          </button>
          {showFormat && (
            <div className="rise mt-2 overflow-hidden rounded-xl border border-line bg-surface/60">
              <pre className="overflow-x-auto px-4 py-3 font-mono text-[11.5px] leading-relaxed text-mute">
                <code>{SAMPLE_SNIPPET}</code>
              </pre>
              <div className="border-t border-line bg-deep/60">
                <div className="p-4">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-faint">
                    rules
                  </p>
                  <ul className="mt-2 space-y-1.5 text-[12.5px] leading-snug text-mute">
                    <li>
                      · root object{" "}
                      <span className="font-mono text-brand">{"{ racks, devices, connections }"}</span>
                    </li>
                    <li>
                      · racks[] — unique <span className="font-mono text-brand">id</span> +{" "}
                      <span className="font-mono text-txt">name</span> (group) ·{" "}
                      <span className="font-mono text-txt">number</span> (string) ·{" "}
                      <span className="font-mono text-txt">units</span> (int)
                    </li>
                    <li>
                      · devices[] — <span className="font-mono text-txt">name</span> +{" "}
                      <span className="font-mono text-txt">ip</span> (IPv4 CIDR) required,{" "}
                      <span className="font-mono text-txt">notes</span> and{" "}
                      <span className="font-mono text-txt">model</span> optional
                    </li>
                    <li>
                      · devices link to a rack via{" "}
                      <span className="font-mono text-brand">rackId</span>, and may set{" "}
                      <span className="font-mono text-txt">mountIndex</span> (U from top) and{" "}
                      <span className="font-mono text-txt">size</span> (U height, default 1)
                    </li>
                    <li>
                      · connections[] — <span className="font-mono text-txt">srcDevice</span> +{" "}
                      <span className="font-mono text-txt">dstDevice</span> (device names) ·{" "}
                      <span className="font-mono text-txt">srcPort</span> +{" "}
                      <span className="font-mono text-txt">dstPort</span> ·{" "}
                      <span className="font-mono text-txt">medium</span> (ethernet | fibre)
                    </li>
                    <li className="text-faint">
                      · devices with a mountIndex are placed first; the rest fill top-to-bottom in
                      JSON order
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* list */}
        <div className="mt-6">
          {devices.length === 0 ? (
            <div className="rise rounded-xl border border-dashed border-line bg-surface/40 px-6 py-14 text-center">
              <p className="font-display text-lg font-bold text-txt">The registry is empty</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-mute">
                Import a JSON file or drop one anywhere on this page to start tracking devices.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-surface/60">
              <div className="hidden grid-cols-[minmax(0,1.6fr)_150px_minmax(0,1fr)_92px] items-center gap-3 border-b border-line bg-deep/60 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint md:grid">
                <span>device</span>
                <span>address</span>
                <span>notes</span>
                <span className="text-right">actions</span>
              </div>

              {devices.map((d, idx) => {
                const t = inferType(d.name, d.model);
                const meta = TYPE_META[t];
                const cidr = parseCidr(getPrimaryIp(d, connections));
                const open = expandedId === d.id;
                return (
                  <div key={d.id} className="border-b border-linesoft/70 last:border-0">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (editingId === d.id) { setEditingId(null); return; }
                        setExpandedId(open ? null : d.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (editingId === d.id) { setEditingId(null); return; }
                          setExpandedId(open ? null : d.id);
                        }
                      }}
                      className="rise grid cursor-pointer grid-cols-[minmax(0,1fr)_92px] items-center gap-3 px-4 py-3 transition-colors hover:bg-raised/50 md:grid-cols-[minmax(0,1.6fr)_150px_minmax(0,1fr)_92px]"
                      style={{ animationDelay: `${Math.min(idx, 14) * 30}ms` }}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            color: meta.color,
                            background: `${meta.color}1a`,
                            border: `1px solid ${meta.color}38`,
                          }}
                        >
                          <TypeIcon type={t} className="h-4 w-4" size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold text-txt">
                            {d.name}
                          </span>
                          <span className="block font-mono text-[10.5px] text-faint">
                            {meta.label}
                            {d.size > 1 ? ` · ${d.size}U` : ""}
                          </span>
                        </span>
                      </span>
                      <span className="hidden font-mono text-[12.5px] text-txt md:block">
                        {getPrimaryIp(d, connections) ?? <span className="italic text-faint">—</span>}
                      </span>
                      <span className="hidden truncate text-[12.5px] text-mute md:block">
                        {d.notes || <span className="italic text-faint">—</span>}
                      </span>
                      <span className="flex items-center justify-end gap-1">
                        <button
                          title={editingId === d.id ? "Cancel edit" : "Edit device"}
                          aria-label={editingId === d.id ? "Cancel edit" : `Edit ${d.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (editingId === d.id) { setEditingId(null); }
                            else { startEdit(d); }
                          }}
                          className={`rounded-md p-1.5 transition-colors ${
                            editingId === d.id
                              ? "bg-brand/15 text-brand"
                              : "text-faint hover:bg-brand/15 hover:text-brand"
                          }`}
                        >
                          <IconEdit className="h-4 w-4" size={16} />
                        </button>
                        <button
                          title="Locate in topology"
                          aria-label={`Locate ${d.name} in topology`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/?focus=${d.id}`);
                          }}
                          className="rounded-md p-1.5 text-faint transition-colors hover:bg-brand/15 hover:text-brand"
                        >
                          <IconLocate className="h-4 w-4" size={16} />
                        </button>
                        <button
                          aria-label={
                            armedDelete === d.id ? `Confirm removing ${d.name}` : `Remove ${d.name}`
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            armDelete(d.id);
                          }}
                          className={`rounded-md p-1.5 transition-all ${
                            armedDelete === d.id
                              ? "bg-danger/20 text-danger"
                              : "text-faint hover:bg-danger/15 hover:text-danger"
                          }`}
                          title={armedDelete === d.id ? "Click again to remove" : "Remove device"}
                        >
                          {armedDelete === d.id ? (
                            <span className="px-0.5 font-mono text-[10px] font-semibold uppercase">
                              sure?
                            </span>
                          ) : (
                            <IconTrash className="h-4 w-4" size={16} />
                          )}
                        </button>
                        <IconChevronDown
                          className={`h-4 w-4 text-faint transition-transform duration-200 ${
                            open ? "rotate-180" : ""
                          }`}
                          size={16}
                        />
                      </span>
                    </div>

                    {editingId === d.id ? (
                      <div className="rise border-t border-linesoft/70 bg-deep/50 px-4 py-4 md:px-[70px]">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">name</label>
                            <input
                              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                              value={editForm.name ?? ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">notes</label>
                            <textarea
                              rows={4}
                              className="mt-1 min-h-0 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                              value={editForm.notes ?? ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                            />
                          </div>
                          <div className="flex flex-col gap-3">
                            <div>
                              <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">model</label>
                              <input
                                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                                value={editForm.model ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">rack</label>
                              <select
                                className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                                value={editForm.rackId ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, rackId: e.target.value }))}
                              >
                                <option value="">None</option>
                                {racks.map((r) => (
                                  <option key={r.id} value={r.id}>{r.name}{r.number ? ` — ${r.number}` : ""}</option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">rack slot</label>
                                <input
                                  type="number"
                                  min={1}
                                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                                  value={editForm.mountIndex ?? ""}
                                  onChange={(e) => setEditForm((f) => ({ ...f, mountIndex: e.target.value === "" ? undefined : Number(e.target.value) }))}
                                  placeholder="auto"
                                />
                              </div>
                              <div>
                                <label className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">size (U)</label>
                                <input
                                  type="number"
                                  min={1}
                                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-[13px] text-txt outline-none transition-colors focus:border-brand/60"
                                  value={editForm.size ?? 1}
                                  onChange={(e) => setEditForm((f) => ({ ...f, size: Number(e.target.value) }))}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-line bg-raised/70 px-4 py-1.5 text-[12.5px] font-semibold text-mute transition-all hover:border-danger/50 hover:text-danger active:scale-[0.97]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            className="rounded-lg bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-abyss shadow-lg shadow-brand/20 transition-all hover:bg-brandsoft active:scale-[0.97]"
                          >
                            Save changes
                          </button>
                        </div>
                      </div>
                    ) : open && (
                      <div className="rise border-t border-linesoft/70 bg-deep/50 px-4 py-4 md:px-[70px]">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
                              notes
                            </p>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
                              {d.notes || (
                                <span className="italic text-faint">No notes recorded.</span>
                              )}
                            </p>
                          </div>
                          <div className="flex flex-col gap-3">
                            {d.model && (
                              <div>
                                <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
                                  model
                                </p>
                                <p className="mt-1.5 font-mono text-[12.5px] text-txt">
                                  {d.model}
                                </p>
                              </div>
                            )}
                            <div>
                              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
                                location
                              </p>
                              <p className="mt-1.5 font-mono text-[12.5px] text-txt">
                                {(() => {
                                  const r = resolveRack(d, racks);
                                  const bits: string[] = [];
                                  if (r) {
                                    bits.push(r.name);
                                    if (r.number) bits.push(`rack ${r.number}`);
                                  } else if (d.rackId) {
                                    bits.push(`rack ${d.rackId} (unregistered)`);
                                  }
                                  if (d.mountIndex != null) bits.push(`slot U${d.mountIndex}`);
                                  if (d.size > 1) bits.push(`${d.size}U`);
                                  return bits.length > 0 ? bits.join(" · ") : "unracked";
                                })()}
                              </p>
                            </div>
                          </div>
                        </div>
                        {cidr && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {[
                              ["network", `${cidr.network}/${cidr.prefix}`],
                              ["netmask", cidr.mask],
                              ["broadcast", cidr.broadcast],
                            ].map(([k, v]) => (
                              <span
                                key={k}
                                className="rounded-md border border-line bg-surface/70 px-2.5 py-1 font-mono text-[11px] text-mute"
                              >
                                <span className="text-faint">{k} </span>
                                {v}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="mt-3 font-mono text-[10px] text-faint/70">
                          {d.source} · {formatDate(d.importedAt)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* footer note */}
        {devices.length > 0 && (
          <p className="mt-5 font-mono text-[11px] text-faint">
            stored locally in your browser
          </p>
        )}
      </div>

      {/* Export modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowExportModal(false)}>
          <div className="relative mx-4 flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-line bg-deep shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h3 className="font-display text-lg font-bold text-txt">Export Preview</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-raised/70 px-3 py-1.5 text-[12px] font-semibold text-txt transition-all hover:border-brand/50 hover:bg-brand/10 active:scale-[0.97]"
                >
                  {copied ? <IconCheck className="h-3.5 w-3.5 text-brand" size={14} /> : <IconCheck className="h-3.5 w-3.5" size={14} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-raised/70 px-3 py-1.5 text-[12px] font-semibold text-txt transition-all hover:border-brand/50 hover:bg-brand/10 active:scale-[0.97]"
                >
                  <IconDownload className="h-3.5 w-3.5" size={14} />
                  Download
                </button>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-txt"
                >
                  <IconX className="h-4 w-4" size={16} />
                </button>
              </div>
            </div>
            {/* JSON preview */}
            <div className="flex-1 overflow-auto p-5">
              <pre className="rounded-lg border border-line bg-surface/50 p-4 font-mono text-[12px] leading-relaxed text-mute">
                <code>{getExportJson()}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
