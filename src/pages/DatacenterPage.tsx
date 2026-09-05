import { useEffect, useRef, useState } from "react";
import { useDatastore } from "../store";
import { useToast } from "../components/Toast";
import { notifyImport } from "../lib/helpers";
import { navigate } from "../lib/router";
import RackManager from "../components/rack/RackManager";
import DeviceManager from "../components/device/DeviceManager";
import TemplateManager from "../components/template/TemplateManager";
import DeviceConnectionsPanel from "../components/connection/DeviceConnectionsPanel";
import RackGroupEditModal from "../components/rack/RackGroupEditModal";
import PortTemplateEditModal from "../components/template/PortTemplateEditModal";
import {
  IconUpload,
  IconArrowLeft,
  IconTrash,
  IconDownload,
  IconCheck,
  IconX,
} from "../components/Icons";

type LeftTab = "racks" | "templates";

export default function DatacenterPage() {
  const { devices, racks, connections, portTemplates, importText, clearAll } = useDatastore();
  const { push } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [armedClear, setArmedClear] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>("racks");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [showRackModal, setShowRackModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
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
    setSelectedDeviceId(null);
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
      ...(d.portTemplate ? { portTemplate: d.portTemplate } : {}),
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
      ...(c.vlans?.length ? { vlans: c.vlans } : {}),
      ...(c.bundleId ? { bundleId: c.bundleId } : {}),
      ...(c.bundleProtocol ? { bundleProtocol: c.bundleProtocol } : {}),
    })),
    ...(portTemplates.length > 0
      ? { portTemplates: portTemplates.map((t) => ({ name: t.name, ports: t.ports })) }
      : {}),
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

  const selectedDevice = selectedDeviceId ? devices.find((d) => d.id === selectedDeviceId) ?? null : null;

  const hasData = devices.length > 0 || racks.length > 0;

  return (
    <div
      className="flex h-full flex-col"
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
      {/* ---- Drag overlay ---- */}
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

      {/* ---- Toolbar ---- */}
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold text-mute transition-all hover:bg-raised hover:text-txt active:scale-[0.97]"
          >
            <IconArrowLeft className="h-3.5 w-3.5" size={14} />
            Fabric
          </button>
          <span className="font-mono text-[10px] text-faint">
            {devices.length} device{devices.length === 1 ? "" : "s"} · {racks.length} rack{racks.length === 1 ? "" : "s"}{connections.length > 0 ? ` · ${connections.length} conn` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
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
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[12px] font-semibold text-abyss shadow-sm shadow-brand/20 transition-all hover:bg-brandsoft active:scale-[0.97]"
          >
            <IconUpload className="h-3.5 w-3.5" size={14} strokeWidth={2} />
            Import
          </button>
          {hasData && (
            <>
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1.5 rounded-md border border-line bg-raised/70 px-2.5 py-1.5 text-[12px] font-semibold text-txt transition-all hover:border-brand/50 hover:bg-brand/10 active:scale-[0.97]"
              >
                <IconDownload className="h-3.5 w-3.5" size={14} />
                Export
              </button>
              <button
                onClick={handleClear}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-semibold transition-all active:scale-[0.97] ${
                  armedClear
                    ? "border-danger/60 bg-danger/15 text-danger"
                    : "border-line bg-raised/70 text-danger/60 hover:border-danger/50 hover:text-danger"
                }`}
              >
                <IconTrash className="h-3.5 w-3.5" size={14} />
                {armedClear ? "Confirm" : "Clear"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ---- Grid ---- */}
      <div className="min-h-0 flex-1 grid grid-cols-[2fr_5fr_5fr]">
        {/* Left column — tabs */}
        <div className="flex flex-col border-r border-line">
          <div className="min-h-0 flex-1 overflow-hidden">
            {leftTab === "racks" ? (
              <RackManager onNewGroup={() => setShowRackModal(true)} />
            ) : (
              <TemplateManager onNewTemplate={() => setShowTemplateModal(true)} />
            )}
          </div>
          <div className="flex shrink-0 border-t border-line">
            <button
              onClick={() => setLeftTab("racks")}
              className={`flex-1 py-2 text-center font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                leftTab === "racks" ? "text-brand border-t-2 border-brand -mt-px" : "text-faint hover:text-mute"
              }`}
            >
              Racks
            </button>
            <button
              onClick={() => setLeftTab("templates")}
              className={`flex-1 py-2 text-center font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                leftTab === "templates" ? "text-brand border-t-2 border-brand -mt-px" : "text-faint hover:text-mute"
              }`}
            >
              Templates
            </button>
          </div>
        </div>

        {/* Middle — devices */}
        <div className="min-h-0 overflow-hidden border-r border-line">
          <DeviceManager selectedId={selectedDeviceId} onSelectDevice={setSelectedDeviceId} />
        </div>

        {/* Right — connections */}
        <div className="min-h-0 overflow-hidden">
          {selectedDevice ? (
            <DeviceConnectionsPanel device={selectedDevice} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="font-mono text-[11px] text-faint">Select a device to view connections</p>
            </div>
          )}
        </div>
      </div>

      {/* ---- Export modal ---- */}
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

      {/* ---- Rack group modal ---- */}
      {showRackModal && (
        <RackGroupEditModal onClose={() => setShowRackModal(false)} />
      )}

      {/* ---- Template modal ---- */}
      {showTemplateModal && (
        <PortTemplateEditModal onClose={() => setShowTemplateModal(false)} />
      )}
    </div>
  );
}
