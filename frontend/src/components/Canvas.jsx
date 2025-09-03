import { useRef, useLayoutEffect, useEffect } from "react";
import { Canvas as FabricCanvas, Circle, Image as FabricImage, PencilBrush } from "fabric";

export default function Canvas({ width = 800, height = 500, imageUrl = "", stageRef: externalStageRef }) {
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);

  // Use useLayoutEffect to initialize the canvas
  useLayoutEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: width,
      height: height,
      backgroundColor: '#fafafa'
    });
    
    // 그리기 모드 설정
    canvas.isDrawingMode = true;
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.width = 2;
    canvas.freeDrawingBrush.color = "#222";
    
    console.log('Drawing brush configured:', !!canvas.freeDrawingBrush);
    fabricCanvas.current = canvas;

    if (externalStageRef) {
      externalStageRef.current = canvas;
    }


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