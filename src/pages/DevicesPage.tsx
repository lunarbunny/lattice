import { useEffect, useRef, useState } from "react";
import { useDevices } from "../store";
import { useToast } from "../components/Toast";
import { parseCidr } from "../lib/cidr";
import { inferType } from "../lib/topology";
import { resolveRack } from "../lib/importer";
import { TYPE_META } from "../lib/types";
import { notifyImport, timeAgo } from "../lib/helpers";
import { navigate } from "../lib/router";
import { SAMPLE_SNIPPET } from "../lib/sample";
import {
  IconUpload,
  IconArrowLeft,
  IconTrash,
  IconChevronDown,
  IconLocate,
  IconInfo,
  TypeIcon,
} from "../components/icons";

export default function DevicesPage() {
  const { devices, racks, importText, removeDevice, clearAll, loadSample } = useDevices();
  const { push } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
                : `${devices.length} device${devices.length === 1 ? "" : "s"} · ${racks.length} rack declaration${
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
              Gallery
            </button>
            <button
              onClick={() => notifyImport(loadSample(), push, "sample-network.json")}
              className="flex items-center gap-2 rounded-lg border border-line bg-raised/70 px-4 py-2 text-[13px] font-semibold text-txt transition-all hover:border-brand/50 hover:bg-brand/10 active:scale-[0.97]"
            >
              Sample
            </button>
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
                      <span className="font-mono text-brand">{"{ racks, devices }"}</span>
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
                Import a JSON file, drop one anywhere on this page, or load the sample network to
                see how devices are tracked.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-surface/60">
              <div className="hidden grid-cols-[minmax(0,1.6fr)_150px_minmax(0,1fr)_90px_92px] items-center gap-3 border-b border-line bg-deep/60 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint md:grid">
                <span>device</span>
                <span>address</span>
                <span>notes</span>
                <span>imported</span>
                <span className="text-right">actions</span>
              </div>

              {devices.map((d, idx) => {
                const t = inferType(d.name, d.model);
                const meta = TYPE_META[t];
                const cidr = parseCidr(d.ip);
                const open = expandedId === d.id;
                return (
                  <div key={d.id} className="border-b border-linesoft/70 last:border-0">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedId(open ? null : d.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedId(open ? null : d.id);
                        }
                      }}
                      className="rise grid cursor-pointer grid-cols-[minmax(0,1fr)_92px] items-center gap-3 px-4 py-3 transition-colors hover:bg-raised/50 md:grid-cols-[minmax(0,1.6fr)_150px_minmax(0,1fr)_90px_92px]"
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
                        {d.ip}
                      </span>
                      <span className="hidden truncate text-[12.5px] text-mute md:block">
                        {d.notes || <span className="italic text-faint">—</span>}
                      </span>
                      <span className="hidden font-mono text-[11px] text-faint md:block">
                        {timeAgo(d.importedAt)}
                      </span>
                      <span className="flex items-center justify-end gap-1">
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

                    {open && (
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
                            {d.model && (
                              <p className="mt-1 font-mono text-[11.5px] text-mute">
                                <span className="text-faint">model · </span>
                                {d.model}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
                              import
                            </p>
                            <p className="mt-1.5 font-mono text-[11px] text-faint">
                              source <span className="text-mute">{d.source}</span> · imported{" "}
                              <span className="text-mute">
                                {new Date(d.importedAt).toLocaleString(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </span>
                            </p>
                            <p className="mt-1 font-mono text-[11px] text-faint">
                              location{" "}
                              <span className="text-mute">
                                {(() => {
                                  const r = resolveRack(d, racks);
                                  const bits: string[] = [];
                                  if (r) {
                                    bits.push(r.name);
                                    if (r.number) bits.push(`rack ${r.number}`);
                                    bits.push(`[${r.id}]`);
                                  } else if (d.rackId) {
                                    bits.push(`rack ${d.rackId} (unregistered)`);
                                  }
                                  if (d.mountIndex != null) bits.push(`U${d.mountIndex}`);
                                  if (d.size > 1) bits.push(`${d.size}U`);
                                  return bits.length > 0 ? bits.join(" · ") : "unracked";
                                })()}
                              </span>
                            </p>
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* footer actions */}
        {devices.length > 0 && (
          <div className="mt-5 flex items-center justify-between">
            <p className="font-mono text-[11px] text-faint">
              stored locally in your browser
            </p>
            <button
              onClick={handleClear}
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[12.5px] font-semibold transition-all active:scale-[0.97] ${
                armedClear
                  ? "border-danger/60 bg-danger/15 text-danger"
                  : "border-line bg-raised/60 text-mute hover:border-danger/50 hover:text-danger"
              }`}
            >
              <IconTrash className="h-4 w-4" size={16} />
              {armedClear ? "Click again to clear everything" : "Clear all"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
