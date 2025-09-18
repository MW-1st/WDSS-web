import { useRef, useEffect } from "react";

export default function useCanvasViewport(fabricCanvasRef, width, height) {
  const baseSizeRef = useRef({ w: width, h: height });

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

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

  const zx = width / (base.w || 1);
  const zy = height / (base.h || 1);
  let z = Math.min(zx, zy);

  // If retina scaling is enabled, Fabric will scale the backing store
  // to account for window.devicePixelRatio. We still use viewport zoom
  // for logical zooming; don't multiply by devicePixelRatio here, but
  // keep element CSS sizes consistent.
    canvas.setZoom(z);

    const vpt = canvas.viewportTransform || [z, 0, 0, z, 0, 0];
    vpt[0] = z;
    vpt[3] = z;
    vpt[4] = (width - base.w * z) / 2;
    vpt[5] = (height - base.h * z) / 2;
    canvas.setViewportTransform(vpt);

    if (canvas.clipPath) {
      try {
        canvas.clipPath.set({ width, height });
      } catch (_) {}
    }

    canvas.requestRenderAll();
    // keep baseSizeRef across resizes; we intentionally don't update it here
  }, [fabricCanvasRef, width, height]);
}
