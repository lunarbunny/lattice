import type { ImportSummary } from "./importer";

export function notifyImport(
  res: { error?: string; summary?: ImportSummary },
  push: (kind: "success" | "warning" | "error", title: string, detail?: string) => void,
  label: string
) {
  if (res.error || !res.summary) {
    push("error", `Import failed — ${label}`, res.error ?? "Unknown error");
    return;
  }
  const s = res.summary;
  const bits: string[] = [];
  if (s.duplicates > 0) bits.push(`${s.duplicates} duplicate${s.duplicates === 1 ? "" : "s"} skipped`);
  if (s.invalid.length > 0) bits.push(`${s.invalid.length} invalid entr${s.invalid.length === 1 ? "y" : "ies"}`);
  if (s.warnings.length > 0) bits.push(`${s.warnings.length} warning${s.warnings.length === 1 ? "" : "s"}`);
  const detail = bits.length > 0 ? bits.join(" · ") : undefined;
  if (s.added.length > 0) {
    const rackBit =
      s.racksAdded.length > 0
        ? ` and ${s.racksAdded.length} rack${s.racksAdded.length === 1 ? "" : "s"}`
        : "";
    push(
      "success",
      `Imported ${s.added.length} device${s.added.length === 1 ? "" : "s"}${rackBit} from ${label}`,
      detail
    );
  } else if (s.racksAdded.length > 0) {
    push(
      "success",
      `Registered ${s.racksAdded.length} rack${s.racksAdded.length === 1 ? "" : "s"} from ${label}`,
      detail
    );
  } else if (s.duplicates > 0) {
    push("warning", `Nothing new from ${label}`, "Every device was already in the registry.");
  } else {
    push("warning", `No devices imported from ${label}`, detail);
  }
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
