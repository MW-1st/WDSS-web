import { useRef, useLayoutEffect, useEffect, useState, useCallback } from "react";
// fabric.js 최적화: 필요한 부분만 import
import { Canvas as FabricCanvas, Circle, FabricImage, PencilBrush } from "fabric";

export default function Canvas({ 
  width = 800, 
  height = 500, 
  imageUrl = "", 
  stageRef: externalStageRef,
  drawingMode: externalDrawingMode = 'draw',
  eraserSize: externalEraserSize = 20,
  drawingColor: externalDrawingColor = '#222222',
  onModeChange
}) {
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);
  const [drawingMode, setDrawingMode] = useState(externalDrawingMode);
  const [eraserSize, setEraserSize] = useState(externalEraserSize);
  const [drawingColor, setDrawingColor] = useState(externalDrawingColor);
  const eraseHandlers = useRef({});
  const [isDragOver, setIsDragOver] = useState(false);

  // Use useLayoutEffect to initialize the canvas
  useLayoutEffect(() => {
    if (!canvasRef.current) return;

    // 최적화된 fabric.js 캔버스 초기화
    const canvas = new FabricCanvas(canvasRef.current, {
      width: width,
      height: height,
      backgroundColor: '#fafafa',
      renderOnAddRemove: false, // 성능 최적화
      selection: false, // 처음엔 선택 비활성화 (나중에 모드별로 설정)
      skipTargetFind: false, // 이미지 선택을 위해 false로 변경
      perPixelTargetFind: false, // 픽셀 단위 대상 찾기 비활성화
      enableRetinaScaling: false // 레티나 스케일링 비활성화로 성능 향상
    });
    
    // 그리기 모드 설정 (성능 최적화)
    canvas.isDrawingMode = true;
    const brush = new PencilBrush(canvas);
    brush.width = 2; // 원래 크기로 복원
    brush.color = externalDrawingColor; // 외부에서 전달받은 색상 사용
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
            const originalFill = circleEl.getAttribute('fill') || '#000000';

            if (index < 10) {
              console.log(`Circle ${index}: cx=${cx}, cy=${cy}, r=${r}, originalFill=${originalFill}`);
            }

            // 실제 SVG의 색상을 그대로 사용 (색상 대체하지 않음)
            const actualFill = originalFill;

            if (index < 10) {
              console.log(`Circle ${index} actualFill: ${actualFill}`);
            }

            const fabricCircle = new Circle({
              left: cx - r,
              top: cy - r,
              radius: r,
              fill: actualFill,
              selectable: false,
              evented: true, // 그리기/지우기 상호작용 가능하도록 true로 설정
              customType: 'svgDot', // 커스텀 타입 추가로 식별 가능
              originalCx: cx,
              originalCy: cy,
              originalFill: originalFill, // 원본 색상 정보 보존
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

  // 외부에서 drawingMode가 변경될 때 반응
  useEffect(() => {
    if (externalDrawingMode !== drawingMode) {
      setDrawingMode(externalDrawingMode);
      // 현재 색상을 유지하면서 모드만 적용
      setTimeout(() => {
        applyDrawingMode(externalDrawingMode, drawingColor);
      }, 10);
    }
  }, [externalDrawingMode, drawingColor]); // drawingColor를 의존성으로 다시 추가

  // 외부에서 eraserSize가 변경될 때 반응
  useEffect(() => {
    if (externalEraserSize !== eraserSize) {
      setEraserSize(externalEraserSize);
    }
  }, [externalEraserSize]);

  // 외부에서 drawingColor가 변경될 때 반응
  useEffect(() => {
    console.log('외부 색상 변경:', externalDrawingColor, '현재 내부 색상:', drawingColor);
    if (externalDrawingColor !== drawingColor) {
      setDrawingColor(externalDrawingColor);
      updateBrushColor(externalDrawingColor);
    }
  }, [externalDrawingColor]);

  // 지우개 크기가 변경될 때 현재 모드에 따라 업데이트
  useEffect(() => {
    if (!fabricCanvas.current || !drawingMode) return;
    
    // erase 모드일 때만 크기 반영
    if (drawingMode === 'erase' || drawingMode === 'pixelErase') {
      applyDrawingMode(drawingMode);
    }
  }, [eraserSize]);

  // 브러시 색상 업데이트 함수
  const updateBrushColor = (color) => {
    if (!fabricCanvas.current) return;
    
    const canvas = fabricCanvas.current;
    
    console.log('updateBrushColor 호출됨:', color);
    
    // 현재 그리기 브러시가 있다면 색상 업데이트
    if (canvas.freeDrawingBrush) {
      console.log('브러시 색상 업데이트:', canvas.freeDrawingBrush.color, '->', color);
      canvas.freeDrawingBrush.color = color;
    } else {
      console.log('브러시가 없어서 색상 업데이트 불가');
    }
  };

  const applyDrawingMode = (mode, colorOverride = null) => {
    if (!fabricCanvas.current) return;
    
    const canvas = fabricCanvas.current;
    const currentColor = colorOverride || drawingColor;
    console.log('applyDrawingMode 호출:', mode, '사용할 색상:', currentColor);
    
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
      canvas.skipTargetFind = true; // 그리기 모드에서는 대상 찾기 건너뛰기
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
      canvas.moveCursor = 'crosshair';
      canvas.freeDrawingCursor = 'crosshair';
      
      const brush = new PencilBrush(canvas);
      brush.width = 2; // 원래 크기로 복원
      brush.color = currentColor; // 현재 색상 사용
      brush.decimate = 2; // 브러시 포인트 간소화
      brush.limitedToCanvasSize = true;
      canvas.freeDrawingBrush = brush;
      
      // 브러시 설정 후 한 번 더 색상 확인 및 설정
      console.log('Draw mode - 설정된 브러시 색상:', brush.color, '사용된 색상:', currentColor);
      
      // 기본 커서로 복구
      canvas.setCursor('crosshair');
      
    } else if (mode === 'brush') {
      canvas.isDrawingMode = false; // SVG 도트와 상호작용하기 위해 false로 설정
      canvas.selection = false;
      canvas.skipTargetFind = true; // 브러시 모드에서는 대상 찾기 건너뛰기
      
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
          fill: currentColor, // 현재 색상 사용
          selectable: false,
          evented: true,
          customType: 'drawnDot', // 그려진 도트로 구분
          originalFill: currentColor, // 원본 색상 정보 보존
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
      canvas.skipTargetFind = true; // 지우개 모드에서는 대상 찾기 건너뛰기
      
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
      
    } else if (mode === 'select') {
      // 선택 모드로 전환
      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.skipTargetFind = false; // 선택 모드에서는 대상 찾기 활성화
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
      canvas.moveCursor = 'move';
      
      // 모든 객체를 선택 가능하게 설정
      canvas.getObjects().forEach(obj => {
        if (obj.customType === 'droppedImage') {
          obj.selectable = true;
          obj.evented = true;
          obj.hasControls = true;
          obj.hasBorders = true;
        }
      });
      
      // 이전 핸들러들 정리
      Object.values(eraseHandlers.current).forEach(handler => {
        if (typeof handler === 'function') {
          canvas.off('mouse:down', handler);
          canvas.off('mouse:move', handler);
          canvas.off('mouse:up', handler);
          canvas.off('mouse:wheel', handler);
        }
      });
      eraseHandlers.current = {};
      
    } else if (mode === 'pixelErase') {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      canvas.skipTargetFind = true; // 픽셀 지우개 모드에서는 대상 찾기 건너뛰기

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

  // 드래그&드롭 이벤트 핸들러들
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const imageUrl = e.dataTransfer.getData("text/plain");
    if (imageUrl && fabricCanvas.current) {
      addImageToCanvas(imageUrl, e.clientX, e.clientY);
      
      // 이미지 드롭 후 선택 모드로 변경
      setDrawingMode('select');
      applyDrawingMode('select');
      if (onModeChange) {
        onModeChange('select');
      }
    }
  };

  // 캔버스에 이미지 추가하는 함수
  const addImageToCanvas = (imageUrl, clientX = null, clientY = null) => {
    if (!fabricCanvas.current) return;
    
    const canvas = fabricCanvas.current;
    
    FabricImage.fromURL(imageUrl, {
      crossOrigin: 'anonymous'
    }).then(img => {
      // 이미지 크기 조정 (최대 200px)
      const maxSize = 200;
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      
      // 드롭 위치 계산 (마우스 위치 또는 중앙)
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
        cornerStyle: 'circle',
        cornerColor: '#007bff',
        cornerSize: 12,
        transparentCorners: false,
        borderColor: '#007bff',
        customType: 'droppedImage', // 구분을 위한 커스텀 타입
        // 회전 컨트롤 활성화
        hasRotatingPoint: true,
        rotatingPointOffset: 30,
        // 균등 스케일링 옵션
        lockUniScaling: false,
        // 컨트롤 포인트 설정
        centeredScaling: false,
        centeredRotation: true
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    }).catch(err => {
      console.error('이미지 로드 실패:', err);
      alert('이미지를 로드할 수 없습니다.');
    });
  };

  // toggleSelectionMode는 이제 toggleDrawingMode로 대체됨

  // 전체 지우기 핸들러
  const handleClearAll = () => {
    if (!fabricCanvas.current) return;
    
    if (confirm('캔버스의 모든 내용을 지우시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      clearCanvas();
      console.log('캔버스 전체가 초기화되었습니다');
    }
  };


  // 현재 캔버스의 모든 객체를 색상별로 분석하여 SVG 생성
  const getCurrentCanvasAsSvg = () => {
    if (!fabricCanvas.current) return null;
    
    const canvas = fabricCanvas.current;
    const objects = canvas.getObjects();
    const dots = [];
    const pathObjects = [];
    
    console.log('getCurrentCanvasAsSvg - 총 객체 수:', objects.length);
    
    objects.forEach((obj, index) => {
      console.log(`객체 ${index}: type=${obj.type}, customType=${obj.customType}, fill=${obj.fill}, stroke=${obj.stroke}`);
      
      if (obj.customType === 'svgDot' || obj.customType === 'drawnDot') {
        // 도트의 중심점 계산
        const centerX = obj.left + obj.radius;
        const centerY = obj.top + obj.radius;
        // 실제 객체의 fill 색상을 우선 사용, 없으면 originalFill, 그것도 없으면 현재 그리기 색상
        const dotColor = obj.fill || obj.originalFill || drawingColor;
        
        dots.push({
          cx: centerX,
          cy: centerY,
          r: obj.radius,
          fill: dotColor, // hexToRgb 변환 제거하여 원본 색상 형태 유지
          originalColor: dotColor
        });
      } else if (obj.type === 'path') {
        // 펜으로 그린 패스의 경우
        const pathColor = obj.stroke || drawingColor;
        console.log(`패스 객체 색상: ${pathColor}`);
        
        pathObjects.push({
          type: 'path',
          fill: pathColor, // hexToRgb 변환 제거하여 원본 색상 형태 유지
          originalColor: pathColor,
          obj: obj
        });
      }
    });
    
    console.log('도트 개수:', dots.length, '패스 개수:', pathObjects.length);
    
    // SVG 문자열 생성 (모든 객체의 실제 색상 사용)
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">`;
    
    // 도트들 추가
    dots.forEach(dot => {
      svgContent += `<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${dot.fill}" />`;
    });
    
    // 패스들은 실제 변환에서 처리될 수 있도록 정보만 포함
    svgContent += '</svg>';
    
    return {
      svgString: svgContent,
      totalDots: dots.length,
      totalPaths: pathObjects.length,
      dots: dots, // 개별 색상이 적용된 도트 배열
      paths: pathObjects, // 패스 객체들의 색상 정보
      hasMultipleColors: new Set([...dots.map(d => d.originalColor), ...pathObjects.map(p => p.originalColor)]).size > 1
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
    
    // 변환 가능한 모든 콘텐츠 확인
    return objects.some(obj => 
      obj.type === 'path' ||                    // 펜으로 그린 선
      obj.customType === 'drawnDot' ||         // 브러시 도트
      obj.customType === 'droppedImage' ||     // 드래그&드롭 이미지
      obj.customType === 'svgDot' ||           // SVG 도트들
      obj.type === 'image'                     // 배경 이미지
    );
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

  // 원본 캔버스 상태 저장 및 복원 기능
  const saveOriginalCanvasState = () => {
    if (!fabricCanvas.current) return null;
    
    const canvas = fabricCanvas.current;
    const state = {
      objects: canvas.toJSON(),
      timestamp: Date.now()
    };
    
    console.log("원본 캔버스 상태 저장:", state);
    return state;
  };

  const restoreOriginalCanvasState = (state) => {
    if (!fabricCanvas.current || !state) return false;
    
    const canvas = fabricCanvas.current;
    
    // 현재 캔버스 초기화
    canvas.clear();
    canvas.backgroundColor = '#fafafa';
    
    // 저장된 상태에서 복원
    canvas.loadFromJSON(state.objects, () => {
      canvas.renderAll();
      console.log("원본 캔버스 상태 복원 완료");
    });
    
    return true;
  };

  // 외부에서 사용할 수 있도록 ref에 함수 등록
  useEffect(() => {
    if (externalStageRef && externalStageRef.current) {
      externalStageRef.current.getCurrentCanvasAsSvg = getCurrentCanvasAsSvg;
      externalStageRef.current.exportCanvasAsImage = exportCanvasAsImage;
      externalStageRef.current.exportDrawnLinesOnly = exportDrawnLinesOnly;
      externalStageRef.current.hasDrawnContent = hasDrawnContent;
      externalStageRef.current.clear = clearCanvas;
      externalStageRef.current.applyDrawingMode = (mode, color) => {
        // 색상 정보를 명시적으로 전달받아 사용
        const currentColor = color || externalDrawingColor;
        console.log('applyDrawingMode with color:', mode, currentColor);
        applyDrawingMode(mode, currentColor);
      };
      externalStageRef.current.setDrawingMode = (mode) => {
        setDrawingMode(mode);
        // 현재 색상을 명시적으로 전달
        setTimeout(() => {
          externalStageRef.current.applyDrawingMode(mode, drawingColor);
        }, 10);
      };
      externalStageRef.current.setDrawingColor = (color) => {
        setDrawingColor(color);
        updateBrushColor(color);
      };
      // 원본 상태 관리 함수 추가
      externalStageRef.current.saveOriginalCanvasState = saveOriginalCanvasState;
      externalStageRef.current.restoreOriginalCanvasState = restoreOriginalCanvasState;
    }
  }, [externalStageRef]); // drawingColor는 의존성에서 제거하여 무한 루프 방지

  return (
      <div 
        style={{ 
          position: 'relative',
          display: 'inline-block',
          border: isDragOver ? '3px dashed #007bff' : 'none',
          backgroundColor: isDragOver ? 'rgba(0, 123, 255, 0.1)' : 'transparent',
          transition: 'all 0.2s ease'
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <canvas ref={canvasRef} />
        {isDragOver && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 123, 255, 0.9)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            pointerEvents: 'none',
            zIndex: 1000
          }}>
            이미지를 여기에 놓으세요
          </div>
        )}
      </div>
  );
}