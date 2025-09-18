import { useRef, useEffect, useState } from "react";

// width/height: container size in CSS px
// baseWidth/baseHeight: logical design resolution (content coordinates)
export default function useCanvasViewport(
  fabricCanvasRef,
  width,
  height,
  baseWidth,
  baseHeight,
  revision = 0
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

  // If a saved viewport was restored, honor it and avoid recomputing
  // zoom/transform here. We still update CSS sizing for overlays.
  if (canvas.__wdss_preserveViewport === true) {
    try {
      const el = canvas.getElement();
      if (el) {
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
      }
    } catch (_) {}
    canvas.requestRenderAll();
    return;
  }

  // Keep viewport anchored to the fixed canvas base area
  // (do not auto-fit to objects).
  let unionLeft = 0, unionTop = 0, unionRight = base.w, unionBottom = base.h;

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
        canvas.clipPath.set({ width: base.w, height: base.h, left: 0, top: 0 });
      } catch (_) {}
    }

    // Sync visual boundary size if present
    try {
      const boundary = canvas.getObjects().find(o => o && o.name === 'canvasBoundary');
      if (boundary) {
        boundary.set({ left: 0, top: 0, width: base.w, height: base.h });
        if (typeof boundary.setCoords === 'function') boundary.setCoords();
      }
    } catch (_) {}

    canvas.requestRenderAll();
    // keep baseSizeRef across resizes; we intentionally don't update it here
  }, [fabricCanvasRef, width, height, baseWidth, baseHeight, dpr, revision]);

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
