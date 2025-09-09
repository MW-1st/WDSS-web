import { useState, useRef, useCallback, useEffect } from 'react';
import { saveCanvasToIndexedDB, loadCanvasFromIndexedDB } from '../utils/indexedDBUtils';

export const useAutoSave = (sceneId, fabricCanvas, options = {}) => {
  const {
    enabled = true,
    delay = 1500,
    onSave = null,
    onError = null,
    includeMetadata = true
  } = options;

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(enabled);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const timeoutRef = useRef(null);

  // 자동저장 트리거
  const triggerAutoSave = useCallback(async (metadata = {}) => {
    if (!autoSaveEnabled || !sceneId || !fabricCanvas?.current) {
      return false;
    }

    // 기존 타이머 클리어
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 지연 후 저장
    timeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      setSaveError(null);

      try {
        const canvas = fabricCanvas.current;
        const canvasData = canvas.toJSON([
          'layerId', 'layerName', 'customType', 'originalFill',
          'originalCx', 'originalCy'
        ]);


        const allObjects = canvas.getObjects();

        // 실제 그린 객체만 카운트 (경계선 제외)
        const drawnObjects = allObjects.filter(obj =>
          obj.name !== 'canvasBoundary' &&
          obj.excludeFromExport !== true
        );

        const actualObjectCount = drawnObjects.length;

        const saveMetadata = includeMetadata ? {
          objectCount: canvas.getObjects().length,
          canvasSize: {
            width: canvas.getWidth(),
            height: canvas.getHeight()
          },
          ...metadata
        } : metadata;

        await saveCanvasToIndexedDB(sceneId, canvasData, saveMetadata);

        setLastSaveTime(new Date());

        if (onSave) {
          onSave({ sceneId, objectCount: actualObjectCount });
        }

        return true;
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveError(error.message);

        if (onError) {
          onError(error);
        }

        return false;
      } finally {
        setIsSaving(false);
      }
    }, delay);

    return true;
  }, [autoSaveEnabled, sceneId, fabricCanvas, delay, onSave, onError, includeMetadata]);

  // 즉시 저장 (딜레이 없음)
  const saveImmediately = useCallback(async (metadata = {}) => {
    if (!sceneId || !fabricCanvas?.current) {
      return false;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const canvas = fabricCanvas.current;
      const canvasData = canvas.toJSON([
        'layerId', 'layerName', 'customType', 'originalFill',
        'originalCx', 'originalCy'
      ]);

      const allObjects = canvas.getObjects();

      // 실제 그린 객체만 카운트 (경계선 제외)
      const drawnObjects = allObjects.filter(obj =>
        obj.name !== 'canvasBoundary' &&
        obj.excludeFromExport !== true
      );

      const actualObjectCount = drawnObjects.length;

      const saveMetadata = {
        objectCount: actualObjectCount,
        canvasSize: {
          width: canvas.getWidth(),
          height: canvas.getHeight()
        },
        manualSave: true,
        ...metadata
      };

      await saveCanvasToIndexedDB(sceneId, canvasData, saveMetadata);
      setLastSaveTime(new Date());

      if (onSave) {
        onSave({ sceneId, objectCount: actualObjectCount, manual: true });
      }

      return true;
    } catch (error) {
      console.error('Manual save failed:', error);
      setSaveError(error.message);

      if (onError) {
        onError(error);
      }

      return false;
    } finally {
      setIsSaving(false);
    }
  }, [sceneId, fabricCanvas, onSave, onError]);

  // 저장된 상태 로드
  const loadSavedState = useCallback(async (targetSceneId = sceneId) => {
    if (!targetSceneId || !fabricCanvas?.current) {
      return false;
    }

    try {
      const savedState = await loadCanvasFromIndexedDB(targetSceneId);

      if (savedState) {
        const canvas = fabricCanvas.current;

        return new Promise((resolve) => {
          canvas.loadFromJSON(savedState, () => {
            canvas.renderAll();
            console.log(`Canvas state loaded for scene: ${targetSceneId}`);
            resolve(true);
          });
        });
      }

      return false;
    } catch (error) {
      console.error('Failed to load saved state:', error);
      setSaveError(error.message);
      return false;
    }
  }, [sceneId, fabricCanvas]);

  // 자동저장 활성화/비활성화
  const setEnabled = useCallback((enabled) => {
    setAutoSaveEnabled(enabled);

    if (!enabled && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    console.log(`Auto-save ${enabled ? 'enabled' : 'disabled'} for scene: ${sceneId}`);
  }, [sceneId]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    // 상태
    isAutoSaveEnabled: autoSaveEnabled,
    isSaving,
    lastSaveTime,
    saveError,

    // 함수
    triggerAutoSave,
    saveImmediately,
    loadSavedState,
    setEnabled,

    // 편의 함수들
    clearError: () => setSaveError(null),
    getStatus: () => ({
      enabled: autoSaveEnabled,
      saving: isSaving,
      lastSave: lastSaveTime,
      error: saveError
    })
  };
};

export default useAutoSave;