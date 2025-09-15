import { useCallback, useEffect, useRef } from "react";

export default function useCanvasPreview({ fabricCanvasRef, onPreviewChange, isDrawingRef }) {
  const previewTimerRef = useRef(null);

  const schedulePreview = useCallback(() => {
    if (!onPreviewChange || !fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    if (canvas.isDrawingMode && canvas._isCurrentlyDrawing) return;

    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      try {
        const dataURL = fabricCanvasRef.current.toDataURL({
          format: "png",
          quality: 0.92,
          multiplier: 1,
        });
        onPreviewChange(dataURL);
      } catch (_) {}
      previewTimerRef.current = null;
    }, 200);
  }, [onPreviewChange, fabricCanvasRef]);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    };
  }, []);

  return { schedulePreview, previewTimerRef };
}
