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
  // 실제 변환 결과를 미리보기로 생성 (서버 API 호출)
  const generatePreview = useCallback(async () => {
    if (!enabled || !stageRef.current || isGeneratingPreview || processing || !projectId || !sceneId) {
      return;
    }

    // 캔버스에 변환 가능한 내용이 있는지 확인
    const hasContent = stageRef.current.hasDrawnContent && stageRef.current.hasDrawnContent();
    if (!hasContent) {
      setPreviewImage(null);
      setCanConfirm(false);
      setError(null);
      return;
    }

    setIsGeneratingPreview(true);
    setError(null);

    try {
      console.log('미리보기를 위한 변환 API 호출');
      
      // 1. 현재 씬 정보 가져오기
      const sceneResp = await client.get(`/projects/${projectId}/scenes/${sceneId}`);
      const sceneData = sceneResp.data;
      const s3Key = sceneData.s3_key;

      // 2. 변환 요청 (기존 handleTransform 로직과 동일)
      const needsOriginalFile = !s3Key || s3Key.startsWith('originals');
      let previewResp;

      if (needsOriginalFile) {
        // 캔버스를 이미지로 변환하여 서버로 전송
        const canvasImage = stageRef.current.exportCanvasAsImage();
        const blob = await new Promise(resolve => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            canvas.toBlob(resolve, 'image/png');
          };
          img.src = canvasImage;
        });
        const file = new File([blob], "canvas_preview.png", {type: "image/png"});
        const fd = new FormData();
        fd.append("image", file);

        previewResp = await client.post(
          `/projects/${projectId}/scenes/${sceneId}/processed?target_dots=${targetDots}`,
          fd
        );
      } else {
        // 기존 원본을 사용하여 재변환
        const hexToRgb = (hex) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          } : { r: 0, g: 0, b: 0 };
        };
        
        const rgbColor = hexToRgb(drawingColor);
        previewResp = await client.post(
          `/projects/${projectId}/scenes/${sceneId}/processed?target_dots=${targetDots}`,
          {
            color_r: rgbColor.r,
            color_g: rgbColor.g,
            color_b: rgbColor.b,
          }
        );
      }

      // 3. 변환된 결과를 미리보기로 렌더링
      const processedUrl = getImageUrl(previewResp.data.output_url);
      
      if (processedUrl) {
        // JSON 데이터를 fetch해서 점들을 캔버스에 렌더링
        const jsonResp = await fetch(processedUrl);
        const fabricJson = await jsonResp.json();
        
        // 임시 캔버스에 렌더링
        const previewCanvas = document.createElement('canvas');
        const previewCtx = previewCanvas.getContext('2d');
        
        previewCanvas.width = fabricJson.width || 800;
        previewCanvas.height = fabricJson.height || 600;
        
        // 배경 채우기
        previewCtx.fillStyle = '#ffffff';
        previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
        
        // 점들 그리기
        fabricJson.objects.forEach(obj => {
          if (obj.type === 'circle') {
            previewCtx.fillStyle = obj.fill || '#000000';
            previewCtx.beginPath();
            previewCtx.arc(obj.left, obj.top, obj.radius || 2, 0, 2 * Math.PI);
            previewCtx.fill();
          }
        });
        
        const previewUrl = previewCanvas.toDataURL();
        setPreviewImage(previewUrl);
        setCanConfirm(true);
        
        console.log(`미리보기 생성 완료: ${fabricJson.objects.length}개 점`);
      } else {
        setError('미리보기 생성에 실패했습니다.');
        setCanConfirm(false);
      }
      
    } catch (err) {
      console.error('Preview generation error:', err);
      const errorMsg = err.response?.data?.detail || err.message;
      setError(`미리보기 생성 실패: ${errorMsg}`);
      setCanConfirm(false);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [enabled, stageRef, isGeneratingPreview, processing, projectId, sceneId, targetDots, drawingColor]);

  // 레이어 변경 시에만 별도 미리보기 트리거
  useEffect(() => {
    if (enabled && stageRef.current && sceneId && layersState.length > 0) {
      debouncedGeneratePreview();
    }
  }, [layersState]); // 레이어 상태 변경시 트리거 (내용, 활성 레이어 등)

  // 디바운스된 미리보기 생성
  const debouncedGeneratePreview = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(generatePreview, 700); // 0.7초 지연
  }, [generatePreview]);

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

  // 컴포넌트가 마운트될 때 또는 씬이 변경될 때만 초기 미리보기 생성
  useEffect(() => {
    if (enabled && stageRef.current && sceneId) {
      debouncedGeneratePreview();
    }
  }, [enabled, sceneId]); // layersState와 debouncedGeneratePreview 제거로 과도한 재실행 방지

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