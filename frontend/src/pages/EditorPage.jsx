import React, { useEffect, useMemo, useRef, useState } from "react";
import EditorToolbar from "../components/EditorToolbar.jsx";
import MainCanvasSection from "../components/MainCanvasSection.jsx";
import SceneCarousel from "../components/SceneCarousel.jsx";
import ImageGallery from "../components/ImageGallery.jsx";
import ObjectPropertiesPanel from "../components/ObjectPropertiesPanel.jsx";
import client from "../api/client";
import { getImageUrl } from '../utils/imageUtils';
import { useUnity } from "../contexts/UnityContext.jsx";
import { useParams } from "react-router-dom";
import { CiSettings } from "react-icons/ci";
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

// 실제 스크롤바 폭 측정 (Windows 레이아웃형 스크롤 대응)

export default function EditorPage({ projectId = DUMMY }) {
  const {project_id} = useParams();
  const [pid, setPid] = useState(project_id);
  const [scenes, setScenes] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [projectMeta, setProjectMeta] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [start, setStart] = useState(0);

  // ✅ 갤러리 열림 상태: 하나만 사용 (초기값: false => 닫힌 채로 시작)
  const [galleryOpen, setGalleryOpen] = useState(() => {
    const saved = localStorage.getItem("wdss:galleryOpen");
    return saved ? JSON.parse(saved) : false; // 기본 닫힘
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
  const [drawingColor, setDrawingColor] = useState("#222222");
  const [selectedObject, setSelectedObject] = useState(null);

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
  const imageUrl = selectedScene?.displayUrl || getImageUrl(selectedScene?.s3_key) || "";
  const originalCanvasState = selectedScene ? selectedScene.originalCanvasState : null;

  // 색상이 변경될 때 즉시 캔버스에 반영
  useEffect(() => {
    if (stageRef.current && stageRef.current.setDrawingColor) {
      stageRef.current.setDrawingColor(drawingColor);
    }
  }, [drawingColor]);

  // unity 관련 상태
  const {isUnityVisible, showUnity, hideUnity, sendTestData} = useUnity();

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
        // Leave default if fetch fails
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
        const {data} = await client.get(`/projects/${pid}/scenes/`);
        const list = data.scenes || [];
        setScenes(
            list.map((s, i) => ({
              ...s,
              name: s.name || `Scene ${s.scene_num ?? i + 1}`,
              imageUrl: getImageUrl(s.s3_key),
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

          // 여기서 이미지 URL을 다시 설정할 필요는 없지만, 만일을 위해 유지할 수 있습니다.
          const fetchedImageUrl = getImageUrl(detail.s3_key);
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
      const scene_num = scenes.length + 1;
      console.log("확인된 scene_num:", scene_num);
      const {data} = await client.post(
          `/projects/${projectIdReady}/scenes/`,
          {
            scene_num,
          }
      );
      const created = data.scene || {};
      const createdNorm = {
        ...created,
        name: created.name || `Scene ${created.scene_num ?? scene_num}`,
        imageUrl: getImageUrl(created.s3_key),
      };
      const nextScenes = [...scenes, createdNorm];
      setScenes(nextScenes);
      setSelectedId(created.id);

      // console.log(`created ${created}`)
      // console.log(`setSelectedId ${created.id}`)
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

  // + 카드까지 포함
  const items = useMemo(
      () => [...scenes, {id: "__ADD__", isAdd: true}],
      [scenes]
  );
  const total = items.length;
  const canSlide = total > VISIBLE;
  const end = Math.min(start + VISIBLE, total);
  const visibleItems = items.slice(start, end);

  // 이미지 변환 핸들러
  const handleTransform = async () => {
    // 사전 조건 확인: 씬 선택 및 캔버스 준비 여부
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
      // ✨ 1. 변수들을 try 블록 최상단에 선언하여 스코프 문제를 해결합니다.
      let finalUrl = '';
      let newS3Key = null;

      // 2. 서버에 원본 이미지가 있는지 먼저 확인
      const checkResp = await client.get(`/projects/${pid}/scenes/${selectedId}/originals`);
      const originalExists = checkResp.data.exists;

      if (originalExists) {
        // 3-A. 원본이 있으면 '재변환 API' 호출
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
        // newS3Key는 null인 상태로 유지됩니다.

      } else {
        // 3-B. 원본이 없으면 '최초 생성 API' 호출
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
        newS3Key = resp.data.s3_key; // ✨ 최초 변환 시에만 값이 할당됩니다.
      }

      console.log("변환 완료! 최종 URL:", finalUrl);

      // 4. 변환 성공 후 공통 로직 실행
      if (finalUrl) {
        // 캔버스 초기화
        if (stageRef.current && stageRef.current.clear) {
          stageRef.current.clear();
        }

        // 상태 업데이트
        setScenes(prevScenes =>
            prevScenes.map(scene => {
              if (scene.id === selectedId) {
                const updatedScene = {
                  ...scene,
                  displayUrl: finalUrl,
                };
                if (newS3Key) {
                  updatedScene.s3_key = newS3Key;
                }
                return updatedScene;
              }
              return scene;
            })
        );

        // 항상 변환된 이미지 로드 (최초든 재변환이든)
        setTimeout(() => {
          console.log("=== 이미지 로드 디버깅 ===");
          console.log("finalUrl:", finalUrl);
          console.log("stageRef.current:", stageRef.current);
          console.log("loadImageFromUrl 메서드:", stageRef.current?.loadImageFromUrl);

          if (stageRef.current && stageRef.current.loadImageFromUrl) {
            // 강제로 HTTP 요청 확인
            fetch(finalUrl)
                .then(response => console.log("수동 fetch 결과:", response.status))
                .catch(err => console.error("수동 fetch 실패:", err));

            stageRef.current.loadImageFromUrl(finalUrl);
          }
        }, 200);
        // ✨ 4-D. 서버에 저장 (기존 로직 유지)
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

  // handleTransform 내부에서 사용될 수 있는 작은 헬퍼 함수
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16)} : {
      r: 0,
      g: 0,
      b: 0
    };
  };

  // 버튼 스타일
  const buttonStyle = {
    padding: "10px 20px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    marginRight: "10px",
  };
  const sendButtonStyle = {...buttonStyle, backgroundColor: "#28a745"};
  const closeButtonStyle = {...buttonStyle, backgroundColor: "#dc3545"};

  // 캔버스 핸들러 함수들
  const handleModeChange = React.useCallback(
      (mode) => {
        setDrawingMode(mode);
        if (stageRef.current && stageRef.current.setDrawingMode) {
          stageRef.current.setDrawingMode(mode);
          // 모드 변경 후 현재 색상을 다시 설정하여 유지
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
    // 미리보기 시에도 실제 상태를 변경하여 도구 전환 시에도 색상 유지
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
        // Also apply stroke when appropriate (paths/lines or when no fill)
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
            gap: 16,                 // 부모가 간격 관리
            boxSizing: "border-box",
            overflowX: "hidden",     // 가로 스크롤 가드
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
              overflow: "visible",   // 팝오버가 밖으로 나올 수 있도록
              zIndex: 50,
            }}
        >
          {/* 내부에서만 스크롤 */}
          <div style={{height: "100%", overflowY: "auto", padding: 16}}>
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
                stageRef={stageRef} // stageRef prop 전달
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
              onModeChange={handleModeChange}
              onSelectionChange={setSelectedObject}
          />

          {/* 씬 캐러셀 */}
          <SceneCarousel
              projectId={pid}
              scenes={scenes}
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
              overflow: "visible",   // 팝오버가 밖으로
              zIndex: 50,
            }}
        >
          <div style={{height: "100%", overflowY: "auto", padding: 16}}>
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
  )
}
