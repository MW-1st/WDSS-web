import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import EditorToolbar from "../components/EditorToolbar.jsx";
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
import { CiSettings } from "react-icons/ci";
import { LuMousePointer } from "react-icons/lu";
import { IoHandRightOutline } from "react-icons/io5";
import ProjectSettingsModal from "../components/ProjectSettingsModal";
import PortalPopover from "../components/PortalPopover.jsx";
import { saveCanvasToIndexedDB } from "../utils/indexedDBUtils.js";
import { useEditor } from "../contexts/EditorContext.jsx";

const VISIBLE = 4;
const DUMMY = "11111111-1111-1111-1111-111111111111";

const LEFT_TOOL_WIDTH = 100;
const RIGHT_PANEL_WIDTH = 280; // 미리보기 패널을 위해 40px 증가

export default function EditorPage({projectId = DUMMY}) {
  const {project_id} = useParams();
  const [pid, setPid] = useState(project_id);
  const [scenes, setScenes] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [projectMeta, setProjectMeta] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [start, setStart] = useState(0);
  const { setDotCount } = useEditor();

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
      try {
        localStorage.setItem("wdss:galleryOpen", JSON.stringify(false));
      } catch (_) {}
    };
  }, []);

  // 이미지 변환 관련 상태
  const [processing, setProcessing] = useState(false);
  const [targetDots, setTargetDots] = useState(2000);

  // 원본 캔버스 상태 관리
  const stageRef = useRef(null);
  const galleryRef = useRef(null);
  const toolButtonRef = useRef(null);

  // 캔버스 관련 상태
  const [drawingMode, setDrawingMode] = useState("select");
  const [eraserSize, setEraserSize] = useState(20);
  const [drawingColor, setDrawingColor] = useState('#222222');
  const [selectedObject, setSelectedObject] = useState(null);
  const [isPanMode, setIsPanMode] = useState(false);
  const [isToolSelectionOpen, setToolSelectionOpen] = useState(false);
  const previousSceneId = useRef(selectedId);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // 미리보기 패널 관련 상태
  const previewPanelRef = useRef(null);

  // 캔버스 변경 시 미리보기 업데이트
  const handleCanvasChange = React.useCallback(() => {
    if (previewPanelRef.current && previewPanelRef.current.triggerPreview) {
      previewPanelRef.current.triggerPreview();
    }
  }, []);

  // 레이어 관련 상태
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

  // 상태(const [originalCanvasState, setOriginalCanvasState],const [imageUrl, setImageUrl])들 대신, 아래 두 줄로 정보를 파생시킵니다.
  const imageUrl = getImageUrl(selectedScene?.s3_key) || "";
  const originalCanvasState = selectedScene ? selectedScene.originalCanvasState : null;

  // 레이어 상태를 업데이트하는 함수
  const updateLayerState = React.useCallback(() => {
    if (stageRef.current && stageRef.current.layers) {
      try {
        const layers = stageRef.current.layers.getLayers() || [];
        const activeId = stageRef.current.layers.getActiveLayerId();

        setLayersState(prevLayers => {
          const layersChanged = JSON.stringify(prevLayers.map(l => ({id: l.id, zIndex: l.zIndex, name: l.name, visible: l.visible, locked: l.locked}))) !== 
                               JSON.stringify(layers.map(l => ({id: l.id, zIndex: l.zIndex, name: l.name, visible: l.visible, locked: l.locked})));
          
          if (layersChanged) {
            console.log('Layers changed, updating state');
            return [...layers];
          } else {
            return prevLayers;
          }
        });

        setActiveLayerIdState(prevActiveId => {
          if (prevActiveId !== activeId) {
            console.log('Active layer changed:', prevActiveId, '->', activeId);
            return activeId;
          } else {
            return prevActiveId;
          }
        });

      } catch (error) {
        console.warn('Error updating layer state:', error);
      }
    }
  }, []);

  // unity 관련 상태
  const {isUnityVisible, showUnity, hideUnity, sendTestData} = useUnity();

  // useAutoSave 훅 초기화 - selectedId가 변경될 때마다 새로운 인스턴스
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
  const {syncToServer, uploadThumbnail} = useServerSync(pid, selectedId, stageRef);

  const handleSaveThumbnail = useCallback(async (pregeneratedDataUrl = null) => {
    // 캔버스나 업로드 함수가 준비되지 않았으면 실행하지 않음
    if (!stageRef.current || !uploadThumbnail) {
      console.warn("썸네일 저장 실패: 캔버스나 업로드 함수가 준비되지 않았습니다.");
      return;
    }

    const thumbnailDataUrl = pregeneratedDataUrl || stageRef.current.toDataURL({
      format: 'png',
      quality: 0.8
    });

    try {
      // 결정된 데이터를 사용해 업로드
      await uploadThumbnail(thumbnailDataUrl);
      console.log("✅ 썸네일이 백그라운드에서 성공적으로 저장되었습니다.");
    } catch (error) {
      console.error("❌ 썸네일 저장에 실패했습니다:", error);
    }
  }, [uploadThumbnail]);


  // 수동 저장 함수
  const handleManualSave = async () => {
    if (!selectedId || !stageRef.current || !pid) {
      console.warn('Cannot save: missing selectedId, stageRef, or projectId');
      return;
    }

    try {
      console.log('Manual save started with mode:', saveMode);

      const canvas = stageRef.current;
      const canvasData = canvas.toJSON([
        'layerId', 'layerName', 'customType', 'originalFill',
        'originalCx', 'originalCy'
      ]);

      // 현재 saveMode에 맞게 서버에 저장
      const success = await syncToServer(canvasData, saveMode);

      if (success) {
        await handleSaveThumbnail();
        console.log(`수동 저장 시 썸네일 저장 완료: Scene ${selectedId}`);
        console.log(`Scene ${selectedId} manually saved with mode: ${saveMode}`);
        // 성공 알림 (선택사항)
        // alert('저장되었습니다.');
      } else {
        console.error('Manual save failed');
        alert('저장에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('Manual save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  // 씬 변경 시 서버 동기화
  useEffect(() => {
    if (previousSceneId.current && previousSceneId.current !== selectedId) {
      console.log('Scene changed, syncing to server...');
    }

    previousSceneId.current = selectedId;
  }, [selectedId]);

  // 브라우저 이벤트 리스너
  useEffect(() => {
    const handleBeforeUnload = async (event) => {
      if (selectedId && stageRef.current) {
        console.log('Page unloading, syncing to server...');
        await Promise.all([
          syncToServerNow(),
          handleSaveThumbnail() // 썸네일 저장 함수 호출
        ]);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('Page hidden, syncing to server...');
        syncToServerNow();
      }
    };

    const handlePopState = () => {
      console.log('Navigation detected, syncing to server...');
      syncToServerNow();
    };

    // 이벤트 리스너 등록
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('popstate', handlePopState);

    return () => {
      // 정리
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [selectedId, syncToServerNow, handleSaveThumbnail]);

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

        // 캔버스 선택 이벤트 리스너 추가
        const canvas = stageRef.current;
        const handleSelectionChanged = () => {
          const activeObject = canvas.getActiveObject();
          if (activeObject && activeObject.layerId) {
            setSelectedObjectLayerId(activeObject.layerId);
          } else {
            setSelectedObjectLayerId(null);
          }
        };

        canvas.on('selection:created', handleSelectionChanged);
        canvas.on('selection:updated', handleSelectionChanged);
        canvas.on('selection:cleared', () => setSelectedObjectLayerId(null));

        return () => {
          if (canvas) {
            canvas.off('selection:created', handleSelectionChanged);
            canvas.off('selection:updated', handleSelectionChanged);
            canvas.off('selection:cleared');
          }
        };
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
    const canvas = stageRef.current;
    if (!canvas) return;

    const updateDotCount = () => {
      const objects = canvas.getObjects();
      const dots = objects.filter(obj => obj.type === 'circle');
      setDotCount(dots.length);
    };

    updateDotCount();

    canvas.on('object:added', updateDotCount);
    canvas.on('object:removed', updateDotCount);
    canvas.on('load:completed', updateDotCount);

    return () => {
      if (canvas) {
        canvas.off('object:added', updateDotCount);
        canvas.off('object:removed', updateDotCount);
        canvas.off('load:completed', updateDotCount);
      }
    };
  }, [canvasReady, setDotCount]);

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

    const imageUrl = getImageUrl(current.s3_key);

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
  }, [selectedId, pid]);

  // // 저장(디바운스)
  // const saveDebounced = useDebounced(async (scene_id, drones, preview, imageUrl, originalCanvasState) => {
  //   if (!pid) return;
  //   try {
  //     const {data} = await client.put(`/projects/${pid}/scenes/${scene_id}`, {
  //       // s3_key: imageUrl
  //     });
  //     const saved = data.scene || {};
  //     setScenes((prev) => prev.map((s) => (s.id === scene_id ? {...s, ...saved} : s)));
  //   } catch (e) {
  //     console.error(e);
  //   }
  // }, 500);

  // Canvas → 변경 반영
  const handleSceneChange = React.useCallback(
      (id, patch) => {
        setScenes((prev) =>
            prev.map((s) => (s.id === id ? {...s, ...patch} : s))
        );
        // saveDebounced(
        //     id,
        //     patch.data,
        //     patch.preview,
        //     imageUrl,
        //     originalCanvasState
        // );
      },
      // [saveDebounced, imageUrl, originalCanvasState, setScenes]
      [imageUrl, originalCanvasState, setScenes]
  );

  // + 생성
  const handleAddScene = async () => {
    try {
      // 최대 씬 개수 제한 (프로젝트 설정)
      const maxScenes = projectMeta?.max_scene ?? projectMeta?.maxScenes ?? null;
      if (Number.isFinite(maxScenes) && maxScenes !== null && scenes.length >= maxScenes) {
        alert(`씬은 최대 ${maxScenes}개까지만 생성할 수 있어요.`);
        return;
      }
      const projectIdReady = await ensureProjectId();
      console.log("확인된 Project ID:", projectIdReady);
      const numericSceneNums = (scenes || [])
          .map((s) => s?.scene_num)
          .filter((n) => typeof n === "number" && !Number.isNaN(n));
      const maxSceneNum = numericSceneNums.length ? Math.max(...numericSceneNums) : 0;
      const scene_num = Math.max(maxSceneNum, scenes.length) + 1;
      console.log("확인된 scene_num:", scene_num);
      const {data} = await client.post(
          `/projects/${projectIdReady}/scenes`,
          {
            scene_num,
          }
      );
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
      if (createdId) {
        await handleSelect(createdId);
      } else {
        // 만약의 경우를 대비해 폴백
        setSelectedId(null);
      }

      const nextTotal = nextScenes.length + 1;
      if (nextTotal > VISIBLE) setStart(nextTotal - VISIBLE)

    } catch (e) {
      console.error(e);
      alert("씬 생성 실패");
    }
  };

  // 이전 씬의 saveMode를 기억하기 위한 ref 추가
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
    dataToSave = canvas.toJSON([
      'layerId', 'layerName', 'customType', 'originalFill',
      'originalCx', 'originalCy'
    ]);
    thumbnailToSave = canvas.toDataURL({ format: 'png', quality: 0.5 });
  }
  console.log(`🚀 데이터 저장`, dataToSave, thumbnailToSave);

  // --- 2. UI 즉시 업데이트 ---
  // 캡쳐한 스냅샷으로 전환 효과를 주고, 씬 ID를 변경하여 UI를 즉시 전환합니다.
  setSelectedId(id);

  // --- 3. 백그라운드에서 저장 실행 ---
  // 캡쳐해 둔 데이터가 있을 경우, 'await' 없이 저장 함수들을 호출하여
  // 백그라운드에서 작업을 실행시킵니다.
  if (dataToSave) {
    // IndexedDB에 저장
    saveImmediately(dataToSave)
      .catch(e => console.error('백그라운드 IndexedDB 저장 실패:', e));

    // 서버에 저장
    syncToServerNow(dataToSave, saveModeToUse)
      .catch(e => console.error('백그라운드 서버 저장 실패:', e));

    // 썸네일 저장 (미리 생성한 썸네일 데이터를 전달)
    handleSaveThumbnail(thumbnailToSave)
      .catch(e => console.error('백그라운드 썸네일 저장 실패:', e));
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
  const canSlide = total > VISIBLE;
  const end = Math.min(start + VISIBLE, total);
  const visibleItems = items.slice(start, end);

  // UI-only scene numbering: override default "Scene N" style names for display without touching DB/state
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
    console.log(`✅ 변환된 데이터가 ${sceneIdToTransform} 씬의 IndexedDB에 저장되었습니다.`);

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

    // 4. 현재 씬이 변환하던 씬일 경우, IndexedDB에 저장된 데이터를 캔버스에 로드합니다.
    if (stageRef.current && selectedIdRef.current === sceneIdToTransform) {
        if (stageRef.current.clear) {
          stageRef.current.clear();
        }
        // loadFromJSON은 Fabric.js의 기본 함수이며, Canvas.jsx에 이미 구현되어 있습니다.
        // 여기서는 이미 JSON 객체를 가지고 있으므로 직접 로드합니다.
        stageRef.current.loadFromJSON(transformedJsonData, () => {
          stageRef.current.renderAll();
          console.log("변환된 데이터가 현재 캔버스에 로드되었습니다.", selectedId, sceneIdToTransform);
          handleModeChange('select');
        });
    } else {
        console.log(`변환은 완료되었지만 사용자가 다른 씬(${selectedId})으로 이동하여 캔버스는 업데이트하지 않습니다.`);
    }

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
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleModeChange]);

  const handleClearAll = React.useCallback(async () => {
    if (stageRef.current && stageRef.current.clear) {
      if (
          confirm(
              "캔버스의 모든 내용을 지우시겠습니까? 이 작업은 되돌릴 수 없습니다."
          )
      ) {
        try {
          // 1. 캔버스 초기화
          stageRef.current.clear();
          console.log("캔버스가 초기화되었습니다");

          // 2. 서버에 씬 초기화 요청
          const response = await client.patch(`/projects/${pid}/scenes/${selectedId}`, {
            status: 'reset'
          });

          // 씬 상태를 초기화된 상태로 업데이트
          setScenes(prevScenes =>
            prevScenes.map(scene => {
              if (scene.id === selectedId) {
                return {
                  ...scene,
                  saveMode: 'originals', // 변환 상태를 원본으로 리셋
                  isTransformed: false, // 백업 필드
                };
              }
              return scene;
            })
          );
          if (stageRef.current?.changeSaveMode) {
              stageRef.current.changeSaveMode('originals');
              console.log(stageRef.current.changeSaveMode);
          }
          console.log("서버 씬 초기화 완료:", response.data);
          window.location.reload();

          // 3. 성공 메시지 (선택사항)
          // alert("씬이 완전히 초기화되었습니다.");

        } catch (error) {
          console.error("씬 초기화 중 오류 발생:", error);
          // 에러 처리 - 사용자에게 알림
          alert("씬 초기화 중 오류가 발생했습니다. 다시 시도해주세요.");
        }
      }
    }
  }, [client, pid, selectedId]); // client, projectId, sceneId를 dependency에 추가

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
      // If path/line or non-fillable but has stroke, apply to stroke
      if (obj.type === "path" || obj.type === "line" || (!obj.fill && ("stroke" in obj))) {
        obj.set({stroke: hex});
        return;
      }
      // Otherwise, apply to fill for fillable shapes (dots/circles etc.)
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

  // 레이어 관련 핸들러들
  const handleLayerSelect = React.useCallback((layerId) => {
    console.log('EditorPage handleLayerSelect called:', layerId);

    if (stageRef.current && stageRef.current.layers && stageRef.current.layers.setActiveLayer) {
      try {
        console.log('Calling setActiveLayer with:', layerId);
        stageRef.current.layers.setActiveLayer(layerId);
        console.log('setActiveLayer called, now calling updateLayerState');

        updateLayerState();

        setTimeout(() => {
          console.log('Delayed updateLayerState call');
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
    console.log('Create layer called');
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
          console.log('Layer created successfully');
          setTimeout(updateLayerState, 10);
        } catch (error) {
          console.error('Error creating layer:', error);
        }
      }
    }
  }, [updateLayerState]);

  const handleDeleteLayer = React.useCallback((layerId) => {
    console.log('Delete layer called:', layerId);
    if (stageRef.current && stageRef.current.layers && stageRef.current.layers.deleteLayer) {
      try {
        stageRef.current.layers.deleteLayer(layerId);
        console.log('Layer deleted successfully');
        setTimeout(updateLayerState, 10);
      } catch (error) {
        console.error('Error deleting layer:', error);
      }
    }
  }, [updateLayerState]);

  const handleToggleVisibility = React.useCallback((layerId) => {
    console.log('Toggle visibility called:', layerId);
    if (stageRef.current && stageRef.current.layers && stageRef.current.layers.toggleVisibility) {
      try {
        stageRef.current.layers.toggleVisibility(layerId);
        console.log('Visibility toggled successfully');
        setTimeout(updateLayerState, 10);
      } catch (error) {
        console.error('Error toggling visibility:', error);
      }
    }
  }, [updateLayerState]);

  const handleToggleLock = React.useCallback((layerId) => {
    console.log('Toggle lock called:', layerId);
    if (stageRef.current && stageRef.current.layers && stageRef.current.layers.toggleLock) {
      try {
        stageRef.current.layers.toggleLock(layerId);
        console.log('Lock toggled successfully');
        setTimeout(updateLayerState, 10);
      } catch (error) {
        console.error('Error toggling lock:', error);
      }
    }
  }, [updateLayerState]);

  const handleRenameLayer = React.useCallback((layerId, newName) => {
    console.log('Rename layer called:', layerId, newName);
    if (stageRef.current && stageRef.current.layers && stageRef.current.layers.renameLayer) {
      try {
        stageRef.current.layers.renameLayer(layerId, newName);
        console.log('Layer renamed successfully');
        setTimeout(updateLayerState, 10);
      } catch (error) {
        console.error('Error renaming layer:', error);
      }
    }
  }, [updateLayerState]);

  const handleLayerReorder = React.useCallback((draggedLayerId, targetLayerId) => {
    console.log('Layer reorder called:', draggedLayerId, 'to position of', targetLayerId);
    if (stageRef.current && stageRef.current.layers && stageRef.current.layers.reorderLayers) {
      try {
        stageRef.current.layers.reorderLayers(draggedLayerId, targetLayerId);
        console.log('Layers reordered successfully');
        setTimeout(() => {
          console.log('Calling updateLayerState after reorder');
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
      console.log('Generating JSON for project:', pid);
      
      // 프로젝트의 모든 씬을 JSON으로 변환
      const response = await client.post(`/projects/${pid}/json`);
      const { json_url, unity_sent, scenes_processed, total_scenes } = response.data;

      if (json_url) {
        const base = client.defaults?.baseURL?.replace(/\/$/, "") || "";
        const full = json_url.startsWith("http")
          ? json_url
          : `${base}/${json_url.replace(/^\//, "")}`;
          
        console.log('JSON generated successfully:', full);
        
        // 성공 메시지
        const message = unity_sent
          ? `${scenes_processed}/${total_scenes}개 씬이 JSON으로 변환되고 Unity로 전송되었습니다!`
          : `${scenes_processed}/${total_scenes}개 씬이 JSON으로 변환되었습니다!`;
        
        alert(message);
        
        return full; // JSON URL 반환
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

  // Bridge editor controls to navbar via window for project routes
  useEffect(() => {
    window.editorAPI = {
      // state
      targetDots,
      processing,
      imageUrl,
      selectedId,
      projectName,
      // refs & methods
      stageRef,
      setTargetDots,
      handleTransform,
      handleManualSave,
      handleJsonGeneration
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
            isServerSyncing,
          },
        })
    );
  }, [targetDots, processing, imageUrl, selectedId, projectName]);

  const isSelectOrPan = drawingMode === 'select' || isPanMode;

  return (
      <div
          className="editor-shell font-nanumhuman"
          style={{
            width: "100%",
            height: "100%",
            background: "#fff",
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            boxSizing: "border-box",
            overflowX: "hidden",
          }}
      >
        {/* 왼쪽 툴바 */}
        <aside
            id="left-rail"
            style={{
              width: LEFT_TOOL_WIDTH,
              borderRight: "1px solid #eee",
              position: "sticky",
              top: 0,
              height: "100%",
              background: "#fff",
              flex: "0 0 auto",
              boxSizing: "border-box",
              overflow: "visible",
              zIndex: 50,
            }}
        >
          <div style={{height: "100%", overflowY: "auto", padding: 16}}>

            <div style={{position: "relative", display: "inline-block", marginBottom: 12}}>
              <button
                  ref={toolButtonRef}
                  onClick={() => setToolSelectionOpen(prev => !prev)}
                  title="도구 선택"
                  aria-label="도구 선택"
                  style={{
                    border: `2px solid ${isSelectOrPan ? '#007bff' : '#e0e0e0'}`,
                    padding: "8px 16px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 16,
                    transition: "all 0.2s ease",
                    backgroundColor: isSelectOrPan ? '#007bff' : '#ffffff',
                    color: isSelectOrPan ? 'white' : '#333333',
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
              >
                {isPanMode ? <IoHandRightOutline/> : <LuMousePointer/>}
              </button>
              <PortalPopover
                  anchorRef={toolButtonRef}
                  open={isToolSelectionOpen}
                  onClose={() => setToolSelectionOpen(false)}
                  placement="right"
                  align="start"
                  offset={8}
                  width={100}
                  padding={4}
              >
                <button
                    onClick={() => {
                      handleModeChange("select");
                      setToolSelectionOpen(false);
                    }}
                    title="선택 도구 (V)"
                    aria-label="선택 도구"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      border: "none",
                      backgroundColor: drawingMode === 'select' && !isPanMode ? '#007bff' : 'transparent',
                      color: drawingMode === 'select' && !isPanMode ? 'white' : '#333333',
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer"
                    }}
                >
                  <LuMousePointer/>
                  <span>선택</span>
                </button>
                <button
                    onClick={() => {
                      handleModeChange("pan");
                      setToolSelectionOpen(false);
                    }}
                    title="이동 도구 (H)"
                    aria-label="이동 도구"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      border: "none",
                      backgroundColor: isPanMode ? '#007bff' : 'transparent',
                      color: isPanMode ? 'white' : '#333333',
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer"
                    }}
                >
                  <IoHandRightOutline/>
                  <span>이동</span>
                </button>
              </PortalPopover>
            </div>
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
                onGalleryStateChange={setGalleryOpen}
                isServerSyncing = {isServerSyncing}
                handleManualSave = {handleManualSave}
                isSceneTransformed={isSceneTransformed}
                isToolAllowed={isToolAllowed}
            />
            <div style={{marginTop: "auto"}}>
              <button
                  type="button"
                  title="프로젝트 설정"
                  aria-label="프로젝트 설정"
                  onClick={openProjectSettings}
                  disabled={!projectMeta}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f9fafb",
                    color: "#374151",
                    cursor: projectMeta ? "pointer" : "not-allowed",
                  }}
              >
                <CiSettings size={20}/>
              </button>
            </div>
          </div>
        </aside>

        {/* 갤러리 패널 */}
        {galleryOpen && (
            <div style={{flex: "0 1 250px", minWidth: 0, boxSizing: "border-box"}}>
              <ImageGallery onImageDragStart={(u) => console.log("drag:", u)}/>
            </div>
        )}

        {/* 메인 */}
        <div
            style={{
              flex: "1 1 0%",
              minWidth: 0,
            }}
        >
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
              onSelectionChange={setSelectedObject}
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

        {/* 오른쪽 패널 - 레이어와 객체 속성을 함께 표시 */}
        <aside
            style={{
              width: RIGHT_PANEL_WIDTH,
              borderLeft: "1px solid #eee",
              position: "sticky",
              top: 0,
              height: "100%",
              background: "#fff",
              flex: "0 0 auto",
              boxSizing: "border-box",
              overflow: "visible",
              zIndex: 50,
            }}
        >
          <div style={{height: "100%", overflowY: "scroll", padding: 16}}>
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
                />
            ) : (
                <div style={{padding: '20px', textAlign: 'center', color: '#666'}}>
                  캔버스 준비 중...
                </div>
            )}

            {/* 구분선 */}
            <div style={{margin: '16px 0', borderTop: '1px solid #eee'}}/>

            {/* 객체 속성 패널 */}
            <ObjectPropertiesPanel
                selection={selectedObject}
                onChangeFill={handleSelectedFillChange}
            />

            {/* 미리보기 패널 - 변환 전에만 표시 */}
            {!isSceneTransformed && (
              <>
                {/* 구분선 */}
                <div style={{ margin: '16px 0', borderTop: '1px solid #eee' }} />

                {/* 미리보기 패널 */}
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
              </>
            )}
            
            {/* 변환 완료 상태 표시 */}
            {isSceneTransformed && (
              <>
                {/* 구분선 */}
                <div style={{ margin: '16px 0', borderTop: '1px solid #eee' }} />
                
                <div style={{
                  padding: "20px",
                  textAlign: "center",
                  border: "1px solid #e9ecef",
                  borderRadius: "8px",
                  backgroundColor: "#f8f9fa",
                  color: "#6c757d"
                }}>
                  <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>
                    ✅ 변환 완료
                  </div>
                  <div style={{ fontSize: "14px", wordBreak: 'keep-all' }}>
                    브러쉬 도구로 추가 편집이 가능합니다
                  </div>
                </div>
              </>
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