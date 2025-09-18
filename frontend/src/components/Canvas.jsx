import { useRef, useEffect, useCallback } from "react";

// Local UI
import CanvasView from "../hooks/canvas/CanvasView";

// Hooks (moved to src/hooks/canvas)
import useCanvasState from "../hooks/canvas/useCanvasState";
import useCanvasInit from "../hooks/canvas/useCanvasInit";
import useCanvasImageLoader from "../hooks/canvas/useCanvasImageLoader";
import useCanvasExternalStageApi from "../hooks/canvas/useCanvasExternalStageApi";
import useCanvasPreview from "../hooks/canvas/useCanvasPreview";
import useCanvasViewport from "../hooks/canvas/useCanvasViewport";
import useCanvasKeyboardDelete from "../hooks/canvas/useCanvasKeyboardDelete";
import useCanvasLayerRefs from "../hooks/canvas/useCanvasLayerRefs";
import useLayers from "../hooks/useLayers";

// Actions / utilities
import { createDrawingModes } from "../hooks/canvas/canvasDrawingModes";
import { createCanvasActions } from "../hooks/canvas/canvasActions";
import { createCanvasImageActions } from "../hooks/canvas/canvasImageActions";
import { createCanvasDragDrop } from "../hooks/canvas/canvasDragDrop";
import * as fabricLayerUtils from "../utils/fabricLayerUtils";

