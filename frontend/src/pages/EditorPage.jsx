import React, { useEffect, useMemo, useRef, useState } from "react";
import EditorToolbar from "../components/EditorToolbar.jsx";
import MainCanvasSection from "../components/MainCanvasSection.jsx";
import SceneCarousel from "../components/SceneCarousel.jsx";
import ImageGallery from "../components/ImageGallery.jsx";
import LayerPanel from "../components/LayerPanel.jsx";
import ObjectPropertiesPanel from "../components/ObjectPropertiesPanel.jsx";
import client from "../api/client";
import { getImageUrl } from '../utils/imageUtils';
import { useUnity } from "../contexts/UnityContext.jsx";
import { useParams } from "react-router-dom";
import { CiSettings } from "react-icons/ci";
import { LuMousePointer } from "react-icons/lu";
import { IoHandRightOutline } from "react-icons/io5";
import ProjectSettingsModal from "../components/ProjectSettingsModal";

const VISIBLE = 4;
const DUMMY = "11111111-1111-1111-1111-111111111111";

const LEFT_TOOL_WIDTH = 100;
const RIGHT_PANEL_WIDTH = 260;

function useDebounced(fn, delay = 400) {
  const t = useRef(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  const debounced = React.useCallback(
    (...args) => {
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay]
  );
  return debounced;
}

export default function EditorPage({ projectId = DUMMY }) {
  const {project_id} = useParams();
  const [pid, setPid] = useState(project_id);
  const [scenes, setScenes] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [projectMeta, setProjectMeta] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [start, setStart] = useState(0);

  // 갤러리 열림 상태
  const [galleryOpen, setGalleryOpen] = useState(() => {
    const saved = localStorage.getItem("wdss:galleryOpen");
    return saved ? JSON.parse(saved) : false;
  });
  useEffect(() => {
    localStorage.setItem("wdss:galleryOpen", JSON.stringify(galleryOpen));
  }, [galleryOpen]);

  // 이미지 변환 관련 상태
  const [processing, setProcessing] = useState(false);
  const [targetDots, setTargetDots] = useState(2000);

  // 원본 캔버스 상태 관리
  const stageRef = useRef(null);
  const galleryRef = useRef(null);

  // 캔버스 관련 상태
  const [drawingMode, setDrawingMode] = useState("draw");
  const [eraserSize, setEraserSize] = useState(20);
  const [drawingColor, setDrawingColor] = useState('#222222');
  const [selectedObject, setSelectedObject] = useState(null);
  const [isPanMode, setIsPanMode] = useState(false);
  
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
  };

  const selectedScene = useMemo(
      () => scenes.find((s) => s.id === selectedId) || null,
      [scenes, selectedId]
  );

  // 방금 삭제한 상태(const [originalCanvasState, setOriginalCanvasState],const [imageUrl, setImageUrl])들 대신, 아래 두 줄로 정보를 파생시킵니다.
  const imageUrl = getImageUrl(selectedScene?.display_url || selectedScene?.s3_key) || "";
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
        if (p) setProjectMeta(p);
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
              imageUrl: getImageUrl(s.display_url || s.s3_key),
            }))
        );
        if (list[0]) setSelectedId(list[0].id);
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
              prev.map((s) => (s.id === selectedId ? {...s, ...detail} : s))
          );
        } catch (e) {
          console.error(e);
        }
      })();
    }
  }, [selectedId, pid]);

  // 저장(디바운스)
  const saveDebounced = useDebounced(async (scene_id, drones, preview, imageUrl, originalCanvasState) => {
    if (!pid) return;
    try {
      const {data} = await client.post(`/projects/${pid}/scenes/${scene_id}`, {
        // s3_key: imageUrl
      });
      const saved = data.scene || {};
      setScenes((prev) => prev.map((s) => (s.id === scene_id ? {...s, ...saved} : s)));
    } catch (e) {
      console.error(e);
    }
  }, 500);

  // Canvas → 변경 반영
  const handleSceneChange = React.useCallback(
      (id, patch) => {
        setScenes((prev) =>
            prev.map((s) => (s.id === id ? {...s, ...patch} : s))
        );
        saveDebounced(
            id,
            patch.data,
            patch.preview,
            imageUrl,
            originalCanvasState
        );
      },
      [saveDebounced, imageUrl, originalCanvasState, setScenes]
  );

  // + 생성
  const handleAddScene = async () => {
    try {
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
      if (createdId) setSelectedId(createdId);

      const nextTotal = nextScenes.length + 1;
      if (nextTotal > VISIBLE) setStart(nextTotal - VISIBLE);

    } catch (e) {
      console.error(e);
      alert("씬 생성 실패");
    }
  };

  // 선택
  const handleSelect = (id) => {
    if (id === "__ADD__") return;
    setSelectedId(id);
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
      return isDefault ? { ...s, name: `Scene ${idx + 1}` } : s;
    });
  }, [scenes]);

  // 이미지 변환 핸들러
  const handleTransform = async () => {
    if (!selectedId) {
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

      const checkResp = await client.get(`/projects/${pid}/scenes/${selectedId}/originals`);
      const originalExists = checkResp.data.exists;

      if (originalExists) {
        console.log("원본이 존재하여 재변환을 요청합니다.");
        const rgbColor = hexToRgb(drawingColor);
        const resp = await client.post(
            `/projects/${pid}/scenes/${selectedId}/transformations`,
            {
              target_dots: targetDots,
              color_r: rgbColor.r,
              color_g: rgbColor.g,
              color_b: rgbColor.b,
            }
        );
        finalUrl = getImageUrl(resp.data.output_url);

      } else {
        console.log("원본이 없어 최초 생성을 요청합니다.");
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
            canvas.toBlob(resolve, 'image/png');
          };
          img.src = canvasImage;
        });
        const file = new File([blob], "canvas_drawing.png", {type: "image/png"});
        const fd = new FormData();
        fd.append("image", file);

        const resp = await client.post(
            `/projects/${pid}/scenes/${selectedId}/originals?target_dots=${targetDots}`,
            fd
        );
        finalUrl = getImageUrl(resp.data.output_url);
        newS3Key = resp.data.s3_key;
      }

      console.log("변환 완료! 최종 URL:", finalUrl);

      if (finalUrl) {
        if (stageRef.current && stageRef.current.clear) {
          stageRef.current.clear();
        }

        setScenes(prevScenes =>
            prevScenes.map(scene => {
              if (scene.id === selectedId) {
                const updatedScene = {
                  ...scene,
                  display_url: finalUrl,
                };
                if (newS3Key) {
                  updatedScene.s3_key = newS3Key;
                }
                return updatedScene;
              }
              return scene;
            })
        );

        setTimeout(() => {
          if (stageRef.current && stageRef.current.loadImageFromUrl) {
            fetch(finalUrl)
                .then(response => console.log("수동 fetch 결과:", response.status))
                .catch(err => console.error("수동 fetch 실패:", err));

            stageRef.current.loadImageFromUrl(finalUrl);
          }
        }, 200);
        
        if (selectedScene) {
          saveDebounced(selectedId, selectedScene?.drones, selectedScene?.preview, finalUrl, originalCanvasState);
        }
      }
    } catch (e) {
      console.error("Transform error", e);
      const errorMsg = e.response?.data?.detail || e.message;
      alert(`이미지 변환 중 오류가 발생했습니다: ${errorMsg}`);
    } finally {
      setProcessing(false);
    }
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16)} : {
      r: 0,
      g: 0,
      b: 0
    };
  };

  // 캔버스 핸들러 함수들
  const handleModeChange = React.useCallback(
      (mode) => {
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
      [drawingColor]
  );

  const handleClearAll = React.useCallback(() => {
    if (stageRef.current && stageRef.current.clear) {
      if (
          confirm(
              "캔버스의 모든 내용을 지우시겠습니까? 이 작업은 되돌릴 수 없습니다."
          )
      ) {
        stageRef.current.clear();
        console.log("캔버스 전체가 초기화되었습니다");
      }
    }
  }, []);

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
      if (
          obj?.customType === "svgDot" ||
          obj?.customType === "drawnDot" ||
          obj?.type === "circle"
      ) {
        obj.set({fill: hex, originalFill: hex});
        if ((obj.type === "path" || obj.type === "line" || !obj.fill) && ("stroke" in obj)) {
          obj.set({stroke: hex});
        }
      }
    };

    if (((active?.type && active.type.toLowerCase() === "activeselection") || active?.type === "group")) {
      (active._objects || active.getObjects?.() || []).forEach(applyFill);
    } else {
      applyFill(active);
    }

    canvas.renderAll && canvas.renderAll();
    setSelectedObject((prev) => (prev ? {...prev, fill: hex} : prev));
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
          },
        })
    );
  }, [targetDots, processing, imageUrl, selectedId, projectName]);

  return (
      <div
          className="editor-shell"
          style={{
            width: "100%",
            minHeight: "100vh",
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
              height: "100vh",
              background: "#fff",
              flex: "0 0 auto",
              boxSizing: "border-box",
              overflow: "visible",
              zIndex: 50,
            }}
        >
          <div style={{height: "100%", overflowY: "auto", padding: 16}}>
            {/* Pointer (click) and Hand (pan) tools */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => {
                  if (!isPanMode) {
                    const c0 = stageRef?.current;
                    if (c0 && typeof c0.enterPanMode === 'function') c0.enterPanMode();
                    return;
                  }
                  setDrawingMode("select");
                  const c = stageRef?.current;
                  if (c && typeof c.exitPanMode === 'function') c.exitPanMode();
                }}
                title="클릭 도구 (V)"
                aria-label="클릭 도구"
                style={{
                  border: "1px solid #ccc",
                  padding: "8px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: drawingMode === 'select' && !isPanMode ? '#007bff' : '#f8f9fa',
                  color: drawingMode === 'select' && !isPanMode ? 'white' : 'black',
                }}
              >
                {isPanMode ? <IoHandRightOutline size={18} /> : <LuMousePointer size={18} />}
              </button>
              <button hidden
                onClick={() => {
                  const c = stageRef?.current;
                  if (!c) return;
                  if (typeof c.getPanMode === 'function' && c.getPanMode()) {
                    if (typeof c.exitPanMode === 'function') c.exitPanMode();
                  } else {
                    if (typeof c.enterPanMode === 'function') c.enterPanMode();
                  }
                }}
                title="이동 도구 (Space)"
                aria-label="이동 도구"
                style={{
                  border: "1px solid #ccc",
                  padding: "8px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: isPanMode ? '#007bff' : '#f8f9fa',
                  color: isPanMode ? 'white' : 'black',
                }}
              >
                <IoHandRightOutline size={18} />
              </button>
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
            <div style={{flex: "0 1 360px", minWidth: 0, boxSizing: "border-box"}}>
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
              imageUrl={imageUrl}
              stageRef={stageRef}
              onChange={handleSceneChange}
              drawingMode={drawingMode}
              eraserSize={eraserSize}
              drawingColor={drawingColor}
              activeLayerId={activeLayerIdState}
              onModeChange={handleModeChange}
              onSelectionChange={setSelectedObject}
              onPanChange={setIsPanMode}
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
              height: "100vh",
              background: "#fff",
              flex: "0 0 auto",
              boxSizing: "border-box",
              overflow: "visible",
              zIndex: 50,
            }}
        >
          <div style={{height: "100%", overflowY: "auto", padding: 16}}>
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
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                캔버스 준비 중...
              </div>
            )}
            
            {/* 구분선 */}
            <div style={{ margin: '16px 0', borderTop: '1px solid #eee' }} />
            
            {/* 객체 속성 패널 */}
            <ObjectPropertiesPanel
                selection={selectedObject}
                onChangeFill={handleSelectedFillChange}
            />
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
