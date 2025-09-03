import React from "react";
import ImageUpload from "../components/ImageUpload.jsx";
import ImageTransformControls from "../components/ImageTransformControls.jsx";
import UnitySimulatorControls from "../components/UnitySimulatorControls.jsx";

export default function EditorToolbar({
  pid,
  selectedId,
  imageUrl,
  targetDots,
  setTargetDots,
  processing,
  onUploaded,
  onTransform,
  // Unity props
  isUnityVisible,
  showUnity,
  hideUnity,
  layout = "full",
}) {
  const Inner = () => (
    <>
      <h2 style={{
        margin: 0,
        fontSize: 20,
        fontWeight: 700,
        marginBottom: 12,
      }}>
        프로젝트 이름
      </h2>

      <ImageUpload
        projectId={pid ?? 1}
        sceneId={selectedId ?? 1}
        onUploaded={onUploaded}
      />

      <div style={{ marginTop: 16 }}>
        <ImageTransformControls
          targetDots={targetDots}
          setTargetDots={setTargetDots}
          processing={processing}
          onTransform={onTransform}
          imageUrl={imageUrl}
          sceneId={selectedId}
        />
      </div>

      <UnitySimulatorControls
        isUnityVisible={isUnityVisible}
        showUnity={showUnity}
        hideUnity={hideUnity}
      />
    </>
  );

  if (layout === "sidebar") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Inner />
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
        <Inner />
      </div>
    </section>
  );
}
