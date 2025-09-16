const DB_NAME = 'CanvasAutoSave';
const DB_VERSION = 1;
const STORE_NAME = 'canvasStates';

// 메모리 캐시 설정
const memoryCache = new Map();
const MEMORY_CACHE_SIZE = 5; // 최근 5개 씬만 메모리에 보관
const CACHE_ACCESS_ORDER = []; // LRU 순서 추적

// DB 연결 재사용
let dbConnection = null;
let dbInitPromise = null;

/**
 * DB 연결 재사용을 위한 헬퍼 함수
 */
const getDBConnection = () => {
  if (dbConnection) return Promise.resolve(dbConnection);
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = initIndexedDB().then(db => {
    dbConnection = db;
    dbInitPromise = null;
    return db;
  }).catch(error => {
    dbInitPromise = null; // 실패 시 재시도 가능하도록
    throw error;
  });

  return dbInitPromise;
};

/**
 * LRU 캐시 관리
 */
const updateCacheAccess = (sceneId) => {
  // 기존 위치에서 제거
  const existingIndex = CACHE_ACCESS_ORDER.indexOf(sceneId);
  if (existingIndex > -1) {
    CACHE_ACCESS_ORDER.splice(existingIndex, 1);
  }

  // 맨 앞에 추가 (가장 최근 사용)
  CACHE_ACCESS_ORDER.unshift(sceneId);

  // 캐시 크기 초과 시 가장 오래된 것 제거
  if (memoryCache.size >= MEMORY_CACHE_SIZE) {
    const oldestSceneId = CACHE_ACCESS_ORDER.pop();
    if (oldestSceneId && memoryCache.has(oldestSceneId)) {
      memoryCache.delete(oldestSceneId);
      console.log(`Memory cache evicted: ${oldestSceneId}`);
    }
  }
};

/**
 * 메모리 캐시에 데이터 저장
 */
const setMemoryCache = (sceneId, data) => {
  if (!data) return;

  updateCacheAccess(sceneId);
  memoryCache.set(sceneId, {
    data: data,
    timestamp: Date.now(),
    hits: (memoryCache.get(sceneId)?.hits || 0) + 1
  });

  console.log(`Memory cache stored: ${sceneId} (cache size: ${memoryCache.size})`);
};

/**
 * 메모리 캐시에서 데이터 조회
 */
const getMemoryCache = (sceneId) => {
  if (!memoryCache.has(sceneId)) return null;

  const cached = memoryCache.get(sceneId);
  updateCacheAccess(sceneId);

  // 히트 카운트 증가
  cached.hits++;
  cached.lastAccess = Date.now();

  console.log(`Memory cache hit: ${sceneId} (hits: ${cached.hits})`);
  return cached.data;
};

/**
 * IndexedDB 초기화 (기존과 동일)
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

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'sceneId' });

        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('savedAt', 'savedAt', { unique: false });

        console.log('IndexedDB store created successfully');
      }
    };
  });
};

/**
 * 캔버스 상태를 IndexedDB에 저장 (메모리 캐시도 함께 업데이트)
 */
export const saveCanvasToIndexedDB = async (sceneId, canvasData, metadata = {}) => {
  if (!sceneId || !canvasData) {
    throw new Error('sceneId and canvasData are required');
  }

  try {
    const db = await getDBConnection();
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

        // 메모리 캐시도 업데이트
        setMemoryCache(sceneId, canvasData);

        // UI 등에서 실시간 변화를 감지할 수 있도록 이벤트 발행
        try {
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            const ev = new CustomEvent('indexeddb:canvas-saved', {
              detail: {
                sceneId,
                objectCount: canvasState.objectCount || 0,
                savedAt: canvasState.savedAt
              }
            });
            window.dispatchEvent(ev);
          }
        } catch (e) {
          console.warn('Failed to dispatch indexeddb:canvas-saved event', e);
        }

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
 * IndexedDB에서 캔버스 상태 로드 (메모리 캐시 우선 확인)
 */
export const loadCanvasFromIndexedDB = async (sceneId) => {
  if (!sceneId) {
    throw new Error('sceneId is required');
  }

  try {
    // 1. 메모리 캐시 확인 (가장 빠름)
    const cachedData = getMemoryCache(sceneId);
    if (cachedData) {
      return cachedData;
    }

    // 2. IndexedDB에서 로드
    const db = await getDBConnection();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(sceneId);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log(`Canvas state loaded from IndexedDB: ${sceneId} (saved: ${result.savedAt})`);

          // 메모리 캐시에 저장
          setMemoryCache(sceneId, result.canvasData);

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
 * 특정 씬의 캔버스 상태 삭제 (메모리 캐시에서도 제거)
 */
export const deleteCanvasFromIndexedDB = async (sceneId) => {
  if (!sceneId) {
    throw new Error('sceneId is required');
  }

  try {
    // 메모리 캐시에서 제거
    if (memoryCache.has(sceneId)) {
      memoryCache.delete(sceneId);
      const index = CACHE_ACCESS_ORDER.indexOf(sceneId);
      if (index > -1) {
        CACHE_ACCESS_ORDER.splice(index, 1);
      }
      console.log(`Removed from memory cache: ${sceneId}`);
    }

    const db = await getDBConnection();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(sceneId);

      request.onsuccess = () => {
        console.log(`Canvas state deleted from IndexedDB: ${sceneId}`);
        // 삭제 이벤트 발행
        try {
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            const ev = new CustomEvent('indexeddb:canvas-deleted', {
              detail: { sceneId }
            });
            window.dispatchEvent(ev);
          }
        } catch (e) {
          console.warn('Failed to dispatch indexeddb:canvas-deleted event', e);
        }
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
 * 메모리 캐시 상태 확인 (디버깅용)
 */
export const getCacheStats = () => {
  const stats = {
    memoryCache: {
      size: memoryCache.size,
      maxSize: MEMORY_CACHE_SIZE,
      entries: []
    },
    accessOrder: [...CACHE_ACCESS_ORDER]
  };

  for (const [sceneId, cacheEntry] of memoryCache.entries()) {
    stats.memoryCache.entries.push({
      sceneId,
      timestamp: cacheEntry.timestamp,
      lastAccess: cacheEntry.lastAccess,
      hits: cacheEntry.hits,
      objectCount: cacheEntry.data?.objects?.length || 0
    });
  }

  return stats;
};

/**
 * 메모리 캐시 클리어 (필요시 사용)
 */
export const clearMemoryCache = () => {
  memoryCache.clear();
  CACHE_ACCESS_ORDER.length = 0;
  console.log('Memory cache cleared');
};

/**
 * 모든 저장된 캔버스 상태 목록 조회 (기존과 동일)
 */
export const getAllCanvasStates = async () => {
  try {
    const db = await getDBConnection();
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
 * 오래된 캔버스 상태 정리 (기존과 동일)
 */
export const cleanupOldCanvasStates = async (maxAgeInDays = 7) => {
  try {
    const db = await getDBConnection();
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
          const sceneId = cursor.value.sceneId;

          // 메모리 캐시에서도 제거
          if (memoryCache.has(sceneId)) {
            memoryCache.delete(sceneId);
            const index = CACHE_ACCESS_ORDER.indexOf(sceneId);
            if (index > -1) {
              CACHE_ACCESS_ORDER.splice(index, 1);
            }
          }

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
 * IndexedDB 저장소 크기 추정 (기존과 동일)
 */
export const getStorageUsage = async () => {
  try {
    const states = await getAllCanvasStates();

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
      estimatedSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      memoryCache: getCacheStats()
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
  getCacheStats,
  clearMemoryCache,
};