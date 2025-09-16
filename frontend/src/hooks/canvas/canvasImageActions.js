import * as fabric from "fabric";
import * as fabricLayerUtils from "../../utils/fabricLayerUtils";

export function createCanvasImageActions({
  fabricCanvasRef,
  width = 800,
  height = 500,
  externalActiveLayerId,
  layers,
  setCanvasRevision,
  triggerAutoSave,
  saveToHistory,
  onCanvasChangeRef,
}) {
  const addImageToCanvas = (imageUrl, clientX = null, clientY = null) => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;

    fabric.FabricImage.fromURL(imageUrl, {
      crossOrigin: "anonymous",
    })
      .then((img) => {
        const maxSize = 200;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

        let left, top;
        if (clientX && clientY) {
          const rect = canvas.getElement().getBoundingClientRect();
          left = clientX - rect.left - (img.width * scale) / 2;
          top = clientY - rect.top - (img.height * scale) / 2;
        } else {
          left = (width - img.width * scale) / 2;
          top = (height - img.height * scale) / 2;
        }

        img.set({
          left: Math.max(0, Math.min(left, width - img.width * scale)),
          top: Math.max(0, Math.min(top, height - img.height * scale)),
          scaleX: scale,
          scaleY: scale,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          customType: "droppedImage",
          lockUniScaling: false,
          centeredScaling: false,
          centeredRotation: true,
        });

        const currentActiveLayerId = externalActiveLayerId;
        const activeLayer = layers.find((layer) => layer.id === currentActiveLayerId);

        if (activeLayer) {
          fabricLayerUtils.assignObjectToLayer(img, activeLayer.id, activeLayer.name);
        }

        canvas.add(img);
        canvas.setActiveObject(img);
        if (typeof setCanvasRevision === "function") setCanvasRevision((c) => c + 1);
        if (typeof triggerAutoSave === "function") triggerAutoSave({ action: "imageDropped", imageUrl });
        if (typeof saveToHistory === "function") saveToHistory("imageDropped")
        if (onCanvasChangeRef && onCanvasChangeRef.current) onCanvasChangeRef.current();
        canvas.renderAll();
      })
      .catch((err) => {
        console.error("이미지 로드 실패:", err);
        alert("이미지를 로드할 수 없습니다.");
      });
  };

  return { addImageToCanvas };
}
