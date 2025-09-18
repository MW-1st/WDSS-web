import { useRef, useEffect, useState } from "react";

// width/height: container size in CSS px
// baseWidth/baseHeight: logical design resolution (content coordinates)
export default function useCanvasViewport(
  fabricCanvasRef,
  width,
  height,
  baseWidth,
  baseHeight
) {
  const baseSizeRef = useRef({ w: baseWidth || width, h: baseHeight || height });
  const [dpr, setDpr] = useState(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Update base size if explicit baseWidth/baseHeight provided
    if (baseWidth && baseHeight) {
      baseSizeRef.current = { w: baseWidth, h: baseHeight };
    }
    const base = baseSizeRef.current || { w: width, h: height };
    // Update logical canvas size
    canvas.setWidth(width);
    canvas.setHeight(height);

    // Also update the DOM element CSS size so layout and overlay
    // calculations (like delete button positioning) use consistent
    // clientWidth/clientHeight values even when devicePixelRatio changes.
    try {
      const el = canvas.getElement();
      if (el) {
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
      }
    } catch (_) {}

  // Compute content bounds to avoid clipping if existing objects extend
  // beyond the logical base area (e.g., created at a larger size).
  let unionLeft = 0, unionTop = 0, unionRight = base.w, unionBottom = base.h;
  try {
    const objs = canvas.getObjects() || [];
    for (const obj of objs) {
      if (!obj || obj.name === 'canvasBoundary' || obj.excludeFromExport === true) continue;
      const left = typeof obj.left === 'number' ? obj.left : 0;
      const top = typeof obj.top === 'number' ? obj.top : 0;
      const w = (obj.width || 0) * (obj.scaleX || 1);
      const h = (obj.height || 0) * (obj.scaleY || 1);
      unionLeft = Math.min(unionLeft, left);
      unionTop = Math.min(unionTop, top);
      unionRight = Math.max(unionRight, left + w);
      unionBottom = Math.max(unionBottom, top + h);
    }
  } catch (_) {}

  const fitW = Math.max(1, unionRight - unionLeft);
  const fitH = Math.max(1, unionBottom - unionTop);

  const zx = width / fitW;
  const zy = height / fitH;
  let z = Math.min(zx, zy);

  // If retina scaling is enabled, Fabric will scale the backing store
  // to account for window.devicePixelRatio. We still use viewport zoom
  // for logical zooming; don't multiply by devicePixelRatio here, but
  // keep element CSS sizes consistent.
    canvas.setZoom(z);

    const vpt = canvas.viewportTransform || [z, 0, 0, z, 0, 0];
    vpt[0] = z;
    vpt[3] = z;
    // center the union rect within the container
    const marginX = (width - fitW * z) / 2;
    const marginY = (height - fitH * z) / 2;
    vpt[4] = marginX - unionLeft * z;
    vpt[5] = marginY - unionTop * z;
    canvas.setViewportTransform(vpt);

    if (canvas.clipPath) {
      try {
        canvas.clipPath.set({ width: fitW, height: fitH, left: unionLeft, top: unionTop });
      } catch (_) {}
    }

    // Sync visual boundary size if present
    try {
      const boundary = canvas.getObjects().find(o => o && o.name === 'canvasBoundary');
      if (boundary) {
        boundary.set({ left: unionLeft, top: unionTop, width: fitW, height: fitH });
        if (typeof boundary.setCoords === 'function') boundary.setCoords();
      }
    } catch (_) {}

    canvas.requestRenderAll();
    // keep baseSizeRef across resizes; we intentionally don't update it here
  }, [fabricCanvasRef, width, height, baseWidth, baseHeight, dpr]);

  // Recompute when browser zoom / devicePixelRatio changes so Fabric backing
  // store and our viewport transform stay in sync and content doesn't appear clipped.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateDpr = () => setDpr(window.devicePixelRatio || 1);
    window.addEventListener('resize', updateDpr);
    let mq;
    try {
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      if (mq && typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', updateDpr);
      } else if (mq && typeof mq.addListener === 'function') {
        mq.addListener(updateDpr);
      }
    } catch (_) {}
    return () => {
      window.removeEventListener('resize', updateDpr);
      try {
        if (mq && typeof mq.removeEventListener === 'function') {
          mq.removeEventListener('change', updateDpr);
        } else if (mq && typeof mq.removeListener === 'function') {
          mq.removeListener(updateDpr);
        }
      } catch (_) {}
    };
  }, []);
}
