import { useDevices } from "../store";
import { useToast } from "./Toast";
import { IconX, IconSamples, IconRack, IconNetwork, IconTree } from "./Icons";
import { getSamples, getSample } from "../lib/sample";

interface SamplePickerModalProps {
  onClose: () => void;
}

const ICONS = [
  <IconSamples className="h-5 w-5" size={20} />,
  <IconRack className="h-5 w-5" size={20} />,
  <IconNetwork className="h-5 w-5" size={20} />,
];

export default function SamplePickerModal({ onClose }: SamplePickerModalProps) {
  const { devices, importText, enterPreview } = useDevices();
  const { push } = useToast();
  const hasData = devices.length > 0;
  const samples = getSamples();

  const handleSelect = (sampleId: string) => {
    const sample = getSample(sampleId);
    if (!sample) return;

    if (hasData) {
      const res = enterPreview(sampleId);
      if (res.error) {
        push("error", res.error);
      } else {
        onClose();
      }
    } else {
      const json = JSON.stringify(sample.data, null, 2);
      importText(json, sample.source);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex w-full max-w-md flex-col rounded-xl border border-line bg-deep shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-display text-lg font-bold text-txt">Sample Networks</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-raised hover:text-txt"
            aria-label="Close"
          >
            <IconX className="h-4 w-4" size={16} />
          </button>
        </div>

        {/* Sample list */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex flex-col gap-3">
            {samples.map((s, i) => (
              <button
                key={s.id}
                onClick={() => handleSelect(s.id)}
                className="group flex w-full items-start gap-4 rounded-lg border border-line bg-surface/50 p-4 text-left transition-all hover:border-brand/50 hover:bg-brand/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  {ICONS[i % ICONS.length]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-txt group-hover:text-brand transition-colors">
                    {s.name}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-mute">
                    {s.description}
                  </p>
                  <div className="mt-2.5 flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[11px] text-faint">
                      <IconRack className="h-3 w-3" size={12} />
                      {s.stats.racks} {s.stats.racks === 1 ? "rack" : "racks"}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-faint">
                      <IconNetwork className="h-3 w-3" size={12} />
                      {s.stats.devices} {s.stats.devices === 1 ? "device" : "devices"}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-faint">
                      <IconTree className="h-3 w-3" size={12} />
                      {s.stats.connections} {s.stats.connections === 1 ? "connection" : "connections"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {hasData ? (
            <p className="mt-3 text-center text-[11px] text-faint">
              Previewing a sample will not affect your existing data.
            </p>
          ) : (
            <p className="mt-3 text-center text-[11px] text-faint">
              Your registry is empty — the sample will be imported directly to storage.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
