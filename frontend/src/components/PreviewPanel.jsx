import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/PreviewPanel.css';

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
  // 캔버스 현재 상태를 미리보기로 사용
  const generatePreview = useCallback(() => {
    if (!enabled || !stageRef.current || isGeneratingPreview || processing) {
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
      // 캔버스 현재 상태를 이미지로 변환
      const canvasImage = stageRef.current.exportCanvasAsImage();
      
      if (canvasImage) {
        setPreviewImage(canvasImage);
        setCanConfirm(true);
      } else {
        setError('미리보기 생성에 실패했습니다.');
        setCanConfirm(false);
      }
    } catch (err) {
      console.error('Preview generation error:', err);
      setError('미리보기 생성 중 오류가 발생했습니다.');
      setCanConfirm(false);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [enabled, stageRef, isGeneratingPreview, processing]);

  // 디바운스된 미리보기 생성
  const debouncedGeneratePreview = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(generatePreview, 500); // 0.5초 지연 (더 빠른 반응)
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

  // 컴포넌트가 마운트될 때 또는 씬/레이어가 변경될 때 초기 미리보기 생성
  useEffect(() => {
    if (enabled && stageRef.current && sceneId) {
      debouncedGeneratePreview();
    }
  }, [enabled, stageRef, sceneId, layersState, debouncedGeneratePreview]);

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