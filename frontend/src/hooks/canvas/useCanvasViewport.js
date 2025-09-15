import { useRef, useEffect } from "react";

export default function useCanvasViewport(fabricCanvasRef, width, height) {
  const baseSizeRef = useRef({ w: width, h: height });

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const base = baseSizeRef.current || { w: width, h: height };
    canvas.setWidth(width);
    canvas.setHeight(height);

    const zx = width / (base.w || 1);
    const zy = height / (base.h || 1);
    const z = Math.min(zx, zy);
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
