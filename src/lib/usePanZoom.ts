import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PanState {
  px: number;
  py: number;
  vx: number;
  vy: number;
  moved: boolean;
}

/**
 * Shared pan / zoom / fit behaviour for the SVG canvases.
 * `refitDeps` trigger a re-fit (e.g. when the dataset changes).
 * `onTap` fires on a click that was not a drag.
 */
export function usePanZoom(
  containerRef: RefObject<HTMLDivElement>,
  svgRef: RefObject<SVGSVGElement>,
  bounds: { width: number; height: number },
  refitDeps: readonly unknown[],
  onTap?: (e: ReactPointerEvent<SVGSVGElement>) => void
) {
  const [vb, setVb] = useState<ViewBox>({ x: 0, y: 0, w: 1200, h: 800 });
  const vbRef = useRef(vb);
  vbRef.current = vb;
  const panRef = useRef<PanState | null>(null);
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el || bounds.width <= 0 || bounds.height <= 0) return;
    const cw = Math.max(1, el.clientWidth);
    const ch = Math.max(1, el.clientHeight);
    const aspect = cw / ch;
    let w = bounds.width;
    let h = bounds.height + 30;
    if (w / h < aspect) w = h * aspect;
    else h = w / aspect;
    setVb({ x: (bounds.width - w) / 2, y: (bounds.height + 30 - h) / 2 - 14, w, h });
  }, [bounds.width, bounds.height, containerRef]);

  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, ...refitDeps]);

  // Non-passive wheel zoom (React's synthetic wheel is passive in some browsers).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const v = vbRef.current;
      const mx = v.x + ((e.clientX - rect.left) / rect.width) * v.w;
      const my = v.y + ((e.clientY - rect.top) / rect.height) * v.h;
      const factor = Math.exp(e.deltaY * 0.0012);
      const nw = Math.min(9000, Math.max(240, v.w * factor));
      const nh = nw * (v.h / v.w);
      setVb({
        x: mx - ((mx - v.x) / v.w) * nw,
        y: my - ((my - v.y) / v.h) * nh,
        w: nw,
        h: nh,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [svgRef]);

  const zoomBy = useCallback((factor: number) => {
    setVb((v) => {
      const nw = Math.min(9000, Math.max(240, v.w * factor));
      const nh = nw * (v.h / v.w);
      return { x: v.x + (v.w - nw) / 2, y: v.y + (v.h - nh) / 2, w: nw, h: nh };
    });
  }, []);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    panRef.current = {
      px: e.clientX,
      py: e.clientY,
      vx: vbRef.current.x,
      vy: vbRef.current.y,
      moved: false,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const st = panRef.current;
    const el = svgRef.current;
    if (!st || !el) return;
    const rect = el.getBoundingClientRect();
    const scale = vbRef.current.w / Math.max(1, rect.width);
    if (Math.abs(e.clientX - st.px) + Math.abs(e.clientY - st.py) > 4) st.moved = true;
    const dx = (e.clientX - st.px) * scale;
    const dy = (e.clientY - st.py) * scale;
    setVb((v) => ({ ...v, x: st.vx - dx, y: st.vy - dy }));
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const st = panRef.current;
    panRef.current = null;
    if (st && !st.moved) onTapRef.current?.(e);
  };

  const onPointerCancel = () => {
    panRef.current = null;
  };

  return {
    vb,
    fit,
    zoomBy,
    panRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
