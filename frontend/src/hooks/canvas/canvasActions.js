export function createCanvasActions({ fabricCanvasRef, drawingColorRef, layersRef, activeLayerIdRef, triggerAutoSave, onCanvasChangeRef, setCanvasRevision, width = 800, height = 500, getSceneLayerState, sceneId }) {
  const handleClearAll = () => {
    if (!fabricCanvasRef.current) return;

    if (
      confirm(
        "캔버스의 모든 내용을 지우시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      const canvas = fabricCanvasRef.current;
      const objectCount = canvas.getObjects().length;
      clearCanvas();
      if (typeof triggerAutoSave === "function") {
        triggerAutoSave({ action: "clearAll", clearedCount: objectCount });
      }
      if (onCanvasChangeRef && onCanvasChangeRef.current) onCanvasChangeRef.current();
    }
  };

  const getCurrentCanvasAsSvg = () => {
    if (!fabricCanvasRef.current) return null;

    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();
    const dots = [];

    const pathObjects = [];

    objects.forEach((obj) => {
      if (
        obj.type === "circle" ||
        obj.customType === "svgDot" ||
        obj.customType === "drawnDot"
      ) {
        const centerX = obj.left + obj.radius;
        const centerY = obj.top + obj.radius;
        const dotColor = obj.fill || obj.originalFill || drawingColorRef.current;

        dots.push({
          cx: centerX,
          cy: centerY,
          r: obj.radius,
          fill: dotColor,
          originalColor: dotColor,
        });
      } else if (obj.type === "path") {
        const pathColor = obj.stroke || drawingColorRef.current;

        pathObjects.push({
          type: "path",
          fill: pathColor,
          originalColor: pathColor,
          obj: obj,
        });
      }
    });

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">`;

    dots.forEach((dot) => {
      svgContent += `<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${dot.fill}" />`;
    });

    svgContent += "</svg>";

    return {
      svgString: svgContent,
      totalDots: dots.length,
      totalPaths: pathObjects.length,
      dots: dots,
      paths: pathObjects,
      hasMultipleColors:
        new Set([
          ...dots.map((d) => d.originalColor),
          ...pathObjects.map((p) => p.originalColor),
        ]).size > 1,
    };
  };

  const exportCanvasAsImage = () => {
    if (!fabricCanvasRef.current) return null;

    const canvas = fabricCanvasRef.current;

    const currentViewportTransform = canvas.viewportTransform
      ? [...canvas.viewportTransform]
      : null;

    try {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

      const dataURL = canvas.toDataURL({
        format: "png",
        quality: 1.0,
        multiplier: 1,
      });

      return dataURL;
    } finally {
      if (currentViewportTransform) {
        canvas.setViewportTransform(currentViewportTransform);
      }
    }
  };

  const exportDrawnLinesOnly = () => {
    if (!fabricCanvasRef.current) return null;

    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();

    const hiddenObjects = [];
    objects.forEach((obj) => {
      if (obj.type === "image" || obj.customType === "svgDot") {
        obj.visible = false;
        hiddenObjects.push(obj);
      }
    });

    canvas.renderAll();

    const dataURL = canvas.toDataURL({
      format: "png",
      quality: 1.0,
      multiplier: 1,
      backgroundColor: "white",
    });

    hiddenObjects.forEach((obj) => {
      obj.visible = true;
    });

    canvas.renderAll();

    return dataURL;
  };

  const hasDrawnContent = () => {
    if (!fabricCanvasRef.current) return false;

    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();
    return objects.some(
      (obj) =>
        obj.type === "path" ||
        obj.customType === "drawnDot" ||
        obj.customType === "droppedImage" ||
        obj.customType === "svgDot" ||
        obj.type === "image"
    );
  };

  const clearCanvas = () => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    canvas.getObjects().forEach((obj) => {
      if (obj && obj.name === "canvasBoundary") return;
      canvas.remove(obj);
    });
    canvas.backgroundColor = "#fafafa";
    canvas.renderAll();
    if (typeof setCanvasRevision === "function") {
      setCanvasRevision((c) => c + 1);
    }
  };

  const saveOriginalCanvasState = () => {
    if (!fabricCanvasRef.current) return null;

    const canvas = fabricCanvasRef.current;
    const canvasData = canvas.toJSON([
      'layerId', 'layerName', 'customType', 'originalFill',
      'originalCx', 'originalCy'
    ]);

    const layerState = sceneId ? getSceneLayerState(sceneId) : null;

    const state = {
      ...canvasData,
      layerMetadata: layerState ? {
        layers: layerState.layers,
        activeLayerId: layerState.activeLayerId
      } : null,
      timestamp: Date.now(),
    };

    return state;
  };

  const restoreOriginalCanvasState = (state, loadSceneLayerState) => {
    if (!fabricCanvasRef.current || !state) return false;

    const canvas = fabricCanvasRef.current;

    const existingObjects = canvas
      .getObjects()
      .filter(
        (obj) =>
          obj.customType === "path" ||
          obj.customType === "circle" ||
          obj.type === "image"
      );
    existingObjects.forEach((obj) => canvas.remove(obj));

    const canvasData = state.objects ? { objects: state.objects, version: state.version } : state;

    canvas.loadFromJSON(canvasData, () => {
      canvas.renderAll();

      if (state.layerMetadata && loadSceneLayerState && sceneId) {
        loadSceneLayerState(sceneId, state.layerMetadata);
      }
    });

    return true;
  };

  return {
    handleClearAll,
    getCurrentCanvasAsSvg,
    exportCanvasAsImage,
    exportDrawnLinesOnly,
    hasDrawnContent,
    clearCanvas,
    saveOriginalCanvasState,
    restoreOriginalCanvasState,
  };
}
