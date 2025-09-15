import { useEffect } from "react";
import * as fabric from "fabric";
import {
  loadCanvasFromIndexedDB,
  saveCanvasToIndexedDB,
} from "../../utils/indexedDBUtils";

export default function useCanvasImageLoader({
  fabricCanvasRef,
  imageUrl,
  scene,
  drawingModeRef,
  currentColorRef,
  applyDrawingMode,
  setDrawingMode,
  drawingMode,
  setEraserSize,
  eraserSize,
  setDrawingColor,
  drawingColor,
  externalDrawingMode,
  externalEraserSize,
  externalDrawingColor,
  externalActiveLayerId,
  setActiveLayerId,
  updateBrushColor,
  triggerAutoSave,
  onCanvasChangeRef,
  setCanvasRevision,
  loadSceneLayerState,
}) {
  // 이미지/JSON 로드 effect
  useEffect(() => {
    // console.log("imageUrl 변경됨:", imageUrl);
    if (!imageUrl || !fabricCanvasRef.current) return;

    let isCancelled = false;

    const canvas = fabricCanvasRef.current;

    const postLoadActions = () => {
      applyDrawingMode(drawingModeRef.current, currentColorRef.current);
      canvas.renderAll();
    };

    const loadFabricCanvasFromData = async (fabricJsonData) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      if (
        !fabricJsonData ||
        !fabricJsonData.objects ||
        fabricJsonData.objects.length === 0
      ) {
        console.warn("렌더링할 객체가 없습니다.");
        return;
      }

      canvas.clear();

      const objectsToRender = fabricJsonData.objects;
      const successfullyCreated = [];

      for (const [i, objData] of objectsToRender.entries()) {
        if (isCancelled) return;
        try {
          const type = objData.type ? objData.type.trim().toLowerCase() : "";

          if (type === "circle") {
            const newCircle = new fabric.Circle({
              ...objData,
              customType: "svgDot",
              selectable: true,
              evented: true,
              hasControls: false,
              hasBorders: true,
              hoverCursor: "crosshair",
              moveCursor: "crosshair",
            });
            successfullyCreated.push(newCircle);
          } else if (type === "path") {
            const newPath = new fabric.Path(objData.path, objData);
            successfullyCreated.push(newPath);
          } else if (type === "image") {
            const image = await new Promise((resolve, reject) => {
              const imgSrc = objData.src;

              if (!imgSrc) {
                return reject(
                  new Error(`#${i} Image 객체에 'src' 속성이 없습니다.`)
                );
              }

              const imgEl = new Image();
              imgEl.crossOrigin = "anonymous";

              imgEl.onload = () => {
                const fabricImage = new fabric.Image(imgEl, objData);
                resolve(fabricImage);
              };

              imgEl.onerror = () => {
                console.error(`[DEBUG] #${i} 이미지 로드 실패.`);
                reject(new Error(`#${i} 이미지 로드 실패: ${imgSrc}`));
              };

              imgEl.src = imgSrc;
            });
            successfullyCreated.push(image);
          } else {
            console.warn(
              `#${i} 객체는 정의되지 않은 '${type}' 타입 입니다. 건너뜁니다.`
            );
          }
        } catch (error) {
          console.error(`객체 생성 실패: #${i} 객체에서 문제가 발생했습니다.`, {
            problematicObjectData: objData,
            errorDetails: error,
          });
          return;
        }
      }
      successfullyCreated.forEach((obj) => obj.set("dirty", true));
      canvas.renderOnAddRemove = false;
      canvas.add(...successfullyCreated);
      canvas.renderOnAddRemove = true;
      canvas.renderAll();

      if (fabricJsonData.layerMetadata && loadSceneLayerState && scene?.id) {
        loadSceneLayerState(scene.id, fabricJsonData.layerMetadata);

        setTimeout(() => {
          const canvas = fabricCanvasRef.current;
          if (canvas && fabricJsonData.layerMetadata) {
            const layers = fabricJsonData.layerMetadata.layers || [];
            const objects = canvas.getObjects();

            objects.forEach(obj => {
              // 캔버스 경계선은 제외
              if (obj.name === 'canvasBoundary') return;

              if (obj.layerId) {
                const layer = layers.find(l => l.id === obj.layerId);
                if (layer) {
                  obj.set({
                    visible: layer.visible,
                    selectable: !layer.locked,
                    evented: !layer.locked
                  });
                }
              } else if (fabricJsonData.layerMetadata.activeLayerId) {
                obj.set('layerId', fabricJsonData.layerMetadata.activeLayerId);
              }
            });

            canvas.renderAll();
          }
        }, 50);
      }

      setTimeout(() => {
        if (isCancelled) return;
        canvas.renderAll();
      }, 16);

      postLoadActions();
    };

    const startLoading = async () => {
      try {
        const cachedData = await loadCanvasFromIndexedDB(scene.id);

        if (cachedData) {
          await loadFabricCanvasFromData(cachedData);
        } else {
          const response = await fetch(imageUrl);
          if (isCancelled) return;
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const fabricJsonData = await response.json();
          if (isCancelled) return;
          if (scene.id) {
            await saveCanvasToIndexedDB(scene.id, fabricJsonData);
          }
          if (isCancelled) return;

          await loadFabricCanvasFromData(fabricJsonData);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("JSON 로드 실패:", err);
        }
      }
    };

    startLoading();

    return () => {
      isCancelled = true;
    };
  }, [imageUrl, scene?.id]);

  // externalDrawingMode sync
  useEffect(() => {
    if (externalDrawingMode !== drawingMode) {
      setDrawingMode(externalDrawingMode);
      setTimeout(() => {
        applyDrawingMode(
          externalDrawingMode,
          externalDrawingMode === "pixelErase" ? null : drawingColor
        );
      }, 10);
    }
  }, [externalDrawingMode, drawingColor]);

  // externalEraserSize sync
  useEffect(() => {
    if (externalEraserSize !== eraserSize) {
      setEraserSize(externalEraserSize);
    }
  }, [externalEraserSize]);

  // externalDrawingColor sync
  useEffect(() => {
    if (externalDrawingColor !== drawingColor) {
      setDrawingColor(externalDrawingColor);
      if (drawingMode !== "pixelErase") {
        updateBrushColor(externalDrawingColor);
      }
    }
  }, [externalDrawingColor, drawingMode]);

  // externalActiveLayerId sync
  useEffect(() => {
    if (externalActiveLayerId && externalActiveLayerId !== undefined) {
      setActiveLayerId(externalActiveLayerId);
    }
  }, [externalActiveLayerId]);

  // eraser size effect trigger applyDrawingMode when eraserSize changes
  useEffect(() => {
    if (!fabricCanvasRef.current || !drawingMode) return;
    if (drawingMode === "erase" || drawingMode === "pixelErase") {
      applyDrawingMode(drawingMode);
    }
  }, [eraserSize]);
}
