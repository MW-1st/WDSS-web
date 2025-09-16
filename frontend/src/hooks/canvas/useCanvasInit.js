import { useLayoutEffect } from "react";
import * as fabric from "fabric";
import * as fabricLayerUtils from "../../utils/fabricLayerUtils";

// 사용자 정의 속성(layerId, layerName)이 toJSON() 호출 시 포함되도록 설정
// 이 설정은 이 모듈이 로드될 때 한 번만 실행됩니다.
fabric.Object.prototype.toObject = (function (toObject) {
  return function (propertiesToInclude) {
    propertiesToInclude = (propertiesToInclude || []).concat([
      'layerId',
      'layerName',
    ]);
    return toObject.call(this, propertiesToInclude);
  };
})(fabric.Object.prototype.toObject);

export default function useCanvasInit({
  canvasRef,
  fabricCanvasRef,
  width,
  height,
  externalDrawingColor,
  externalDrawingMode,
  externalStageRef,
  schedulePreview,
  activeLayerIdRef,
  layersRef,
  triggerAutoSave,
  saveToHistory,
  onCanvasChangeRef,
  onSelectionChangeRef,
  setCanvasRevision,
  setDrawingMode,
  applyDrawingMode,
  currentColorRef,
  drawingModeRef,
  prevInteractMapRef,
  setDeleteIconPos,
  eraseHandlers,
  selectionHandlers,
  onPanChange,
}) {
  useLayoutEffect(() => {
    if (!canvasRef.current) return;

    // Guard: if a fabric canvas is already attached, skip re-initialization.
    if (fabricCanvasRef && fabricCanvasRef.current) {
      // Ensure externalStageRef is set if provided
      if (externalStageRef) externalStageRef.current = fabricCanvasRef.current;
      return;
    }

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: width,
      height: height,
      backgroundColor: "#fafafa",
      renderOnAddRemove: false,
      selection: false,
      skipTargetFind: false,
      perPixelTargetFind: false,
      enableRetinaScaling: false,
    });

    const clipPath = new fabric.Rect({
      left: 0,
      top: 0,
      width: width,
      height: height,
      absolutePositioned: true,
    });
    canvas.clipPath = clipPath;

    const brush = new fabric.PencilBrush(canvas);
    brush.width = 2;
    brush.color = externalDrawingColor;
    brush.decimate = 2;
    brush.limitedToCanvasSize = true;
    canvas.freeDrawingBrush = brush;

    try {
      if (!(externalDrawingMode === "draw" || externalDrawingMode === "pixelErase")) {
        canvas.isDrawingMode = false;
        canvas.selection = externalDrawingMode === "select";
        canvas.skipTargetFind =
          externalDrawingMode === "draw" ||
          externalDrawingMode === "pixelErase" ||
          externalDrawingMode === "erase" ||
          externalDrawingMode === "brush";
      }
    } catch (_) {}
    fabricCanvasRef.current = canvas;

    if (externalStageRef) {
      externalStageRef.current = canvas;
    }

    const previewEvents = ["object:added", "object:modified", "object:removed", "path:created"];
    previewEvents.forEach((evt) => canvas.on(evt, schedulePreview));

    canvas.renderOnAddRemove = true;
    canvas.renderAll();

    const handleCanvasZoom = (opt) => {
      const e = opt.e;
      if (e.ctrlKey) {
        e.preventDefault();

        const delta = e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;

        if (zoom > 20) zoom = 20;
        if (zoom < 0.01) zoom = 0.01;

        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      }
    };

    const addCanvasBoundary = () => {
      const boundary = new fabric.Rect({
        left: 0,
        top: 0,
        width: width,
        height: height,
        fill: "transparent",
        stroke: "#999",
        strokeWidth: 1,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        excludeFromExport: true,
        name: "canvasBoundary",
      });
      canvas.add(boundary);
      canvas.sendObjectToBack(boundary);
    };

    let isPanMode = false;
    let isPanning = false;
    let lastPosX, lastPosY;
    let originalDrawingMode = false;
    let originalSelection = false;

    const enterPanMode = () => {
      if (isPanMode) return;

      originalDrawingMode = canvas.isDrawingMode;
      originalSelection = canvas.selection;

      isPanMode = true;
      canvas.isDrawingMode = false;
      canvas.selection = false;
      try {
        if (eraseHandlers.current) {
          if (eraseHandlers.current.startDraw) {
            canvas.off("mouse:down", eraseHandlers.current.startDraw);
            canvas.off("mouse:move", eraseHandlers.current.continueDraw);
            canvas.off("mouse:up", eraseHandlers.current.stopDraw);
          }
          if (eraseHandlers.current.startErase) {
            canvas.off("mouse:down", eraseHandlers.current.startErase);
            canvas.off("mouse:move", eraseHandlers.current.erase);
            canvas.off("mouse:up", eraseHandlers.current.stopErase);
          }
          if (eraseHandlers.current.wheelHandler) {
            canvas.off("mouse:wheel", eraseHandlers.current.wheelHandler);
          }
        }
      } catch (_) {}
      canvas.defaultCursor = "grab";
      canvas.hoverCursor = "grab";
      canvas.moveCursor = "grab";
      canvas.setCursor("grab");

      const prevMap = prevInteractMapRef.current;
      canvas.getObjects().forEach((obj) => {
        prevMap.set(obj, { selectable: obj.selectable, evented: obj.evented });
        obj.selectable = false;
        obj.evented = false;
      });
      try {
        onPanChange && onPanChange(true);
      } catch {}
    };

    const exitPanMode = () => {
      if (!isPanMode) return;

      isPanMode = false;
      isPanning = false;

      setDrawingMode("select");
      applyDrawingMode("select", currentColorRef.current);

      const prevMap = prevInteractMapRef.current;
      canvas.getObjects().forEach((obj) => {
        const prev = prevMap.get(obj);
        if (prev) {
          obj.selectable = prev.selectable;
          obj.evented = prev.evented;
          prevMap.delete(obj);
        } else {
          obj.selectable = true;
          obj.evented = true;
        }
      });

      canvas.isDrawingMode = originalDrawingMode;
      canvas.selection = originalSelection;
      try {
        applyDrawingMode(drawingModeRef.current, currentColorRef.current);
      } catch (_) {
        canvas.defaultCursor = "default";
        canvas.hoverCursor = "move";
        canvas.moveCursor = "move";
        canvas.setCursor("default");
      }

      try {
        onPanChange && onPanChange(false);
      } catch {}
    };

    const handleMouseDown = (opt) => {
      if (isPanMode && !isPanning) {
        isPanning = true;
        lastPosX = opt.e.clientX;
        lastPosY = opt.e.clientY;
        canvas.setCursor("grabbing");
        opt.e.preventDefault();
        opt.e.stopImmediatePropagation();
      }
    };

    const handleMouseMove = (opt) => {
      if (isPanMode && isPanning) {
        const e = opt.e;
        const vpt = canvas.viewportTransform;
        vpt[4] += e.clientX - lastPosX;
        vpt[5] += e.clientY - lastPosY;
        canvas.requestRenderAll();
        lastPosX = e.clientX;
        lastPosY = e.clientY;
        opt.e.preventDefault();
        opt.e.stopImmediatePropagation();
      }
    };

    const handleMouseUp = (opt) => {
      if (isPanMode && isPanning) {
        isPanning = false;
        canvas.setCursor("grab");
        opt.e.preventDefault();
        opt.e.stopImmediatePropagation();
      }
    };

    const handlePathCreated = (e) => {
      const path = e.path;
      if (path) {
        const currentActiveLayerId = activeLayerIdRef.current;
        const currentLayers = layersRef.current;
        const activeLayer = currentLayers.find((layer) => layer.id === currentActiveLayerId);

        if (activeLayer) {
          fabricLayerUtils.assignObjectToLayer(path, activeLayer.id, activeLayer.name);
          setCanvasRevision((c) => c + 1);

          triggerAutoSave({ drawingMode: "draw" });
          saveToHistory("draw")
          if (onCanvasChangeRef.current) onCanvasChangeRef.current();
        }
      }
    };

    const handleObjectAdded = (e) => {
      const obj = e.target;
      if (obj && !obj.layerId) {
        const currentActiveLayerId = activeLayerIdRef.current;
        const currentLayers = layersRef.current;
        const activeLayer = currentLayers.find((layer) => layer.id === currentActiveLayerId);

        if (activeLayer) {
          fabricLayerUtils.assignObjectToLayer(obj, activeLayer.id, activeLayer.name);
        }
      }
    };

    const notifySelection = () => {
      const cb = onSelectionChangeRef.current;
      if (!cb) return;
      const active = canvas.getActiveObject();
      if (!active) {
        cb(null);
        return;
      }
      cb({
        type: active.type || null,
        customType: active.customType || null,
        fill: active.fill || null,
        stroke: active.stroke || null,
        radius: typeof active.radius === "number" ? active.radius : null,
        left: active.left ?? null,
        top: active.top ?? null,
        layerId: active.layerId || null,
      });
    };

    const updateDeleteIconPosition = () => {
      const active = canvas.getActiveObject();
      if (!active) {
        setDeleteIconPos(null);
        return;
      }
      try {
        if (typeof active.setCoords === "function") active.setCoords();

        const aCoords = active.aCoords;
        if (!aCoords || !aCoords.tr) {
          setDeleteIconPos(null);
          return;
        }

        const tr = aCoords.tr;

        const el = canvas.getElement();
        const clientW = el.clientWidth || canvas.getWidth();
        const clientH = el.clientHeight || canvas.getHeight();
        const scaleX = clientW / canvas.getWidth();
        const scaleY = clientH / canvas.getHeight();

        const BTN = 28;
        const OFFSET_X = 24;
        const OFFSET_Y = 8;

        const leftCss = tr.x * scaleX - OFFSET_X;
        const topCss = tr.y * scaleY - OFFSET_Y;

        const clampedLeft = Math.max(0, Math.min(leftCss, clientW - BTN));
        const clampedTop = Math.max(0, Math.min(topCss, clientH - BTN));

        setDeleteIconPos({ left: clampedLeft, top: clampedTop });
      } catch (e) {
        setDeleteIconPos(null);
      }
    };

    const handleCreated = () => {
      notifySelection();
      updateDeleteIconPosition();
    };
    const handleUpdated = () => {
      notifySelection();
      updateDeleteIconPosition();
    };
    const handleCleared = () => {
      const cb = onSelectionChangeRef.current;
      if (cb) cb(null);
      setDeleteIconPos(null);
    };

    canvas.on("selection:created", handleCreated);
    canvas.on("selection:updated", handleUpdated);
    canvas.on("selection:cleared", handleCleared);

    const handleTransforming = () => updateDeleteIconPosition();
    const handleModified = () => updateDeleteIconPosition();
    const handleWheel = () => updateDeleteIconPosition();
    const handleAfterRender = () => updateDeleteIconPosition();
    canvas.on("object:moving", handleTransforming);
    canvas.on("object:scaling", handleTransforming);
    canvas.on("object:rotating", handleTransforming);
    canvas.on("object:modified", handleModified);
    canvas.on("mouse:wheel", handleWheel);
    canvas.on("after:render", handleAfterRender);
    selectionHandlers.current = { handleCreated, handleUpdated, handleCleared };

    canvas.on("mouse:wheel", handleCanvasZoom);
    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);
    canvas.on("path:created", handlePathCreated);
    canvas.on("object:added", handleObjectAdded);

    canvas.enterPanMode = enterPanMode;
    canvas.exitPanMode = exitPanMode;
    canvas.getPanMode = () => isPanMode;

    addCanvasBoundary();

    const handleObjectMoved = () => {
      triggerAutoSave({ action: "objectMoved" });
      saveToHistory("objectMoved");
      if (onCanvasChangeRef.current) onCanvasChangeRef.current();
    };

    const handleObjectScaled = () => {
      triggerAutoSave({ action: "objectScaled" });
      saveToHistory("objectScaled");
      if (onCanvasChangeRef.current) onCanvasChangeRef.current();
    };

    const handleObjectRotated = () => {
      triggerAutoSave({ action: "objectRotated" });
      saveToHistory("objectRotated");
      if (onCanvasChangeRef.current) onCanvasChangeRef.current();
    };

    const handleObjectModified = () => {
      triggerAutoSave({ action: "objectModified" });
      saveToHistory("objectModified");
      if (onCanvasChangeRef.current) onCanvasChangeRef.current();
    };

    canvas.on("object:moved", handleObjectMoved);
    canvas.on("object:scaled", handleObjectScaled);
    canvas.on("object:rotated", handleObjectRotated);
    canvas.on("object:modified", handleObjectModified);

    return () => {
      canvas.off("mouse:wheel", handleCanvasZoom);
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
      canvas.off("path:created", handlePathCreated);
      canvas.off("object:added", handleObjectAdded);
      if (selectionHandlers.current.handleCreated)
        canvas.off("selection:created", selectionHandlers.current.handleCreated);
      if (selectionHandlers.current.handleUpdated)
        canvas.off("selection:updated", selectionHandlers.current.handleUpdated);
      if (selectionHandlers.current.handleCleared)
        canvas.off("selection:cleared", selectionHandlers.current.handleCleared);
      canvas.off("object:moving", handleTransforming);
      canvas.off("object:scaling", handleTransforming);
      canvas.off("object:rotating", handleTransforming);
      canvas.off("object:modified", handleModified);
      canvas.off("after:render", handleAfterRender);
      canvas.off("object:moved", handleObjectMoved);
      canvas.off("object:scaled", handleObjectScaled);
      canvas.off("object:rotated", handleObjectRotated);
      canvas.off("object:modified", handleObjectModified);
      try {
        canvas.dispose();
      } catch (_) {}
      // Clear ref so future initializations can run
      if (fabricCanvasRef) fabricCanvasRef.current = null;
    };
  }, [externalStageRef, onCanvasChangeRef, onSelectionChangeRef]);
}
