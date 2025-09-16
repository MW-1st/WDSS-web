import * as fabric from "fabric";
import * as fabricLayerUtils from "../../utils/fabricLayerUtils";

export function createDrawingModes({
  fabricCanvasRef,
  drawingModeRef,
  currentColorRef,
  activeLayerIdRef,
  layersRef,
  setCanvasRevision,
  triggerAutoSave,
  saveToHistory,
  onCanvasChangeRef,
  width,
  height,
  eraserSizeRef,
}) {
  const eraseHandlers = { current: {} };

  const updateBrushColor = (color) => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    if (drawingModeRef.current === "pixelErase") return;
    if (canvas.freeDrawingBrush) canvas.freeDrawingBrush.color = color;
  };

  const applyDrawingMode = (mode, colorOverride = null) => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;

    const currentColor =
      mode === "pixelErase" ? "#fafafa" : colorOverride || currentColorRef.current;

    // detach previous handlers
    if (eraseHandlers.current.wheelHandler) {
      canvas.off("mouse:wheel", eraseHandlers.current.wheelHandler);
    }
    if (eraseHandlers.current.pathCreatedHandler) {
      canvas.off("path:created", eraseHandlers.current.pathCreatedHandler);
    }
    if (eraseHandlers.current.startErase) {
      canvas.off("mouse:down", eraseHandlers.current.startErase);
      canvas.off("mouse:move", eraseHandlers.current.erase);
      canvas.off("mouse:up", eraseHandlers.current.stopErase);
    }
    if (eraseHandlers.current.startDraw) {
      canvas.off("mouse:down", eraseHandlers.current.startDraw);
      canvas.off("mouse:move", eraseHandlers.current.continueDraw);
      canvas.off("mouse:up", eraseHandlers.current.stopDraw);
    }

    canvas.defaultCursor = "default";

    if (mode === "draw") {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      canvas.skipTargetFind = true;
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
      canvas.moveCursor = "crosshair";
      canvas.freeDrawingCursor = "crosshair";

      const brush = new fabric.PencilBrush(canvas);
      brush.width = 2;
      brush.color = currentColor;
      brush.decimate = 2;
      brush.limitedToCanvasSize = true;
      canvas.freeDrawingBrush = brush;

      const pathCreatedHandler = (e) => {
        if (e.path) {
          const currentActiveLayerId = activeLayerIdRef.current;
          const currentLayers = layersRef.current;
          const activeLayer = currentLayers.find((layer) => layer.id === currentActiveLayerId);

          e.path.set({
            selectable: true,
            evented: true,
          });

          if (activeLayer) {
            fabricLayerUtils.assignObjectToLayer(e.path, activeLayer.id, activeLayer.name);
          }

          if (setCanvasRevision) setCanvasRevision((c) => c + 1);
          if (triggerAutoSave) triggerAutoSave({ drawingMode: "draw" });
          if (saveToHistory) saveToHistory("draw")
          if (onCanvasChangeRef && onCanvasChangeRef.current) onCanvasChangeRef.current();
        }
      };

      eraseHandlers.current = { pathCreatedHandler };
      canvas.on("path:created", pathCreatedHandler);

      canvas.setCursor("crosshair");
    } else if (mode === "brush") {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.skipTargetFind = true;

      let isDrawing = false;

      const startDraw = (e) => {
        try {
          const c = fabricCanvasRef.current;
          if (c && typeof c.getPanMode === "function" && c.getPanMode()) return;
        } catch (_) {}
        isDrawing = true;
        drawDotAtPoint(e);
      };

      const continueDraw = (e) => {
        try {
          const c = fabricCanvasRef.current;
          if (c && typeof c.getPanMode === "function" && c.getPanMode()) return;
        } catch (_) {}
        if (!isDrawing) return;

        const currentDots = canvas
          .getObjects()
          .filter(
            (obj) => obj.type === "circle" || obj.customType === "svgDot" || obj.customType === "drawnDot"
          );
        const maxDrone = window.editorAPI?.targetDots || 2000;
        if (currentDots.length >= maxDrone) return;

        drawDotAtPoint(e);
        canvas.requestRenderAll();
      };

      const stopDraw = () => {
        isDrawing = false;
        if (setCanvasRevision) setCanvasRevision((c) => c + 1);
        if (triggerAutoSave) triggerAutoSave({ drawingMode: "brush" });
        if (saveToHistory) saveToHistory("brush")
        if (onCanvasChangeRef && onCanvasChangeRef.current) onCanvasChangeRef.current();
      };

      const drawDotAtPoint = (e) => {
        const allObjects = canvas.getObjects();
        const currentDots = allObjects.filter(
          (obj) => obj.type === "circle" || obj.customType === "svgDot" || obj.customType === "drawnDot"
        );
        const maxDrone = window.editorAPI?.targetDots || 2000;
        if (currentDots.length >= maxDrone) {
          if (!window._maxDroneWarningShown) {
            alert(`최대 드론 개수(${maxDrone}개)에 도달했습니다. 더 이상 추가할 수 없습니다.`);
            window._maxDroneWarningShown = true;
          }
          return;
        }

        const pointer = canvas.getPointer(e.e);
        const dotRadius = 2;
        if (pointer.x < 0 || pointer.x > width || pointer.y < 0 || pointer.y > height) return;

        const overlapping = currentDots.some((existingDot) => {
          const existingX = existingDot.left + existingDot.radius;
          const existingY = existingDot.top + existingDot.radius;
          const newX = pointer.x;
          const newY = pointer.y;
          const distance = Math.sqrt(Math.pow(newX - existingX, 2) + Math.pow(newY - existingY, 2));
          return distance < dotRadius + existingDot.radius;
        });
        if (overlapping) return;

        const currentActiveLayerId = activeLayerIdRef.current;
        const currentLayers = layersRef.current;
        const activeLayer = currentLayers.find((layer) => layer.id === currentActiveLayerId);

        const newDot = new fabric.Circle({
          left: pointer.x - dotRadius,
          top: pointer.y - dotRadius,
          radius: dotRadius,
          fill: currentColorRef.current || currentColor,
          selectable: false,
          evented: true,
          customType: "drawnDot",
          originalFill: currentColorRef.current || currentColor,
          hoverCursor: "crosshair",
          moveCursor: "crosshair",
        });

        if (activeLayer) {
          fabricLayerUtils.assignObjectToLayer(newDot, activeLayer.id, activeLayer.name);
        }

        canvas.add(newDot);
      };

      const createBrushCursor = () => {
        const cursorCanvas = document.createElement("canvas");
        const ctx = cursorCanvas.getContext("2d");
        const dotRadius = 2;
        const cursorSize = dotRadius * 2 + 10;
        cursorCanvas.width = cursorSize;
        cursorCanvas.height = cursorSize;
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.arc(cursorSize / 2, cursorSize / 2, dotRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cursorSize / 2, cursorSize / 2, dotRadius, 0, 2 * Math.PI);
        ctx.stroke();
        return `url(${cursorCanvas.toDataURL()}) ${cursorSize / 2} ${cursorSize / 2}, crosshair`;
      };

      const brushCursor = createBrushCursor();
      canvas.defaultCursor = brushCursor;
      canvas.hoverCursor = brushCursor;
      canvas.moveCursor = brushCursor;
      canvas.freeDrawingCursor = brushCursor;
      canvas.setCursor(brushCursor);

      eraseHandlers.current = { startDraw, continueDraw, stopDraw };
      canvas.on("mouse:down", startDraw);
      canvas.on("mouse:move", continueDraw);
      canvas.on("mouse:up", stopDraw);
    } else if (mode === "erase") {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.skipTargetFind = true;

      const createEraserCursor = (size) => {
        const cursorCanvas = document.createElement("canvas");
        const ctx = cursorCanvas.getContext("2d");
        const cursorSize = size + 10;
        cursorCanvas.width = cursorSize;
        cursorCanvas.height = cursorSize;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cursorSize / 2, cursorSize / 2, size / 2, 0, 2 * Math.PI);
        ctx.stroke();
        return `url(${cursorCanvas.toDataURL()}) ${cursorSize / 2} ${cursorSize / 2}, crosshair`;
      };

      const eraserCursor = createEraserCursor(eraserSizeRef.current);
      canvas.defaultCursor = eraserCursor;
      canvas.hoverCursor = eraserCursor;
      canvas.moveCursor = eraserCursor;
      canvas.setCursor(eraserCursor);

      let isErasing = false;

      const startErase = (e) => {
        try {
          const c = fabricCanvasRef.current;
          if (c && typeof c.getPanMode === "function" && c.getPanMode()) return;
        } catch (_) {}
        isErasing = true;
        eraseAtPoint(e);
      };

      const erase = (e) => {
        try {
          const c = fabricCanvasRef.current;
          if (c && typeof c.getPanMode === "function" && c.getPanMode()) return;
        } catch (_) {}
        if (!isErasing) return;
        eraseAtPoint(e);
      };

      const stopErase = () => {
        isErasing = false;
        if (triggerAutoSave) triggerAutoSave({ drawingMode: "erase" });
        if (saveToHistory) saveToHistory("erase");
        if (onCanvasChangeRef && onCanvasChangeRef.current) onCanvasChangeRef.current();
      };

      const eraseAtPoint = (e) => {
        const pointer = canvas.getPointer(e.e);
        const objects = canvas.getObjects();
        const objectsToRemove = [];
        const eraserRadius = eraserSizeRef.current / 2;

        objects.forEach((obj) => {
          if (
            obj.type === "path" ||
            obj.type === "circle" ||
            obj.customType === "svgDot" ||
            obj.customType === "drawnDot"
          ) {
            if (obj.type === "circle" || obj.customType === "svgDot" || obj.customType === "drawnDot") {
              const dotCenterX = obj.left + obj.radius;
              const dotCenterY = obj.top + obj.radius;
              const distance = Math.sqrt(Math.pow(pointer.x - dotCenterX, 2) + Math.pow(pointer.y - dotCenterY, 2));
              if (distance <= eraserRadius + obj.radius) {
                objectsToRemove.push(obj);
              }
            } else {
              const bounds = obj.getBoundingRect();
              if (
                pointer.x + eraserRadius >= bounds.left &&
                pointer.x - eraserRadius <= bounds.left + bounds.width &&
                pointer.y + eraserRadius >= bounds.top &&
                pointer.y - eraserRadius <= bounds.top + bounds.height
              ) {
                objectsToRemove.push(obj);
              }
            }
          }
        });

        objectsToRemove.forEach((obj) => canvas.remove(obj));

        if (objectsToRemove.length > 0) {
          canvas.renderAll();
          if (triggerAutoSave) triggerAutoSave({ drawingMode: "erase", erased: objectsToRemove.length });
          if (saveToHistory) saveToHistory("erase")
          if (onCanvasChangeRef && onCanvasChangeRef.current) onCanvasChangeRef.current();
        }
      };

      const wheelHandler = (e) => {
        e.e.preventDefault();
        const delta = e.e.deltaY;
        const step = 3;

        const prev = eraserSizeRef.current;
        let newSize;
        if (delta > 0) newSize = Math.max(5, prev - step);
        else newSize = Math.min(100, prev + step);
        eraserSizeRef.current = newSize;

        const newEraserCursor = createEraserCursor(newSize);
        canvas.defaultCursor = newEraserCursor;
        canvas.hoverCursor = newEraserCursor;
        canvas.moveCursor = newEraserCursor;
        canvas.setCursor(newEraserCursor);
      };

      eraseHandlers.current = { startErase, erase, stopErase, wheelHandler };

      canvas.on("mouse:down", startErase);
      canvas.on("mouse:move", erase);
      canvas.on("mouse:up", stopErase);
      canvas.on("mouse:wheel", wheelHandler);
    } else if (mode === "select") {
      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.skipTargetFind = false;
      canvas.defaultCursor = "default";
      canvas.hoverCursor = "move";
      canvas.moveCursor = "move";

      canvas.getObjects().forEach((obj) => {
        if (obj.customType === "droppedImage") {
          obj.selectable = true;
          obj.evented = true;
          obj.hasControls = true;
          obj.hasBorders = true;
        }
      });

      canvas.getObjects().forEach((obj) => {
        if (obj.customType === "svgDot" || obj.customType === "drawnDot") {
          obj.selectable = true;
          obj.evented = true;
          obj.hasControls = false;
          obj.hasBorders = true;
        }
      });

      Object.values(eraseHandlers.current).forEach((handler) => {
        if (typeof handler === "function") {
          canvas.off("mouse:down", handler);
          canvas.off("mouse:move", handler);
          canvas.off("mouse:up", handler);
          canvas.off("mouse:wheel", handler);
        }
      });
      eraseHandlers.current = {};
    } else if (mode === "pixelErase") {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      canvas.skipTargetFind = true;

      const backgroundColor = "#fafafa";
      const eraserBrush = new fabric.PencilBrush(canvas);
      eraserBrush.width = eraserSizeRef.current;
      eraserBrush.color = backgroundColor;
      canvas.freeDrawingBrush = eraserBrush;

      const createPixelEraserCursor = (size) => {
        const cursorCanvas = document.createElement("canvas");
        const ctx = cursorCanvas.getContext("2d");
        const cursorSize = size + 10;
        cursorCanvas.width = cursorSize;
        cursorCanvas.height = cursorSize;
        ctx.strokeStyle = "#ff6600";
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(cursorSize / 2, cursorSize / 2, size / 2, 0, 2 * Math.PI);
        ctx.stroke();
        return `url(${cursorCanvas.toDataURL()}) ${cursorSize / 2} ${cursorSize / 2}, crosshair`;
      };

      const pixelEraserCursor = createPixelEraserCursor(eraserSizeRef.current);
      canvas.defaultCursor = pixelEraserCursor;
      canvas.hoverCursor = pixelEraserCursor;
      canvas.moveCursor = pixelEraserCursor;
      canvas.freeDrawingCursor = pixelEraserCursor;
      canvas.setCursor(pixelEraserCursor);

      const wheelHandler = (e) => {
        e.e.preventDefault();
        const delta = e.e.deltaY;
        const step = 3;
        const prev = eraserSizeRef.current;
        let newSize;
        if (delta > 0) newSize = Math.max(5, prev - step);
        else newSize = Math.min(100, prev + step);
        eraserSizeRef.current = newSize;

        if (canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.width = newSize;
          canvas.freeDrawingBrush.color = backgroundColor;
        }

        const newPixelEraserCursor = createPixelEraserCursor(newSize);
        canvas.defaultCursor = newPixelEraserCursor;
        canvas.hoverCursor = newPixelEraserCursor;
        canvas.moveCursor = newPixelEraserCursor;
        canvas.freeDrawingCursor = newPixelEraserCursor;
        canvas.setCursor(newPixelEraserCursor);
      };

      const pathCreatedHandler = (e) => {
        if (e.path) {
          const currentActiveLayerId = activeLayerIdRef.current;
          const currentLayers = layersRef.current;
          const activeLayer = currentLayers.find((layer) => layer.id === currentActiveLayerId);

          e.path.set({
            selectable: false,
            evented: false,
            excludeFromExport: false,
            isEraserPath: true,
          });

          if (activeLayer) {
            fabricLayerUtils.assignObjectToLayer(e.path, activeLayer.id, activeLayer.name);
          }
        }
      };

      eraseHandlers.current = { wheelHandler, pathCreatedHandler };

      canvas.on("mouse:wheel", wheelHandler);
      canvas.on("path:created", pathCreatedHandler);
    } else if (mode === "pan") {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.defaultCursor = "grab";
      canvas.hoverCursor = "grab";
      canvas.moveCursor = "grab";
    }
  };

  const toggleDrawingMode = (mode) => {
    if (!drawingModeRef) return;
    drawingModeRef.current = mode;
    setTimeout(() => applyDrawingMode(mode), 0);
  };

  return { updateBrushColor, applyDrawingMode, toggleDrawingMode };
}
