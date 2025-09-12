import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/PreviewPanel.css';
import client from '../api/client';
import { getImageUrl } from '../utils/imageUtils';

const PreviewPanel = React.forwardRef(({
  projectId,
  sceneId,
  stageRef,
  targetDots,
  drawingColor,
  onTransformComplete,
  processing = false,
  enabled = true,
  layersState = []
}, ref) => {
  const [previewImage, setPreviewImage] = useState(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [canConfirm, setCanConfirm] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const debounceTimerRef = useRef(null);
  // 고품질 클라이언트 미리보기 생성 (서버 로직 기반)
  const generatePreview = useCallback(async () => {
    if (!enabled || !stageRef.current || isGeneratingPreview || processing || !projectId || !sceneId) {
      return;
    }

    // 캔버스가 완전히 준비되었는지 추가 확인
    if (!stageRef.current.exportCanvasAsImage || typeof stageRef.current.exportCanvasAsImage !== 'function') {
      console.log('미리보기 취소: 캔버스 API가 아직 준비되지 않음');
      return;
    }

    // 캔버스에 변환 가능한 내용이 있는지 확인
    const hasContent = stageRef.current.hasDrawnContent && stageRef.current.hasDrawnContent();
    if (!hasContent) {
      console.log('미리보기 취소: 캔버스에 변환 가능한 내용이 없음');
      setPreviewImage(null);
      setCanConfirm(false);
      setError(null);
      return;
    }

    setIsGeneratingPreview(true);
    setError(null);

    // UI 업데이트를 위한 짧은 지연
    await new Promise(resolve => setTimeout(resolve, 10));

    try {
      console.log('고품질 클라이언트 미리보기 생성 시작');
      
      // 캔버스에서 현재 이미지 데이터 가져오기
      const canvasImage = stageRef.current.exportCanvasAsImage();
      
      const previewResult = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            // 1. 이미지를 Canvas로 변환
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);
            
            // 2. 이미지 데이터 얻기
            const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
            const pixels = imageData.data;
            
            // 3. Grayscale 변환
            const grayPixels = new Uint8ClampedArray(img.width * img.height);
            for (let i = 0; i < pixels.length; i += 4) {
              const r = pixels[i];
              const g = pixels[i + 1];
              const b = pixels[i + 2];
              const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
              grayPixels[i / 4] = gray;
            }
            
            // 4. 가우시안 블러 적용 (간단한 5x5 커널)
            const blurred = applyGaussianBlur(grayPixels, img.width, img.height, 5);
            
            // 5. Canny 엣지 검출 (간단한 Sobel 기반)
            const edges = applySobelEdgeDetection(blurred, img.width, img.height, 80, 200);
            
            // 6. 모폴로지 클로징 (끊어진 선 연결)
            const closed = applyMorphologyClose(edges, img.width, img.height);
            
            // 7. Step 계산 (서버 로직과 동일)
            const edgePixelCount = closed.reduce((count, val) => count + (val > 0 ? 1 : 0), 0);
            let step = 3; // 기본값
            if (targetDots && targetDots > 0 && edgePixelCount > 0) {
              const est = Math.round(Math.sqrt(edgePixelCount / Math.max(targetDots, 1)));
              step = Math.max(1, Math.min(est, 64));
            }
            
            // 8. 그리드 샘플링으로 점 수집
            const points = [];
            for (let y = 0; y < img.height; y += step) {
              for (let x = 0; x < img.width; x += step) {
                const idx = y * img.width + x;
                if (closed[idx] > 0) {
                  points.push({ x, y });
                }
              }
            }
            
            // 9. 목표 개수보다 많으면 랜덤 샘플링
            let finalPoints = points;
            if (targetDots && points.length > targetDots) {
              finalPoints = [];
              const indices = Array.from({ length: points.length }, (_, i) => i);
              // Fisher-Yates shuffle
              for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
              }
              for (let i = 0; i < targetDots; i++) {
                finalPoints.push(points[indices[i]]);
              }
            }
            
            // 10. 최소 거리 유지 (간단한 버전)
            const filteredPoints = enforceMinDistance(finalPoints, 4); // 반지름 2의 2배
            
            // 11. 미리보기 캔버스에 렌더링
            const previewCanvas = document.createElement('canvas');
            const previewCtx = previewCanvas.getContext('2d');
            previewCanvas.width = img.width;
            previewCanvas.height = img.height;
            
            // 배경 채우기
            previewCtx.fillStyle = '#ffffff';
            previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
            
            // 12. 원본 색상 분석 및 점 그리기
            filteredPoints.forEach(point => {
              const { x, y } = point;
              if (x < img.width && y < img.height) {
                const pixelIndex = (y * img.width + x) * 4;
                let r = pixels[pixelIndex];
                let g = pixels[pixelIndex + 1];
                let b = pixels[pixelIndex + 2];
                
                // 펜 스트로크 영역 확인 및 색상 보정
                if (isPenStrokeArea(pixels, img.width, img.height, x, y)) {
                  // 노란색 계열 보정
                  if (isYellowLike(r, g, b)) {
                    r = Math.min(255, Math.floor(r * 1.2));
                    g = Math.min(255, Math.floor(g * 1.2));
                    b = Math.max(0, Math.floor(b * 0.8));
                  }
                }
                
                const fillColor = `rgb(${r}, ${g}, ${b})`;
                previewCtx.fillStyle = fillColor;
                previewCtx.beginPath();
                previewCtx.arc(x, y, 2, 0, 2 * Math.PI);
                previewCtx.fill();
              }
            });
            
            const previewUrl = previewCanvas.toDataURL();
            console.log(`고품질 미리보기 생성 완료: ${filteredPoints.length}개 점 (목표: ${targetDots})`);
            resolve(previewUrl);
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = () => reject(new Error('이미지 로드 실패'));
        img.src = canvasImage;
      });
      
      setPreviewImage(previewResult);
      setCanConfirm(true);
      
    } catch (err) {
      console.error('Preview generation error:', err);
      setError(`미리보기 생성 실패: ${err.message}`);
      setCanConfirm(false);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [enabled, stageRef, processing, projectId, sceneId, targetDots, drawingColor]);

  // 헬퍼 함수들 (서버 로직 기반)
  const applyGaussianBlur = (pixels, width, height, kernelSize) => {
    const result = new Uint8ClampedArray(pixels.length);
    const radius = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              sum += pixels[ny * width + nx];
              count++;
            }
          }
        }
        
        result[y * width + x] = Math.round(sum / count);
      }
    }
    
    return result;
  };

  const applySobelEdgeDetection = (pixels, width, height, lowThreshold, highThreshold) => {
    const result = new Uint8ClampedArray(pixels.length);
    
    // Sobel 커널
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const pixel = pixels[(y + dy) * width + (x + dx)];
            gx += pixel * sobelX[dy + 1][dx + 1];
            gy += pixel * sobelY[dy + 1][dx + 1];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        result[y * width + x] = magnitude > highThreshold ? 255 : (magnitude > lowThreshold ? 128 : 0);
      }
    }
    
    return result;
  };

  const applyMorphologyClose = (pixels, width, height) => {
    const result = new Uint8ClampedArray(pixels.length);
    const kernel = [[1, 1], [1, 1]]; // 2x2 커널
    
    // 단순한 클로징 (팽창 후 침식)
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        let maxVal = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            if (y + dy < height && x + dx < width) {
              maxVal = Math.max(maxVal, pixels[(y + dy) * width + (x + dx)]);
            }
          }
        }
        result[y * width + x] = maxVal;
      }
    }
    
    return result;
  };

  const enforceMinDistance = (points, minDist) => {
    if (!points || points.length === 0 || minDist <= 1) return points;
    
    const result = [];
    const minDistSq = minDist * minDist;
    
    for (const point of points) {
      let tooClose = false;
      for (const existing of result) {
        const dx = existing.x - point.x;
        const dy = existing.y - point.y;
        if (dx * dx + dy * dy < minDistSq) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        result.push(point);
      }
    }
    
    return result;
  };

  const isPenStrokeArea = (pixels, width, height, x, y, radius = 3) => {
    if (y < radius || x < radius || y >= height - radius || x >= width - radius) {
      return false;
    }
    
    const colors = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const idx = ((y + dy) * width + (x + dx)) * 4;
        colors.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
      }
    }
    
    // 색상 분산 계산
    const avgR = colors.reduce((sum, c) => sum + c[0], 0) / colors.length;
    const avgG = colors.reduce((sum, c) => sum + c[1], 0) / colors.length;
    const avgB = colors.reduce((sum, c) => sum + c[2], 0) / colors.length;
    
    const variance = colors.reduce((sum, c) => {
      return sum + Math.pow(c[0] - avgR, 2) + Math.pow(c[1] - avgG, 2) + Math.pow(c[2] - avgB, 2);
    }, 0) / colors.length;
    
    return Math.sqrt(variance) < 15; // 표준편차 15 이하면 균일한 영역
  };

  const isYellowLike = (r, g, b) => {
    // HSV 변환 (간단한 버전)
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let hue = 0;
    if (diff !== 0) {
      if (max === r) hue = ((g - b) / diff) % 6;
      else if (max === g) hue = (b - r) / diff + 2;
      else hue = (r - g) / diff + 4;
    }
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
    
    const saturation = max === 0 ? 0 : (diff / max) * 100;
    const value = (max / 255) * 100;
    
    return (hue >= 45 && hue <= 75) && saturation > 20 && value > 40; // 노란색 범위
  };

  // 디바운스된 미리보기 생성
  const debouncedGeneratePreview = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(generatePreview, 700); // 0.7초 지연
  }, [generatePreview]);

  // sceneId 변경 시 미리보기 상태 초기화 후 새로 생성
  useEffect(() => {
    console.log('씬 변경됨, 미리보기 상태 초기화:', sceneId);
    setPreviewImage(null);
    setCanConfirm(false);
    setError(null);
    setIsGeneratingPreview(false);
    
    // 디바운스 타이머 초기화 후 새 씬의 미리보기 생성
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // 씬 전환 후 새로운 미리보기 생성
    if (enabled && stageRef.current && sceneId) {
      debouncedGeneratePreview();
    }
  }, [sceneId, enabled, debouncedGeneratePreview]);

  // 레이어 변경 시 미리보기 트리거
  useEffect(() => {
    if (enabled && stageRef.current && sceneId && layersState.length > 0) {
      debouncedGeneratePreview();
    }
  }, [layersState, enabled, sceneId, debouncedGeneratePreview]); // 레이어 상태 변경시 트리거

  // 외부에서 호출할 수 있는 함수 (캔버스 변경 시 사용)
  const triggerPreview = useCallback(() => {
    debouncedGeneratePreview();
  }, [debouncedGeneratePreview]);

  // 미리보기 확정 (실제 변환 실행)
  const confirmPreview = async () => {
    if (!canConfirm || isConfirming || processing) return;

    setIsConfirming(true);
    try {
      // 기존 변환 로직과 동일하게 실행
      if (onTransformComplete) {
        await onTransformComplete();
      }
    } catch (err) {
      console.error('Transform confirmation error:', err);
      setError('변환 확정 중 오류가 발생했습니다.');
    } finally {
      setIsConfirming(false);
    }
  };

  // 컴포넌트 초기 마운트 시 미리보기 생성
  useEffect(() => {
    if (enabled && stageRef.current && sceneId) {
      // 캔버스가 완전히 로드되기 전까지 지연
      const timer = setTimeout(() => {
        // 캔버스가 준비되었는지 다시 한번 확인
        if (stageRef.current && stageRef.current.hasDrawnContent) {
          const hasContent = stageRef.current.hasDrawnContent();
          if (hasContent) {
            debouncedGeneratePreview();
          } else {
            // 내용이 없으면 미리보기 상태 초기화
            setPreviewImage(null);
            setCanConfirm(false);
            setError(null);
          }
        }
      }, 100); // 캔버스 로딩 대기

      return () => clearTimeout(timer);
    }
  }, [enabled, sceneId, debouncedGeneratePreview]);

  // 클린업
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // imperative handle로 triggerPreview 함수 외부 노출
  React.useImperativeHandle(ref, () => ({
    triggerPreview
  }));

  if (!enabled) {
    return null;
  }

  return (
    <div className="preview-panel">
      <div className="preview-panel-header">
        <h3>변환 미리보기</h3>
        <div className="preview-status">
          {isGeneratingPreview && <span className="status-loading">생성 중...</span>}
          {error && <span className="status-error">오류</span>}
          {previewImage && !isGeneratingPreview && !error && <span className="status-ready">준비됨</span>}
        </div>
      </div>

      <div className="preview-panel-body">
        {isGeneratingPreview && (
          <div className="preview-loading">
            <div className="loading-spinner"></div>
            <p>미리보기 생성 중...</p>
          </div>
        )}

        {error && (
          <div className="preview-error">
            <p>{error}</p>
            <button 
              type="button" 
              className="retry-btn"
              onClick={debouncedGeneratePreview}
              disabled={isGeneratingPreview}
            >
              다시 시도
            </button>
          </div>
        )}

        {previewImage && !isGeneratingPreview && !error && (
          <div className="preview-content">
            <div className="preview-image-container" onClick={() => setIsModalOpen(true)}>
              <img 
                src={previewImage} 
                alt="변환 미리보기" 
                className="preview-image clickable"
                onError={() => setError('미리보기 이미지를 불러올 수 없습니다.')}
              />
            </div>
          </div>
        )}

        {!previewImage && !isGeneratingPreview && !error && (
          <div className="preview-empty">
            <p>캔버스에 내용을 추가하면<br/>변환 미리보기가 표시됩니다</p>
          </div>
        )}
      </div>

      <div className="preview-panel-footer">
        <button
          type="button"
          className="confirm-btn"
          onClick={confirmPreview}
          disabled={!canConfirm || isConfirming || processing || isGeneratingPreview}
        >
          {isConfirming ? '변환 중...' : '확정'}
        </button>
      </div>

      {/* 미리보기 모달 */}
      {isModalOpen && previewImage && (
        <div className="preview-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="preview-modal-close"
              onClick={() => setIsModalOpen(false)}
            >
              ×
            </button>
            <img 
              src={previewImage} 
              alt="변환 미리보기 (크게 보기)" 
              className="preview-modal-image"
            />
          </div>
        </div>
      )}
    </div>
  );
});

export default PreviewPanel;