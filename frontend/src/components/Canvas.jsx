import {
  useRef,
  useLayoutEffect,
  useEffect,
  useState,
  useCallback,
} from "react";
import { MdDelete } from "react-icons/md";
// fabric.js 최적화: 필요한 부분만 import
import {
  Canvas as FabricCanvas,
  Circle,
  FabricImage,
  PencilBrush,
  Rect,
} from "fabric";
import useLayers from "../hooks/useLayers";
import * as fabricLayerUtils from "../utils/fabricLayerUtils";
import {loadCanvasFromIndexedDB, saveCanvasToIndexedDB} from "../utils/indexedDBUtils.js";

export default function Canvas({
  width = 800,
  height = 500,
  imageUrl = "",
  stageRef: externalStageRef,
  drawingMode: externalDrawingMode = "draw",
  eraserSize: externalEraserSize = 20,
  drawingColor: externalDrawingColor = '#222222',
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
}) {
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);
  const [drawingMode, setDrawingMode] = useState(externalDrawingMode);
  const [eraserSize, setEraserSize] = useState(externalEraserSize);
  const [drawingColor, setDrawingColor] = useState(externalDrawingColor);
  const currentColorRef = useRef(externalDrawingColor);
  useEffect(() => { currentColorRef.current = externalDrawingColor; }, [externalDrawingColor]);
  // Keep latest drawing mode accessible inside closures
  const drawingModeRef = useRef(drawingMode);
  useEffect(() => { drawingModeRef.current = drawingMode; }, [drawingMode]);
  const eraseHandlers = useRef({});
  const selectionHandlers = useRef({});
  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange; }, [onSelectionChange]);
  const onCanvasChangeRef = useRef(onCanvasChange);
  useEffect(() => { onCanvasChangeRef.current = onCanvasChange; }, [onCanvasChange]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [canvasRevision, setCanvasRevision] = useState(0);
  const [deleteIconPos, setDeleteIconPos] = useState(null);
  const maxDroneWarningShownRef = useRef(false);
  const previewTimerRef = useRef(null);
  // pan 모드 전/후 객체 상호작용 상태 저장용
  const prevInteractMapRef = useRef(new WeakMap());

  const schedulePreview = useCallback(() => {
    if (!onPreviewChange || !fabricCanvas.current) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      try {
        const dataURL = fabricCanvas.current.toDataURL({ format: 'png', quality: 0.92, multiplier: 1 });
        onPreviewChange(dataURL);
      } catch (_) {}
    }, 200);
  }, [onPreviewChange]);

  const sceneId = scene?.id;

  // 레이어 관리 훅
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
    getSortedLayers
  } = useLayers();

  // 클로저(closure) 문제 해결을 위한 ref
  // 이벤트 핸들러가 항상 최신 값을 참조하도록 보장
  const activeLayerIdRef = useRef(activeLayerId);
  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

  const layersRef = useRef(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const getSortedLayersRef = useRef(getSortedLayers);
  useEffect(() => {
    getSortedLayersRef.current = getSortedLayers;
  }, [getSortedLayers]);

  // [중요] 레이어 상태 동기화를 위한 중앙 집중식 Effect
  // layers 배열(순서, zIndex 등 포함)이 변경될 때마다 캔버스 객체들의 순서를 재정렬합니다.
  // 이것이 캔버스와 레이어 패널의 상태를 일치시키는 가장 확실한 방법입니다.
  useEffect(() => {
    if (fabricCanvas.current) {
      console.log('🔄 [Sync Effect] Layer state changed, reordering canvas objects...');
      // getSortedLayers는 layers 상태에 의존하므로, 이 effect가 실행될 때는 항상 최신 상태를 반영합니다.
      const sortedLayers = getSortedLayers();
      fabricLayerUtils.reorderObjectsByLayers(fabricCanvas.current, sortedLayers);
    }
  }, [layers, canvasRevision]); // 'layers' 또는 'canvasRevision' 상태가 변경될 때마다 실행

  // Use useLayoutEffect to initialize the canvas (once)
  useLayoutEffect(() => {
    if (!canvasRef.current) return;

    // 최적화된 fabric.js 캔버스 초기화
    const canvas = new FabricCanvas(canvasRef.current, {
      width: width,
      height: height,
      backgroundColor: "#fafafa",
      renderOnAddRemove: false, // 성능 최적화
      selection: false, // 처음엔 선택 비활성화 (나중에 모드별로 설정)
      skipTargetFind: false, // 이미지 선택을 위해 false로 변경
      perPixelTargetFind: false, // 픽셀 단위 대상 찾기 비활성화
      enableRetinaScaling: false, // 레티나 스케일링 비활성화로 성능 향상
    });

    // 그리기 영역을 캔버스 경계로 제한
    const clipPath = new Rect({
      left: 0,
      top: 0,
      width: width,
      height: height,
      absolutePositioned: true
    });
    canvas.clipPath = clipPath;

    // 그리기 모드 설정 (성능 최적화)
    canvas.isDrawingMode = true;
    const brush = new PencilBrush(canvas);
    brush.width = 2; // 원래 크기로 복원
    brush.color = externalDrawingColor; // 외부에서 전달받은 색상 사용
    brush.decimate = 2; // 브러시 포인트 간소화
    brush.limitedToCanvasSize = true; // 캔버스 경계 제한
    canvas.freeDrawingBrush = brush;
    // 초기 외부 모드가 드로잉이 아니면 즉시 비활성화하여 첫 클릭에 선이 그려지지 않도록 함
    try {
      if (!(externalDrawingMode === 'draw' || externalDrawingMode === 'pixelErase')) {
        canvas.isDrawingMode = false;
        canvas.selection = (externalDrawingMode === 'select');
        canvas.skipTargetFind = externalDrawingMode === 'draw' || externalDrawingMode === 'pixelErase' || externalDrawingMode === 'erase' || externalDrawingMode === 'brush';
      }
    } catch (_) {}
    fabricCanvas.current = canvas;

    if (externalStageRef) {
      externalStageRef.current = canvas;
    }

    // Preview update on core canvas events (debounced)
    const previewEvents = ['object:added', 'object:modified', 'object:removed', 'path:created'];
    previewEvents.forEach((evt) => canvas.on(evt, schedulePreview));

    // 초기 렌더링 활성화
    canvas.renderOnAddRemove = true;
    canvas.renderAll();

    // 간단한 줌 기능 추가
    const handleCanvasZoom = (opt) => {
      const e = opt.e;
      
      // Ctrl키와 함께 휠 이벤트가 발생한 경우에만 처리
      if (e.ctrlKey) {
        e.preventDefault(); // 브라우저 기본 줌 방지
        
        const delta = e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        
        // 줌 범위 제한
        if (zoom > 20) zoom = 20;
        if (zoom < 0.01) zoom = 0.01;
        
        // 마우스 포인터 중심으로 줌
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      }
    };

    // 캔버스 경계 표시 (실제 변환될 영역)
    const addCanvasBoundary = () => {
      const boundary = new Rect({
        left: 0,
        top: 0,
        width: width,
        height: height,
        fill: 'transparent',
        stroke: '#999',
        strokeWidth: 1,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        excludeFromExport: true,
        name: 'canvasBoundary'
      });
      canvas.add(boundary);
      canvas.sendObjectToBack(boundary);
    };

    // 팬 모드 구현 (안전하게)
    let isPanMode = false;
    let isPanning = false;
    let lastPosX, lastPosY;
    let originalDrawingMode = false;
    let originalSelection = false;

    const enterPanMode = () => {
      if (isPanMode) return;
      
      // 현재 상태 저장
      originalDrawingMode = canvas.isDrawingMode;
      originalSelection = canvas.selection;
      
      // 팬 모드로 전환
      isPanMode = true;
      canvas.isDrawingMode = false;
      canvas.selection = false;
      // 팬 모드에서 그리기/지우기 핸들러가 동작하지 않도록 임시 해제
      try {
        if (eraseHandlers.current) {
          if (eraseHandlers.current.startDraw) {
            canvas.off('mouse:down', eraseHandlers.current.startDraw);
            canvas.off('mouse:move', eraseHandlers.current.continueDraw);
            canvas.off('mouse:up', eraseHandlers.current.stopDraw);
          }
          if (eraseHandlers.current.startErase) {
            canvas.off('mouse:down', eraseHandlers.current.startErase);
            canvas.off('mouse:move', eraseHandlers.current.erase);
            canvas.off('mouse:up', eraseHandlers.current.stopErase);
          }
          if (eraseHandlers.current.wheelHandler) {
            canvas.off('mouse:wheel', eraseHandlers.current.wheelHandler);
          }
        }
      } catch (_) {}
      canvas.defaultCursor = 'grab';
      canvas.hoverCursor = 'grab';
      canvas.moveCursor = 'grab';
     canvas.setCursor('grab');

    // ✅ 팬 진입: 원래 상태 저장 후 비활성화
    const prevMap = prevInteractMapRef.current;
    canvas.getObjects().forEach(obj => {
      prevMap.set(obj, { selectable: obj.selectable, evented: obj.evented });
      obj.selectable = false;
      obj.evented = false;
    });
    try { onPanChange && onPanChange(true); } catch {}
    }; // ✅ 여기서 enterPanMode를 닫아야 합니다!!!

    const exitPanMode = () => {
      if (!isPanMode) return;

      isPanMode = false;
      isPanning = false;

      // (선택) 팬 해제 후 일반 클릭=선택으로 강제 복귀
      setDrawingMode('select');
      applyDrawingMode('select', currentColorRef.current);

      // ✅ 팬 해제: 저장한 값으로 전부 복구
      const prevMap = prevInteractMapRef.current;
      canvas.getObjects().forEach(obj => {
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

      // 원래 모드/selection 복구 시도(안전망)
      canvas.isDrawingMode = originalDrawingMode;
      canvas.selection = originalSelection;
      try {
        applyDrawingMode(drawingModeRef.current, currentColorRef.current);
      } catch (_) {
        canvas.defaultCursor = 'default';
        canvas.hoverCursor = 'move';
        canvas.moveCursor = 'move';
        canvas.setCursor('default');
      }

      // ❌ (이 부분은 이제 필요 없음) droppedImage만 복구하는 forEach는 지워주세요.
      // canvas.getObjects().forEach(obj => { ... });

      try { onPanChange && onPanChange(false); } catch {}
    };


    const handleMouseDown = (opt) => {
      if (isPanMode && !isPanning) {
        isPanning = true;
        lastPosX = opt.e.clientX;
        lastPosY = opt.e.clientY;
        canvas.setCursor('grabbing');
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
        canvas.setCursor('grab');
        opt.e.preventDefault();
        opt.e.stopImmediatePropagation();
      }
    };

    // 패스 생성 이벤트 리스너 (그리기 모드에서 레이어 정보 할당)
    const handlePathCreated = (e) => {
      const path = e.path;
      if (path) {
        // 클로저 문제를 피하기 위해 ref에서 최신 값을 가져옴
        const currentActiveLayerId = activeLayerIdRef.current;
        const currentLayers = layersRef.current;
        const activeLayer = currentLayers.find(layer => layer.id === currentActiveLayerId);
        console.log('🎨 Path created - using activeLayerId:', currentActiveLayerId, 'layer:', activeLayer?.name);
        
        if (activeLayer) {
          fabricLayerUtils.assignObjectToLayer(path, activeLayer.id, activeLayer.name);
          console.log('✅ Path assigned to layer:', activeLayer.name);
          setCanvasRevision(c => c + 1); // 캔버스 변경을 알림

          triggerAutoSave({ drawingMode: 'draw' });
          if (onCanvasChangeRef.current) onCanvasChangeRef.current();
        } else {
          console.error('❌ Path assignment failed - no active layer found!');
          console.log('Debug info:', {
            refActiveLayerId: currentActiveLayerId,
            externalActiveLayerId,
            internalActiveLayerId: activeLayerId,
            availableLayers: currentLayers.map(l => ({id: l.id, name: l.name, type: l.type}))
          });
        }
      }
    };

    // 객체 추가 이벤트 리스너 (모든 객체에 대해 레이어 할당)
    const handleObjectAdded = (e) => {
      const obj = e.target;
      if (obj && !obj.layerId) { // 레이어 정보가 없는 객체만 처리
        // 클로저 문제를 피하기 위해 ref에서 최신 값을 가져옴
        const currentActiveLayerId = activeLayerIdRef.current;
        const currentLayers = layersRef.current;
        const activeLayer = currentLayers.find(layer => layer.id === currentActiveLayerId);
        
        if (activeLayer) {
          fabricLayerUtils.assignObjectToLayer(obj, activeLayer.id, activeLayer.name);
          console.log('Object assigned to layer:', activeLayer.name);
        }
      }
    };

    // Selection change handlers
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
        radius: typeof active.radius === 'number' ? active.radius : null,
        left: active.left ?? null,
        top: active.top ?? null,
      });
    };

    const updateDeleteIconPosition = () => {
      const active = canvas.getActiveObject();
      if (!active) {
        setDeleteIconPos(null);
        return;
      }
      try {
        // 최신 좌표 강제 업데이트
        if (typeof active.setCoords === 'function') active.setCoords();

        // Fabric aCoords를 이용해 선택 박스 우상단(tr)을 기준점으로 사용
        const aCoords = active.aCoords;
        if (!aCoords || !aCoords.tr) {
          setDeleteIconPos(null);
          return;
        }

        const tr = aCoords.tr; // { x, y } in canvas viewport coords

        // 캔버스 DOM 스케일 보정 (CSS 크기 ↔ 논리 캔버스 크기)
        const el = canvas.getElement();
        const clientW = el.clientWidth || canvas.getWidth();
        const clientH = el.clientHeight || canvas.getHeight();
        const scaleX = clientW / canvas.getWidth();
        const scaleY = clientH / canvas.getHeight();

        // 버튼 크기 및 오프셋 (우상단에 살짝 붙이기)
        const BTN = 28;
        const OFFSET_X = 24; // 오른쪽 모서리에서 안쪽으로 24px
        const OFFSET_Y = 8;  // 위로 8px 띄우기

        // DOM 좌표 (컨테이너 기준, 캔버스는 컨테이너 좌상단에 배치됨)
        const leftCss = tr.x * scaleX - OFFSET_X;
        const topCss = tr.y * scaleY - OFFSET_Y;

        const clampedLeft = Math.max(0, Math.min(leftCss, clientW - BTN));
        const clampedTop = Math.max(0, Math.min(topCss, clientH - BTN));

        setDeleteIconPos({ left: clampedLeft, top: clampedTop });
      } catch (e) {
        setDeleteIconPos(null);
      }
    };

    const handleCreated = () => { notifySelection(); updateDeleteIconPosition(); };
    const handleUpdated = () => { notifySelection(); updateDeleteIconPosition(); };
    const handleCleared = () => { const cb = onSelectionChangeRef.current; if (cb) cb(null); setDeleteIconPos(null); };

    canvas.on('selection:created', handleCreated);
    canvas.on('selection:updated', handleUpdated);
    canvas.on('selection:cleared', handleCleared);
    // 추가 갱신 타이밍들: 이동/스케일/회전/수정/휠(줌)/렌더 후
    const handleTransforming = () => updateDeleteIconPosition();
    const handleModified = () => updateDeleteIconPosition();
    const handleWheel = () => updateDeleteIconPosition();
    const handleAfterRender = () => updateDeleteIconPosition();
    canvas.on('object:moving', handleTransforming);
    canvas.on('object:scaling', handleTransforming);
    canvas.on('object:rotating', handleTransforming);
    canvas.on('object:modified', handleModified);
    canvas.on('mouse:wheel', handleWheel);
    canvas.on('after:render', handleAfterRender);
    selectionHandlers.current = { handleCreated, handleUpdated, handleCleared };

    // 이벤트 리스너 등록
    canvas.on('mouse:wheel', handleCanvasZoom);
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('path:created', handlePathCreated);
    canvas.on('object:added', handleObjectAdded);

    
    // Expose minimal pan controls for external UI
    canvas.enterPanMode = enterPanMode;
    canvas.exitPanMode = exitPanMode;
    canvas.getPanMode = () => isPanMode;
    
    // 캔버스 경계 추가
    addCanvasBoundary();

    const handleObjectMoved = () => {
      triggerAutoSave({ action: 'objectMoved' });
      if (onCanvasChangeRef.current) onCanvasChangeRef.current();
    };

    const handleObjectScaled = () => {
      triggerAutoSave({ action: 'objectScaled' });
      if (onCanvasChangeRef.current) onCanvasChangeRef.current();
    };

    const handleObjectRotated = () => {
      triggerAutoSave({ action: 'objectRotated' });
      if (onCanvasChangeRef.current) onCanvasChangeRef.current();
    };

    const handleObjectModified = () => {
      triggerAutoSave({ action: 'objectModified' });
      if (onCanvasChangeRef.current) onCanvasChangeRef.current();
    };

    canvas.on('object:moved', handleObjectMoved);
    canvas.on('object:scaled', handleObjectScaled);
    canvas.on('object:rotated', handleObjectRotated);
    canvas.on('object:modified', handleObjectModified);

    return () => {
      canvas.off('mouse:wheel', handleCanvasZoom);
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('path:created', handlePathCreated);
      canvas.off('object:added', handleObjectAdded);
      if (selectionHandlers.current.handleCreated) canvas.off('selection:created', selectionHandlers.current.handleCreated);
      if (selectionHandlers.current.handleUpdated) canvas.off('selection:updated', selectionHandlers.current.handleUpdated);
      if (selectionHandlers.current.handleCleared) canvas.off('selection:cleared', selectionHandlers.current.handleCleared);
      canvas.off('object:moving', handleTransforming);
      canvas.off('object:scaling', handleTransforming);
      canvas.off('object:rotating', handleTransforming);
      canvas.off('object:modified', handleModified);
      canvas.off('after:render', handleAfterRender);
      canvas.off('object:moved', handleObjectMoved);
      canvas.off('object:scaled', handleObjectScaled);
      canvas.off('object:rotated', handleObjectRotated);
      canvas.off('object:modified', handleObjectModified);
      canvas.dispose();
    };
  }, [externalStageRef]);

  // Resize with zoom: keep object positions, zoom the viewport to match new size
  const baseSizeRef = useRef({ w: width, h: height });
  useEffect(() => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;

    const base = baseSizeRef.current || { w: width, h: height };
    // Update physical canvas size
    canvas.setWidth(width);
    canvas.setHeight(height);

    // Compute zoom so that base content fits new canvas
    const zx = width / (base.w || 1);
    const zy = height / (base.h || 1);
    const z = Math.min(zx, zy);
    canvas.setZoom(z);

    // Center content by adjusting viewport transform translation
    const vpt = canvas.viewportTransform || [z, 0, 0, z, 0, 0];
    vpt[0] = z; vpt[3] = z;
    vpt[4] = (width - base.w * z) / 2;
    vpt[5] = (height - base.h * z) / 2;
    canvas.setViewportTransform(vpt);

    // Ensure clipPath matches new canvas bounds if present
    if (canvas.clipPath) {
      try {
        canvas.clipPath.set({ width, height });
      } catch (_) {}
    }

    canvas.requestRenderAll();
  }, [width, height]);

  // Delete key to remove current selection in select mode
  useEffect(() => {
    const onKeyDown = (e) => {
      if (drawingMode !== 'select') return;
      if (!fabricCanvas.current) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const canvas = fabricCanvas.current;
      const activeObjects = canvas.getActiveObjects();
      if (!activeObjects || activeObjects.length === 0) return;
      e.preventDefault();
      activeObjects.forEach((obj) => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      setDeleteIconPos(null);
      const cb = onSelectionChangeRef.current; if (cb) cb(null);
      triggerAutoSave({ action: 'delete', deletedCount: activeObjects.length });
      if (onCanvasChangeRef.current) onCanvasChangeRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawingMode, triggerAutoSave]);

  // Effect for loading the background image
  useEffect(() => {
    console.log("imageUrl 변경됨:", imageUrl);
    if (!imageUrl || !fabricCanvas.current) return;
    const canvas = fabricCanvas.current;

    const postLoadActions = () => {
      applyDrawingMode(drawingModeRef.current, currentColorRef.current);
      canvas.renderAll();
    };

    if (imageUrl.endsWith(".json")) {
      console.log("JSON 파일 로드 시작:", imageUrl);

      // IndexedDB에서 먼저 확인
      (async () => {
        try {
          // selectedId를 사용해서 IndexedDB에서 캐시된 데이터 확인
          const cachedData = await loadCanvasFromIndexedDB(scene.id);

          if (cachedData) {
            console.log("IndexedDB에서 캐시된 JSON 데이터 사용:", scene.id);
            loadFabricCanvasFromData(cachedData);
            return;
          }

          console.log("캐시된 데이터 없음, 서버에서 가져오기:", imageUrl);

          // 캐시가 없으면 기존처럼 fetch로 가져오기
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const fabricJsonData = await response.json();
          console.log("서버에서 JSON 데이터 로드됨:", fabricJsonData);

          // 서버에서 가져온 데이터를 IndexedDB에 저장
          if (scene.id) {
            try {
              await saveCanvasToIndexedDB(scene.id, fabricJsonData);
              console.log("JSON 데이터가 IndexedDB에 저장됨:", scene.id);
            } catch (saveError) {
              console.warn("IndexedDB 저장 실패:", saveError);
            }
          }

          loadFabricCanvasFromData(fabricJsonData);

        } catch (err) {
          console.error("JSON 로드 실패:", err);
          // // JSON 로드 실패 시 기본 이미지 방식으로 폴백
          // loadAsImage();
        }
      })();
    }
    // Fabric Canvas 로드 함수 (공통 로직 분리)
    const loadFabricCanvasFromData = (fabricJsonData) => {
      // 기존 객체들 제거
      const existingObjects = canvas.getObjects()
        .filter(obj => obj.customType === "svgDot" || obj.customType === "jsonDot" || obj.type === "image");
      existingObjects.forEach(obj => canvas.remove(obj));

      // Fabric.js 내장 메서드로 JSON 로드
      canvas.loadFromJSON(fabricJsonData, () => {
        // 로드 완료 후 customType 추가 및 이벤트 설정
        canvas.getObjects().forEach(obj => {
          if (obj.type === "circle") {
            obj.set({
              customType: "jsonDot",
              selectable: false,
              evented: true,
              hoverCursor: 'crosshair',
              moveCursor: 'crosshair'
            });

            // JSON 도트는 배경 레이어에 할당
            const backgroundLayer = getLayer('background');
            if (backgroundLayer) {
              fabricLayerUtils.assignObjectToLayer(obj, backgroundLayer.id, backgroundLayer.name);
            }
          }
        });

        setCanvasRevision(c => c + 1);
        canvas.renderAll();
        postLoadActions();
      });
    };
  }, [imageUrl,scene?.id]); // selectedId도 dependency에 추가


  //   function loadAsImage() {
  //     FabricImage.fromURL(imageUrl, {
  //       crossOrigin: "anonymous",
  //     }).then((img) => {
  //       // Clear previous image
  //       const existingImage = canvas.getObjects("image")[0];
  //       if (existingImage) {
  //         canvas.remove(existingImage);
  //       }
  //
  //       const scale = Math.min(width / img.width, height / img.height, 1);
  //       img.set({
  //         left: (width - img.width * scale) / 2,
  //         top: (height - img.height * scale) / 2,
  //         scaleX: scale,
  //         scaleY: scale,
  //         selectable: false,
  //         evented: false,
  //       });
  //
  //       canvas.add(img);
  //       canvas.sendToBack(img);
  //       canvas.renderAll();
  //     });
  //   }
  // }, [imageUrl]);

  // 외부에서 drawingMode가 변경될 때 반응
  useEffect(() => {
    if (externalDrawingMode !== drawingMode) {
      setDrawingMode(externalDrawingMode);
      // 현재 색상을 유지하면서 모드만 적용 (픽셀 지우개 모드는 예외)
      setTimeout(() => {
        applyDrawingMode(externalDrawingMode, externalDrawingMode === "pixelErase" ? null : drawingColor);
      }, 10);
    }
    // 픽셀 지우개 모드에서는 색상 변경으로 인한 재실행 방지
  }, [externalDrawingMode, drawingMode === "pixelErase" ? null : drawingColor]);

  // 외부에서 eraserSize가 변경될 때 반응
  useEffect(() => {
    if (externalEraserSize !== eraserSize) {
      setEraserSize(externalEraserSize);
    }
  }, [externalEraserSize]);

  // 외부에서 drawingColor가 변경될 때 반응
  useEffect(() => {
    console.log('외부 색상 변경:', externalDrawingColor, '현재 내부 색상:', drawingColor);
    if (externalDrawingColor !== drawingColor) {
      setDrawingColor(externalDrawingColor);
      // 픽셀 지우개 모드가 아닐 때만 브러시 색상 업데이트
      if (drawingMode !== "pixelErase") {
        updateBrushColor(externalDrawingColor);
      }
    }
  }, [externalDrawingColor, drawingMode]);

  // 외부에서 activeLayerId가 변경될 때 반응
  useEffect(() => {
    console.log('🔄 외부 activeLayerId 변경:', externalActiveLayerId, '현재 내부 activeLayerId:', activeLayerId);
    if (externalActiveLayerId && externalActiveLayerId !== activeLayerId) {
      console.log('✅ Canvas activeLayerId 업데이트:', activeLayerId, '->', externalActiveLayerId);
      setActiveLayerId(externalActiveLayerId);
    }
  }, [externalActiveLayerId]);

  // 지우개 크기가 변경될 때 현재 모드에 따라 업데이트
  useEffect(() => {
    if (!fabricCanvas.current || !drawingMode) return;

    // erase 모드일 때만 크기 반영
    if (drawingMode === "erase" || drawingMode === "pixelErase") {
      applyDrawingMode(drawingMode);
    }
  }, [eraserSize]);

  // 브러시 색상 업데이트 함수
  const updateBrushColor = (color) => {
    if (!fabricCanvas.current) return;
    
    const canvas = fabricCanvas.current;
    
    console.log('updateBrushColor 호출됨:', color);
    
    // 픽셀 지우개 모드일 때는 색상을 변경하지 않음 (항상 배경색 사용)
    if (drawingMode === "pixelErase") {
      console.log('픽셀 지우개 모드에서는 색상 변경 무시');
      return;
    }
    
    // 현재 그리기 브러시가 있다면 색상 업데이트
    if (canvas.freeDrawingBrush) {
      console.log('브러시 색상 업데이트:', canvas.freeDrawingBrush.color, '->', color);
      canvas.freeDrawingBrush.color = color;
    } else {
      console.log('브러시가 없어서 색상 업데이트 불가');
    }
  };

  const applyDrawingMode = (mode, colorOverride = null) => {
    if (!fabricCanvas.current) return;

    const canvas = fabricCanvas.current;

    // 픽셀 지우개 모드일 때는 항상 배경색 사용
    const currentColor = mode === "pixelErase" ? "#fafafa" : (colorOverride || drawingColor);
    console.log('applyDrawingMode 호출:', mode, '사용할 색상:', currentColor);
    
    // 이전 이벤트 리스너 정리
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

    // isDrawingMode가 true일 때는 fabric이 내부적으로 핸들러를 관리하므로
    // pixelErase 모드에서 사용했던 핸들러는 따로 정리할 필요가 없습니다.

    // 기본 커서로 복구
    canvas.defaultCursor = "default";

    if (mode === "draw") {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      canvas.skipTargetFind = true; // 그리기 모드에서는 대상 찾기 건너뛰기
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
      canvas.moveCursor = "crosshair";
      canvas.freeDrawingCursor = "crosshair";

      const brush = new PencilBrush(canvas);
      brush.width = 2; // 원래 크기로 복원
      brush.color = currentColor; // 현재 색상 사용
      brush.decimate = 2; // 브러시 포인트 간소화
      brush.limitedToCanvasSize = true;
      canvas.freeDrawingBrush = brush;

      // 브러시 설정 후 한 번 더 색상 확인 및 설정
      console.log('Draw mode - 설정된 브러시 색상:', brush.color, '사용된 색상:', currentColor);
      
      // 기본 커서로 복구
      canvas.setCursor("crosshair");
    } else if (mode === "brush") {
      canvas.isDrawingMode = false; // SVG 도트와 상호작용하기 위해 false로 설정
      canvas.selection = false;
      canvas.skipTargetFind = true; // 브러시 모드에서는 대상 찾기 건너뛰기

      let isDrawing = false;

      const startDraw = (e) => {
        // 팬 모드일 때는 브러쉬 점 그리기 방지
        try {
          const c = fabricCanvas.current;
          if (c && typeof c.getPanMode === 'function' && c.getPanMode()) return;
        } catch (_) {}
        isDrawing = true;
        drawDotAtPoint(e);
      };

      const continueDraw = (e) => {
        // 팬 모드일 때는 브러쉬 이동 중 그리기 방지
        try {
          const c = fabricCanvas.current;
          if (c && typeof c.getPanMode === 'function' && c.getPanMode()) return;
        } catch (_) {}
        if (!isDrawing) return;

        // 최대 개수 체크를 continueDraw에서도 해야 함
        const currentDots = canvas.getObjects().filter(obj =>
          obj.customType === 'svgDot' || obj.customType === 'drawnDot'
        );
        const maxDrone = window.editorAPI?.targetDots || 2000;

        // 최대 개수에 도달했으면 더 이상 그리지 않음
        if (currentDots.length >= maxDrone) {
          return;
        }

        drawDotAtPoint(e);
        canvas.requestRenderAll(); // 실시간 피드백을 위해 최적화된 렌더링 호출
      };

      const stopDraw = () => {
        isDrawing = false;

        // 드로잉 세션이 끝났으므로 경고 플래그 리셋
        maxDroneWarningShownRef.current = false;

        setCanvasRevision(c => c + 1); // 캔버스 변경을 알림
        triggerAutoSave({ drawingMode: 'brush' });
        if (onCanvasChangeRef.current) onCanvasChangeRef.current();
      };

      const drawDotAtPoint = (e) => {
        // 현재 도트 개수 확인
        const allObjects = canvas.getObjects();
        const currentDots = allObjects.filter(obj =>
          obj.customType === 'svgDot' || obj.customType === 'drawnDot'
        );
        console.log('전체 객체 수:', allObjects.length);
        console.log('인식된 도트 수:', currentDots.length);
        console.log('객체 타입들:', allObjects.map(obj => ({type: obj.type, customType: obj.customType})));

        const maxDrone = window.editorAPI?.targetDots || 2000;
        console.log('최대 드론 수:', maxDrone);

        // 최대 개수에 도달한 경우 새 도트를 추가하지 않고 경고만 표시
        if (currentDots.length >= maxDrone) {
          // 한 번만 경고 표시하기 위한 플래그 체크
          if (!maxDroneWarningShownRef.current) {
            alert(`최대 드론 개수(${maxDrone}개)에 도달했습니다. 더 이상 추가할 수 없습니다.`);
            maxDroneWarningShownRef.current = true;
          }
          return; // 새 도트 추가하지 않고 함수 종료
        }

        const pointer = canvas.getPointer(e.e);
        // 클로저 문제를 피하기 위해 ref에서 최신 값을 가져옴
        const currentActiveLayerId = activeLayerIdRef.current;
        const currentLayers = layersRef.current;
        const activeLayer = currentLayers.find(layer => layer.id === currentActiveLayerId);

        // 변환된 도트와 같은 크기로 브러쉬 도트 생성 (고정 2px)
        const dotRadius = 2;
        const newDot = new Circle({
          left: pointer.x - dotRadius,
          top: pointer.y - dotRadius,
          radius: dotRadius,
          fill: currentColorRef.current || currentColor, // 현재 색상 사용
          selectable: false,
          evented: true,
          customType: 'drawnDot', // 그려진 도트로 구분
          originalFill: currentColorRef.current || currentColor, // 원본 색상 정보 보존
          hoverCursor: 'crosshair',
          moveCursor: 'crosshair'
        });

        // 레이어 정보 할당
        if (activeLayer) {
          fabricLayerUtils.assignObjectToLayer(newDot, activeLayer.id, activeLayer.name);
        }

        canvas.add(newDot);
        // 연속적인 드로잉 중에는 매번 renderAll을 호출하지 않습니다.
        // 렌더링은 continueDraw와 stopDraw에서 관리합니다.
      };

      // 고정 크기 브러시 커서 생성
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

        return `url(${cursorCanvas.toDataURL()}) ${cursorSize / 2} ${
          cursorSize / 2
        }, crosshair`;
      };

      // 커서 설정
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
      canvas.skipTargetFind = true; // 지우개 모드에서는 대상 찾기 건너뛰기

      // 원형 커서 생성 함수
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

        return `url(${cursorCanvas.toDataURL()}) ${cursorSize / 2} ${
          cursorSize / 2
        }, crosshair`;
      };

      // 커서 설정
      const eraserCursor = createEraserCursor(eraserSize);
      canvas.defaultCursor = eraserCursor;
      canvas.hoverCursor = eraserCursor;
      canvas.moveCursor = eraserCursor;
      canvas.setCursor(eraserCursor);

      // 지우개 구현
      let isErasing = false;

      const startErase = (e) => {
        // 팬 모드일 때는 지우개 동작 방지
        try {
          const c = fabricCanvas.current;
          if (c && typeof c.getPanMode === 'function' && c.getPanMode()) return;
        } catch (_) {}
        isErasing = true;
        eraseAtPoint(e);
      };

      const erase = (e) => {
        // 팬 모드일 때는 지우개 동작 방지
        try {
          const c = fabricCanvas.current;
          if (c && typeof c.getPanMode === 'function' && c.getPanMode()) return;
        } catch (_) {}
        if (!isErasing) return;
        eraseAtPoint(e);
      };

      const stopErase = () => {
        isErasing = false;
        triggerAutoSave({ drawingMode: 'erase' });
        if (onCanvasChangeRef.current) onCanvasChangeRef.current();
      };

      const eraseAtPoint = (e) => {
        const pointer = canvas.getPointer(e.e);
        const objects = canvas.getObjects();
        const objectsToRemove = [];
        const eraserRadius = eraserSize / 2;

        objects.forEach((obj) => {
          // 그려진 패스들, SVG 도트들, 그려진 도트들 모두 지우기 가능
          if (
            obj.type === "path" ||
            obj.customType === "svgDot" ||
            obj.customType === "drawnDot"
          ) {
            if (obj.customType === "svgDot" || obj.customType === "drawnDot") {
              // 도트들의 경우 원의 중심점과의 거리 계산
              const dotCenterX = obj.left + obj.radius;
              const dotCenterY = obj.top + obj.radius;
              const distance = Math.sqrt(
                Math.pow(pointer.x - dotCenterX, 2) +
                  Math.pow(pointer.y - dotCenterY, 2)
              );

              if (distance <= eraserRadius + obj.radius) {
                objectsToRemove.push(obj);
              }
            } else {
              // 패스의 경우 기존 로직 사용
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

        objectsToRemove.forEach((obj) => {
          canvas.remove(obj);
        });

        if (objectsToRemove.length > 0) {
          canvas.renderAll();
          triggerAutoSave({ drawingMode: 'erase', erased: objectsToRemove.length });
          if (onCanvasChangeRef.current) onCanvasChangeRef.current();
        }
      };

      // 휠 이벤트로 크기 조절
      const wheelHandler = (e) => {
        e.e.preventDefault();
        const delta = e.e.deltaY;
        const step = 3;

        setEraserSize((prevSize) => {
          let newSize;
          if (delta > 0) {
            newSize = Math.max(5, prevSize - step);
          } else {
            newSize = Math.min(100, prevSize + step);
          }

          const newEraserCursor = createEraserCursor(newSize);
          canvas.defaultCursor = newEraserCursor;
          canvas.hoverCursor = newEraserCursor;
          canvas.moveCursor = newEraserCursor;
          canvas.setCursor(newEraserCursor);
          return newSize;
        });
      };

      eraseHandlers.current = { startErase, erase, stopErase, wheelHandler };

      canvas.on("mouse:down", startErase);
      canvas.on("mouse:move", erase);
      canvas.on("mouse:up", stopErase);
      canvas.on("mouse:wheel", wheelHandler);
    } else if (mode === "select") {
      // 선택 모드로 전환
      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.skipTargetFind = false; // 선택 모드에서는 대상 찾기 활성화
      canvas.defaultCursor = "default";
      canvas.hoverCursor = "move";
      canvas.moveCursor = "move";

      // 모든 객체를 선택 가능하게 설정
      canvas.getObjects().forEach((obj) => {
        if (obj.customType === "droppedImage") {
          obj.selectable = true;
          obj.evented = true;
          obj.hasControls = true;
          obj.hasBorders = true;
        }
      });

      // Also enable selection for svg/drawn dots
      canvas.getObjects().forEach((obj) => {
        if (obj.customType === "svgDot" || obj.customType === "drawnDot") {
          obj.selectable = true;
          obj.evented = true;
          obj.hasControls = false;
          obj.hasBorders = true;
        }
      });

      // 이전 핸들러들 정리
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
      canvas.skipTargetFind = true; // 픽셀 지우개 모드에서는 대상 찾기 건너뛰기

      // 픽셀 지우개용 브러시 설정 (배경색으로 칠하기)
      const backgroundColor = "#fafafa"; // 실제 캔버스 배경색 사용
      const eraserBrush = new PencilBrush(canvas);
      eraserBrush.width = eraserSize;
      eraserBrush.color = backgroundColor;
      canvas.freeDrawingBrush = eraserBrush;
      
      console.log('픽셀 지우개 브러시 설정 - 배경색:', backgroundColor, '실제 캔버스 배경색:', canvas.backgroundColor);

      // 원형 커서 생성 함수
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

        return `url(${cursorCanvas.toDataURL()}) ${cursorSize / 2} ${
          cursorSize / 2
        }, crosshair`;
      };

      // 커서 설정
      const pixelEraserCursor = createPixelEraserCursor(eraserSize);
      canvas.defaultCursor = pixelEraserCursor;
      canvas.hoverCursor = pixelEraserCursor;
      canvas.moveCursor = pixelEraserCursor;
      canvas.freeDrawingCursor = pixelEraserCursor;
      canvas.setCursor(pixelEraserCursor);

      // 휠 이벤트로 크기 조절
      const wheelHandler = (e) => {
        e.e.preventDefault();
        const delta = e.e.deltaY;
        const step = 3;

        setEraserSize((prevSize) => {
          let newSize;
          if (delta > 0) {
            newSize = Math.max(5, prevSize - step);
          } else {
            newSize = Math.min(100, prevSize + step);
          }

          if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.width = newSize;
            // 픽셀 지우개 모드에서는 항상 배경색 유지
            const backgroundColor = "#fafafa"; // 실제 캔버스 배경색 사용
            canvas.freeDrawingBrush.color = backgroundColor;
            console.log('픽셀 지우개 크기 변경 - 배경색 유지:', backgroundColor);
          }

          const newPixelEraserCursor = createPixelEraserCursor(newSize);
          canvas.defaultCursor = newPixelEraserCursor;
          canvas.hoverCursor = newPixelEraserCursor;
          canvas.moveCursor = newPixelEraserCursor;
          canvas.freeDrawingCursor = newPixelEraserCursor;
          canvas.setCursor(newPixelEraserCursor);
          return newSize;
        });
      };

      // 픽셀 지우개로 그린 패스를 선택 불가능하게 만들기
      const pathCreatedHandler = (e) => {
        if (e.path) {
          e.path.set({
            selectable: false,
            evented: false,
            excludeFromExport: false, // 내보내기에서는 제외하지 않음
            isEraserPath: true // 지우개 패스임을 표시
          });
          console.log('픽셀 지우개 패스 생성 - 선택 불가능으로 설정');
        }
      };

      eraseHandlers.current = { wheelHandler, pathCreatedHandler };

      canvas.on("mouse:wheel", wheelHandler);
      canvas.on("path:created", pathCreatedHandler);
    }
    else if (mode === "pan") {
    // 팬 모드 처리 - 실제로는 enterPanMode가 대부분 처리하지만 일관성을 위해 추가
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = "grab";
    canvas.hoverCursor = "grab";
    canvas.moveCursor = "grab";
  }
  };

  const toggleDrawingMode = (mode) => {
    setDrawingMode(mode);
    applyDrawingMode(mode);
  };

  // 드래그&드롭 이벤트 핸들러들
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const imageUrl = e.dataTransfer.getData("text/plain");
    if (imageUrl && fabricCanvas.current) {
      addImageToCanvas(imageUrl, e.clientX, e.clientY);
      
      // 이미지 드롭 후 선택 모드로 변경
      setDrawingMode('select');
      applyDrawingMode('select');
      if (onModeChange) {
        onModeChange('select');
      }
    }
  };

  // 캔버스에 이미지 추가하는 함수
  const addImageToCanvas = (imageUrl, clientX = null, clientY = null) => {
    if (!fabricCanvas.current) return;

    const canvas = fabricCanvas.current;

    FabricImage.fromURL(imageUrl, {
      crossOrigin: "anonymous",
    })
      .then((img) => {
        // 이미지 크기 조정 (최대 200px)
        const maxSize = 200;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

        // 드롭 위치 계산 (마우스 위치 또는 중앙)
        let left, top;
        if (clientX && clientY) {
          const rect = canvas.getElement().getBoundingClientRect();
          left = clientX - rect.left - (img.width * scale) / 2;
          top = clientY - rect.top - (img.height * scale) / 2;
        } else {
          left = (width - img.width * scale) / 2;
          top = (height - img.height * scale) / 2;
        }

        img.set({
          left: Math.max(0, Math.min(left, width - img.width * scale)),
          top: Math.max(0, Math.min(top, height - img.height * scale)),
          scaleX: scale,
          scaleY: scale,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          cornerStyle: "circle",
          cornerColor: "#007bff",
          cornerSize: 12,
          transparentCorners: false,
          borderColor: "#007bff",
          customType: "droppedImage", // 구분을 위한 커스텀 타입
          // 회전 컨트롤 활성화
          hasRotatingPoint: true,
          rotatingPointOffset: 30,
          // 균등 스케일링 옵션
          lockUniScaling: false,
          // 컨트롤 포인트 설정
          centeredScaling: false,
          centeredRotation: true,
        });

        // 드롭된 이미지는 활성 레이어에 할당  
        const currentActiveLayerId = externalActiveLayerId;
        const activeLayer = layers.find(layer => layer.id === currentActiveLayerId);
        console.log('🖼️ Image dropped - using activeLayerId:', currentActiveLayerId, 'layer:', activeLayer?.name);
        
        if (activeLayer) {
          fabricLayerUtils.assignObjectToLayer(img, activeLayer.id, activeLayer.name);
        }

        canvas.add(img);
        canvas.setActiveObject(img);
        setCanvasRevision(c => c + 1); // 캔버스 변경을 알림
        triggerAutoSave({ action: 'imageDropped', imageUrl });
        if (onCanvasChangeRef.current) onCanvasChangeRef.current();
        canvas.renderAll();
      })
      .catch((err) => {
        console.error("이미지 로드 실패:", err);
        alert("이미지를 로드할 수 없습니다.");
      });
  };

  // 전체 지우기 핸들러
  const handleClearAll = () => {
    if (!fabricCanvas.current) return;

    if (
      confirm(
        "캔버스의 모든 내용을 지우시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      const canvas = fabricCanvas.current;
      const objectCount = canvas.getObjects().length;
      clearCanvas();
      console.log("캔버스 전체가 초기화되었습니다");
      triggerAutoSave({ action: 'clearAll', clearedCount: objectCount });
      if (onCanvasChangeRef.current) onCanvasChangeRef.current();
    }
  };

  // 현재 캔버스의 모든 객체를 색상별로 분석하여 SVG 생성
  const getCurrentCanvasAsSvg = () => {
    if (!fabricCanvas.current) return null;

    const canvas = fabricCanvas.current;
    const objects = canvas.getObjects();
    const dots = [];

    const pathObjects = [];
    
    console.log('getCurrentCanvasAsSvg - 총 객체 수:', objects.length);
    
    objects.forEach((obj, index) => {
      // console.log(`객체 ${index}: type=${obj.type}, customType=${obj.customType}, fill=${obj.fill}, stroke=${obj.stroke}`);
      
      if (obj.customType === 'svgDot' || obj.customType === 'drawnDot') {
        // 도트의 중심점 계산
        const centerX = obj.left + obj.radius;
        const centerY = obj.top + obj.radius;
        // 실제 객체의 fill 색상을 우선 사용, 없으면 originalFill, 그것도 없으면 현재 그리기 색상
        const dotColor = obj.fill || obj.originalFill || drawingColor;
        
        dots.push({
          cx: centerX,
          cy: centerY,
          r: obj.radius,
          fill: dotColor, // hexToRgb 변환 제거하여 원본 색상 형태 유지
          originalColor: dotColor
        });
      } else if (obj.type === 'path') {
        // 펜으로 그린 패스의 경우
        const pathColor = obj.stroke || drawingColor;
        console.log(`패스 객체 색상: ${pathColor}`);
        
        pathObjects.push({
          type: 'path',
          fill: pathColor, // hexToRgb 변환 제거하여 원본 색상 형태 유지
          originalColor: pathColor,
          obj: obj
        });
      }
    });
    
    console.log('도트 개수:', dots.length, '패스 개수:', pathObjects.length);
    
    // SVG 문자열 생성 (모든 객체의 실제 색상 사용)
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">`;
    
    // 도트들 추가
    dots.forEach(dot => {
      svgContent += `<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${dot.fill}" />`;
    });
    
    // 패스들은 실제 변환에서 처리될 수 있도록 정보만 포함
    svgContent += '</svg>';
    
    return {
      svgString: svgContent,
      totalDots: dots.length,
      totalPaths: pathObjects.length,
      dots: dots, // 개별 색상이 적용된 도트 배열
      paths: pathObjects, // 패스 객체들의 색상 정보
      hasMultipleColors: new Set([...dots.map(d => d.originalColor), ...pathObjects.map(p => p.originalColor)]).size > 1
    };
  };

  // 현재 캔버스 전체를 이미지로 내보내기
  const exportCanvasAsImage = () => {
    if (!fabricCanvas.current) return null;

    const canvas = fabricCanvas.current;
    // 캔버스를 데이터 URL로 변환 (PNG 형태)
    const dataURL = canvas.toDataURL({
      format: "png",
      quality: 1.0,
      multiplier: 1,
    });

    return dataURL;
  };

  // 펜으로 그린 선만 별도로 이미지로 내보내기
  const exportDrawnLinesOnly = () => {
    if (!fabricCanvas.current) return null;

    const canvas = fabricCanvas.current;
    const objects = canvas.getObjects();

    // 배경 이미지와 SVG 도트들을 임시로 숨기기
    const hiddenObjects = [];
    objects.forEach((obj) => {
      if (obj.type === "image" || obj.customType === "svgDot") {
        obj.visible = false;
        hiddenObjects.push(obj);
      }
    });

    canvas.renderAll();

    // 펜으로 그린 선만 포함된 이미지 생성
    const dataURL = canvas.toDataURL({
      format: "png",
      quality: 1.0,
      multiplier: 1,
      backgroundColor: "white", // 배경을 흰색으로 설정
    });

    // 숨겼던 객체들 다시 보이게 하기
    hiddenObjects.forEach((obj) => {
      obj.visible = true;
    });

    canvas.renderAll();

    return dataURL;
  };

  // 캔버스에 그려진 객체가 있는지 확인
  const hasDrawnContent = () => {
    if (!fabricCanvas.current) return false;

    const canvas = fabricCanvas.current;
    const objects = canvas.getObjects();
    // 변환 가능한 모든 콘텐츠 확인
    return objects.some(obj => 
      obj.type === 'path' ||                    // 펜으로 그린 선
      obj.customType === 'drawnDot' ||         // 브러시 도트
      obj.customType === 'droppedImage' ||     // 드래그&드롭 이미지
      obj.customType === 'svgDot' ||           // SVG 도트들
      obj.type === 'image'                     // 배경 이미지
    );
  };

  // 캔버스 초기화 (모든 객체 제거)
  const clearCanvas = () => {
    if (!fabricCanvas.current) return;

    const canvas = fabricCanvas.current;
    // 모든 객체 제거 (경계선은 유지)
    canvas.getObjects().forEach((obj) => {
      if (obj && obj.name === 'canvasBoundary') return; // 점선 테두리 유지
      canvas.remove(obj);
    });
    canvas.backgroundColor = "#fafafa";
    canvas.renderAll();
    setCanvasRevision(c => c + 1); // 캔버스 변경을 알림
  };

  // 원본 캔버스 상태 저장 및 복원 기능
  const saveOriginalCanvasState = () => {
    if (!fabricCanvas.current) return null;
    
    const canvas = fabricCanvas.current;
    const state = {
      objects: canvas.toJSON(),
      timestamp: Date.now()
    };
    
    console.log("원본 캔버스 상태 저장:", state);
    return state;
  };

  const restoreOriginalCanvasState = (state) => {
    if (!fabricCanvas.current || !state) return false;
    
    const canvas = fabricCanvas.current;
    
    // 현재 캔버스 초기화
    canvas.clear();
    canvas.backgroundColor = '#fafafa';
    
    // 저장된 상태에서 복원
    canvas.loadFromJSON(state.objects, () => {
      canvas.renderAll();
      console.log("원본 캔버스 상태 복원 완료");
    });
    
    return true;
  };

  // 레이어 가시성 제어 함수
  const handleLayerVisibilityChange = useCallback((layerId) => {
    if (fabricCanvas.current) {
      const layer = getLayer(layerId);
      if (layer) {
        fabricLayerUtils.setLayerVisibility(fabricCanvas.current, layerId, !layer.visible);
        toggleLayerVisibility(layerId);
      }
    }
  }, [getLayer, toggleLayerVisibility]);

  // 레이어 잠금 제어 함수
  const handleLayerLockChange = useCallback((layerId) => {
    if (fabricCanvas.current) {
      const layer = getLayer(layerId);
      if (layer) {
        fabricLayerUtils.setLayerLock(fabricCanvas.current, layerId, !layer.locked);
        toggleLayerLock(layerId);
      }
    }
  }, [getLayer, toggleLayerLock]);

  // 레이어 삭제 (캔버스 객체도 함께 삭제)
  const handleDeleteLayer = useCallback((layerId) => {
    if (fabricCanvas.current) {
      // 먼저 캔버스에서 해당 레이어의 모든 객체 삭제
      fabricLayerUtils.deleteLayerObjects(fabricCanvas.current, layerId);
      // 캔버스 변경을 알림 (객체 삭제 후)
      setCanvasRevision(c => c + 1);
      // 그다음 레이어 상태에서 삭제
      deleteLayer(layerId);
    }
  }, [deleteLayer]);

  // 외부에서 사용할 수 있도록 ref에 함수 등록
  useEffect(() => {
    if (externalStageRef && externalStageRef.current) {
      externalStageRef.current.getCurrentCanvasAsSvg = getCurrentCanvasAsSvg;
      externalStageRef.current.exportCanvasAsImage = exportCanvasAsImage;
      externalStageRef.current.exportDrawnLinesOnly = exportDrawnLinesOnly;
      externalStageRef.current.hasDrawnContent = hasDrawnContent;
      externalStageRef.current.clear = clearCanvas;
      
      // 누락된 loadImageFromUrl 메서드 추가
      externalStageRef.current.loadFabricJsonNative = (url) => {
        console.log("loadFabricJsonNative 호출됨:", url);
        if (!fabricCanvas.current) return;

        const canvas = fabricCanvas.current;

        if (url.endsWith(".json")) {
          fetch(url)
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.json();
            })
            .then(fabricJsonData => {
              console.log("JSON 데이터 로드됨:", fabricJsonData);

              // 기존 객체들 제거
              canvas.clear();

              // Fabric.js 내장 메서드로 JSON 로드
              canvas.loadFromJSON(fabricJsonData, () => {
                // 로드 완료 후 customType 추가 및 이벤트 설정
                canvas.getObjects().forEach(obj => {
                  if (obj.type === "circle") {
                    obj.set({
                      customType: "jsonDot",
                      selectable: false,
                      evented: true,
                      hoverCursor: 'crosshair',
                      moveCursor: 'crosshair'
                    });
                  }
                });

                canvas.renderAll();
                console.log(`${canvas.getObjects().length}개의 객체를 로드했습니다.`);
              });
            })
            .catch(err => {
              console.error("JSON 로드 실패:", err);
              alert("변환된 데이터를 불러오는데 실패했습니다.");
            });
        } else {
          console.warn("JSON 파일이 아닙니다:", url);
        }
      };

      externalStageRef.current.applyDrawingMode = (mode, color) => {
        // 색상 정보를 명시적으로 전달받아 사용
        const currentColor = color || externalDrawingColor;
        console.log('applyDrawingMode with color:', mode, currentColor);
        applyDrawingMode(mode, currentColor);
      };
      externalStageRef.current.setDrawingMode = (mode) => {
        setDrawingMode(mode);
        // 현재 색상을 명시적으로 전달
        setTimeout(() => {
          externalStageRef.current.applyDrawingMode(mode, drawingColor);
        }, 10);
      };
      externalStageRef.current.setDrawingColor = (color) => {
        setDrawingColor(color);
        // 현재 drawingMode 상태를 직접 확인 (클로저 문제 해결)
        setDrawingMode(currentMode => {
          if (currentMode !== "pixelErase") {
            updateBrushColor(color);
          }
          return currentMode; // 상태는 변경하지 않고 현재 값 확인만
        });
      };
      // 원본 상태 관리 함수 추가
      externalStageRef.current.saveOriginalCanvasState = saveOriginalCanvasState;
      externalStageRef.current.restoreOriginalCanvasState = restoreOriginalCanvasState;
      
      // 레이어 관리 함수들 추가
      externalStageRef.current.layers = {
        getLayers: getSortedLayers,
        getActiveLayerId: () => activeLayerId,
        setActiveLayer: setActiveLayerId,
        createLayer,
        deleteLayer: handleDeleteLayer, // 캔버스 객체도 함께 삭제하는 핸들러 사용
        renameLayer,
        toggleVisibility: handleLayerVisibilityChange,
        toggleLock: handleLayerLockChange,
        reorderLayers: reorderLayers,
      };

      externalStageRef.current.changeSaveMode = changeSaveMode;
    }
  }, [externalStageRef, getSortedLayers, activeLayerId, setActiveLayerId, createLayer, 
      handleDeleteLayer, renameLayer, handleLayerVisibilityChange, handleLayerLockChange, 
      reorderLayers, changeSaveMode]);

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        border: isDragOver ? "3px dashed #007bff" : "none",
        backgroundColor: isDragOver ? "rgba(0, 123, 255, 0.1)" : "transparent",
        transition: "all 0.2s ease",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas ref={canvasRef} />
      {deleteIconPos && drawingMode === 'select' && (
        <button
          type="button"
          onClick={() => {
            if (!fabricCanvas.current) return;
            const canvas = fabricCanvas.current;
            const activeObjects = canvas.getActiveObjects();
            if (!activeObjects || activeObjects.length === 0) return;
            activeObjects.forEach((obj) => canvas.remove(obj));
            canvas.discardActiveObject();
            canvas.requestRenderAll();
            setDeleteIconPos(null);
            const cb = onSelectionChangeRef.current; if (cb) cb(null);
            triggerAutoSave({ action: 'deleteButton', deletedCount: activeObjects.length });
            if (onCanvasChangeRef.current) onCanvasChangeRef.current();
          }}
          style={{
            position: 'absolute',
            left: deleteIconPos.left,
            top: deleteIconPos.top,
            background: '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: 16,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,.25)',
            cursor: 'pointer',
            zIndex: 5000,
          }}
          title="선택 영역 삭제"
          aria-label="선택 영역 삭제"
        >
          <MdDelete size={18} />
        </button>
      )}
      {isDragOver && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "rgba(0, 123, 255, 0.9)",
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: "bold",
            pointerEvents: "none",
            zIndex: 9999,
          }}
        >
          이미지를 여기에 놓으세요
        </div>
      )}
    </div>
  );
}
