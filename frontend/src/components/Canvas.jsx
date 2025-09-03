import { useRef, useLayoutEffect, useEffect } from "react";
// fabric.js 최적화: 필요한 부분만 import
import { Canvas as FabricCanvas, Circle, FabricImage, PencilBrush } from "fabric";

export default function Canvas({ width = 800, height = 500, imageUrl = "", stageRef: externalStageRef }) {
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);

  // Use useLayoutEffect to initialize the canvas
  useLayoutEffect(() => {
    if (!canvasRef.current) return;

    // 최적화된 fabric.js 캔버스 초기화
    const canvas = new FabricCanvas(canvasRef.current, {
      width: width,
      height: height,
      backgroundColor: '#fafafa',
      renderOnAddRemove: false, // 성능 최적화
      selection: false, // 선택 기능 비활성화로 성능 향상
      skipTargetFind: true, // 대상 찾기 건너뛰기로 성능 향상
      perPixelTargetFind: false, // 픽셀 단위 대상 찾기 비활성화
      enableRetinaScaling: false // 레티나 스케일링 비활성화로 성능 향상
    });
    
    // 그리기 모드 설정 (성능 최적화)
    canvas.isDrawingMode = true;
    const brush = new PencilBrush(canvas);
    brush.width = 2;
    brush.color = "#222";
    brush.decimate = 2; // 브러시 포인트 간소화
    brush.limitedToCanvasSize = true; // 캔버스 경계 제한
    canvas.freeDrawingBrush = brush;
    fabricCanvas.current = canvas;

    if (externalStageRef) {
      externalStageRef.current = canvas;
    }
    
    // 초기 렌더링 활성화
    canvas.renderOnAddRemove = true;
    canvas.renderAll();

    return () => {
      canvas.dispose();
    };
  }, [width, height, externalStageRef]);

  // Effect for loading the background image
  useEffect(() => {
    if (!imageUrl || !fabricCanvas.current) return;
    const canvas = fabricCanvas.current;

    FabricImage.fromURL(imageUrl, {
      crossOrigin: 'anonymous'
    }).then(img => {
      // Clear previous image
      const existingImage = canvas.getObjects('image')[0];
      if (existingImage) {
        canvas.remove(existingImage);
      }

      const scale = Math.min(width / img.width, height / img.height, 1);
      img.set({
        left: (width - img.width * scale) / 2,
        top: (height - img.height * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
      });

      canvas.add(img);
      canvas.sendToBack(img);
      canvas.renderAll();
    });
  }, [imageUrl, width, height]);

  return (
    <div>
      <p>Fabric.js Canvas: 자유 그리기 및 이미지 표시</p>
      <canvas ref={canvasRef} />
    </div>
  );
}