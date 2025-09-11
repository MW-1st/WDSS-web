import { useState, useRef, useCallback, useEffect } from 'react';
import { saveCanvasToIndexedDB, loadCanvasFromIndexedDB } from '../utils/indexedDBUtils';
import { useServerSync } from './useServerSync';
import client from "../api/client.js";

export const useAutoSave = (projectId, sceneId, fabricCanvas, options = {}, sceneData) => {
  const {
    enabled = true,
    delay = 1500,
    onSave = null,
    onError = null,
    includeMetadata = true,
    serverSync = true,
    serverSyncInterval = 150000,
    onServerSync = null,
    onServerSyncError = null
  } = options;

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(enabled);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveMode, setSaveMode] = useState('originals'); // 'originals' 또는 'processed'


  const timeoutRef = useRef(null);

  const {
    syncToServer,
    isServerSyncEnabled,
    isSyncing: isServerSyncing,
    lastSyncTime: lastServerSyncTime,
    syncError: serverSyncError,
    setEnabled: setServerSyncEnabled
  } = useServerSync(projectId, sceneId, fabricCanvas, {});

  // 서버 동기화를 위한 타이머 ref 추가
  const serverSyncTimerRef = useRef(null);

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

        // 서버 동기화 스케줄링 추가
        if (isServerSyncEnabled && !isServerSyncing) {
          scheduleServerSync(canvasData);
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

  const changeSaveMode = useCallback((newMode) => {
    console.log('🔄 Changing save mode from', saveMode, 'to', newMode);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      console.log('⏹️ Cancelled pending auto-save');
    }
    if (serverSyncTimerRef.current) {
      clearTimeout(serverSyncTimerRef.current);
      serverSyncTimerRef.current = null;
      console.log('⏹️ Cancelled pending server sync');
    }

    setSaveMode(newMode);
    console.log('✅ Save mode changed to:', newMode);
  }, [saveMode]);

  // 서버 동기화 스케줄링 함수 추가
  const scheduleServerSync = useCallback((canvasData) => {
    console.log('⏰ Scheduling server sync with mode:', saveMode);

    if (serverSyncTimerRef.current) {
      clearTimeout(serverSyncTimerRef.current);
    }

    serverSyncTimerRef.current = setTimeout(async () => {
      try {
        console.log('🚀 Executing scheduled sync with mode:', saveMode);
        await syncToServer(canvasData, saveMode);
        console.log('✅ Scheduled server sync completed with mode:', saveMode);
      } catch (error) {
        console.error('❌ Scheduled server sync failed:', error);
      }
    }, serverSyncInterval);
  }, [syncToServer, serverSyncInterval, saveMode]);

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
      if (serverSyncTimerRef.current) {
        clearTimeout(serverSyncTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const determineInitialSaveMode = async () => {
      console.log('🔍 Determining save mode for sceneId:', sceneId);

      if (!sceneId || !projectId) return;

      try {
        // sceneData가 있으면 추가 요청 없이 사용
        let s3Key;
        if (sceneData && sceneData.s3_key !== undefined) {
          s3Key = sceneData.s3_key;
          console.log('📝 Using provided scene s3_key:', s3Key);
        } else {
          // sceneData가 없을 때만 서버 요청
          const response = await client.get(`/projects/${projectId}/scenes/${sceneId}`);
          s3Key = response.data?.scene?.s3_key;
          console.log('📝 Fetched scene s3_key:', s3Key);
        }

        if (!s3Key || s3Key.startsWith('originals')) {
          setSaveMode('originals');
          console.log('✅ Save mode set to: originals');
        } else if (s3Key.startsWith('processed')) {
          setSaveMode('processed');
          console.log('✅ Save mode set to: processed');
        }
      } catch (error) {
        console.warn('❌ Failed to determine save mode:', error);
        setSaveMode('originals');
      }
    };

    determineInitialSaveMode();
  }, [sceneId, projectId, sceneData?.s3_key]);

  
  return {
    // 상태
    isAutoSaveEnabled: autoSaveEnabled,
    isSaving,
    lastSaveTime,
    saveError,
    saveMode,

    // 함수
    triggerAutoSave,
    saveImmediately,
    loadSavedState,
    setEnabled,
    changeSaveMode,

    // 편의 함수들
    clearError: () => setSaveError(null),
    getStatus: () => ({
      enabled: autoSaveEnabled,
      saving: isSaving,
      lastSave: lastSaveTime,
      error: saveError
    }),

    // 서버 동기화 관련
    isServerSyncing,
    lastServerSyncTime,
    serverSyncError,
    setServerSyncEnabled,

    syncToServerNow: () => {
      const canvas = fabricCanvas?.current;
      if (canvas) {
        const canvasData = canvas.toJSON([
          'layerId', 'layerName', 'customType', 'originalFill',
          'originalCx', 'originalCy'
        ]);
        return syncToServer(canvasData, saveMode);
      }
      return Promise.resolve(false);
    }
  };
};

export default useAutoSave;