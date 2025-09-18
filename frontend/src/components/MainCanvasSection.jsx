import React, { useRef, useState, useEffect } from "react";
import Canvas from "../components/Canvas.jsx";

function MainCanvasSection({
  selectedScene,
  projectId,
  imageUrl,
  stageRef,
  onChange,
  onPreviewChange,
  onCanvasChange,
  drawingMode,
  eraserSize,
  drawingColor,
  activeLayerId,
  onModeChange,
  onSelectionChange,
  onPanChange,
  changeSaveMode,
  triggerAutoSave,
  saveToHistory,
  isSceneTransformed = false // 씬 변환 상태
}) {
  const containerRef = useRef(null);
  const DESIGN = { width: 1200, height: 675 }; // logical base resolution
  const [canvasSize, setCanvasSize] = useState({ width: DESIGN.width, height: DESIGN.height });

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width, height });
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  return (
    <section
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "24px 0 32px",
      }}
    >
      <div style={{ width: "70%", maxWidth: 980 }}>
        <div
          ref={containerRef}
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            background: "#f7f7f7",
            borderRadius: 8,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "inset 0 0 0 1px #eee",
            border: "1px solid #bbb", 
          }}
        >
          {selectedScene ? (
            <Canvas
              key={selectedScene.id}
              projectId={projectId}
              scene={selectedScene}
              width={canvasSize.width}
              height={canvasSize.height}
              baseWidth={DESIGN.width}
              baseHeight={DESIGN.height}
              onChange={(patch) => onChange(selectedScene.id, patch)}
              onPreviewChange={onPreviewChange}
              onCanvasChange={onCanvasChange}
              imageUrl={imageUrl}
              stageRef={stageRef}
              drawingMode={drawingMode}
              eraserSize={eraserSize}
              drawingColor={drawingColor}
              activeLayerId={activeLayerId}
              onModeChange={onModeChange}
              onSelectionChange={onSelectionChange}
              onPanChange={onPanChange}
              changeSaveMode={changeSaveMode}
              triggerAutoSave={triggerAutoSave}
              saveToHistory = {saveToHistory}
              isSceneTransformed={isSceneTransformed}
            />

          ) : (
            <div style={{ color: "#666", fontSize: 14 }}>
              아래 + 카드로 새 씬을 추가하세요
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


export default React.memo(MainCanvasSection);