// --------------------------------------------------
// 컴포넌트: Canvas
// props: 크기, 초기 모드/색상, 레이어/콜백 등
// --------------------------------------------------
export default function Canvas({
  width = 800,
  height = 500,
  imageUrl = "",
  stageRef: externalStageRef,
  drawingMode: externalDrawingMode = "select",
  eraserSize: externalEraserSize = 20,
  drawingColor: externalDrawingColor = "#222222",
  activeLayerId: externalActiveLayerId,
  onPreviewChange,
  onCanvasChange,
  onModeChange,
  onSelectionChange,
  onPanChange,
  scene,
  projectId,
  changeSaveMode,
  triggerAutoSave,
  saveToHistory,
  isSceneTransformed = false,
}) {
  // Canvas: 캔버스 훅들을 조합하고 외부 API를 노출합니다.
  // - 상태 및 refs는 `useCanvasState`에서 제공합니다.
  // - 초기화와 부수효과는 재사용 가능한 훅으로 위임합니다.

  /* 상태 및 refs (useCanvasState에서 제공) */
  const {
    canvasRef,
    fabricCanvas,
    drawingMode,
    setDrawingMode,
    eraserSize,
    setEraserSize,
    drawingColor,
    setDrawingColor,
    currentColorRef,
    drawingModeRef,
    eraseHandlers,
    selectionHandlers,
    onSelectionChangeRef,
    onCanvasChangeRef,
    isDragOver,
    setIsDragOver,
    canvasRevision,
    setCanvasRevision,
    deleteIconPos,
    setDeleteIconPos,
    maxDroneWarningShownRef,
    prevInteractMapRef,
  } = useCanvasState({
    externalDrawingMode,
    externalEraserSize,
    externalDrawingColor,
    onSelectionChange,
    onCanvasChange,
  });

  /* 프리뷰 스케줄러 */
  const { schedulePreview, previewTimerRef } = useCanvasPreview({
    fabricCanvasRef: fabricCanvas,
    onPreviewChange,
  });

  const sceneId = scene?.id;

  /* 레이어 관리 훅 */
  const {
    layers,
    activeLayerId,
    setActiveLayerId,
    createLayer,
    deleteLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    renameLayer,
    reorderLayers,
    getActiveLayer,
    getLayer,
    getSortedLayers,
    loadSceneLayerState,
    getSceneLayerState,
  } = useLayers(scene?.id);

  /* 레이어 참조(derived) */
  const { activeLayerIdRef, layersRef, getSortedLayersRef } =
    useCanvasLayerRefs({
      layers,
      activeLayerId,
      getSortedLayers,
      canvasRef: fabricCanvas,
      setCanvasRevision,
      canvasRevision,
    });

  /* 레이어 상태와 Fabric.js 동기화 */
  useEffect(() => {
    if (!fabricCanvas.current || !layers || layers.length === 0) return;

    const canvas = fabricCanvas.current;
    const objects = canvas.getObjects();
    const sortedLayers = getSortedLayers();

    // zIndex가 높은 레이어부터 순회하며 객체를 캔버스 맨 뒤로 보냅니다.
    // 최종적으로 zIndex가 가장 낮은 레이어의 객체가 맨 뒤에 남게 됩니다.
    [...sortedLayers].reverse().forEach(layer => {
      const objectsInLayer = objects.filter(obj => obj.layerId === layer.id);
      // 한 레이어 내 객체들의 순서를 유지하기 위해 역순으로 처리합니다.
      objectsInLayer.reverse().forEach(obj => {
        canvas.sendObjectToBack(obj);
      });
    });

    // 레이어 속성(visible, locked) 동기화
    objects.forEach(obj => {
      if (obj.name === 'canvasBoundary') return;

      if (!obj.layerId) {
        obj.set('layerId', activeLayerId);
      }

      const layer = getLayer(obj.layerId);
      if (layer) {
        obj.set({
          visible: layer.visible,
          selectable: !layer.locked,
          evented: !layer.locked
        });
      }
    });

    canvas.renderAll();
  }, [layers, activeLayerId, getLayer, getSortedLayers, canvasRevision]);

  /* 리사이즈 및 뷰포트 처리 */
  useCanvasViewport(fabricCanvas, width, height);

  /* 키보드 삭제(Del 키) 처리 */
  useCanvasKeyboardDelete(
    fabricCanvas,
    drawingModeRef,
    onSelectionChangeRef,
    triggerAutoSave,
    saveToHistory,
    onCanvasChangeRef
  );

  /* 브러시/지우개 유틸 */
  const eraserSizeRef = useRef(eraserSize);
  useEffect(() => {
    eraserSizeRef.current = eraserSize;
  }, [eraserSize]);

  const drawingModes = createDrawingModes({
    fabricCanvasRef: fabricCanvas,
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
  });

  const { updateBrushColor, applyDrawingMode, toggleDrawingMode } =
    drawingModes;

  /* 이미지/JSON 로더 및 외부 prop 동기화 */
  useCanvasImageLoader({
    fabricCanvasRef: fabricCanvas,
    imageUrl,
    scene,
    drawingModeRef,
    currentColorRef,
    applyDrawingMode,
    setDrawingMode,
    drawingMode,
    setEraserSize,
    eraserSize,
    setDrawingColor,
    drawingColor,
    externalDrawingMode,
    externalEraserSize,
    externalDrawingColor,
    externalActiveLayerId,
    setActiveLayerId,
    updateBrushColor,
    onCanvasChangeRef,
    setCanvasRevision,
    loadSceneLayerState,
  });

  /* Fabric 캔버스 초기화 */
  useCanvasInit({
    canvasRef,
    fabricCanvasRef: fabricCanvas,
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
  });

  /* 이미지 추가 및 드래그앤드롭 핸들러 */
  const addImageToCanvasRef = useRef();
  addImageToCanvasRef.current = null;

  const canvasImageActions = createCanvasImageActions({
    fabricCanvasRef: fabricCanvas,
    width,
    height,
    externalActiveLayerId: externalActiveLayerId,
    layers,
    setCanvasRevision,
    triggerAutoSave,
    saveToHistory,
    onCanvasChangeRef,
  });
  const { addImageToCanvas } = canvasImageActions;
  addImageToCanvasRef.current = addImageToCanvas;

  const applyDrawingModeRef = useRef(applyDrawingMode);
  useEffect(() => {
    applyDrawingModeRef.current = applyDrawingMode;
  }, [applyDrawingMode]);

  const onModeChangeRef = useRef(onModeChange);
  useEffect(() => {
    onModeChangeRef.current = onModeChange;
  }, [onModeChange]);

  const isSceneTransformedRef = useRef(isSceneTransformed);
  useEffect(() => {
    isSceneTransformedRef.current = isSceneTransformed;
  }, [isSceneTransformed]);

  const dragDropHandlers = createCanvasDragDrop({
    fabricCanvasRef: fabricCanvas,
    isSceneTransformedRef,
    setIsDragOver,
    addImageToCanvasRef,
    setDrawingMode,
    applyDrawingModeRef,
    onModeChangeRef,
  });

  const { handleDragOver, handleDragLeave, handleDrop } = dragDropHandlers;

  const canvasActions = createCanvasActions({
    fabricCanvasRef: fabricCanvas,
    drawingColorRef: currentColorRef,
    layersRef,
    activeLayerIdRef,
    triggerAutoSave,
    saveToHistory,
    onCanvasChangeRef,
    setCanvasRevision,
    width,
    height,
  });

  const {
    handleClearAll,
    getCurrentCanvasAsSvg,
    exportCanvasAsImage,
    exportDrawnLinesOnly,
    hasDrawnContent,
    clearCanvas,
    saveOriginalCanvasState,
    restoreOriginalCanvasState,
  } = canvasActions;

  /* 레이어 제어 유틸 */
  const handleLayerVisibilityChange = useCallback(
    (layerId) => {
      if (fabricCanvas.current) {
        const layer = getLayer(layerId);
        if (layer) {
          fabricLayerUtils.setLayerVisibility(
            fabricCanvas.current,
            layerId,
            !layer.visible
          );
          toggleLayerVisibility(layerId);
          setCanvasRevision((c) => c + 1);
        }
      }
    },
    [getLayer, toggleLayerVisibility, setCanvasRevision]
  );

  const handleLayerLockChange = useCallback(
    (layerId) => {
      if (fabricCanvas.current) {
        const layer = getLayer(layerId);
        if (layer) {
          fabricLayerUtils.setLayerLock(
            fabricCanvas.current,
            layerId,
            !layer.locked
          );
          toggleLayerLock(layerId);
          setCanvasRevision((c) => c + 1);
        }
      }
    },
    [getLayer, toggleLayerLock, setCanvasRevision]
  );

  const handleDeleteLayer = useCallback(
    (layerId) => {
      if (fabricCanvas.current) {
        fabricLayerUtils.deleteLayerObjects(fabricCanvas.current, layerId);
        setCanvasRevision((c) => c + 1);
        deleteLayer(layerId);
      }
    },
    [deleteLayer]
  );

  /* 외부 stageRef API 등록 */
  useCanvasExternalStageApi({
    externalStageRef,
    fabricCanvas,
    getCurrentCanvasAsSvg,
    exportCanvasAsImage,
    exportDrawnLinesOnly,
    hasDrawnContent,
    clearCanvas,
    saveOriginalCanvasState,
    restoreOriginalCanvasState: (state) => restoreOriginalCanvasState(state, loadSceneLayerState),
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
    saveCurrentSceneLayerState: () => scene?.id ? getSceneLayerState(scene.id) : null,
    restoreSceneLayerState: (sceneId, layerState) => {
      if (sceneId && layerState) {
        loadSceneLayerState(sceneId, layerState);
        setTimeout(() => {
          if (fabricCanvas.current) {
            const canvas = fabricCanvas.current;
            const objects = canvas.getObjects();

            objects.forEach(obj => {
              // 캔버스 경계선은 제외
              if (obj.name === 'canvasBoundary') return;

              if (!obj.layerId && layerState.activeLayerId) {
                obj.set('layerId', layerState.activeLayerId);
              }

              const layerId = obj.layerId;
              const layer = layerState.layers ? layerState.layers.find(l => l.id === layerId) : null;

              if (layer) {
                obj.set({
                  visible: layer.visible,
                  selectable: !layer.locked,
                  evented: !layer.locked
                });
              }
            });

            canvas.renderAll();
          }
        }, 100);
      }
    },
  });

  /* 렌더링 */
  const handleDeleteSelection = () => {
    if (!fabricCanvas.current) return;
    const canvas = fabricCanvas.current;
    const activeObjects = canvas.getActiveObjects();
    if (!activeObjects || activeObjects.length === 0) return;
    activeObjects.forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setDeleteIconPos(null);
    const cb = onSelectionChangeRef.current;
    if (cb) cb(null);
    triggerAutoSave({
      action: "deleteButton",
      deletedCount: activeObjects.length,
    });
    saveToHistory("deleteButton");
    if (onCanvasChangeRef.current) onCanvasChangeRef.current();
  };

  return (
    <CanvasView
      canvasRef={canvasRef}
      isDragOver={isDragOver}
      deleteIconPos={deleteIconPos}
      drawingMode={drawingMode}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDeleteSelection={handleDeleteSelection}
    />
  );
}
