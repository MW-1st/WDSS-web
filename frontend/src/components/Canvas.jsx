import { useRef, useLayoutEffect, useEffect, useState } from "react";
// fabric.js 최적화: 필요한 부분만 import
import { Canvas as FabricCanvas, Circle, FabricImage, PencilBrush } from "fabric";

export default function Canvas({ width = 800, height = 500, imageUrl = "", stageRef: externalStageRef }) {
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);
  const [drawingMode, setDrawingMode] = useState('draw');
  const [eraserSize, setEraserSize] = useState(20);
  const [brushSize, setBrushSize] = useState(10);
  const eraseHandlers = useRef({});

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

  // 지우개 크기가 변경될 때 브러시 업데이트
  useEffect(() => {
    if ((drawingMode === 'erase' || drawingMode === 'pixelErase') && fabricCanvas.current) {
      const canvas = fabricCanvas.current;
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.width = eraserSize;
      }
    }
  }, [eraserSize, drawingMode]);

  const toggleDrawingMode = (mode) => {
    setDrawingMode(mode);
    if (!fabricCanvas.current) return;
    
    const canvas = fabricCanvas.current;
    
    // 이전 이벤트 리스너 정리
    if (eraseHandlers.current.wheelHandler) {
      canvas.off('mouse:wheel', eraseHandlers.current.wheelHandler);
    }
    if (eraseHandlers.current.startErase) {
      canvas.off('mouse:down', eraseHandlers.current.startErase);
      canvas.off('mouse:move', eraseHandlers.current.erase);
      canvas.off('mouse:up', eraseHandlers.current.stopErase);
    }
    
    // isDrawingMode가 true일 때는 fabric이 내부적으로 핸들러를 관리하므로
    // pixelErase 모드에서 사용했던 핸들러는 따로 정리할 필요가 없습니다.

    // 기본 커서로 복구
    canvas.defaultCursor = 'default';
    
    if (mode === 'draw') {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
      canvas.moveCursor = 'crosshair';
      canvas.freeDrawingCursor = 'crosshair';
      
      const brush = new PencilBrush(canvas);
      brush.width = 2;
      brush.color = "#222";
      brush.decimate = 2;
      brush.limitedToCanvasSize = true;
      canvas.freeDrawingBrush = brush;
      
      // 기본 커서로 복구
      canvas.setCursor('crosshair');
      
    } else if (mode === 'brush') {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      
      // 브러시 설정
      const brush = new PencilBrush(canvas);
      brush.width = brushSize;
      brush.color = "rgba(0,0,0,1)";
      canvas.freeDrawingBrush = brush;
      
      // 원형 커서 생성 함수
      const createBrushCursor = (size) => {
        const cursorCanvas = document.createElement('canvas');
        const ctx = cursorCanvas.getContext('2d');
        const cursorSize = size + 10;
        
        cursorCanvas.width = cursorSize;
        cursorCanvas.height = cursorSize;
        
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(cursorSize/2, cursorSize/2, size/2, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cursorSize/2, cursorSize/2, size/2, 0, 2 * Math.PI);
        ctx.stroke();
        
        return `url(${cursorCanvas.toDataURL()}) ${cursorSize/2} ${cursorSize/2}, crosshair`;
      };
      
      // 커서 설정
      const brushCursor = createBrushCursor(brushSize);
      canvas.defaultCursor = brushCursor;
      canvas.hoverCursor = brushCursor;
      canvas.moveCursor = brushCursor;
      canvas.freeDrawingCursor = brushCursor;
      canvas.setCursor(brushCursor);
      
      // 휠 이벤트로 크기 조절
      const wheelHandler = (e) => {
        e.e.preventDefault();
        const delta = e.e.deltaY;
        const step = 3;
        
        setBrushSize(prevSize => {
          let newSize;
          if (delta > 0) {
            newSize = Math.max(1, prevSize - step);
          } else {
            newSize = Math.min(100, prevSize + step);
          }
          
          // 브러시 크기 업데이트
          if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.width = newSize;
          }
          const newBrushCursor = createBrushCursor(newSize);
          canvas.defaultCursor = newBrushCursor;
          canvas.hoverCursor = newBrushCursor;
          canvas.moveCursor = newBrushCursor;
          canvas.freeDrawingCursor = newBrushCursor;
          canvas.setCursor(newBrushCursor);
          return newSize;
        });
      };
      
      eraseHandlers.current = { wheelHandler };
      canvas.on('mouse:wheel', wheelHandler);
      
    } else if (mode === 'erase') {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      
      // 원형 커서 생성 함수
      const createEraserCursor = (size) => {
        const cursorCanvas = document.createElement('canvas');
        const ctx = cursorCanvas.getContext('2d');
        const cursorSize = size + 10;
        
        cursorCanvas.width = cursorSize;
        cursorCanvas.height = cursorSize;
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cursorSize/2, cursorSize/2, size/2, 0, 2 * Math.PI);
        ctx.stroke();
        
        return `url(${cursorCanvas.toDataURL()}) ${cursorSize/2} ${cursorSize/2}, crosshair`;
      };
      
      // 커서 설정
      const eraserCursor = createEraserCursor(eraserSize);
      canvas.defaultCursor = eraserCursor;
      canvas.hoverCursor = eraserCursor;
      canvas.moveCursor = eraserCursor;
      canvas.setCursor(eraserCursor);
      
      // 지우개 구현
      let isErasing = false;
      
      const startErase = (e) => {
        isErasing = true;
        eraseAtPoint(e);
      };
      
      const erase = (e) => {
        if (!isErasing) return;
        eraseAtPoint(e);
      };
      
      const stopErase = () => {
        isErasing = false;
      };
      
      const eraseAtPoint = (e) => {
        const pointer = canvas.getPointer(e.e);
        const objects = canvas.getObjects();
        const objectsToRemove = [];
        
        objects.forEach(obj => {
          if (obj.type === 'path') {
            // 객체의 경계 박스와 지우개 영역이 교차하는지 확인
            const bounds = obj.getBoundingRect();
            const eraserRadius = eraserSize / 2;
            
            // 간단한 교차 검사
            if (pointer.x + eraserRadius >= bounds.left && 
                pointer.x - eraserRadius <= bounds.left + bounds.width &&
                pointer.y + eraserRadius >= bounds.top && 
                pointer.y - eraserRadius <= bounds.top + bounds.height) {
              objectsToRemove.push(obj);
            }
          }
        });
        
        objectsToRemove.forEach(obj => {
          canvas.remove(obj);
        });
        
        if (objectsToRemove.length > 0) {
          canvas.renderAll();
        }
      };
      
      // 휠 이벤트로 크기 조절
      const wheelHandler = (e) => {
        e.e.preventDefault();
        const delta = e.e.deltaY;
        const step = 3;
        
        setEraserSize(prevSize => {
          let newSize;
          if (delta > 0) {
            newSize = Math.max(5, prevSize - step);
          } else {
            newSize = Math.min(100, prevSize + step);
          }
          
          const newEraserCursor = createEraserCursor(newSize);
          canvas.defaultCursor = newEraserCursor;
          canvas.hoverCursor = newEraserCursor;
          canvas.moveCursor = newEraserCursor;
          canvas.setCursor(newEraserCursor);
          return newSize;
        });
      };
      
      eraseHandlers.current = { startErase, erase, stopErase, wheelHandler };
      
      canvas.on('mouse:down', startErase);
      canvas.on('mouse:move', erase);
      canvas.on('mouse:up', stopErase);
      canvas.on('mouse:wheel', wheelHandler);
      
    } else if (mode === 'pixelErase') {
      canvas.isDrawingMode = true;
      canvas.selection = false;

      // 픽셀 지우개용 브러시 설정 (배경색으로 칠하기)
      const eraserBrush = new PencilBrush(canvas);
      eraserBrush.width = eraserSize;
      eraserBrush.color = canvas.backgroundColor || '#fafafa';
      canvas.freeDrawingBrush = eraserBrush;

      // 원형 커서 생성 함수
      const createPixelEraserCursor = (size) => {
        const cursorCanvas = document.createElement('canvas');
        const ctx = cursorCanvas.getContext('2d');
        const cursorSize = size + 10;
        
        cursorCanvas.width = cursorSize;
        cursorCanvas.height = cursorSize;
        
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(cursorSize/2, cursorSize/2, size/2, 0, 2 * Math.PI);
        ctx.stroke();
        
        return `url(${cursorCanvas.toDataURL()}) ${cursorSize/2} ${cursorSize/2}, crosshair`;
      };
      
      // 커서 설정
      const pixelEraserCursor = createPixelEraserCursor(eraserSize);
      canvas.defaultCursor = pixelEraserCursor;
      canvas.hoverCursor = pixelEraserCursor;
      canvas.moveCursor = pixelEraserCursor;
      canvas.freeDrawingCursor = pixelEraserCursor;
      canvas.setCursor(pixelEraserCursor);
      
      // 휠 이벤트로 크기 조절
      const wheelHandler = (e) => {
        e.e.preventDefault();
        const delta = e.e.deltaY;
        const step = 3;
        
        setEraserSize(prevSize => {
          let newSize;
          if (delta > 0) {
            newSize = Math.max(5, prevSize - step);
          } else {
            newSize = Math.min(100, prevSize + step);
          }
          
          if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.width = newSize;
          }
          
          const newPixelEraserCursor = createPixelEraserCursor(newSize);
          canvas.defaultCursor = newPixelEraserCursor;
          canvas.hoverCursor = newPixelEraserCursor;
          canvas.moveCursor = newPixelEraserCursor;
          canvas.freeDrawingCursor = newPixelEraserCursor;
          canvas.setCursor(newPixelEraserCursor);
          return newSize;
        });
      };
      
      eraseHandlers.current = { wheelHandler };
      
      canvas.on('mouse:wheel', wheelHandler);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={() => toggleDrawingMode('draw')} 
          style={{ 
            marginRight: '10px', 
            backgroundColor: drawingMode === 'draw' ? '#007bff' : '#f8f9fa',
            color: drawingMode === 'draw' ? 'white' : 'black',
            border: '1px solid #ccc',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          펜
        </button>
        <button 
          onClick={() => toggleDrawingMode('brush')} 
          style={{ 
            marginRight: '10px', 
            backgroundColor: drawingMode === 'brush' ? '#28a745' : '#f8f9fa',
            color: drawingMode === 'brush' ? 'white' : 'black',
            border: '1px solid #ccc',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          브러시
        </button>
        <button 
          onClick={() => toggleDrawingMode('erase')} 
          style={{ 
            marginRight: '10px', 
            backgroundColor: drawingMode === 'erase' ? '#dc3545' : '#f8f9fa',
            color: drawingMode === 'erase' ? 'white' : 'black',
            border: '1px solid #ccc',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          선 지우개
        </button>
        <button 
          onClick={() => toggleDrawingMode('pixelErase')} 
          style={{ 
            backgroundColor: drawingMode === 'pixelErase' ? '#fd7e14' : '#f8f9fa',
            color: drawingMode === 'pixelErase' ? 'white' : 'black',
            border: '1px solid #ccc',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          픽셀 지우개
        </button>
      </div>
      <p>Fabric.js Canvas: 자유 그리기 및 이미지 표시 ({
        drawingMode === 'draw' ? '펜 모드' : 
        drawingMode === 'brush' ? `브러시 모드 (크기: ${brushSize}px, 휠로 조절)` : 
        drawingMode === 'erase' ? `선 지우개 모드 (크기: ${eraserSize}px, 휠로 조절)` :
        `픽셀 지우개 모드 (크기: ${eraserSize}px, 휠로 조절)`
      })</p>
      <canvas ref={canvasRef} />
    </div>
  );
}