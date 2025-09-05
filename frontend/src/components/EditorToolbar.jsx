import React from "react";
import { createPortal } from "react-dom";
import ImageTransformControls from "../components/ImageTransformControls.jsx";
import UnitySimulatorControls from "../components/UnitySimulatorControls.jsx";
import ImageGallery from "../components/ImageGallery.jsx";
import CanvasTools from "../components/CanvasTools.jsx";
import { FaImage } from "react-icons/fa";

export default function EditorToolbar({
  pid,
  selectedId,
  imageUrl,
  targetDots,
  setTargetDots,
  processing,
  onTransform,
  // Unity props
  isUnityVisible,
  showUnity,
  hideUnity,
  // ImageGallery props
  onImageDragStart,
  // Canvas props
  drawingMode,
  eraserSize,
  onModeChange,
  onClearAll,
  stageRef, // stageRef prop
  layout = "full",
}) {
  const [showGallery, setShowGallery] = React.useState(true);
  const wrapperRef = React.useRef(null);
  const [overlayPos, setOverlayPos] = React.useState({ top: 0, left: 0 });
  // Gallery tooltip state
  const galleryBtnRef = React.useRef(null);
  const [galleryHovered, setGalleryHovered] = React.useState(false);
  const [galleryTooltipPos, setGalleryTooltipPos] = React.useState({
    top: 0,
    left: 0,
  });

  const updateOverlayPos = React.useCallback(() => {
    const aside = document.querySelector("aside");
    if (!wrapperRef.current || !aside) return;
    const wrapRect = wrapperRef.current.getBoundingClientRect();
    const asideRect = aside.getBoundingClientRect();
    setOverlayPos({
      top: Math.round(wrapRect.top),
      left: Math.round(asideRect.right + 12),
    });
  }, []);

  React.useEffect(() => {
    if (!showGallery) return;
    updateOverlayPos();
    window.addEventListener("resize", updateOverlayPos);
    window.addEventListener("scroll", updateOverlayPos, true);
    return () => {
      window.removeEventListener("resize", updateOverlayPos);
      window.removeEventListener("scroll", updateOverlayPos, true);
    };
  }, [showGallery, updateOverlayPos]);

  // Tooltip position updater for Image Gallery button (match CanvasTools)
  React.useEffect(() => {
    if (!galleryHovered) return;
    const el = galleryBtnRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setGalleryTooltipPos({
        top: Math.round(r.top + r.height / 2),
        left: Math.round(r.right + 8),
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [galleryHovered]);

  const GalleryTooltipPortal = () =>
    galleryHovered
      ? createPortal(
          <div
            style={{
              position: "fixed",
              top: galleryTooltipPos.top,
              left: galleryTooltipPos.left,
              transform: "translateY(-50%)",
              background: "#000",
              color: "#fff",
              padding: "6px 8px",
              borderRadius: 6,
              fontSize: 12,
              whiteSpace: "nowrap",
              zIndex: 9999,
              boxShadow: "0 2px 6px rgba(0,0,0,.2)",
              pointerEvents: "none",
            }}
          >
            Image gallery
          </div>,
          document.body
        )
      : null;
  const Inner = () => (
    <>
      <div ref={wrapperRef} style={{ marginBottom: 16, position: "relative" }}>
        {layout === "sidebar" && (
          <button
            ref={galleryBtnRef}
            onClick={() => setShowGallery((v) => !v)}
            style={{
              border: "1px solid #ccc",
              padding: "8px 16px",
              borderRadius: 4,
              cursor: "pointer",
              marginBottom: 8,
              fontSize: 16,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: "#f8f9fa",
              color: "black",
            }}
            onMouseEnter={() => setGalleryHovered(true)}
            onMouseLeave={() => setGalleryHovered(false)}
            aria-label="Image gallery"
          >
            <FaImage />
          </button>
        )}
        <GalleryTooltipPortal />
        {layout === "sidebar"
          ? showGallery &&
            createPortal(
              <div
                style={{
                  position: "fixed",
                  top: overlayPos.top,
                  left: overlayPos.left,
                  zIndex: 8000,
                }}
              >
                <ImageGallery
                  onImageDragStart={onImageDragStart}
                  layout="overlay"
                />
              </div>,
              document.body
            )
          : showGallery && <ImageGallery onImageDragStart={onImageDragStart} />}
      </div>

      <div style={{ marginBottom: 16 }}>
        <CanvasTools
          drawingMode={drawingMode}
          eraserSize={eraserSize}
          onModeChange={onModeChange}
          onClearAll={onClearAll}
        />
      </div>

      {layout !== "sidebar" && (
        <>
          <div style={{ marginTop: 16 }}>
            <ImageTransformControls
              targetDots={targetDots}
              setTargetDots={setTargetDots}
              processing={processing}
              onTransform={onTransform}
              imageUrl={imageUrl}
              sceneId={selectedId}
              layout={layout}
              stageRef={stageRef}
            />
          </div>

          <UnitySimulatorControls
            isUnityVisible={isUnityVisible}
            showUnity={showUnity}
            hideUnity={hideUnity}
          />
        </>
      )}
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
