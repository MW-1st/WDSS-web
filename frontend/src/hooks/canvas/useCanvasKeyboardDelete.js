import { useEffect } from "react";

export default function useCanvasKeyboardDelete(
  fabricCanvasRef,
  drawingModeRef,
  onSelectionChangeRef,
  triggerAutoSave,
  saveToHistory,
  onCanvasChangeRef
) {
  useEffect(() => {
    const onKeyDown = (e) => {
      const drawingMode = drawingModeRef.current;
      if (drawingMode !== "select") return;
      if (!fabricCanvasRef.current) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const canvas = fabricCanvasRef.current;
      const activeObjects = canvas.getActiveObjects();
      if (!activeObjects || activeObjects.length === 0) return;
      e.preventDefault();
      activeObjects.forEach((obj) => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      try {
        // update selection UI
        const cb = onSelectionChangeRef.current;
        if (cb) cb(null);
      } catch (err) {}
      try {
        triggerAutoSave({ action: "delete", deletedCount: activeObjects.length });
        saveToHistory("delete")
      } catch (err) {}
      try {
        if (onCanvasChangeRef && onCanvasChangeRef.current) onCanvasChangeRef.current();
      } catch (err) {}
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fabricCanvasRef, drawingModeRef, onSelectionChangeRef, triggerAutoSave, saveToHistory, onCanvasChangeRef]);
}
