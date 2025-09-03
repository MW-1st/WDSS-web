import { useRef, useLayoutEffect, useEffect, useState, useCallback } from "react";
// fabric.js 최적화: 필요한 부분만 import
import { Canvas as FabricCanvas, Circle, FabricImage, PencilBrush } from "fabric";

export default function Canvas({ width = 800, height = 500, imageUrl = "", stageRef: externalStageRef }) {
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);
  const [drawingMode, setDrawingMode] = useState('draw');
  const [eraserSize, setEraserSize] = useState(20);
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
    brush.width = 2; // 원래 크기로 복원
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
    console.log("imageUrl 변경됨:", imageUrl);
    if (!imageUrl || !fabricCanvas.current) return;
    const canvas = fabricCanvas.current;

    // SVG 파일인지 확인
    if (imageUrl.endsWith('.svg')) {
      console.log("SVG 파일 로드 시작:", imageUrl);
      // SVG 파일을 직접 로드하여 개별 요소들에 접근 가능하도록 처리
      fetch(imageUrl)
        .then(response => {
          console.log("SVG fetch 응답:", response.status);
          return response.text();
        })
        .then(svgText => {
          console.log("SVG 텍스트 길이:", svgText.length);
          console.log("SVG 내용 시작:", svgText.substring(0, 200));
          // 기존 SVG 요소들 제거
          const existingSvgObjects = canvas.getObjects().filter(obj => 
            obj.customType === 'svgDot' || obj.type === 'image'
          );
          existingSvgObjects.forEach(obj => canvas.remove(obj));

          // SVG를 파싱하여 개별 도트들을 Fabric 객체로 변환
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
          const circles = svgDoc.querySelectorAll('circle');
          console.log("찾은 circle 개수:", circles.length);
          
          let addedCount = 0;
          circles.forEach((circleEl, index) => {
            const cx = parseFloat(circleEl.getAttribute('cx') || '0');
            const cy = parseFloat(circleEl.getAttribute('cy') || '0');
            const r = parseFloat(circleEl.getAttribute('r') || '2');
            const fill = circleEl.getAttribute('fill') || '#000000';

            if (index < 5) {
              console.log(`Circle ${index}: cx=${cx}, cy=${cy}, r=${r}, fill=${fill}`);
            }

            const fabricCircle = new Circle({
              left: cx - r,
              top: cy - r,
              radius: r,
              fill: fill,
              selectable: false,
              evented: true, // 그리기/지우기 상호작용 가능하도록 true로 설정
              customType: 'svgDot', // 커스텀 타입 추가로 식별 가능
              originalCx: cx,
              originalCy: cy,
              hoverCursor: 'crosshair',
              moveCursor: 'crosshair'
            });

            canvas.add(fabricCircle);
            addedCount++;
          });
          
          console.log(`총 ${addedCount}개의 circle을 캔버스에 추가했습니다`);
          console.log("캔버스 객체 개수:", canvas.getObjects().length);

          canvas.renderAll();
        })
        .catch(err => {
          console.error('SVG 로드 실패:', err);
          // SVG 로드 실패 시 기본 이미지 방식으로 폴백
          loadAsImage();
        });
    } else {
      loadAsImage();
    }

    function loadAsImage() {
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
    }
  }, [imageUrl, width, height]);

  // 지우개 크기가 변경될 때 현재 모드에 따라 업데이트
  useEffect(() => {
    if (!fabricCanvas.current || !drawingMode) return;
    
    // erase 모드일 때만 크기 반영
    if (drawingMode === 'erase') {
      applyDrawingMode(drawingMode);
    }
  }, [eraserSize]);

  const applyDrawingMode = (mode) => {
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
    if (eraseHandlers.current.startDraw) {
      canvas.off('mouse:down', eraseHandlers.current.startDraw);
      canvas.off('mouse:move', eraseHandlers.current.continueDraw);
      canvas.off('mouse:up', eraseHandlers.current.stopDraw);
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
      brush.width = 2; // 원래 크기로 복원
      brush.color = "#222";
      brush.decimate = 2; // 브러시 포인트 간소화
      brush.limitedToCanvasSize = true;
      canvas.freeDrawingBrush = brush;
      
      // 기본 커서로 복구
      canvas.setCursor('crosshair');
      
    } else if (mode === 'brush') {
      canvas.isDrawingMode = false; // SVG 도트와 상호작용하기 위해 false로 설정
      canvas.selection = false;
      
      let isDrawing = false;
      
      const startDraw = (e) => {
        isDrawing = true;
        drawDotAtPoint(e);
      };
      
      const continueDraw = (e) => {
        if (!isDrawing) return;
        drawDotAtPoint(e);
      };
      
      const stopDraw = () => {
        isDrawing = false;
      };
      
      const drawDotAtPoint = (e) => {
        const pointer = canvas.getPointer(e.e);
        
        // 새로운 도트 생성 (SVG circle과 같은 크기 2px 사용)
        const dotRadius = 1;
        const newDot = new Circle({
          left: pointer.x - dotRadius,
          top: pointer.y - dotRadius,
          radius: dotRadius,
          fill: "rgba(0,0,0,1)",
          selectable: false,
          evented: true,
          customType: 'drawnDot', // 그려진 도트로 구분
          hoverCursor: 'crosshair',
          moveCursor: 'crosshair'
        });
        
        canvas.add(newDot);
        canvas.renderAll();
      };
      
      // 고정 크기 브러시 커서 생성
      const createBrushCursor = () => {
        const cursorCanvas = document.createElement('canvas');
        const ctx = cursorCanvas.getContext('2d');
        const dotRadius = 2;
        const cursorSize = dotRadius * 2 + 10;
        
        cursorCanvas.width = cursorSize;
        cursorCanvas.height = cursorSize;
        
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(cursorSize/2, cursorSize/2, dotRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cursorSize/2, cursorSize/2, dotRadius, 0, 2 * Math.PI);
        ctx.stroke();
        
        return `url(${cursorCanvas.toDataURL()}) ${cursorSize/2} ${cursorSize/2}, crosshair`;
      };
      
      // 커서 설정
      const brushCursor = createBrushCursor();
      canvas.defaultCursor = brushCursor;
      canvas.hoverCursor = brushCursor;
      canvas.moveCursor = brushCursor;
      canvas.freeDrawingCursor = brushCursor;
      canvas.setCursor(brushCursor);
      
      eraseHandlers.current = { startDraw, continueDraw, stopDraw };
      
      canvas.on('mouse:down', startDraw);
      canvas.on('mouse:move', continueDraw);
      canvas.on('mouse:up', stopDraw);
      
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
        const eraserRadius = eraserSize / 2;
        
        objects.forEach(obj => {
          // 그려진 패스들, SVG 도트들, 그려진 도트들 모두 지우기 가능
          if (obj.type === 'path' || obj.customType === 'svgDot' || obj.customType === 'drawnDot') {
            if (obj.customType === 'svgDot' || obj.customType === 'drawnDot') {
              // 도트들의 경우 원의 중심점과의 거리 계산
              const dotCenterX = obj.left + obj.radius;
              const dotCenterY = obj.top + obj.radius;
              const distance = Math.sqrt(
                Math.pow(pointer.x - dotCenterX, 2) + 
                Math.pow(pointer.y - dotCenterY, 2)
              );
              
              if (distance <= eraserRadius + obj.radius) {
                objectsToRemove.push(obj);
              }
            } else {
              // 패스의 경우 기존 로직 사용
              const bounds = obj.getBoundingRect();
              
              if (pointer.x + eraserRadius >= bounds.left && 
                  pointer.x - eraserRadius <= bounds.left + bounds.width &&
                  pointer.y + eraserRadius >= bounds.top && 
                  pointer.y - eraserRadius <= bounds.top + bounds.height) {
                objectsToRemove.push(obj);
              }
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

  const toggleDrawingMode = (mode) => {
    setDrawingMode(mode);
    applyDrawingMode(mode);
  };

  // 전체 지우기 핸들러
  const handleClearAll = () => {
    if (!fabricCanvas.current) return;
    
    if (confirm('캔버스의 모든 내용을 지우시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      clearCanvas();
      console.log('캔버스 전체가 초기화되었습니다');
    }
  };

  // 현재 캔버스의 도트들을 SVG 문자열로 생성
  const getCurrentCanvasAsSvg = () => {
    if (!fabricCanvas.current) return null;
    
    const canvas = fabricCanvas.current;
    const objects = canvas.getObjects();
    const dots = [];
    
    objects.forEach(obj => {
      if (obj.customType === 'svgDot' || obj.customType === 'drawnDot') {
        // 도트의 중심점 계산
        const centerX = obj.left + obj.radius;
        const centerY = obj.top + obj.radius;
        
        dots.push({
          cx: centerX,
          cy: centerY,
          r: obj.radius,
          fill: obj.fill
        });
      }
    });
    
    // SVG 문자열 생성
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">`;
    dots.forEach(dot => {
      svgContent += `<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${dot.fill}" />`;
    });
    svgContent += '</svg>';
    
    return {
      svgString: svgContent,
      totalDots: dots.length
    };
  };

  // 현재 캔버스 전체를 이미지로 내보내기
  const exportCanvasAsImage = () => {
    if (!fabricCanvas.current) return null;
    
    const canvas = fabricCanvas.current;
    // 캔버스를 데이터 URL로 변환 (PNG 형태)
    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 1.0,
      multiplier: 1
    });
    
    return dataURL;
  };

  // 펜으로 그린 선만 별도로 이미지로 내보내기
  const exportDrawnLinesOnly = () => {
    if (!fabricCanvas.current) return null;
    
    const canvas = fabricCanvas.current;
    const objects = canvas.getObjects();
    
    // 배경 이미지와 SVG 도트들을 임시로 숨기기
    const hiddenObjects = [];
    objects.forEach(obj => {
      if (obj.type === 'image' || obj.customType === 'svgDot') {
        obj.visible = false;
        hiddenObjects.push(obj);
      }
    });
    
    canvas.renderAll();
    
    // 펜으로 그린 선만 포함된 이미지 생성
    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 1.0,
      multiplier: 1,
      backgroundColor: 'white' // 배경을 흰색으로 설정
    });
    
    // 숨겼던 객체들 다시 보이게 하기
    hiddenObjects.forEach(obj => {
      obj.visible = true;
    });
    
    canvas.renderAll();
    
    return dataURL;
  };

  // 캔버스에 그려진 객체가 있는지 확인
  const hasDrawnContent = () => {
    if (!fabricCanvas.current) return false;
    
    const canvas = fabricCanvas.current;
    const objects = canvas.getObjects();
    
    // path(펜으로 그린 선)나 drawnDot(브러시 도트)가 있는지 확인
    return objects.some(obj => obj.type === 'path' || obj.customType === 'drawnDot');
  };

  // 캔버스 초기화 (모든 객체 제거)
  const clearCanvas = () => {
    if (!fabricCanvas.current) return;
    
    const canvas = fabricCanvas.current;
    // 모든 객체 제거
    canvas.getObjects().forEach(obj => canvas.remove(obj));
    canvas.backgroundColor = '#fafafa';
    canvas.renderAll();
  };

  // 외부에서 사용할 수 있도록 ref에 함수 등록
  useEffect(() => {
    if (externalStageRef && externalStageRef.current) {
      externalStageRef.current.getCurrentCanvasAsSvg = getCurrentCanvasAsSvg;
      externalStageRef.current.exportCanvasAsImage = exportCanvasAsImage;
      externalStageRef.current.exportDrawnLinesOnly = exportDrawnLinesOnly;
      externalStageRef.current.hasDrawnContent = hasDrawnContent;
      externalStageRef.current.clear = clearCanvas;
    }
  }, [externalStageRef]);

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
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          픽셀 지우개
        </button>
        <button 
          onClick={() => handleClearAll()} 
          style={{ 
            backgroundColor: '#dc3545',
            color: 'white',
            border: '1px solid #dc3545',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          전체 지우기
        </button>
      </div>
      <p>Fabric.js Canvas: 자유 그리기 및 이미지 표시 ({
        drawingMode === 'draw' ? '펜 모드' : 
        drawingMode === 'brush' ? '브러시 모드' : 
        drawingMode === 'erase' ? `선 지우개 모드 (크기: ${eraserSize}px, 휠로 조절)` :
        `픽셀 지우개 모드 (크기: ${eraserSize}px, 휠로 조절)`
      })</p>
      <canvas ref={canvasRef} />
    </div>
  );
}