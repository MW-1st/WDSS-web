import { useState, useRef, useCallback, useEffect } from 'react';
import client from '../api/client'; // axios 클라이언트 import

export const useServerSync = (projectId, sceneId, fabricCanvas, options = {}) => {
  const {
    enabled = true,
    syncInterval = 30000, // 30초마다 동기화
    onSync = null,
    onError = null
  } = options;

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [serverSyncEnabled, setServerSyncEnabled] = useState(enabled);

  const syncIntervalRef = useRef(null);
  const pendingSyncRef = useRef(false);

  // 서버에 원본 캔버스 저장
  const saveOriginalToServer = useCallback(async (canvasData) => {
    if (!projectId || !sceneId) {
      throw new Error('Project ID and Scene ID are required');
    }

    try {
      const response = await client.put(`/projects/${projectId}/scenes/${sceneId}/originals`, canvasData);

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      throw new Error(errorMessage);
    }
  }, [projectId, sceneId]);

  // 서버에서 원본 캔버스 로드 (mount를 통해 직접 파일 접근)
  const loadOriginalFromServer = useCallback(async () => {
    if (!projectId || !sceneId) {
      throw new Error('Project ID and Scene ID are required');
    }

    try {
      // mount된 static 파일로 직접 접근
      const response = await fetch(`/originals/${sceneId}.json`);

      if (!response.ok) {
        if (response.status === 404) {
          return null; // 캔버스가 없는 경우
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // 메타데이터가 있는 형태인지 확인
      if (data.canvas_data && data.metadata) {
        return data.canvas_data;
      } else {
        // 메타데이터 없이 바로 캔버스 데이터인 경우
        return data;
      }
    } catch (error) {
      if (error.message.includes('404')) {
        return null; // 캔버스가 없는 경우
      }
      throw new Error(`Failed to load original canvas: ${error.message}`);
    }
  }, [projectId, sceneId]);

  // 서버에 도트 캔버스 저장
  const saveDotCanvasToServer = useCallback(async (dotCanvasData) => {
    if (!projectId || !sceneId) {
      throw new Error('Project ID and Scene ID are required');
    }

    try {
      const response = await client.put(`/projects/${projectId}/scenes/${sceneId}/processed`, dotCanvasData);

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      throw new Error(errorMessage);
    }
  }, [projectId, sceneId]);

  // 서버에서 도트 캔버스 로드 (mount를 통해 직접 파일 접근)
  const loadDotCanvasFromServer = useCallback(async () => {
    if (!projectId || !sceneId) {
      throw new Error('Project ID and Scene ID are required');
    }

    try {
      // mount된 static 파일로 직접 접근
      const response = await fetch(`/processed/${sceneId}.json`);

      if (!response.ok) {
        if (response.status === 404) {
          return null; // 도트 캔버스가 없는 경우
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // 메타데이터가 있는 형태인지 확인
      if (data.canvas_data && data.metadata) {
        return data.canvas_data;
      } else {
        // 메타데이터 없이 바로 캔버스 데이터인 경우
        return data;
      }
    } catch (error) {
      if (error.message.includes('404')) {
        return null; // 도트 캔버스가 없는 경우
      }
      throw new Error(`Failed to load dot canvas: ${error.message}`);
    }
  }, [projectId, sceneId]);

  // 원본 캔버스를 도트로 변환
  const convertToDotsOnServer = useCallback(async (conversionOptions = {}) => {
    if (!projectId || !sceneId) {
      throw new Error('Project ID and Scene ID are required');
    }

    try {
      const response = await client.post(`/projects/${projectId}/scenes/${sceneId}/processed`, conversionOptions);

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      throw new Error(errorMessage);
    }
  }, [projectId, sceneId]);

  // IndexedDB에서 서버로 동기화
  const syncToServer = useCallback(async (canvasData, syncType = 'original') => {
    if (!serverSyncEnabled || !canvasData) {
      return false;
    }

    setIsSyncing(true);
    setSyncError(null);
    pendingSyncRef.current = true;

    try {
      let result;

      if (syncType === 'original') {
        result = await saveOriginalToServer(canvasData);
      } else if (syncType === 'dots') {
        result = await saveDotCanvasToServer(canvasData);
      } else {
        throw new Error(`Unknown sync type: ${syncType}`);
      }

      setLastSyncTime(new Date());
      pendingSyncRef.current = false;

      if (onSync) {
        onSync({
          type: syncType,
          sceneId,
          success: true,
          result
        });
      }

      console.log(`Server sync completed: ${syncType} for scene ${sceneId}`);
      return true;

    } catch (error) {
      console.error('Server sync failed:', error);
      setSyncError(error.message);
      pendingSyncRef.current = false;

      if (onError) {
        onError(error);
      }

      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [serverSyncEnabled, sceneId, saveOriginalToServer, saveDotCanvasToServer, onSync, onError]);

  // 현재 캔버스 데이터 가져오기
  const getCurrentCanvasData = useCallback(() => {
    if (!fabricCanvas?.current) return null;

    const canvas = fabricCanvas.current;
    return canvas.toJSON([
      'layerId', 'layerName', 'customType', 'originalFill',
      'originalCx', 'originalCy'
    ]);
  }, [fabricCanvas]);

  // 주기적 동기화 시작
  const startPeriodicSync = useCallback((syncType = 'original') => {
    if (!serverSyncEnabled || !getCurrentCanvasData) {
      return;
    }

    // 기존 인터벌 정리
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }

    syncIntervalRef.current = setInterval(async () => {
      // 이미 동기화 중이거나 보류 중이면 건너뛰기
      if (isSyncing || pendingSyncRef.current) {
        return;
      }

      try {
        const canvasData = getCurrentCanvasData();
        if (canvasData && canvasData.objects && canvasData.objects.length > 0) {
          await syncToServer(canvasData, syncType);
        }
      } catch (error) {
        console.error('Periodic sync failed:', error);
      }
    }, syncInterval);

    console.log(`Periodic server sync started for scene ${sceneId} (interval: ${syncInterval}ms)`);
  }, [serverSyncEnabled, syncInterval, sceneId, isSyncing, syncToServer, getCurrentCanvasData]);

  // 주기적 동기화 중지
  const stopPeriodicSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
      console.log(`Periodic server sync stopped for scene ${sceneId}`);
    }
  }, [sceneId]);

  // 즉시 동기화
  const syncNow = useCallback(async (syncType = 'original') => {
    const canvasData = getCurrentCanvasData();
    if (canvasData) {
      return await syncToServer(canvasData, syncType);
    }
    return false;
  }, [getCurrentCanvasData, syncToServer]);

  // 서버에서 캔버스 로드 후 적용
  const loadFromServer = useCallback(async (syncType = 'original') => {
    if (!fabricCanvas?.current) {
      throw new Error('Canvas not available');
    }

    try {
      let canvasData;

      if (syncType === 'original') {
        canvasData = await loadOriginalFromServer();
      } else if (syncType === 'dots') {
        canvasData = await loadDotCanvasFromServer();
      } else {
        throw new Error(`Unknown sync type: ${syncType}`);
      }

      if (canvasData) {
        const canvas = fabricCanvas.current;

        return new Promise((resolve) => {
          canvas.loadFromJSON(canvasData, () => {
            canvas.renderAll();
            console.log(`Canvas loaded from server: ${syncType} for scene ${sceneId}`);
            resolve(true);
          });
        });
      }

      return false;
    } catch (error) {
      console.error('Load from server failed:', error);
      setSyncError(error.message);
      if (onError) onError(error);
      return false;
    }
  }, [fabricCanvas, sceneId, loadOriginalFromServer, loadDotCanvasFromServer, onError]);

  // 서버 동기화 활성화/비활성화
  const setEnabled = useCallback((enabled) => {
    setServerSyncEnabled(enabled);

    if (!enabled) {
      stopPeriodicSync();
    }

    console.log(`Server sync ${enabled ? 'enabled' : 'disabled'} for scene ${sceneId}`);
  }, [sceneId, stopPeriodicSync]);

  // 컴포넌트 언마운트 시 인터벌 정리
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  return {
    // 상태
    isSyncing,
    lastSyncTime,
    syncError,
    isServerSyncEnabled: serverSyncEnabled,

    // 서버 작업 함수들
    saveOriginalToServer,
    loadOriginalFromServer,
    saveDotCanvasToServer,
    loadDotCanvasFromServer,
    convertToDotsOnServer,

    // 동기화 함수들
    syncToServer,
    syncNow,
    loadFromServer,
    startPeriodicSync,
    stopPeriodicSync,
    setEnabled,

    // 편의 함수들
    clearError: () => setSyncError(null),
    getStatus: () => ({
      enabled: serverSyncEnabled,
      syncing: isSyncing,
      lastSync: lastSyncTime,
      error: syncError,
      hasPendingSync: pendingSyncRef.current
    })
  };
};

export default useServerSync;