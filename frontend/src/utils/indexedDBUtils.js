const DB_NAME = 'CanvasAutoSave';
const DB_VERSION = 1;
const STORE_NAME = 'canvasStates';

/**
 * IndexedDB 초기화
 */
const initIndexedDB = () => {
  if (!window.indexedDB) {
    console.warn('IndexedDB not supported in this browser');
    return Promise.reject(new Error('IndexedDB not supported'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB initialization failed:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // canvasStates 스토어가 없으면 생성
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'sceneId' });

        // 인덱스 생성
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('savedAt', 'savedAt', { unique: false });

        console.log('IndexedDB store created successfully');
      }
    };
  });
};

/**
 * 캔버스 상태를 IndexedDB에 저장
 * @param {string} sceneId - 씬 ID
 * @param {Object} canvasData - Fabric.js toJSON() 결과
 * @param {Object} metadata - 추가 메타데이터 (선택사항)
 */
export const saveCanvasToIndexedDB = async (sceneId, canvasData, metadata = {}) => {
  if (!sceneId || !canvasData) {
    throw new Error('sceneId and canvasData are required');
  }

  try {
    const db = await initIndexedDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const canvasState = {
      sceneId,
      canvasData,
      timestamp: Date.now(),
      savedAt: new Date().toISOString(),
      version: '1.0',
      objectCount: canvasData?.objects?.length || 0,
      ...metadata
    };

    return new Promise((resolve, reject) => {
      const request = store.put(canvasState);

      request.onsuccess = () => {
        console.log(`Canvas state saved to IndexedDB: ${sceneId} (${canvasState.objectCount} objects)`);
        resolve(canvasState);
      };

      request.onerror = () => {
        console.error('Failed to save canvas state:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error saving to IndexedDB:', error);
    throw error;
  }
};

/**
 * IndexedDB에서 캔버스 상태 로드
 * @param {string} sceneId - 씬 ID
 */
export const loadCanvasFromIndexedDB = async (sceneId) => {
  if (!sceneId) {
    throw new Error('sceneId is required');
  }

  try {
    const db = await initIndexedDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore('canvasStates');

    return new Promise((resolve, reject) => {
      const request = store.get(sceneId);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log(`Canvas state loaded from IndexedDB: ${sceneId} (saved: ${result.savedAt})`);
          resolve(result.canvasData);
        } else {
          console.log(`No saved canvas state found for scene: ${sceneId}`);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('Failed to load canvas state:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error loading from IndexedDB:', error);
    throw error;
  }
};

/**
 * 특정 씬의 캔버스 상태 삭제
 * @param {string} sceneId - 씬 ID
 */
export const deleteCanvasFromIndexedDB = async (sceneId) => {
  if (!sceneId) {
    throw new Error('sceneId is required');
  }

  try {
    const db = await initIndexedDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(sceneId);

      request.onsuccess = () => {
        console.log(`Canvas state deleted from IndexedDB: ${sceneId}`);
        resolve(true);
      };

      request.onerror = () => {
        console.error('Failed to delete canvas state:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error deleting from IndexedDB:', error);
    throw error;
  }
};

/**
 * 모든 저장된 캔버스 상태 목록 조회
 */
export const getAllCanvasStates = async () => {
  try {
    const db = await initIndexedDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result.map(item => ({
          sceneId: item.sceneId,
          timestamp: item.timestamp,
          savedAt: item.savedAt,
          objectCount: item.objectCount || 0,
          version: item.version || 'unknown'
        }));
        resolve(results);
      };

      request.onerror = () => {
        console.error('Failed to load all canvas states:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error loading all canvas states:', error);
    throw error;
  }
};

/**
 * 오래된 캔버스 상태 정리 (7일 이상 된 것들)
 * @param {number} maxAgeInDays - 최대 보관 기간 (기본: 7일)
 */
export const cleanupOldCanvasStates = async (maxAgeInDays = 7) => {
  try {
    const db = await initIndexedDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');

    const cutoffTime = Date.now() - (maxAgeInDays * 24 * 60 * 60 * 1000);
    const range = IDBKeyRange.upperBound(cutoffTime);

    return new Promise((resolve, reject) => {
      let deletedCount = 0;
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`Cleaned up ${deletedCount} old canvas states`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.error('Failed to cleanup old canvas states:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
};

/**
 * IndexedDB 저장소 크기 추정 (대략적인 값)
 */
export const getStorageUsage = async () => {
  try {
    const states = await getAllCanvasStates();

    // 각 상태의 대략적인 크기 계산
    let totalSize = 0;
    for (const state of states) {
      const fullState = await loadCanvasFromIndexedDB(state.sceneId);
      if (fullState) {
        totalSize += JSON.stringify(fullState).length;
      }
    }

    return {
      totalStates: states.length,
      estimatedSizeBytes: totalSize,
      estimatedSizeMB: (totalSize / 1024 / 1024).toFixed(2)
    };
  } catch (error) {
    console.error('Error calculating storage usage:', error);
    return null;
  }
};

export default {
    saveCanvasToIndexedDB,
    loadCanvasFromIndexedDB,
    deleteCanvasFromIndexedDB,
    getAllCanvasStates,
    cleanupOldCanvasStates,
}