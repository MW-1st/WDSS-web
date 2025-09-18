import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import { createPortal } from "react-dom";
import EditorToolbar from "../components/EditorToolbar.jsx";
import "../styles/CanvasTools.css"; // 버튼/툴 공유 스타일
import MainCanvasSection from "../components/MainCanvasSection.jsx";
import SceneCarousel from "../components/SceneCarousel.jsx";
import ImageGallery from "../components/ImageGallery.jsx";
import LayerPanel from "../components/LayerPanel.jsx";
import ObjectPropertiesPanel from "../components/ObjectPropertiesPanel.jsx";
import PreviewPanel from "../components/PreviewPanel.jsx";
import { useAutoSave } from '../hooks/useAutoSave';
import { useServerSync } from '../hooks/useServerSync';
import client from "../api/client";
import { getImageUrl } from '../utils/imageUtils';
import { useUnity } from "../contexts/UnityContext.jsx";
import { useParams } from "react-router-dom";
import { ImExit } from "react-icons/im";
import { CiSettings } from "react-icons/ci";
import { LuMousePointer } from "react-icons/lu";
import { IoHandRightOutline } from "react-icons/io5";
import ProjectSettingsModal from "../components/ProjectSettingsModal";
import PortalPopover from "../components/PortalPopover.jsx";
import { deleteCanvasFromIndexedDB, saveCanvasToIndexedDB } from "../utils/indexedDBUtils.js";
import { useUndoRedo } from '../hooks/useUndoRedo';
import "../styles/EditorPage.css";
import { IoMdCheckmarkCircleOutline } from "react-icons/io";
const VISIBLE = 4;
const DUMMY = "11111111-1111-1111-1111-111111111111";

