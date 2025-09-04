import React from "react";
import ImageTransformControls from "../components/ImageTransformControls.jsx";
import UnitySimulatorControls from "../components/UnitySimulatorControls.jsx";
import ImageGallery from "../components/ImageGallery.jsx";
import CanvasTools from "../components/CanvasTools.jsx";

// Inner 컴포넌트를 EditorToolbar 밖으로 분리하여 불필요한 리렌더링 방지
const Inner = ({ 
  onImageDragStart, 
  drawingMode, 
  eraserSize, 
  drawingColor, 
  onModeChange, 
  onColorChange, 
  onColorPreview, 
  onClearAll, 
  targetDots, 
  setTargetDots, 
  processing, 
  onTransform, 
  imageUrl, 
  selectedId, 
  layout, 
  stageRef,
  isUnityVisible,
  showUnity,
  hideUnity
}) => (
  <>
    <h2
      style={{
        margin: 0,
        fontSize: 20,
        fontWeight: 700,
        marginBottom: 12,
      }}
    >
      프로젝트 이름
    </h2>

    <div style={{ marginBottom: 16 }}>
      <ImageGallery
        onImageDragStart={onImageDragStart}
      />
    </div>

    <div style={{ marginBottom: 16 }}>
      <CanvasTools
        drawingMode={drawingMode}
        eraserSize={eraserSize}
        drawingColor={drawingColor}
        onModeChange={onModeChange}
        onColorChange={onColorChange}
        onColorPreview={onColorPreview}
        onClearAll={onClearAll}
      />
    </div>

    <div style={{ marginTop: 16 }}>
      <ImageTransformControls
        targetDots={targetDots}
        setTargetDots={setTargetDots}
        processing={processing}
        onTransform={onTransform}
        imageUrl={imageUrl}
        sceneId={selectedId}
        layout={layout}
        stageRef={stageRef} // stageRef prop 전달
      />
    </div>

    <UnitySimulatorControls
      isUnityVisible={isUnityVisible}
      showUnity={showUnity}
      hideUnity={hideUnity}
    />
  </>
);

const EditorToolbar = React.memo(function EditorToolbar(props) {
  const { layout = "full" } = props;

  if (layout === "sidebar") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Inner {...props} />
      </div>
    );
  }

  return (
    <section
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "24px 0",
        borderBottom: "1px solid #eee",
      }}
    >
      <div style={{ width: "70%", maxWidth: 980 }}>
        <Inner {...props} />
      </div>
    </section>
  );
});

export default EditorToolbar;
