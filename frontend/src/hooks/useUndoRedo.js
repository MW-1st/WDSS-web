import {deleteCanvasFromIndexedDB, loadCanvasFromIndexedDB, saveCanvasToIndexedDB} from "../utils/indexedDBUtils.js";
import {useCallback, useRef, useState} from "react";

// debounce 헬퍼 함수
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

export const useUndoRedo = (sceneId, fabricCanvas, { getCurrentCanvasData }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const lastSaveRef = useRef({ actionType: '', timestamp: 0, sceneId: null });

  // 씬별 curr 관리로 변경
  const [globalHistoryStack, setGlobalHistoryStack] = useState({
    undoStack: [],
    currentStates: {}, // { sceneId: { historyKey, sceneId, actionType, timestamp } }
    currentStatesOrder: [], // LRU 순서 추적
    redoStack: [],
    pendingCleanup: [], // 지연 삭제 대기열
    maxHistorySize: 50,
    maxSceneStates: 10
  });

  // 백그라운드 정리 함수 (지연 실행)
  const scheduleCleanup = useRef(
    debounce(async (itemsToDelete) => {
      if (itemsToDelete.length === 0) return;

      console.log(`🧹 Starting background cleanup of ${itemsToDelete.length} items`);

      // 배치로 삭제 (성능 최적화)
      for (const item of itemsToDelete) {
        try {
          await deleteCanvasFromIndexedDB(item.historyKey);
          console.log(`🗑️ Cleaned up: ${item.historyKey}`);
        } catch (error) {
          console.warn('Background cleanup failed:', error);
        }
        // CPU 부하 분산을 위한 작은 대기
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      console.log(`✅ Background cleanup completed`);
    }, 2000) // 2초 후 실행
  ).current;

  // 액션 후 현재 상태 저장
  const saveToHistory = useCallback(async (actionType = 'unknown', targetSceneId = null) => {
    // targetSceneId가 없으면 현재 sceneId 사용
    const effectiveSceneId = targetSceneId || sceneId;

    if (!effectiveSceneId || !fabricCanvas?.current || isProcessing) {
      return false;
    }

    const now = Date.now();

    // 중복 호출 방지
    if (lastSaveRef.current.actionType === actionType &&
        lastSaveRef.current.sceneId === effectiveSceneId &&
        now - lastSaveRef.current.timestamp < 100) {
      console.log(`🚫 Duplicate saveToHistory ignored: ${actionType}`);
      return false;
    }

    lastSaveRef.current = { actionType, timestamp: now, sceneId: effectiveSceneId };

    try {
      setIsProcessing(true);

      const canvasData = getCurrentCanvasData();
      const historyKey = `history_${effectiveSceneId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await saveCanvasToIndexedDB(historyKey, canvasData, {
        isHistory: true,
        actionType,
        parentSceneId: effectiveSceneId
      });

      setGlobalHistoryStack(prev => {
        const newCurrentState = {
          historyKey,
          sceneId: effectiveSceneId,
          actionType,
          timestamp: Date.now()
        };

        // LRU 순서 업데이트
        const newOrder = [effectiveSceneId, ...prev.currentStatesOrder.filter(id => id !== effectiveSceneId)];

        // 제거될 씬들 식별 (10개 초과시)
        const scenesToRemove = newOrder.length > prev.maxSceneStates
          ? newOrder.slice(prev.maxSceneStates)
          : [];

        // 제거될 씬들의 모든 히스토리 수집
        const historyItemsToDelete = [];
        scenesToRemove.forEach(sceneToRemove => {
          // curr 수집
          if (prev.currentStates[sceneToRemove]) {
            historyItemsToDelete.push(prev.currentStates[sceneToRemove]);
          }

          // 해당 씬의 undo/redo 히스토리도 수집
          prev.undoStack
            .filter(item => item.sceneId === sceneToRemove)
            .forEach(item => historyItemsToDelete.push(item));

          prev.redoStack
            .filter(item => item.sceneId === sceneToRemove)
            .forEach(item => historyItemsToDelete.push(item));
        });

        // 현재 씬의 기존 curr를 undo 스택으로 이동
        let newUndoStack = prev.undoStack;
        const currentSceneCurr = prev.currentStates[effectiveSceneId];
        if (currentSceneCurr) {
          newUndoStack = [...prev.undoStack, currentSceneCurr];
        }

        // 활성 씬들만 필터링
        const activeScenes = new Set(newOrder.slice(0, prev.maxSceneStates));
        const filteredUndoStack = newUndoStack.filter(item => activeScenes.has(item.sceneId));

        // 50개 초과시 오래된 것 제거
        if (filteredUndoStack.length > prev.maxHistorySize) {
          const excessItems = filteredUndoStack
            .slice(0, filteredUndoStack.length - prev.maxHistorySize);
          historyItemsToDelete.push(...excessItems);
          newUndoStack = filteredUndoStack.slice(-prev.maxHistorySize);
        } else {
          newUndoStack = filteredUndoStack;
        }

        // 새로운 currentStates (제거될 씬 제외)
        const newCurrentStates = Object.fromEntries(
          Object.entries(prev.currentStates)
            .filter(([sid]) => !scenesToRemove.includes(sid))
        );
        newCurrentStates[effectiveSceneId] = newCurrentState;

        // 지연 정리 스케줄링 (논블로킹)
        if (historyItemsToDelete.length > 0) {
          scheduleCleanup(historyItemsToDelete);
        }

        return {
          undoStack: newUndoStack.filter(item => activeScenes.has(item.sceneId)),
          currentStates: newCurrentStates,
          currentStatesOrder: newOrder.slice(0, prev.maxSceneStates),
          redoStack: prev.redoStack
            .filter(item => activeScenes.has(item.sceneId))
            .filter(item => item.sceneId !== effectiveSceneId), // 현재 씬 redo 클리어
          pendingCleanup: prev.pendingCleanup,
          maxHistorySize: prev.maxHistorySize,
          maxSceneStates: prev.maxSceneStates
        };
      });

      return true;
    } catch (error) {
      console.error('Failed to save history:', error);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [sceneId, fabricCanvas, getCurrentCanvasData, isProcessing]);

  const undo = useCallback(async () => {
    if (!sceneId || !fabricCanvas?.current || isProcessing) {
      return false;
    }

    const currentSceneUndoHistory = globalHistoryStack.undoStack
      .filter(item => item.sceneId === sceneId)
      .slice(-1)[0];

    if (!currentSceneUndoHistory) {
      console.log('No undo history available for current scene');
      return false;
    }

    try {
      setIsProcessing(true);

      const canvasData = await loadCanvasFromIndexedDB(currentSceneUndoHistory.historyKey);

      if (!canvasData) {
        console.error('Failed to load canvas data for undo');
        return false;
      }

      const canvas = fabricCanvas.current;
      canvas.clear();
      canvas.renderOnAddRemove = false; // 개별 렌더링 비활성화
      canvas.skipTargetFind = true;     // 이벤트 감지 임시 비활성화

      canvas.loadFromJSON(canvasData, () => {
        canvas.renderOnAddRemove = true;
        canvas.skipTargetFind = false;
        canvas.renderAll();
      });

      setGlobalHistoryStack(prev => {
        const undoIndex = prev.undoStack.findIndex(
          item => item.historyKey === currentSceneUndoHistory.historyKey
        );

        const newUndoStack = prev.undoStack.filter((_, index) => index !== undoIndex);
        let newRedoStack = prev.redoStack;

        // 현재 씬의 curr가 있으면 redo로 이동
        const currentSceneCurr = prev.currentStates[sceneId];
        if (currentSceneCurr) {
          newRedoStack = [...prev.redoStack, currentSceneCurr];
        }

        return {
          undoStack: newUndoStack,
          currentStates: {
            ...prev.currentStates,
            [sceneId]: currentSceneUndoHistory
          },
          currentStatesOrder: prev.currentStatesOrder,
          redoStack: newRedoStack,
          pendingCleanup: prev.pendingCleanup,
          maxHistorySize: prev.maxHistorySize,
          maxSceneStates: prev.maxSceneStates
        };
      });

      return true;
    } catch (error) {
      console.error('Undo failed:', error);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [sceneId, fabricCanvas, globalHistoryStack, isProcessing]);

  const redo = useCallback(async () => {
    if (!sceneId || !fabricCanvas?.current || isProcessing) {
      return false;
    }

    const currentSceneRedoHistory = globalHistoryStack.redoStack
      .filter(item => item.sceneId === sceneId)
      .slice(-1)[0];

    if (!currentSceneRedoHistory) {
      console.log('No redo history available for current scene');
      return false;
    }

    try {
      setIsProcessing(true);

      const canvasData = await loadCanvasFromIndexedDB(currentSceneRedoHistory.historyKey);

      if (!canvasData) {
        console.error('Failed to load canvas data for redo');
        return false;
      }

      const canvas = fabricCanvas.current;
      canvas.clear();
      canvas.renderOnAddRemove = false; // 개별 렌더링 비활성화
      canvas.skipTargetFind = true;     // 이벤트 감지 임시 비활성화

      canvas.loadFromJSON(canvasData, () => {
        canvas.renderOnAddRemove = true;
        canvas.skipTargetFind = false;
        canvas.renderAll();
      });

      setGlobalHistoryStack(prev => {
        const redoIndex = prev.redoStack.findIndex(
          item => item.historyKey === currentSceneRedoHistory.historyKey
        );

        const newRedoStack = prev.redoStack.filter((_, index) => index !== redoIndex);
        let newUndoStack = prev.undoStack;

        // 현재 씬의 curr가 있으면 undo로 이동
        const currentSceneCurr = prev.currentStates[sceneId];
        if (currentSceneCurr) {
          newUndoStack = [...prev.undoStack, currentSceneCurr];
        }

        return {
          undoStack: newUndoStack,
          currentStates: {
            ...prev.currentStates,
            [sceneId]: currentSceneRedoHistory
          },
          currentStatesOrder: prev.currentStatesOrder,
          redoStack: newRedoStack,
          pendingCleanup: prev.pendingCleanup,
          maxHistorySize: prev.maxHistorySize,
          maxSceneStates: prev.maxSceneStates
        };
      });

      return true;
    } catch (error) {
      console.error('Redo failed:', error);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [sceneId, fabricCanvas, globalHistoryStack, isProcessing]);

  const clearHistoryAndSetNew = useCallback(async (actionType = 'conversion', targetSceneId = null, providedCanvasData = null) => {
    // targetSceneId가 없으면 현재 sceneId 사용
    const effectiveSceneId = targetSceneId || sceneId;

    if (!effectiveSceneId || !fabricCanvas?.current) {
      return false;
    }

    try {
      // 1. 해당 씬의 모든 기존 히스토리 수집
      const currentSceneItems = [
        ...globalHistoryStack.undoStack.filter(item => item.sceneId === effectiveSceneId),
        ...globalHistoryStack.redoStack.filter(item => item.sceneId === effectiveSceneId)
      ];

      if (globalHistoryStack.currentStates[effectiveSceneId]) {
        currentSceneItems.push(globalHistoryStack.currentStates[effectiveSceneId]);
      }

      // 2. 캔버스 데이터 결정: 제공된 데이터 우선, 없으면 현재 캔버스에서
      const canvasData = providedCanvasData || getCurrentCanvasData();
      const newHistoryKey = `history_${effectiveSceneId}_${actionType}_${Date.now()}`;

      await saveCanvasToIndexedDB(newHistoryKey, canvasData, {
        isHistory: true,
        actionType,
        parentSceneId: effectiveSceneId
      });

      // 3. 메모리에서 기존 히스토리 제거 + 새 상태 설정
      setGlobalHistoryStack(prev => ({
        undoStack: prev.undoStack.filter(item => item.sceneId !== effectiveSceneId),
        currentStates: {
          ...prev.currentStates,
          [effectiveSceneId]: {
            historyKey: newHistoryKey,
            sceneId: effectiveSceneId,
            actionType,
            timestamp: Date.now()
          }
        },
        currentStatesOrder: [effectiveSceneId, ...prev.currentStatesOrder.filter(id => id !== effectiveSceneId)],
        redoStack: prev.redoStack.filter(item => item.sceneId !== effectiveSceneId),
        pendingCleanup: prev.pendingCleanup,
        maxHistorySize: prev.maxHistorySize,
        maxSceneStates: prev.maxSceneStates
      }));

      // 4. 기존 히스토리 백그라운드에서 삭제
      if (currentSceneItems.length > 0) {
        scheduleCleanup(currentSceneItems);
      }

      console.log(`히스토리 클리어 완료. 새 시작점 설정: ${effectiveSceneId}`);
      return true;
    } catch (error) {
      console.error('Failed to clear history:', error);
      return false;
    }
  }, [sceneId, fabricCanvas, getCurrentCanvasData, globalHistoryStack, scheduleCleanup]);

  return {
    globalHistoryStack,
    saveToHistory,
    undo,
    redo,
    canUndo: globalHistoryStack.undoStack.some(item => item.sceneId === sceneId),
    canRedo: globalHistoryStack.redoStack.some(item => item.sceneId === sceneId),
    isProcessing,
    clearHistoryAndSetNew,

    // 디버깅/관리용 함수들
    getHistoryStats: () => ({
      totalHistoryItems: globalHistoryStack.undoStack.length + globalHistoryStack.redoStack.length,
      currentStatesCount: Object.keys(globalHistoryStack.currentStates).length,
      scenesInOrder: globalHistoryStack.currentStatesOrder,
      currentSceneHistoryCount: globalHistoryStack.undoStack.filter(item => item.sceneId === sceneId).length
    })
  };
};