export default function EditorPage({projectId = DUMMY}) {
  const {project_id} = useParams();
  const [pid, setPid] = useState(project_id);
  const [scenes, setScenes] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [projectMeta, setProjectMeta] = useState(null);
  useEffect(() => {
    setProjectMeta(prev => (prev ? { ...prev, max_scene: scenes.length } : prev));
  }, [scenes.length]);
  const [selectedId, setSelectedId] = useState(null);
  const [start, setStart] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // 갤러리 열림 상태
  const [galleryOpen, setGalleryOpen] = useState(() => {
    const saved = localStorage.getItem("wdss:galleryOpen");
    return saved ? JSON.parse(saved) : false;
  });
  useEffect(() => {
    localStorage.setItem("wdss:galleryOpen", JSON.stringify(galleryOpen));
  }, [galleryOpen]);

  // Ensure gallery is closed on leaving the editor page
  useEffect(() => {
    return () => {
      try { localStorage.setItem("wdss:galleryOpen", JSON.stringify(false)); } catch(_) {}
    };
  }, []);

  // 변환/렌더 상태
  const [processing, setProcessing] = useState(false);
  const [targetDots, setTargetDots] = useState(2000);

  // refs
  const stageRef = useRef(null);
  const toolButtonRef = useRef(null);
  const dashboardBtnRef = useRef(null);
  const previousSceneId = useRef(selectedId);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // 툴팁 상태
  const [dashboardHovered, setDashboardHovered] = useState(false);
  const [dashboardTooltipPos, setDashboardTooltipPos] = useState({ top: 0, left: 0 });
  const [selectHovered, setSelectHovered] = useState(false);
  const [selectTooltipPos, setSelectTooltipPos] = useState({ top: 0, left: 0 });

  // 캔버스/도구 상태
  const [drawingMode, setDrawingMode] = useState("select");
  const [eraserSize, setEraserSize] = useState(20);
  const [drawingColor, setDrawingColor] = useState('#222222');
  const [selectedObject, setSelectedObject] = useState(null);
  const [isPanMode, setIsPanMode] = useState(false);
  const [isToolSelectionOpen, setToolSelectionOpen] = useState(false);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);

  // 선택에 따라 속성 패널 자동 토글
  useEffect(() => { setIsPropertiesPanelOpen(!!selectedObject); }, [selectedObject]);

  // Select/Pan 툴팁 위치
  useEffect(() => {
    if (!selectHovered) return;
    const el = toolButtonRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSelectTooltipPos({ top: Math.round(r.top + r.height / 2), left: Math.round(r.right + 10) });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [selectHovered]);

  // 대시보드 툴팁 위치
  useEffect(() => {
    if (!dashboardHovered) return;
    const el = dashboardBtnRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setDashboardTooltipPos({ top: Math.round(r.top + r.height / 2), left: Math.round(r.right + 10) });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [dashboardHovered]);

  const getSelectTooltipText = () =>
    isPanMode ? "이동(H): 캔버스를 드래그해서 이동" : "선택(V): 객체를 선택하고 조작";

  // 프리뷰 패널 ref
  const previewPanelRef = useRef(null);
  const handleCanvasChange = useCallback(() => {
    if (previewPanelRef.current?.triggerPreview) previewPanelRef.current.triggerPreview();
  }, []);

  // 레이어 상태
  const [canvasReady, setCanvasReady] = useState(false);
  const [layersState, setLayersState] = useState([]);
  const [activeLayerIdState, setActiveLayerIdState] = useState(null);
  const [selectedObjectLayerId, setSelectedObjectLayerId] = useState(null);

  // 프로젝트 설정 모달
  const [editingProject, setEditingProject] = useState(null);
  const openProjectSettings = () => { if (projectMeta) setEditingProject(projectMeta); };
  const closeProjectSettings = () => setEditingProject(null);
  const handleSettingsSaved = (updated) => {
    setProjectMeta(updated);
    if (updated?.project_name) setProjectName(updated.project_name);
    if (updated?.max_drone) setTargetDots(updated.max_drone);
  };

  // 선택된 씬
  const selectedScene = useMemo(
    () => scenes.find((s) => s.id === selectedId) || null,
    [scenes, selectedId]
  );

  // 변환 상태
  const isSceneTransformed = useMemo(() => {
    if (!selectedScene) return false;
    return selectedScene.saveMode === 'processed' || selectedScene.isTransformed === true;
  }, [selectedScene]);

  // 파생 상태
  const imageUrl = getImageUrl(selectedScene?.s3_key) || "";
  const originalCanvasState = selectedScene ? selectedScene.originalCanvasState : null;

  // 레이어 상태 업데이트
  const updateLayerState = useCallback(() => {
    if (stageRef.current && selectedId) {
      try {
        const canvas = stageRef.current;
        if (canvas.getSceneLayerState) {
          const layerState = canvas.getSceneLayerState(selectedId);
          if (layerState?.layers) {
            const layers = layerState.layers || [];
            const activeId = layerState.activeLayerId || 'layer-1';

            setLayersState(prevLayers => {
              const layersChanged = JSON.stringify(prevLayers.map(l => ({id: l.id, zIndex: l.zIndex, name: l.name, visible: l.visible, locked: l.locked}))) !==
                                   JSON.stringify(layers.map(l => ({id: l.id, zIndex: l.zIndex, name: l.name, visible: l.visible, locked: l.locked})));

              if (layersChanged) {
                return [...layers];
              } else {
                return prevLayers;
              }
            });

            setActiveLayerIdState(prevActiveId => {
              if (prevActiveId !== activeId) {
                return activeId;
              } else {
                return prevActiveId;
              }
            });
            return;
          }
        }
        // 폴백
        if (stageRef.current.layers) {
          const layers = stageRef.current.layers.getLayers() || [];
          const activeId = stageRef.current.layers.getActiveLayerId() || 'layer-1';
          setLayersState([...layers]);
          setActiveLayerIdState(activeId);
        } else {
          setActiveLayerIdState('layer-1');
        }
      } catch (error) {
        console.warn('Error updating layer state:', error);
      }
    }
  }, [selectedId]);

  // unity 관련 상태
  const {isUnityVisible, showUnity, hideUnity, sendTestData} = useUnity();

  // AutoSave
  const {
    saveImmediately,
    triggerAutoSave,
    isSaving: isAutoSaving,
    saveMode,
    changeSaveMode,
    syncToServerNow,
    isServerSyncing,
  } = useAutoSave(pid, selectedId, stageRef, {
    enabled: true,
    delay: 1500,
    serverSync: true,
    serverSyncInterval: 30000,
    onSave: (data) => {
      if (data.s3_key) {
        setScenes(prevScenes =>
            prevScenes.map(scene =>
                scene.id === data.sceneId
                    ? {...scene, s3_key: data.s3_key}
                    : scene
            )
        );
        console.log(`Scene ${data.sceneId} s3_key updated to: ${data.s3_key}`);
      }
    },
    onError: (error) => {
      console.error('Auto-save failed:', error);
    },
    onServerSync: (data) => {
      console.log('Server sync completed:', data);
      if (data.s3_key) {
        setScenes(prevScenes =>
            prevScenes.map(scene =>
                scene.id === data.sceneId
                    ? {...scene, s3_key: data.s3_key}
                    : scene
            )
        );
        console.log(`Scene ${data.sceneId} s3_key updated after server sync: ${data.s3_key}`);
      }
    },
    onServerSyncError: (error) => {
      console.error('Server sync failed:', error);
    },
    selectedScene
  });
  const {syncToServer, uploadThumbnail, getCurrentCanvasData} = useServerSync(pid, selectedId, stageRef);

  const { saveToHistory, undo, redo, canUndo, canRedo, isProcessing, clearHistoryAndSetNew, globalHistoryStack, } = useUndoRedo(
    selectedId,
    stageRef,
    {
      getCurrentCanvasData: () => getCurrentCanvasData(),
      onCanvasChange: handleCanvasChange
    }
  );

   const saveCurrentScene = useCallback(async (sceneIdToSave, saveModeToUse, options = {}) => {
    const {
      shouldSaveThumbnail = false,
      capturedCanvasData = null,    // 캡처된 캔버스 데이터 옵션
      capturedThumbnailDataUrl = null // 캡처된 썸네일 데이터 옵션
    } = options;

    if (!sceneIdToSave || !stageRef.current) {
      console.warn('저장할 씬 ID 또는 캔버스가 없어 저장 작업을 건너뜁니다.');
      return;
    }

    const canvas = stageRef.current;
    const logAction = shouldSaveThumbnail ? "전체 저장 (썸네일 포함)" : "데이터 저장";

    try {
      // 1. 데이터 결정: 캡처된 데이터가 있으면 사용, 없으면 현재 캔버스에서 생성
      const canvasData = capturedCanvasData || getCurrentCanvasData();

      // 2. 실행할 저장 작업 목록 구성
      const savePromises = [
        saveImmediately(canvasData),
        syncToServer(canvasData, saveModeToUse)
      ];

      // 3. 썸네일 저장 작업 구성
      if (shouldSaveThumbnail) {
        // 캡처된 썸네일이 있으면 사용, 없으면 현재 캔버스에서 생성
        const thumbnailDataUrl = capturedThumbnailDataUrl || canvas.toDataURL({ format: 'png', quality: 0.5 });
        savePromises.push(uploadThumbnail(thumbnailDataUrl));
      }

      await Promise.all(savePromises);
      console.log(`✅ ${sceneIdToSave} 씬 ${logAction} 완료`);

    } catch (error) {
      console.error(`❌ ${sceneIdToSave} 씬 저장 중 오류 발생:`, error);
    }
  }, [saveImmediately, syncToServer, uploadThumbnail]);


  // 수동 저장 함수
  const handleManualSave = async () => {
     await saveCurrentScene(selectedId, saveMode, { shouldSaveThumbnail: true });
  };

  // 씬 변경 시 서버 동기화
  useEffect(() => {
    if (previousSceneId.current && previousSceneId.current !== selectedId) {
      console.log('Scene changed, syncing to server...');
    }

    previousSceneId.current = selectedId;
  }, [selectedId]);

  // 씬 변경 추적 및 페이지 이탈 시 저장을 위한 useEffect
  useEffect(() => {
    // --- 페이지를 떠날 때 실행될 통합 저장 함수 ---
    const handleSaveOnExit = () => {
      // 현재 선택된 씬 ID와 저장 모드를 ref에서 가져와 저장
      // 페이지를 떠나는 것은 중요한 이벤트이므로 썸네일을 함께 저장합니다.
      saveCurrentScene(selectedIdRef.current, previousSaveModeRef.current, {
        shouldSaveThumbnail: true
      });
    };

    // --- 이벤트 핸들러 정의 ---
    const handleBeforeUnload = (event) => {
      // 내용이 있을 때만 저장 로직 실행
      if (selectedIdRef.current && stageRef.current) {
        console.log('페이지를 닫기 전 저장합니다...');
        handleSaveOnExit();
      }
    };

    const handleVisibilityChange = () => {
      // 탭을 벗어나거나 브라우저가 비활성화될 때
      if (document.visibilityState === 'hidden') {
        handleSaveOnExit();
      }
    };

    const handlePopState = () => {
      // 브라우저 뒤로가기/앞으로가기 버튼 사용 시
      handleSaveOnExit();
    };

    // --- 이벤트 리스너 등록 ---
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('popstate', handlePopState);

    // --- 컴포넌트 언마운트 시 리스너 정리 ---
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [saveCurrentScene]);

  // 색상이 변경될 때 즉시 캔버스에 반영
  useEffect(() => {
    if (stageRef.current && stageRef.current.setDrawingColor) {
      stageRef.current.setDrawingColor(drawingColor);
    }
  }, [drawingColor]);

  // Canvas 준비 상태 확인
  useEffect(() => {
    let timeoutId = null;
    let isCleanedUp = false;

    const checkCanvasReady = () => {
      if (isCleanedUp) return;

      if (stageRef.current && stageRef.current.layers) {
        setCanvasReady(true);
        // 초기 진입 시 도구를 클릭(선택) 모드로 강제 설정
        try {
          if (stageRef.current.setDrawingMode) {
            stageRef.current.setDrawingMode('select');
          }
        } catch (_) {
        }
        updateLayerState();

        // 캔버스 선택 이벤트는 Canvas 컴포넌트의 onSelectionChange prop으로 처리됨
      } else {
        timeoutId = setTimeout(checkCanvasReady, 100);
      }
    };

    const cleanup = checkCanvasReady();

    return () => {
      isCleanedUp = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (cleanup) cleanup();
    };
  }, []);

  useEffect(() => {
    if (canvasReady && selectedId) {
      // 첫 번째 시도: 즉시 업데이트
      updateLayerState();

      // 두 번째 시도: 200ms 후 다시 업데이트 (캔버스가 씬 데이터를 로드할 시간을 줌)
      setTimeout(() => {
        updateLayerState();
      }, 200);

      // 세 번째 시도: 500ms 후 최종 확인 (새 씬의 경우 레이어 시스템이 완전히 초기화될 시간)
      setTimeout(() => {
        updateLayerState();
      }, 500);
    }
  }, [selectedId, canvasReady, updateLayerState]);


  useEffect(() => {
    if (canvasReady && selectedId && stageRef.current) {
      const canvas = stageRef.current;
      setTimeout(() => {
        updateLayerState();

        if (canvas.getSceneLayerState) {
          const layerState = canvas.getSceneLayerState(selectedId);
          if (layerState && layerState.layers && layerState.layers.length > 0) {
            if (canvas.restoreSceneLayerState) {
              canvas.restoreSceneLayerState(selectedId, layerState);
            }
          }
        }
      }, 200);
    }
  }, [selectedId, canvasReady, updateLayerState]);

  // 프로젝트가 없으면 생성하는 헬퍼
  const ensureProjectId = async () => {
    if (pid) return pid;
    const newId =
        crypto?.randomUUID?.() ??
        ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
            (c ^
                (crypto.getRandomValues(new Uint8Array(1))[0] &
                    (15 >> (c / 4)))).toString(16)
        );
    const {data} = await client.post("/projects", {
      id: newId,
      project_name: "Untitled Project",
      user_id: null,
    });
    setPid(data.id);
    setProjectName("Untitled Project");
    return data.id;
  };

  // 초기: 프로젝트가 있으면 목록 로드
  useEffect(() => {
    if (!pid) return;
    // Load project meta (name)
    (async () => {
      setIsLoading(true);
      try {
        const {data} = await client.get(`/projects/${pid}`);
        const p = data?.project ?? data;
        if (p?.project_name) setProjectName(p.project_name);
        if (p) {
          setProjectMeta(p);
          if (p.max_drone) setTargetDots(p.max_drone);
        }
      } catch (e) {
        console.warn(
            "Failed to load project info",
            e?.response?.data || e?.message
        );
      }
    })();
  }, [pid]);

  // 초기: 프로젝트가 있으면 목록 로드
  useEffect(() => {
    if (!pid) return;
    (async () => {
      try {
        const {data} = await client.get(`/projects/${pid}/scenes`);
        const list = data.scenes || [];
        setScenes(
            list.map((s, i) => ({
              ...s,
              name: s.name || `Scene ${s.scene_num ?? i + 1}`,
              imageUrl: getImageUrl(s.s3_key),
              // 변환 상태 추론: s3_key가 'processed'로 시작하면 변환됨
              saveMode: s.s3_key && s.s3_key.startsWith('processed') ? 'processed' : 'originals',
              isTransformed: s.s3_key && s.s3_key.startsWith('processed'),
              preview: `/thumbnails/${s.id}.png`,
            }))
        );
        if (list[0]) {
          setSelectedId(list[0].id);
          
          // 첫 번째 씬의 변환 상태에 맞는 도구로 설정
          setTimeout(() => {
            const firstScene = list[0];
            const isFirstSceneTransformed = firstScene.s3_key && firstScene.s3_key.startsWith('processed');
            
                            if (isFirstSceneTransformed) {
                              handleModeChange('select');
                            } else {
                              handleModeChange('select');
                            }          }, 100);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [pid]);

  // 씬 선택 → 상세 로드
  useEffect(() => {
    if (!pid || !selectedId) {
      return;
    }

    const current = scenes.find((s) => s.id === selectedId);
    if (!current) return;
    if (!("s3_key" in current)) {
      (async () => {
        try {
          const {data} = await client.get(
              `/projects/${pid}/scenes/${selectedId}`
          );
          const detail = data.scene || {};
          setScenes((prev) =>
              prev.map((s) => {
                if (s.id === selectedId) {
                  const updated = {...s, ...detail};
                  // 변환 상태 재계산
                  updated.saveMode = updated.s3_key && updated.s3_key.startsWith('processed') ? 'processed' : 'originals';
                  updated.isTransformed = updated.s3_key && updated.s3_key.startsWith('processed');
                  return updated;
                }
                return s;
              })
          );
        } catch (e) {
          console.error(e);
        }
      })();
    }
  }, [selectedId, pid, scenes]);

  // 씬 로드 시 히스토리 초기 스냅샷
  useEffect(() => {
    if (selectedId && scenes.find(scene => scene.id === selectedId)) {
      // 씬이 선택되고 로드가 완료되었을 때
      if (!globalHistoryStack.currentStates[selectedId]) {
        // 약간의 딜레이를 두고 히스토리 저장 (캔버스 로드 완료 후)
        setTimeout(() => {
          saveToHistory('scene_loaded', selectedId);
        }, 500);
      }
    }
  }, [selectedId]);

  // Canvas → 변경 반영
  const handleSceneChange = React.useCallback(
      (id, patch) => {
        setScenes((prev) =>
            prev.map((s) => (s.id === id ? {...s, ...patch} : s))
        );
      }, [imageUrl, originalCanvasState, setScenes]
  );

  // 씬 추가
  const handleAddScene = async () => {
    try {
      const projectIdReady = await ensureProjectId();

      const {data} = await client.post(
          `/projects/${projectIdReady}/scenes`,
          {}
      );
      const createdRaw = data.scene || data || {};
      const createdId = createdRaw.id ?? createdRaw.scene_id ?? createdRaw.sceneId;
      const fallbackSceneNum = createdRaw.scene_num ?? (scenes.length + 1);
      const createdNorm = {
        ...createdRaw,
        id: createdId,
        project_id: createdRaw.project_id ?? projectIdReady,
        scene_num: fallbackSceneNum,
        name: createdRaw.name || `Scene ${fallbackSceneNum}`,
        imageUrl: getImageUrl(createdRaw.s3_key),
      };
      const nextScenes = [...scenes, createdNorm];
      setScenes(nextScenes);
      setProjectMeta(prev => (prev ? { ...prev, max_scene: nextScenes.length } : prev));

      // 선택 상태 초기화
      setSelectedObject(null);
      setSelectedObjectLayerId(null);

      if (createdId) {
        await handleSelect(createdId);
      } else {
        // 만약의 경우를 대비해 폴백
        setSelectedId(null);
      }

      const nextTotal = nextScenes.length + 1;
      if (nextTotal > VISIBLE) setStart(nextTotal - VISIBLE);

      window.dispatchEvent(new CustomEvent('editor:scene-changed', {
        detail: { sceneId: createdId, projectId }
      }));

    } catch (e) {
      console.error(e);
      alert("씬 생성 실패");
    }
  };

  // 이전 씬의 saveMode 기억
  const previousSaveModeRef = useRef('originals');

  // useAutoSave의 saveMode 변경을 감지
  useEffect(() => {
    if (saveMode) {
      previousSaveModeRef.current = saveMode;
    }
  }, [saveMode]);

    // 선택
  const handleSelect = (id) => {
      if (id === "__ADD__" || id === selectedId) return;

    // --- 1. 데이터 캡쳐 ---
    // 씬이 바뀌기 직전, 현재 캔버스의 데이터를 미리 변수에 저장합니다.
    let dataToSave = null;
    let thumbnailToSave = null;
    const sceneIdToSave = selectedId; // 떠나는 씬의 ID
    const saveModeToUse = previousSaveModeRef.current; // 떠나는 씬의 저장 모드

      if (sceneIdToSave && stageRef.current) {
        const canvas = stageRef.current;
        dataToSave = getCurrentCanvasData();
        thumbnailToSave = canvas.toDataURL({ format: 'png', quality: 0.5 });
      }

    // --- 2. UI 즉시 업데이트 ---
    setSelectedId(id);
    setSelectedObject(null);
    setSelectedObjectLayerId(null);

    // 캔버스 선택 해제
    if (stageRef.current) {
      const canvas = stageRef.current;
      canvas.discardActiveObject();
      canvas.renderAll();
    }

    // --- 3. 백그라운드에서 저장 실행 ---
    if (sceneIdToSave && dataToSave) {
      saveCurrentScene(sceneIdToSave, saveModeToUse, {
        shouldSaveThumbnail: true,
        capturedCanvasData: dataToSave,
        capturedThumbnailDataUrl: thumbnailToSave,
      });
    }

    // --- 캐러셀 스크롤 등 나머지 UI 로직 ---
    const nextScene = scenes.find(s => s.id === id);
    const nextSceneTransformed = nextScene?.saveMode === 'processed' || nextScene?.isTransformed === true;

    if (nextSceneTransformed) {
      handleModeChange('select');
    } else {
      handleModeChange('select');
    }

    const items = [...scenes, {id: "__ADD__", isAdd: true}];
    const idx = items.findIndex(it => it.id === id);
    if (idx < start) setStart(idx);
    if (idx >= start + VISIBLE) setStart(idx - VISIBLE + 1);

    // 레이어 상태 보정
    setTimeout(() => {
      updateLayerState();
      setSelectedObject(null);
      setSelectedObjectLayerId(null);

      // 새 씬인 경우 레이어 시스템이 올바르게 초기화되었는지 확인
      setTimeout(() => {
        updateLayerState();

        // 여전히 활성 레이어가 없으면 강제로 기본값 설정
        setTimeout(() => {
          if (!activeLayerIdState || activeLayerIdState === null) {
            setActiveLayerIdState('layer-1');
          }
        }, 100);
      }, 200);
    }, 100);
  };

  // scenes/selectedId 변경 시 선택 유효성 보정
  useEffect(() => {
    if (!Array.isArray(scenes)) return;

    if (scenes.length === 0) {
      if (selectedId != null) setSelectedId(null);
      return;
    }

    const exists = selectedId != null && scenes.some((s) => s.id === selectedId);
    if (!exists) {
      // 새로 추가/기존 삭제 등으로 현재 선택이 유효하지 않으면 마지막 항목으로 보정
      const lastId = scenes[scenes.length - 1]?.id ?? null;
      if (lastId !== selectedId) setSelectedId(lastId);
    }
  }, [scenes, selectedId]);

  // + 카드까지 포함
  const items = useMemo(
      () => [...scenes, {id: "__ADD__", isAdd: true}],
      [scenes]
  );
  const total = items.length;
  const end = Math.min(start + VISIBLE, total);
  const visibleItems = items.slice(start, end);

  // UI-only 씬 넘버링
  const scenesForUI = useMemo(() => {
    return scenes.map((s, idx) => {
      const n = (s?.name || "").trim();
      const isDefault = /^Scene\s+\d+$/i.test(n) || n === "";
      return isDefault ? {...s, name: `Scene ${idx + 1}`} : s;
    });
  }, [scenes]);

  // 캔버스 핸들러 함수들
// EditorPage.jsx - handleModeChange 함수 수정 (기존 함수를 찾아서 수정)
  const handleModeChange = React.useCallback(
      (mode) => {
        // 팬 모드 처리
        if (mode === 'pan') {
          const canvas = stageRef.current;
          if (canvas && typeof canvas.enterPanMode === 'function') {
            canvas.enterPanMode();
          }
          setIsPanMode(true);
          setDrawingMode('pan');
          return;
        }

        // 다른 모드 처리 (기존 로직)
        try {
          const canvas = stageRef.current;
          const panActive = isPanMode || (canvas && typeof canvas.getPanMode === 'function' && canvas.getPanMode());
          if (panActive && canvas && typeof canvas.exitPanMode === 'function') {
            canvas.exitPanMode();
          }
        } catch (e) {
        }
        setIsPanMode(false);
        setDrawingMode(mode);
        if (stageRef.current && stageRef.current.setDrawingMode) {
          stageRef.current.setDrawingMode(mode);
          setTimeout(() => {
            if (stageRef.current && stageRef.current.setDrawingColor) {
              stageRef.current.setDrawingColor(drawingColor);
            }
          }, 20);
        }
      },
      [drawingColor, isPanMode]
  );

  // 이미지 변환 핸들러
 const handleTransform = useCallback(async (sceneIdToTransform) => {

    if (!sceneIdToTransform) {
    alert("먼저 씬을 추가하거나 선택해 주세요.");
    return;
  }
  if (!pid) {
    alert("프로젝트 ID가 없습니다. 페이지를 새로고침해 주세요.");
    return;
  }
  if (!stageRef.current) {
    alert("캔버스가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
    return;
  }

  setProcessing(true);

  try {
    let finalUrl = '';
    let newS3Key = null;

    // 씬 정보를 가져와서 s3_key 확인
    const sceneResp = await client.get(`/projects/${pid}/scenes/${sceneIdToTransform}`);
    const sceneData = sceneResp.data;
    const s3Key = sceneData.s3_key;

    // s3_key가 null이거나 'originals'로 시작하면 원본 파일과 함께 변환 요청
    const needsOriginalFile = !s3Key || s3Key.startsWith('originals');

    if (needsOriginalFile) {
      console.log("원본 파일이 필요하여 최초 생성을 요청합니다.");
      const hasContent = stageRef.current.hasDrawnContent && stageRef.current.hasDrawnContent();
      if (!hasContent) {
        alert("변환할 내용이 없습니다. 먼저 이미지를 추가하거나 그림을 그려주세요.");
        setProcessing(false);
        return;
      }
      const canvasImage = stageRef.current.exportCanvasAsImage();
      const blob = await new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.getContext('2d').drawImage(img, 0, 0);
          // PNG 대신 고품질 JPEG 사용으로 파일 크기 대폭 감소 (품질 90%)
          canvas.toBlob(resolve, 'image/jpeg', 0.9);
        };
        img.src = canvasImage;
      });
      const file = new File([blob], "canvas_drawing.jpg", { type: "image/jpeg" });
      const fd = new FormData();
      fd.append("image", file);

      const resp = await client.post(
        `/projects/${pid}/scenes/${sceneIdToTransform}/processed?target_dots=${targetDots}`,
        fd
      );
      finalUrl = getImageUrl(resp.data.output_url);
      newS3Key = resp.data.s3_key;

    } else {
      console.log("기존 원본을 사용하여 재변환을 요청합니다.");
      const rgbColor = hexToRgb(drawingColor);
      const resp = await client.post(
        `/projects/${pid}/scenes/${sceneIdToTransform}/processed?target_dots=${targetDots}`,
        {
          color_r: rgbColor.r,
          color_g: rgbColor.g,
          color_b: rgbColor.b,
        }
      );
      finalUrl = getImageUrl(resp.data.output_url);
    }

    if (stageRef.current?.changeSaveMode) {
      stageRef.current.changeSaveMode('processed');
      console.log(stageRef.current.changeSaveMode);
    }

    if (!finalUrl) {
      throw new Error("변환 후 URL을 받지 못했습니다.");
    }

    // 1. 서버에서 변환된 JSON 데이터를 직접 가져옵니다.
    const jsonDataResponse = await fetch(finalUrl);
    if (!jsonDataResponse.ok) {
      throw new Error("변환된 JSON 데이터를 가져오는 데 실패했습니다.");
    }
    const transformedJsonData = await jsonDataResponse.json();

    // 2. 가져온 데이터를 IndexedDB에 먼저 저장합니다.
    await saveCanvasToIndexedDB(sceneIdToTransform, transformedJsonData);
    await clearHistoryAndSetNew("scene_transformed", sceneIdToTransform, transformedJsonData);

    // 3. scenes 배열의 상태를 업데이트합니다. (기존과 동일)
    setScenes(prevScenes =>
      prevScenes.map(scene => {
        if (scene.id === sceneIdToTransform) {
          return {
            ...scene,
            saveMode: 'processed',
            isTransformed: true,
            s3_key: newS3Key || scene.s3_key,
          };
        }
        return scene;
      })
    );

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      // IndexedDB 저장 이벤트
      window.dispatchEvent(new CustomEvent('indexeddb:canvas-saved', {
        detail: {
          sceneId: sceneIdToTransform,
          // objectCount: transformedJsonData.objects.length,
          savedAt: new Date().toISOString(),
          source: 'transform'
        }
      }));

      // Editor 상태 업데이트 이벤트
      window.dispatchEvent(new CustomEvent('editor:updated', {
        detail: {
          selectedId: sceneIdToTransform,
          isTransformed: true,
                // objectCount: transformedJsonData.objects.length,
        }
      }));
    }

    // 4. 현재 씬이 변환하던 씬일 경우, IndexedDB에 저장된 데이터를 캔버스에 로드합니다.
    if (stageRef.current && selectedIdRef.current === sceneIdToTransform) {
      if (stageRef.current.clear) {
        stageRef.current.clear();
      }
      stageRef.current.loadFromJSON(transformedJsonData, () => {
        stageRef.current.renderAll();
      });
    } else {
      console.log(`변환은 완료되었지만 사용자가 다른 씬(${selectedId})으로 이동하여 캔버스는 업데이트하지 않습니다.`);
    }

    // React 상태 설정
    stageRef.current.isDrawingMode = false;
    stageRef.current.selection = true;

    setDrawingMode('select');
    setIsPanMode(false);

  } catch (e) {
    console.error("Transform error", e);
    alert(`이미지 변환 중 오류가 발생했습니다: ${e.response?.data?.detail || e.message}`);
  } finally {
    setProcessing(false);
  }
}, [pid, targetDots, drawingColor, setScenes, setProcessing, handleModeChange, saveImmediately])

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16)} : {
      r: 0,
      g: 0,
      b: 0
    };
  };

  // 변환 상태에 따른 허용 도구 확인 (이제 통합된 그리기 도구로 인해 필요 없음)
  const isToolAllowed = React.useCallback((mode) => {
    // 모든 도구를 허용 (그리기 도구는 이미 통합되어 자동으로 전환됨)
    return true;
  }, [isSceneTransformed]);

  // 키보드 단축키 추가
  useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      const isTyping = target &&
          (target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.isContentEditable);
      if (isTyping) return;

      const key = e.key?.toLowerCase();
      if (key === "v") {
        e.preventDefault();
        handleModeChange('select');
      } else if (key === "h") { // Also handle space for pan
        e.preventDefault();
        handleModeChange('pan');
      }

      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo && !isProcessing) {
          undo();
        }
      }

      // Ctrl/Cmd + Shift + Z: Redo (또는 Ctrl/Cmd + Y)
      if ((e.ctrlKey || e.metaKey) && ((key === 'z' && e.shiftKey) || key === 'y')) {
        e.preventDefault();
        if (canRedo && !isProcessing) {
          redo();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleModeChange, undo, redo, canUndo, canRedo, isProcessing]);

  const handleClearAll = React.useCallback(async () => {
    const canvas = stageRef?.current;
    if (canvas && canvas.clear) {
      if (
        confirm(
          "캔버스의 모든 내용을 지우시겠습니까? 이 작업은 되돌릴 수 없습니다. - editor page"
        )
      ) {
        try {
          // 1. 캔버스 완전 초기화
          canvas.clear();

          // 2. 서버 및 indexedDB 데이터 업데이트
          await client.patch(`/projects/${pid}/scenes/${selectedId}`, {
            status: 'reset'
          });
          triggerAutoSave({action: "clearAll"});
          saveToHistory('clearAll')

          // 3. 씬 상태 초기화
          setScenes(prevScenes =>
            prevScenes.map(scene => {
              if (scene.id === selectedId) {
                return {
                  ...scene,
                  saveMode: 'originals',
                  isTransformed: false,
                };
              }
              return scene;
            })
          );

          // 5. 캔버스 내부 저장 모드 변경
          if (canvas?.changeSaveMode) {
            canvas.changeSaveMode('originals');
          }
          handleModeChange('select')

        } catch (error) {
          console.error("씬 초기화 중 오류 발생:", error);
          alert("씬 초기화 중 오류가 발생했습니다. 다시 시도해주세요.");
        }
      }
    }
  }, [client, pid, selectedId, drawingMode, isPanMode]);

  const handleColorChange = React.useCallback((color) => {
    setDrawingColor(color);
    if (stageRef.current && stageRef.current.setDrawingColor) {
      stageRef.current.setDrawingColor(color);
    }
  }, []);

  const handleColorPreview = React.useCallback((color) => {
    setDrawingColor(color);
    if (stageRef.current && stageRef.current.setDrawingColor) {
      stageRef.current.setDrawingColor(color);
    }
  }, []);

  // Change fill color for single or multi-selection
  const handleSelectedFillChange = React.useCallback((hex) => {
    const canvas = stageRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject && canvas.getActiveObject();
    if (!active) return;

    const applyFill = (obj) => {
      if (!obj) return;
      if (obj.type === "path" || obj.type === "line" || (!obj.fill && ("stroke" in obj))) {
        obj.set({ stroke: hex });
        return;
      }
      if ("fill" in obj) {
        obj.set({fill: hex, originalFill: hex});
      }
    };

    if (((active?.type && active.type.toLowerCase() === "activeselection") || active?.type === "group")) {
      (active._objects || active.getObjects?.() || []).forEach(applyFill);
    } else {
      applyFill(active);
    }

    canvas.renderAll && canvas.renderAll();
    setSelectedObject((prev) => (prev ? {...prev, fill: hex, stroke: hex} : prev));
  }, []);

  const handleChangeBrightness = useCallback((brightnessValue) => {
    const canvas = stageRef.current;
    if (!canvas) {
      return;
    }

    const activeObject = canvas.getActiveObject();
    if (!activeObject) {
      return;
    }

    if (activeObject.type === 'activeselection') {
      const objects = activeObject.getObjects();

      objects.forEach((obj, index) => {
        obj.set({ opacity: brightnessValue });
      });
    } else {
      activeObject.set({ opacity: brightnessValue });
    }

    canvas.renderAll();
  }, []);

  // 레이어 관련 핸들러들
  const handleLayerSelect = React.useCallback((layerId) => {
    if (stageRef.current && stageRef.current.layers && stageRef.current.layers.setActiveLayer) {
      try {
        stageRef.current.layers.setActiveLayer(layerId);
        updateLayerState();

        setTimeout(() => {
          updateLayerState();
        }, 50);
      } catch (error) {
        console.error('Error selecting layer:', error);
      }
    } else {
      console.warn('Canvas layers not ready');
    }
  }, [updateLayerState, activeLayerIdState]);

  const handleCreateLayer = React.useCallback(() => {
    if (stageRef.current && stageRef.current.layers && stageRef.current.layers.createLayer) {
      const currentLayers = stageRef.current.layers.getLayers() || [];
      const drawingLayers = currentLayers.filter(layer => layer.type === 'drawing');
      let layerNumber = drawingLayers.length + 1;

      while (currentLayers.some(layer => layer.name === `레이어 ${layerNumber}`)) {
        layerNumber++;
      }

      const defaultName = `레이어 ${layerNumber}`;
      const layerName = prompt('새 레이어 이름을 입력하세요:', defaultName);

      if (layerName !== null) {
        try {
          const finalName = (layerName.trim() === '' || layerName.trim() === defaultName)
              ? null
              : layerName.trim();
          stageRef.current.layers.createLayer(finalName);
          setIsLayerPanelOpen(true);
          setTimeout(updateLayerState, 10);
        } catch (error) {
          console.error('Error creating layer:', error);
        }
      }
    }
  }, [updateLayerState]);

  const handleDeleteLayer = React.useCallback((layerId) => {
    if (stageRef.current && stageRef.current.layers && stageRef.current.layers.deleteLayer) {
      try {
        stageRef.current.layers.deleteLayer(layerId);
        setTimeout(updateLayerState, 10);
      } catch (error) {
        console.error('Error deleting layer:', error);
      }
    }
  }, [updateLayerState]);

  const handleToggleVisibility = React.useCallback((layerId) => {
    if (stageRef.current && stageRef.current.layers && stageRef.current.layers.toggleVisibility) {
      try {
        stageRef.current.layers.toggleVisibility(layerId);
        setTimeout(updateLayerState, 10);
      } catch (error) {
        console.error('Error toggling visibility:', error);
      }
    }
  }, [updateLayerState]);

  const handleToggleLock = React.useCallback((layerId) => {
    if (stageRef.current && stageRef.current.layers && stageRef.current.layers.toggleLock) {
      try {
        stageRef.current.layers.toggleLock(layerId);
        setTimeout(updateLayerState, 10);
      } catch (error) {
        console.error('Error toggling lock:', error);
      }
    }
  }, [updateLayerState]);

  const handleRenameLayer = React.useCallback((layerId, newName) => {
    if (stageRef.current && stageRef.current.layers && stageRef.current.layers.renameLayer) {
      try {
        stageRef.current.layers.renameLayer(layerId, newName);
        setTimeout(updateLayerState, 10);
      } catch (error) {
        console.error('Error renaming layer:', error);
      }
    }
  }, [updateLayerState]);

  const handleLayerReorder = React.useCallback((draggedLayerId, targetLayerId) => {
    if (stageRef.current && stageRef.current.layers && stageRef.current.layers.reorderLayers) {
      try {
        stageRef.current.layers.reorderLayers(draggedLayerId, targetLayerId);
        setTimeout(() => {
          updateLayerState();
        }, 10);
      } catch (error) {
        console.error('Error reordering layers:', error);
      }
    }
  }, [updateLayerState]);

  // JSON 생성 함수 (Navbar와 공유)
  const handleJsonGeneration = React.useCallback(async () => {
    if (!pid) {
      console.warn('Project ID not available for JSON generation');
      return null;
    }

    try {
      const response = await client.post(`/projects/${pid}/json`);
      const { json_url, unity_sent, scenes_processed, total_scenes } = response.data;

      if (json_url) {
        const base = client.defaults?.baseURL?.replace(/\/$/, "") || "";
        const full = json_url.startsWith("http") ? json_url : `${base}/${json_url.replace(/^\//, "")}`;
        alert(unity_sent
          ? `${scenes_processed}/${total_scenes}개의 JSON이 생성되어 Unity로 전송되었습니다.`
          : `${scenes_processed}/${total_scenes}개의 JSON이 생성되었습니다.`);
        return full;
      } else {
        alert("JSON 생성에 실패했습니다.");
        return null;
      }
    } catch (error) {
      console.error("JSON generation error:", error);
      alert("JSON 생성 중 오류가 발생했습니다.");
      return null;
    }
  }, [pid]);

  // window API
  useEffect(() => {
    window.editorAPI = {
      // state
      targetDots,
      processing,
      imageUrl,
      selectedId,
      projectName,
      isTransformed: isSceneTransformed,
      // refs & methods
      stageRef,
      setTargetDots,
      handleTransform,
      handleManualSave,
      handleJsonGeneration,
      // undo redo
      undo,
      redo,
      canUndo,
      canRedo,
      isProcessing
    };
    // notify listeners (e.g., Navbar) that editor state changed
    window.dispatchEvent(
        new CustomEvent("editor:updated", {
          detail: {
            targetDots,
            processing,
            imageUrl,
            selectedId,
            projectName,
            isProcessing,
            isServerSyncing,
            isTransformed: isSceneTransformed,
          },
        })
    );
  }, [targetDots, processing, imageUrl, selectedId, projectName, canUndo, canRedo, isProcessing, undo, redo, isServerSyncing, isSceneTransformed]);

  const isSelectOrPan = drawingMode === 'select' || isPanMode;

  // 로딩 먼저 반환 (원래 위치 오류 수정)
  if (isLoading) {
    return (
      <div className="editor-loading">
        <div className="editor-loading-content">
          <p>프로젝트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // JSX
  return (
    <div className="editor-shell font-nanumhuman">
      {/* 좌측 툴바 */}
      <aside id="left-rail" className="left-rail">
        <div className="left-rail-inner">
          <div className="tool-anchor">
            <button
              ref={toolButtonRef}
              onClick={() => setToolSelectionOpen(prev => !prev)}
              title="선택 도구"
              aria-label="선택 도구"
              className={`tool-button tool-select-toggle ${isSelectOrPan ? 'active' : ''}`}
              data-open={isToolSelectionOpen ? 'true' : 'false'}
              onMouseEnter={() => setSelectHovered(true)}
              onMouseLeave={() => setSelectHovered(false)}
            >
              {isPanMode ? <IoHandRightOutline size={20}/> : <LuMousePointer size={20}/>}
            </button>
            {selectHovered && createPortal(
              <div className="tooltip" style={{top: selectTooltipPos.top, left: selectTooltipPos.left}}>
                {getSelectTooltipText()}
              </div>,
              document.body
            )}
            <PortalPopover
              anchorRef={toolButtonRef}
              open={isToolSelectionOpen}
              onClose={() => setToolSelectionOpen(false)}
              placement="right"
              align="start"
              offset={8}
              width={120}
              padding={4}
            >
              <button
                onClick={() => { handleModeChange("select"); setToolSelectionOpen(false); }}
                title="선택 모드 (V)"
                aria-label="선택 모드"
                className={`popover-button ${drawingMode === 'select' && !isPanMode ? 'active' : ''}`}
              >
                <LuMousePointer/>
                <span>클릭(V)</span>
              </button>
              <button
                onClick={() => { handleModeChange("pan"); setToolSelectionOpen(false); }}
                title="이동 모드 (H)"
                aria-label="이동 모드"
                className={`popover-button ${isPanMode ? 'active' : ''}`}
              >
                <IoHandRightOutline/>
                <span>이동(H)</span>
              </button>
            </PortalPopover>
          </div>

          {/* 상단 툴바 */}
          <EditorToolbar
            pid={pid}
            selectedId={selectedId}
            imageUrl={imageUrl}
            targetDots={targetDots}
            setTargetDots={setTargetDots}
            processing={processing}
            onTransform={handleTransform}
            isUnityVisible={isUnityVisible}
            showUnity={showUnity}
            hideUnity={hideUnity}
            onImageDragStart={(imageUrl) =>
                console.log("Image drag started:", imageUrl)
            }
            drawingMode={drawingMode}
            eraserSize={eraserSize}
            drawingColor={drawingColor}
            onModeChange={handleModeChange}
            onColorChange={handleColorChange}
            onColorPreview={handleColorPreview}
            onClearAll={handleClearAll}
            stageRef={stageRef}
            layout="sidebar"
            galleryOpen={galleryOpen}
            onGalleryStateChange={setGalleryOpen}
            isServerSyncing={isServerSyncing}
            handleManualSave={handleManualSave}
            isSceneTransformed={isSceneTransformed}
            isToolAllowed={isToolAllowed}
          />

          <div className="settings-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <a
              href="/dashboard"
              ref={dashboardBtnRef}
              className="tool-button"
              aria-label="대시보드로 이동"
              onMouseEnter={() => setDashboardHovered(true)}
              onMouseLeave={() => setDashboardHovered(false)}
            >
              <ImExit />
            </a>
            {dashboardHovered && createPortal(
              <div
                className="tool-tooltip"
                style={{ top: dashboardTooltipPos.top, left: dashboardTooltipPos.left, position: "absolute", zIndex: 9999 }}
              >
                대시보드로 이동
              </div>,
              document.body
            )}
            <button
              type="button"
              title="프로젝트 설정"
              aria-label="프로젝트 설정"
              onClick={openProjectSettings}
              disabled={!projectMeta}
              className="tool-button"
              style={{cursor: projectMeta ? "pointer" : "not-allowed"}}
            >
              <CiSettings size={23}/>
            </button>
          </div>
        </div>
      </aside>

      {/* 갤러리 */}
      {galleryOpen && (
        <div className="gallery-panel">
          <ImageGallery onImageDragStart={(u) => console.log("drag:", u)}/>
        </div>
      )}

      {/* 메인 캔버스 */}
      <div className="main-content">
        <div className="canvas-area">
        <MainCanvasSection
          selectedScene={selectedScene}
          projectId={project_id}
          imageUrl={imageUrl}
          stageRef={stageRef}
          onChange={handleSceneChange}
          onPreviewChange={(dataUrl) => {
            if (!dataUrl || !selectedId) return;
            setScenes(prev => prev.map(s => s.id === selectedId ? {...s, preview: dataUrl} : s));
          }}
          onCanvasChange={handleCanvasChange}
          drawingMode={drawingMode}
          eraserSize={eraserSize}
          drawingColor={drawingColor}
          activeLayerId={activeLayerIdState}
          onModeChange={handleModeChange}
          onSelectionChange={(selection) => {
            if (selection && stageRef.current) {
              const activeObject = stageRef.current.getActiveObject();

              if (activeObject && activeObject.type.toLowerCase() === 'activeselection') {
                // 다중 선택: 첫 번째 객체의 속성을 대표값으로 사용
                const objects = activeObject.getObjects();
                const firstObject = objects[0];

                const enhancedSelection = {
                  ...selection,
                  opacity: firstObject?.opacity || 1.0,
                  fill: firstObject?.fill || selection.fill,
                  customType: firstObject?.customType || selection.customType,
                  // 다중 선택임을 명시
                  isMultiSelection: true,
                  objectCount: objects.length
                };
                setSelectedObject(enhancedSelection);
              } else {
                // 단일 선택
                const enhancedSelection = {
                  ...selection,
                  opacity: activeObject?.opacity || 1.0,
                  isMultiSelection: false
                };
                setSelectedObject(enhancedSelection);
              }
            } else {
              setSelectedObject(selection);
            }
            setSelectedObjectLayerId(selection?.layerId || null);
          }}
          onPanChange={setIsPanMode}
          changeSaveMode={changeSaveMode}
          triggerAutoSave={triggerAutoSave}
          saveToHistory={saveToHistory}
          isSceneTransformed={isSceneTransformed}
        />

        {/* 씬 캐러셀 */}
        <SceneCarousel
          projectId={pid}
          scenes={scenesForUI}
          setScenes={setScenes}
          selectedId={selectedId}
          start={start}
          setStart={setStart}
          onAddScene={handleAddScene}
          onSelectScene={handleSelect}
          compact={galleryOpen}
        />
        </div>
      </div>
      {/* 오른쪽 패널 */}
      <aside className="right-panel">
        <div className="right-panel-inner">
          {/* 변환 전: 프리뷰 */}
          {!isSceneTransformed && (
            <PreviewPanel
              ref={previewPanelRef}
              projectId={pid}
              sceneId={selectedId}
              stageRef={stageRef}
              targetDots={targetDots}
              drawingColor={drawingColor}
              onTransformComplete={handleTransform}
              processing={processing}
              enabled={true}
              layersState={layersState}
            />
          )}

          {/* 변환 완료 후 */}
          {isSceneTransformed && (
            <div className="transform-complete-box">
              <div className="transform-complete-title inline-flex items-center gap-2 font-bold">
                <IoMdCheckmarkCircleOutline className="text-green-500 w-5 h-5" />
                변환 완료
              </div>
              <div className="transform-complete-text">
                브러쉬 도구로 추가 편집이 가능합니다.
              </div>
            </div>
          )}


          <div className="separator"/>

          {/* 선택 객체 속성 패널 */}
          <div className="accordion-section">
            <button
              type="button"
              className="accordion-header"
              aria-expanded={isPropertiesPanelOpen}
              onClick={() => setIsPropertiesPanelOpen(v => !v)}
            >
              <span>객체 속성</span>
              {selectedObject && (
                <span className="accordion-badge">
                  {(selectedObject?.customType || selectedObject?.type || "").toString()}
                </span>
              )}
            </button>
            {isPropertiesPanelOpen && (
              <div className="accordion-body">
                <ObjectPropertiesPanel
                  selection={selectedObject}
                  onChangeFill={handleSelectedFillChange}
                  onChangeBrightness={handleChangeBrightness}
                  triggerAutoSave={triggerAutoSave}
                  saveToHistory={saveToHistory}
                />
              </div>
            )}
          </div>

          <div className="separator"/>

          {/* 레이어 패널 */}
          {canvasReady ? (
            <LayerPanel
              layers={layersState}
              activeLayerId={activeLayerIdState}
              selectedObjectLayerId={selectedObjectLayerId}
              onLayerSelect={handleLayerSelect}
              onCreateLayer={handleCreateLayer}
              onDeleteLayer={handleDeleteLayer}
              onToggleVisibility={handleToggleVisibility}
              onToggleLock={handleToggleLock}
              onRenameLayer={handleRenameLayer}
              onLayerReorder={handleLayerReorder}
              open={isLayerPanelOpen}
              onToggleOpen={() => setIsLayerPanelOpen(v => !v)}
            />
          ) : (
            <div className="canvas-loading">캔버스를 불러오는 중...</div>
          )}
        </div>
      </aside>

      {editingProject && (
        <ProjectSettingsModal
          project={editingProject}
          onClose={closeProjectSettings}
          onSaved={handleSettingsSaved}
        />
      )}
    </div>
  );
}