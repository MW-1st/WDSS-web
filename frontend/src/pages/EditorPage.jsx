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
import { useParams, Link } from "react-router-dom";
import { ImExit } from "react-icons/im";
import { CiSettings } from "react-icons/ci";
import { LuMousePointer } from "react-icons/lu";
import { IoHandRightOutline } from "react-icons/io5";
import ProjectSettingsModal from "../components/ProjectSettingsModal";
import PortalPopover from "../components/PortalPopover.jsx";
import { saveCanvasToIndexedDB } from "../utils/indexedDBUtils.js";
import "../styles/EditorPage.css";
import "../styles/CanvasTools.css"; // tooltip style 재사용

const VISIBLE = 4;
const DUMMY = "11111111-1111-1111-1111-111111111111";

const LEFT_TOOL_WIDTH = 100;
const RIGHT_PANEL_WIDTH = 280; // 미리보기 패널을 위해 40px 추가

export default function EditorPage({projectId = DUMMY}) {
  const {project_id} = useParams();
  const [pid, setPid] = useState(project_id);
  const [scenes, setScenes] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [projectMeta, setProjectMeta] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [start, setStart] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // 프로젝트 ID가 없을 경우 자동으로 새 프로젝트 생성
  useEffect(() => {
    if (!pid) {
      ensureProjectId().then(newPid => {
        setPid(newPid);
      }).catch(error => {
        console.error("Failed to create new project:", error);
      });
    }
  }, []);

  // 갤러리 열림 상태
  const [galleryOpen, setGalleryOpen] = useState(() => {
    const saved = localStorage.getItem("wdss:galleryOpen");
    return saved ? JSON.parse(saved) : false;
  });
  useEffect(() => {
    localStorage.setItem("wdss:galleryOpen", JSON.stringify(galleryOpen));
  }, [galleryOpen]);

  // 에디터 페이지 떠날 때 갤러리 닫기
  useEffect(() => {
    return () => {
      try {
        localStorage.setItem("wdss:galleryOpen", JSON.stringify(false));
      } catch (_) {}
    };
  }, []);

  // 이미지 변환 처리 상태
  const [processing, setProcessing] = useState(false);
  const [targetDots, setTargetDots] = useState(2000);

  // 캔버스 / UI 참조
  const stageRef = useRef(null);
  const galleryRef = useRef(null);
  const toolButtonRef = useRef(null);
  const [selectHovered, setSelectHovered] = useState(false);
  const [selectTooltipPos, setSelectTooltipPos] = useState({ top: 0, left: 0 });

  // 캔버스 관련 상태
  const [drawingMode, setDrawingMode] = useState("select");
  const [eraserSize, setEraserSize] = useState(20);
  const [drawingColor, setDrawingColor] = useState('#222222');
  const [selectedObject, setSelectedObject] = useState(null);
  const [isPanMode, setIsPanMode] = useState(false);
  const [isToolSelectionOpen, setToolSelectionOpen] = useState(false);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const previousSceneId = useRef(selectedId);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // 선택된 개체 상태에 따라 개체 속성 패널 자동 열기/닫기
  useEffect(() => {
    if (selectedObject) {
      setIsPropertiesPanelOpen(true);
    } else {
      setIsPropertiesPanelOpen(false);
    }
  }, [selectedObject]);

  // Select/Pan 토글 툴팁 위치
  useEffect(() => {
    if (!selectHovered) return;
    const el = toolButtonRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSelectTooltipPos({
        top: Math.round(r.top + r.height / 2),
        left: Math.round(r.right + 10),
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [selectHovered]);

  const getSelectTooltipText = () =>
    isPanMode
      ? "이동(H): 캔버스를 드래그해서 이동"
      : "선택(V): 객체를 선택하고 조작";

  // 미리보기 패널 관련 상태
  const previewPanelRef = useRef(null);
  const [rightPropsOpen, setRightPropsOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wdss:rightPropsOpen') ?? 'true'); } catch { return true; }
  });
  const [rightLayersOpen, setRightLayersOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wdss:rightLayersOpen') ?? 'true'); } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem('wdss:rightPropsOpen', JSON.stringify(rightPropsOpen)); } catch(_){} }, [rightPropsOpen]);
  useEffect(() => { try { localStorage.setItem('wdss:rightLayersOpen', JSON.stringify(rightLayersOpen)); } catch(_){} }, [rightLayersOpen]);

  // 캔버스 변경 시 미리보기 업데이트
  const handleCanvasChange = React.useCallback(() => {
    if (previewPanelRef.current && previewPanelRef.current.triggerPreview) {
      previewPanelRef.current.triggerPreview();
    }
  }, []);

  // 레이어 상태
  const [canvasReady, setCanvasReady] = useState(false);
  const [layersState, setLayersState] = useState([]);
  const [activeLayerIdState, setActiveLayerIdState] = useState(null);
  const [selectedObjectLayerId, setSelectedObjectLayerId] = useState(null);

  // 프로젝트 설정 모달 상태
  const [editingProject, setEditingProject] = useState(null);
  const openProjectSettings = () => {
    if (projectMeta) setEditingProject(projectMeta);
  };
  const closeProjectSettings = () => setEditingProject(null);
  const handleSettingsSaved = (updated) => {
    setProjectMeta(updated);
    if (updated?.project_name) setProjectName(updated.project_name);
    if (updated?.max_drone) setTargetDots(updated.max_drone);
  };
  const selectedScene = useMemo(
    () => scenes.find((s) => s.id === selectedId) || null,
    [scenes, selectedId]
  );

  // 씬의 변환 상태 확인 (기본값: 변환 전)
  const isSceneTransformed = useMemo(() => {
    if (!selectedScene) return false;
    return selectedScene.saveMode === 'processed' || selectedScene.isTransformed === true;
  }, [selectedScene]);

  // 씬의 원본 캔버스 상태와 이미지 URL
  const imageUrl = getImageUrl(selectedScene?.s3_key) || "";
  const originalCanvasState = selectedScene ? selectedScene.originalCanvasState : null;

  // 레이어 상태 업데이트 함수
  const updateLayerState = React.useCallback(() => {
    if (stageRef.current && selectedId) {
      try {
        const canvas = stageRef.current;
        if (canvas.getSceneLayerState) {
          const layerState = canvas.getSceneLayerState(selectedId);
          if (layerState && layerState.layers) {
            const layers = layerState.layers || [];
            const activeId = layerState.activeLayerId || 'layer-1';

            setLayersState(prevLayers => {
              const layersChanged =
                JSON.stringify(prevLayers.map(l => ({
                  id: l.id, zIndex: l.zIndex, name: l.name, visible: l.visible, locked: l.locked
                }))) !==
                JSON.stringify(layers.map(l => ({
                  id: l.id, zIndex: l.zIndex, name: l.name, visible: l.visible, locked: l.locked
                })));

              if (layersChanged) return [...layers];
              return prevLayers;
            });

            setActiveLayerIdState(prevActiveId => {
              if (prevActiveId !== activeId) return activeId;
              return prevActiveId;
            });
            return;
          }
        }

        // 폴백: 기존 방식
        if (stageRef.current.layers) {
          const layers = stageRef.current.layers.getLayers() || [];
          const activeId = stageRef.current.layers.getActiveLayerId() || 'layer-1';
          setLayersState([...layers]);
          setActiveLayerIdState(activeId);
        } else {
          console.log('Canvas layers not ready, using default values');
          setActiveLayerIdState('layer-1');
        }
      } catch (error) {
        console.warn('Error updating layer state:', error);
      }
    }
  }, [selectedId]);

  // unity 상태
  const {isUnityVisible, showUnity, hideUnity, sendTestData} = useUnity();

  // AutoSave 훅 초기화
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
      console.log(`Auto-saved scene ${data.sceneId} with ${data.objectCount} objects`);
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

  const {syncToServer, uploadThumbnail, getCurrentCanvasData} =
    useServerSync(pid, selectedId, stageRef);

  // 현재 씬 저장 함수
  const saveCurrentScene = useCallback(async (sceneIdToSave, saveModeToUse, options = {}) => {
    const {
      shouldSaveThumbnail = false,
      capturedCanvasData = null,
      capturedThumbnailDataUrl = null
    } = options;

    if (!sceneIdToSave || !stageRef.current) {
      console.warn('저장할 씬 ID 또는 캔버스가 없어 저장 작업을 건너뜁니다.');
      return;
    }

    const canvas = stageRef.current;
    const logAction = shouldSaveThumbnail ? "전체 저장 (썸네일 포함)" : "데이터 저장";
    console.log(`🚀 ${sceneIdToSave} 씬 ${logAction} 시작 (모드: ${saveModeToUse})`);

    try {
      const canvasData = capturedCanvasData || getCurrentCanvasData();

      const savePromises = [
        saveImmediately(canvasData),
        syncToServer(canvasData, saveModeToUse)
      ];

      if (shouldSaveThumbnail) {
        const thumbnailDataUrl =
          capturedThumbnailDataUrl || canvas.toDataURL({ format: 'png', quality: 0.5 });
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

  // 씬 변경 감지
  useEffect(() => {
    if (previousSceneId.current && previousSceneId.current !== selectedId) {
      console.log('Scene changed, syncing to server...');
    }
    previousSceneId.current = selectedId;
  }, [selectedId]);

  // 페이지 이탈 시 저장
  useEffect(() => {
    const handleSaveOnExit = () => {
      saveCurrentScene(selectedIdRef.current, previousSaveModeRef.current, {
        shouldSaveThumbnail: true
      });
    };

    const handleBeforeUnload = (event) => {
      if (selectedIdRef.current && stageRef.current) {
        console.log('페이지를 닫기 전 저장합니다...');
        handleSaveOnExit();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('페이지가 비활성화되어 저장합니다...');
        handleSaveOnExit();
      }
    };

    const handlePopState = () => {
      console.log('브라우저 네비게이션으로 인해 저장합니다...');
      handleSaveOnExit();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('popstate', handlePopState);

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
        try {
          if (stageRef.current.setDrawingMode) {
            stageRef.current.setDrawingMode('select');
          }
        } catch (_) {}
        updateLayerState();
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

  // 씬 변경 시 레이어 상태 3회 업데이트 (즉시/200ms/500ms 후)
  useEffect(() => {
    if (canvasReady && selectedId) {
      updateLayerState();
      setTimeout(updateLayerState, 200);
      setTimeout(updateLayerState, 500);
    }
  }, [selectedId, canvasReady, updateLayerState]);

  // 씬 변경 시 레이어 상태 복원
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
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
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

  // 초기: 프로젝트 메타 및 씬 데이터 로드
  useEffect(() => {
  if (!pid) return;

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

      try {
        const {data: scenesData} = await client.get(`/projects/${pid}/scenes`);
        const list = scenesData.scenes || [];
        setScenes(list.map((s, i) => ({
          ...s,
          name: s.name || `Scene ${s.scene_num ?? i + 1}`,
          imageUrl: getImageUrl(s.s3_key),
          saveMode: s.s3_key && s.s3_key.startsWith('processed') ? 'processed' : 'originals',
          isTransformed: s.s3_key && s.s3_key.startsWith('processed'),
          preview: `/thumbnails/${s.id}.png`,
        })));
        if (list[0]) setSelectedId(list[0].id);
      } catch (e) {
        console.error("Failed to load scenes:", e);
      }
    } catch (e) {
      console.warn("Failed to load project info", e?.response?.data || e?.message);
    } finally {
      setIsLoading(false);
    }
  })(); 
}, [pid]);

  // 초기: 씬 목록 로드
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
            saveMode: s.s3_key && s.s3_key.startsWith('processed') ? 'processed' : 'originals',
            isTransformed: s.s3_key && s.s3_key.startsWith('processed'),
            preview: `/thumbnails/${s.id}.png`,
          }))
        );
        if (list[0]) {
          setSelectedId(list[0].id);
          setTimeout(() => {
            const firstScene = list[0];
            const isFirstSceneTransformed = firstScene.s3_key && firstScene.s3_key.startsWith('processed');
            if (isFirstSceneTransformed) {
              handleModeChange('select');
            } else {
              handleModeChange('select');
            }
          }, 100);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [pid]);

  // 씬 상세 로드
  useEffect(() => {
    if (!pid || !selectedId) return;
    const current = scenes.find((s) => s.id === selectedId);
    if (!current) return;

    if (!("s3_key" in current)) {
      (async () => {
        try {
          const {data} = await client.get(`/projects/${pid}/scenes/${selectedId}`);
          const detail = data.scene || {};
          setScenes((prev) =>
            prev.map((s) => {
              if (s.id === selectedId) {
                const updated = {...s, ...detail};
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
  }, [selectedId, pid]);

  // 씬 변경 핸들러
  const handleSceneChange = React.useCallback(
    (id, patch) => {
      setScenes((prev) => prev.map((s) => (s.id === id ? {...s, ...patch} : s)));
    },
    [imageUrl, originalCanvasState, setScenes]
  );

  // 씬 추가
  const handleAddScene = async () => {
    try {
      const maxScenes = projectMeta?.max_scene ?? projectMeta?.maxScenes ?? null;
      if (Number.isFinite(maxScenes) && maxScenes !== null && scenes.length >= maxScenes) {
        alert(`씬은 최대 ${maxScenes}개까지만 생성할 수 있어요.`);
        return;
      }
      const projectIdReady = await ensureProjectId();
      const numericSceneNums = (scenes || [])
        .map((s) => s?.scene_num)
        .filter((n) => typeof n === "number" && !Number.isNaN(n));
      const maxSceneNum = numericSceneNums.length ? Math.max(...numericSceneNums) : 0;
      const scene_num = Math.max(maxSceneNum, scenes.length) + 1;

      const {data} = await client.post(`/projects/${projectIdReady}/scenes`, { scene_num });
      const createdRaw = data.scene || data || {};
      const createdId = createdRaw.id ?? createdRaw.scene_id ?? createdRaw.sceneId;
      const createdNorm = {
        ...createdRaw,
        id: createdId,
        project_id: createdRaw.project_id ?? projectIdReady,
        scene_num: createdRaw.scene_num ?? scene_num,
        name: createdRaw.name || `Scene ${createdRaw.scene_num ?? scene_num}`,
        imageUrl: getImageUrl(createdRaw.s3_key),
      };
      const nextScenes = [...scenes, createdNorm];
      setScenes(nextScenes);

      setSelectedObject(null);
      setSelectedObjectLayerId(null);

      if (createdId) {
        await handleSelect(createdId);
      } else {
        setSelectedId(null);
      }

      const nextTotal = nextScenes.length + 1;
      if (nextTotal > VISIBLE) setStart(nextTotal - VISIBLE);
    } catch (e) {
      console.error(e);
      alert("씬 생성 실패");
    }
  };

  // 이전 씬의 saveMode 기억
  const previousSaveModeRef = useRef('originals');
  useEffect(() => {
    if (saveMode) {
      previousSaveModeRef.current = saveMode;
    }
  }, [saveMode]);

  // 씬 선택
  const handleSelect = (id) => {
    if (id === "__ADD__" || id === selectedId) return;

    // --- 1. 현재 씬 데이터 캡쳐 ---
    let dataToSave = null;
    let thumbnailToSave = null;
    const sceneIdToSave = selectedId;
    const saveModeToUse = previousSaveModeRef.current;

    if (sceneIdToSave && stageRef.current) {
      const canvas = stageRef.current;
      dataToSave = getCurrentCanvasData();
      thumbnailToSave = canvas.toDataURL({ format: 'png', quality: 0.5 });
    }

    // --- 2. UI 전환 ---
    setSelectedId(id);
    setSelectedObject(null);
    setSelectedObjectLayerId(null);

    if (stageRef.current) {
      const canvas = stageRef.current;
      canvas.discardActiveObject();
      canvas.renderAll();
    }

    // --- 3. 백그라운드 저장 ---
    if (sceneIdToSave && dataToSave) {
      saveCurrentScene(sceneIdToSave, saveModeToUse, {
        shouldSaveThumbnail: true,
        capturedCanvasData: dataToSave,
        capturedThumbnailDataUrl: thumbnailToSave,
      });
    }

    // --- 캐러셀 처리 ---
    const items = [...scenes, {id: "__ADD__", isAdd: true}];
    const idx = items.findIndex(it => it.id === id);
    if (idx < start) setStart(idx);
    if (idx >= start + VISIBLE) setStart(idx - VISIBLE + 1);

    setTimeout(() => {
      updateLayerState();
      setSelectedObject(null);
      setSelectedObjectLayerId(null);

      setTimeout(() => {
        updateLayerState();
        setTimeout(() => {
          if (!activeLayerIdState || activeLayerIdState === null) {
            console.log('Force setting default active layer');
            setActiveLayerIdState('layer-1');
          }
        }, 100);
      }, 200);
    }, 100);
  };
  // 씬/selectedId 유효성 보정
  useEffect(() => {
    if (!Array.isArray(scenes)) return;
    if (scenes.length === 0) {
      if (selectedId != null) setSelectedId(null);
      return;
    }
    const exists = selectedId != null && scenes.some((s) => s.id === selectedId);
    if (!exists) {
      const lastId = scenes[scenes.length - 1]?.id ?? null;
      if (lastId !== selectedId) setSelectedId(lastId);
    }
  }, [scenes, selectedId]);

  // 캐러셀 데이터
  const items = useMemo(() => [...scenes, {id: "__ADD__", isAdd: true}], [scenes]);
  const total = items.length;
  const canSlide = total > VISIBLE;
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

  // 모드 변경
  const handleModeChange = React.useCallback(
    (mode) => {
      if (mode === 'pan') {
        const canvas = stageRef.current;
        if (canvas && typeof canvas.enterPanMode === 'function') {
          canvas.enterPanMode();
        }
        setIsPanMode(true);
        setDrawingMode('pan');
        return;
      }

      try {
        const canvas = stageRef.current;
        const panActive =
          isPanMode ||
          (canvas && typeof canvas.getPanMode === 'function' && canvas.getPanMode());
        if (panActive && canvas && typeof canvas.exitPanMode === 'function') {
          canvas.exitPanMode();
        }
      } catch (e) {}
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

  // 씬 변환 요청
  const handleTransform = useCallback(
    async (sceneIdToTransform) => {
      if (!sceneIdToTransform) {
        alert("변환할 씬을 선택하세요.");
        return;
      }
      if (!pid) {
        alert("프로젝트 ID가 없습니다. 저장 후 다시 시도하세요.");
        return;
      }
      if (!stageRef.current) {
        alert("캔버스가 준비되지 않았습니다.");
        return;
      }

      setProcessing(true);
      stageRef.current.off('mouse:down');
      stageRef.current.off('mouse:move');
      stageRef.current.off('mouse:up');

      try {
        let finalUrl = '';
        let newS3Key = null;

        // 현재 씬 정보 불러오기
        const sceneResp = await client.get(`/projects/${pid}/scenes/${sceneIdToTransform}`);
        const sceneData = sceneResp.data;
        const s3Key = sceneData.s3_key;

        const needsOriginalFile = !s3Key || s3Key.startsWith('originals');

        if (needsOriginalFile) {
          console.log("원본 파일 업로드 필요");
          const hasContent = stageRef.current.hasDrawnContent && stageRef.current.hasDrawnContent();
          if (!hasContent) {
            alert("내용이 없습니다. 드로잉 후 변환하세요.");
            setProcessing(false);
            return;
          }
          const canvasImage = stageRef.current.exportCanvasAsImage();
          const blob = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              canvas.getContext('2d').drawImage(img, 0, 0);
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
          console.log("기존 S3 파일 사용 변환");
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
        }

        if (!finalUrl) {
          throw new Error("출력 URL이 없습니다.");
        }

        // 변환된 JSON 다운로드
        const jsonDataResponse = await fetch(finalUrl);
        if (!jsonDataResponse.ok) {
          throw new Error("변환 JSON을 불러올 수 없습니다.");
        }
        const transformedJsonData = await jsonDataResponse.json();

        await saveCanvasToIndexedDB(sceneIdToTransform, transformedJsonData);

        setScenes((prevScenes) =>
          prevScenes.map((scene) =>
            scene.id === sceneIdToTransform
              ? {
                  ...scene,
                  saveMode: 'processed',
                  isTransformed: true,
                  s3_key: newS3Key || scene.s3_key,
                }
              : scene
          )
        );

        if (stageRef.current && selectedIdRef.current === sceneIdToTransform) {
          if (stageRef.current.clear) {
            stageRef.current.clear();
          }
          stageRef.current.loadFromJSON(transformedJsonData, () => {
            stageRef.current.renderAll();
          });
        }

        stageRef.current.isDrawingMode = false;
        stageRef.current.selection = true;
        setDrawingMode('select');
        setIsPanMode(false);
      } catch (e) {
        console.error("Transform error", e);
        alert(`변환 중 오류 발생: ${e.response?.data?.detail || e.message}`);
      } finally {
        setProcessing(false);
      }
    },
    [pid, targetDots, drawingColor, setScenes, setProcessing, handleModeChange, saveImmediately]
  );

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16)}
      : {r: 0, g: 0, b: 0};
  };

  // 특정 도구 사용 허용 여부 (지금은 항상 true)
  const isToolAllowed = React.useCallback(() => true, [isSceneTransformed]);

  // 단축키: V = select, H = pan
  useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      const isTyping =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping) return;

      const key = e.key?.toLowerCase();
      if (key === "v") {
        e.preventDefault();
        handleModeChange('select');
      } else if (key === "h") {
        e.preventDefault();
        handleModeChange('pan');
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleModeChange]);

  // 전체 지우기
  const handleClearAll = React.useCallback(async () => {
    const canvas = stageRef.current;
    if (canvas && canvas.clear) {
      if (confirm("캔버스의 모든 내용을 지우시겠습니까?")) {
        try {
          canvas.off('mouse:down');
          canvas.off('mouse:move');
          canvas.off('mouse:up');

          canvas.clear();
          canvas.isDrawingMode = false;
          canvas.selection = true;

          await client.patch(`/projects/${pid}/scenes/${selectedId}`, {status: 'reset'});
          await deleteCanvasFromIndexedDB(selectedId);

          setScenes((prevScenes) =>
            prevScenes.map((scene) =>
              scene.id === selectedId
                ? {...scene, saveMode: 'originals', isTransformed: false}
                : scene
            )
          );

          if (canvas?.changeSaveMode) {
            canvas.changeSaveMode('originals');
          }

          setDrawingMode('select');
          setIsPanMode(false);
        } catch (error) {
          console.error("Clear error", error);
          alert("캔버스 초기화 중 오류 발생");
        }
      }
    }
  }, [client, pid, selectedId, drawingMode, isPanMode]);
  // 색상 변경 핸들러
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

  // 선택된 객체 채우기 색상 변경
  const handleSelectedFillChange = React.useCallback((hex) => {
    const canvas = stageRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject && canvas.getActiveObject();
    if (!active) return;

    const applyFill = (obj) => {
      if (!obj) return;
      if (obj.type === "path" || obj.type === "line" || (!obj.fill && ("stroke" in obj))) {
        obj.set({stroke: hex});
        return;
      }
      if ("fill" in obj) {
        obj.set({fill: hex, originalFill: hex});
      }
    };

    if (
      (active?.type && active.type.toLowerCase() === "activeselection") ||
      active?.type === "group"
    ) {
      (active._objects || active.getObjects?.() || []).forEach(applyFill);
    } else {
      applyFill(active);
    }

    canvas.renderAll && canvas.renderAll();
    setSelectedObject((prev) => (prev ? {...prev, fill: hex, stroke: hex} : prev));
  }, []);

  // 레이어 선택
  const handleLayerSelect = React.useCallback((layerId) => {
    if (stageRef.current?.layers?.setActiveLayer) {
      try {
        stageRef.current.layers.setActiveLayer(layerId);
        updateLayerState();
        setTimeout(updateLayerState, 50);
      } catch (error) {
        console.error('Error selecting layer:', error);
      }
    }
  }, [updateLayerState]);

  // 레이어 생성
  const handleCreateLayer = React.useCallback(() => {
    if (stageRef.current?.layers?.createLayer) {
      const currentLayers = stageRef.current.layers.getLayers() || [];
      const drawingLayers = currentLayers.filter(layer => layer.type === 'drawing');
      let layerNumber = drawingLayers.length + 1;
      while (currentLayers.some(layer => layer.name === `레이어${layerNumber}`)) {
        layerNumber++;
      }
      const defaultName = `레이어${layerNumber}`;
      const layerName = prompt('새 레이어 이름을 입력하세요', defaultName);
      if (layerName !== null) {
        try {
          const finalName =
            (layerName.trim() === '' || layerName.trim() === defaultName) ? null : layerName.trim();
          stageRef.current.layers.createLayer(finalName);
          // 레이어 생성 시 레이어 패널 자동으로 열기
          setRightLayersOpen(true);
          setTimeout(updateLayerState, 10);
        } catch (error) {
          console.error('Error creating layer:', error);
        }
      }
    }
  }, [updateLayerState]);

  // 레이어 삭제
  const handleDeleteLayer = React.useCallback((layerId) => {
    if (stageRef.current?.layers?.deleteLayer) {
      try {
        stageRef.current.layers.deleteLayer(layerId);
        setTimeout(updateLayerState, 10);
      } catch (error) {
        console.error('Error deleting layer:', error);
      }
    }
  }, [updateLayerState]);

  // 레이어 보이기/숨기기
  const handleToggleVisibility = React.useCallback((layerId) => {
    if (stageRef.current?.layers?.toggleVisibility) {
      try {
        stageRef.current.layers.toggleVisibility(layerId);
        setTimeout(updateLayerState, 10);
      } catch (error) {
        console.error('Error toggling visibility:', error);
      }
    }
  }, [updateLayerState]);

  // 레이어 잠금/해제
  const handleToggleLock = React.useCallback((layerId) => {
    if (stageRef.current?.layers?.toggleLock) {
      try {
        stageRef.current.layers.toggleLock(layerId);
        setTimeout(updateLayerState, 10);
      } catch (error) {
        console.error('Error toggling lock:', error);
      }
    }
  }, [updateLayerState]);

  // 레이어 이름 변경
  const handleRenameLayer = React.useCallback((layerId, newName) => {
    if (stageRef.current?.layers?.renameLayer) {
      try {
        stageRef.current.layers.renameLayer(layerId, newName);
        setTimeout(updateLayerState, 10);
      } catch (error) {
        console.error('Error renaming layer:', error);
      }
    }
  }, [updateLayerState]);

  // 레이어 순서 변경
  const handleLayerReorder = React.useCallback((draggedLayerId, targetLayerId) => {
    if (stageRef.current?.layers?.reorderLayers) {
      try {
        stageRef.current.layers.reorderLayers(draggedLayerId, targetLayerId);
        setTimeout(updateLayerState, 10);
      } catch (error) {
        console.error('Error reordering layers:', error);
      }
    }
  }, [updateLayerState]);

  // JSON 생성
  const handleJsonGeneration = React.useCallback(async () => {
    if (!pid) {
      console.warn('Project ID not available for JSON generation');
      return null;
    }
    try {
      const response = await client.post(`/projects/${pid}/json`);
      const {json_url, unity_sent, scenes_processed, total_scenes} = response.data;
      if (json_url) {
        const base = client.defaults?.baseURL?.replace(/\/$/, "") || "";
        const full = json_url.startsWith("http")
          ? json_url
          : `${base}/${json_url.replace(/^\//, "")}`;
        const message = unity_sent
          ? `${scenes_processed}/${total_scenes}개의 JSON이 생성되어 Unity로 전송되었습니다.`
          : `${scenes_processed}/${total_scenes}개의 JSON이 생성되었습니다.`;
        alert(message);
        return full;
      } else {
        alert("JSON 생성에 실패했습니다.");
        return null;
      }
    } catch (error) {
      console.error("JSON generation error", error);
      alert("JSON 생성 중 오류가 발생했습니다.");
      return null;
    }
  }, [pid]);

  // window API 노출
  useEffect(() => {
    window.editorAPI = {
      targetDots,
      processing,
      imageUrl,
      selectedId,
      projectName,
      stageRef,
      setTargetDots,
      handleTransform,
      handleManualSave,
      handleJsonGeneration,
    };
    window.dispatchEvent(
      new CustomEvent("editor:updated", {
        detail: {targetDots, processing, imageUrl, selectedId, projectName, isServerSyncing},
      })
    );
  }, [targetDots, processing, imageUrl, selectedId, projectName]);

  const isSelectOrPan = drawingMode === 'select' || isPanMode;

  // JSX UI
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
                onClick={() => {
                  handleModeChange("select");
                  setToolSelectionOpen(false);
                }}
                title="선택 모드 (V)"
                aria-label="선택 모드"
                className={`popover-button ${drawingMode === 'select' && !isPanMode ? 'active' : ''}`}
              >
                <LuMousePointer/>
                <span>클릭(V)</span>
              </button>
              <button
                onClick={() => {
                  handleModeChange("pan");
                  setToolSelectionOpen(false);
                }}
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
            <Link
              to="/dashboard"
              className="tool-button"
              title="대시보드로 이동"
              aria-label="대시보드로 이동"
            >
              <ImExit size={20} />
            </Link>
            
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
            setSelectedObject(selection);
            setSelectedObjectLayerId(selection?.layerId || null);
          }}
          onPanChange={setIsPanMode}
          changeSaveMode={changeSaveMode}
          triggerAutoSave={triggerAutoSave}
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
              <div className="transform-complete-title">변환 완료</div>
              <div className="transform-complete-text">
                다른 장면을 선택하여 계속 작업할 수 있습니다.
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

  // 로딩 상태 렌더링
  if (isLoading) {
    return (
      <div className="editor-loading">
        <div className="editor-loading-content">
          <p>프로젝트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

}
