import { useEffect, useRef, useState } from "react";
import { useDatastore } from "../store";
import { useToast } from "../components/Toast";
import { notifyImport } from "../lib/helpers";
import { navigate } from "../lib/router";
import { SAMPLE_SNIPPET } from "../lib/sample";
import RackManager from "../components/rack/RackManager";
import DeviceManager from "../components/device/DeviceManager";
import {
  IconUpload,
  IconArrowLeft,
  IconTrash,
  IconChevronDown,
  IconInfo,
  IconDownload,
  IconCheck,
  IconX,
} from "../components/Icons";

export default function DatacenterPage() {
  const { devices, racks, connections, importText, clearAll } = useDatastore();
  const { push } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const handleClear = () => {
    if (!armedClear) {
      setArmedClear(true);
      if (disarmTimer.current) window.clearTimeout(disarmTimer.current);
      disarmTimer.current = window.setTimeout(() => setArmedClear(false), 2600);
      return;
    }
    clearAll();
    setArmedClear(false);
    push("success", "Datacenter cleared", "All racks, devices, and connections were removed.");
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    notifyImport(importText(text, file.name), push, file.name);
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

  const connCount = connections.length;

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
              datacenter
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-txt">
              Datacenter
            </h1>
            <p className="mt-1.5 text-[13.5px] text-mute">
              {devices.length === 0 && racks.length === 0
                ? "Start building your inventory."
                : `${devices.length} device${devices.length === 1 ? "" : "s"} · ${racks.length} rack${racks.length === 1 ? "" : "s"}${connCount > 0 ? ` · ${connCount} connection${connCount === 1 ? "" : "s"}` : ""}`}
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
            {(devices.length > 0 || racks.length > 0) && (
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

        {/* import format help */}
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
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-faint">rules</p>
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
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* racks section */}
        <div className="mt-8">
          <RackManager />
        </div>

        {/* devices section */}
        <div className="mt-8">
          <DeviceManager />
        </div>

        {/* footer */}
        {(devices.length > 0 || racks.length > 0) && (
          <p className="mt-5 font-mono text-[11px] text-faint">
            stored locally in your browser
          </p>
        )}
      </div>

      {/* Export modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowExportModal(false)}>
          <div className="relative mx-4 flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-line bg-deep shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
