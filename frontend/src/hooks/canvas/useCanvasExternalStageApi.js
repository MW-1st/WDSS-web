import { useEffect } from "react";

// 외부 stageRef에 API 메서드를 등록합니다. 상위 컴포넌트에서
// 캔버스를 명령형으로 제어할 수 있도록(예: applyDrawingMode, JSON 로드,
// 레이어 관리) 단일 위치에서 등록을 관리합니다.
export default function useCanvasExternalStageApi({
  externalStageRef,
  fabricCanvas,
  setCanvasRevision,
  getCurrentCanvasAsSvg,
  exportCanvasAsImage,
  exportDrawnLinesOnly,
  hasDrawnContent,
  clearCanvas,
  saveOriginalCanvasState,
  restoreOriginalCanvasState,
  applyDrawingMode,
  externalDrawingColor,
  setDrawingMode,
  drawingColor,
  updateBrushColor,
  getSortedLayers,
  activeLayerId,
  setActiveLayerId,
  createLayer,
  handleDeleteLayer,
  renameLayer,
  handleLayerVisibilityChange,
  handleLayerLockChange,
  reorderLayers,
  changeSaveMode,
  loadSceneLayerState,
  getSceneLayerState,
  saveCurrentSceneLayerState,
  restoreSceneLayerState,
}) {
  useEffect(() => {
    if (externalStageRef && externalStageRef.current) {
      externalStageRef.current.getCurrentCanvasAsSvg = getCurrentCanvasAsSvg;
      externalStageRef.current.exportCanvasAsImage = exportCanvasAsImage;
      externalStageRef.current.exportDrawnLinesOnly = exportDrawnLinesOnly;
      externalStageRef.current.hasDrawnContent = hasDrawnContent;
      externalStageRef.current.clear = clearCanvas;

      // JSON native loader
      externalStageRef.current.loadFabricJsonNative = (url) => {
        if (!fabricCanvas.current) return;

        const canvas = fabricCanvas.current;

        if (url.endsWith(".json")) {
          fetch(url)
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.json();
            })
            .then((fabricJsonData) => {
              canvas.clear();

              canvas.loadFromJSON(fabricJsonData, () => {
                canvas.getObjects().forEach((obj) => {
                  if (obj.type === "circle") {
                    obj.set({
                      customType: "jsonDot",
                      selectable: false,
                      evented: true,
                      hoverCursor: "crosshair",
                      moveCursor: "crosshair",
                    });
                  }
                });

                canvas.renderAll();
              });
            })
            .catch((err) => {
              console.error("JSON 로드 실패:", err);
              alert("변환된 데이터를 불러오는데 실패했습니다.");
            });
        } else {
          console.warn("JSON 파일이 아닙니다:", url);
        }
      };

      // External API: applyDrawingMode
      externalStageRef.current.applyDrawingMode = (mode, color) => {
        const currentColor = color || externalDrawingColor;
        applyDrawingMode(mode, currentColor);
      };

      externalStageRef.current.setDrawingMode = (mode) => {
        setDrawingMode(mode);
        setTimeout(() => {
          externalStageRef.current.applyDrawingMode(mode, drawingColor);
        }, 10);
      };

      externalStageRef.current.setDrawingColor = (color) => {
        updateBrushColor(color);
        setDrawingMode((currentMode) => {
          if (currentMode !== "pixelErase") {
            updateBrushColor(color);
          }
          return currentMode;
        });
      };

      externalStageRef.current.saveOriginalCanvasState = saveOriginalCanvasState;
      externalStageRef.current.restoreOriginalCanvasState = restoreOriginalCanvasState;

      externalStageRef.current.layers = {
        getLayers: getSortedLayers,
        getActiveLayerId: () => activeLayerId,
        setActiveLayer: setActiveLayerId,
        createLayer,
        deleteLayer: handleDeleteLayer,
        renameLayer,
        toggleVisibility: handleLayerVisibilityChange,
        toggleLock: handleLayerLockChange,
        reorderLayers: reorderLayers,
      };

      externalStageRef.current.changeSaveMode = changeSaveMode;
      externalStageRef.current.saveCurrentSceneLayerState = saveCurrentSceneLayerState;
      externalStageRef.current.restoreSceneLayerState = restoreSceneLayerState;
      externalStageRef.current.loadSceneLayerState = loadSceneLayerState;
      externalStageRef.current.getSceneLayerState = getSceneLayerState;

      // Force viewport recalculation from parent (e.g., after loadFromJSON)
      externalStageRef.current.recalcViewport = () => {
        try { if (typeof setCanvasRevision === 'function') setCanvasRevision(c => c + 1); } catch (_) {}
      };
    }
  }, [
    externalStageRef,
    setCanvasRevision,
    getSortedLayers,
    activeLayerId,
    setActiveLayerId,
    createLayer,
    handleDeleteLayer,
    renameLayer,
    handleLayerVisibilityChange,
    handleLayerLockChange,
    reorderLayers,
    changeSaveMode,
    saveCurrentSceneLayerState,
    restoreSceneLayerState,
    loadSceneLayerState,
    getSceneLayerState,
    // keep stable references to functions passed in
    getCurrentCanvasAsSvg,
    exportCanvasAsImage,
    exportDrawnLinesOnly,
    hasDrawnContent,
    clearCanvas,
    saveOriginalCanvasState,
    restoreOriginalCanvasState,
    applyDrawingMode,
    externalDrawingColor,
    setDrawingMode,
    drawingColor,
    updateBrushColor,
  ]);
}
