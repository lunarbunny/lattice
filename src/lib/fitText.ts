export const NAME_FONT = "600 11.5px 'IBM Plex Sans', sans-serif";

const measureCache = new Map<string, number>();
let mctx: CanvasRenderingContext2D | null = null;

function textWidth(text: string, font: string): number {
  if (!mctx) mctx = document.createElement("canvas").getContext("2d");
  if (!mctx) return text.length * 6.5;
  const key = `${font}|${text}`;
  const hit = measureCache.get(key);
  if (hit != null) return hit;
  mctx.font = font;
  const w = mctx.measureText(text).width;
  measureCache.set(key, w);
  return w;
}

export function clearMeasureCache() {
  measureCache.clear();
}

export function fitText(text: string, maxWidth: number, font: string): string {
  if (textWidth(text, font) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (textWidth(text.slice(0, mid).trimEnd() + "\u2026", font) <= maxWidth) lo = mid;
    else hi = mid;
  }
  return text.slice(0, Math.max(1, lo)).trimEnd() + "\u2026";
}
