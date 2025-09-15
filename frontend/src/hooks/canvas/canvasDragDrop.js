export function createCanvasDragDrop({
  fabricCanvasRef,
  isSceneTransformedRef,
  setIsDragOver,
  addImageToCanvasRef,
  setDrawingMode,
  applyDrawingModeRef,
  onModeChangeRef,
}) {
  const handleDragOver = (e) => {
    e.preventDefault();
    try {
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    } catch (_) {}
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    if (isSceneTransformedRef && isSceneTransformedRef.current) {
      alert("변환이 완료된 씬에서는 이미지를 추가할 수 없습니다.");
      return;
    }

    let imageUrl = null;
    try {
      imageUrl = e.dataTransfer.getData("text/plain");
    } catch (_) {}

    const addImage = addImageToCanvasRef && addImageToCanvasRef.current;
    const canvas = fabricCanvasRef && fabricCanvasRef.current;

    if (imageUrl && canvas && typeof addImage === "function") {
      addImage(imageUrl, e.clientX, e.clientY);

      if (typeof setDrawingMode === "function") setDrawingMode("select");
      const apply = applyDrawingModeRef && applyDrawingModeRef.current;
      if (typeof apply === "function") apply("select");
      const onMode = onModeChangeRef && onModeChangeRef.current;
      if (typeof onMode === "function") onMode("select");
    }
  };

  return { handleDragOver, handleDragLeave, handleDrop };
}
