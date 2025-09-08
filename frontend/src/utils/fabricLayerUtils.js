// Fabric.js v6+ 캔버스에서 레이어(z-index) 제어를 위한 유틸리티 함수들

/**
 * 객체를 한 단계 앞으로 이동
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {import('fabric').FabricObject} object - 이동할 객체
 */
export const bringForward = (canvas, object) => {
  canvas.bringObjectForward(object);
};

/**
 * 객체를 한 단계 뒤로 이동
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {import('fabric').FabricObject} object - 이동할 객체
 */
export const sendBackwards = (canvas, object) => {
  canvas.sendObjectBackwards(object);
};

/**
 * 객체를 맨 앞으로 이동
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {import('fabric').FabricObject} object - 이동할 객체
 */
export const bringToFront = (canvas, object) => {
  canvas.bringObjectToFront(object);
};

/**
 * 객체를 맨 뒤로 이동
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {import('fabric').FabricObject} object - 이동할 객체
 */
export const sendToBack = (canvas, object) => {
  canvas.sendObjectToBack(object);
};


/**
 * 특정 레이어의 모든 객체를 한 단계 앞으로 이동
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 */
export const bringLayerForward = (canvas, layerId) => {
  const layerObjects = canvas.getObjects().filter(obj => obj.layerId === layerId);
  layerObjects.forEach(obj => {
    canvas.bringObjectForward(obj);
  });
  canvas.renderAll();
};

/**
 * 특정 레이어의 모든 객체를 한 단계 뒤로 이동
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 */
export const sendLayerBackwards = (canvas, layerId) => {
  const layerObjects = canvas.getObjects().filter(obj => obj.layerId === layerId);
  layerObjects.forEach(obj => {
    canvas.sendObjectBackwards(obj);
  });
  canvas.renderAll();
};

/**
 * 특정 레이어의 모든 객체를 맨 앞으로 이동
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 */
export const bringLayerToFront = (canvas, layerId) => {
  const layerObjects = canvas.getObjects().filter(obj => obj.layerId === layerId);
  layerObjects.forEach(obj => {
    canvas.bringObjectToFront(obj);
  });
  canvas.renderAll();
};

/**
 * 특정 레이어의 모든 객체를 맨 뒤로 이동
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 */
export const sendLayerToBack = (canvas, layerId) => {
  const layerObjects = canvas.getObjects().filter(obj => obj.layerId === layerId).reverse(); // 역순으로 처리
  layerObjects.forEach(obj => {
    canvas.sendObjectToBack(obj);
  });
  canvas.renderAll();
};

/**
 * 레이어 가시성 제어
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 * @param {boolean} visible - 가시성 상태
 */
export const setLayerVisibility = (canvas, layerId, visible) => {
  const objects = canvas.getObjects();
  objects.forEach(obj => {
    if (obj.layerId === layerId) {
      obj.set('visible', visible);
    }
  });
  canvas.renderAll();
};

/**
 * 레이어 잠금 제어
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 * @param {boolean} locked - 잠금 상태
 */
export const setLayerLock = (canvas, layerId, locked) => {
  const objects = canvas.getObjects();
  objects.forEach(obj => {
    if (obj.layerId === layerId) {
      obj.set('selectable', !locked);
      obj.set('evented', !locked);
    }
  });
  canvas.renderAll();
};

/**
 * 객체에 레이어 정보 할당
 * @param {import('fabric').FabricObject} object - Fabric.js 객체
 * @param {string} layerId - 레이어 ID
 * @param {string} layerName - 레이어 이름
 */
export const assignObjectToLayer = (object, layerId, layerName) => {
  object.set({
    layerId: layerId,
    layerName: layerName
  });
};

/**
 * 선택된 객체의 레이어 ID 가져오기
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @returns {string|null} 선택된 객체의 레이어 ID
 */
export const getSelectedObjectLayerId = (canvas) => {
  const activeObject = canvas.getActiveObject();
  return activeObject?.layerId || null;
};

/**
 * 특정 레이어의 모든 객체 가져오기
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 * @returns {Array<import('fabric').FabricObject>} 레이어의 객체들
 */
export const getLayerObjects = (canvas, layerId) => {
  return canvas.getObjects().filter(obj => obj.layerId === layerId);
};

/**
 * 특정 레이어의 모든 객체 삭제
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 */
export const deleteLayerObjects = (canvas, layerId) => {
  const layerObjects = canvas.getObjects().filter(obj => obj.layerId === layerId);
  layerObjects.forEach(obj => {
    canvas.remove(obj);
  });
  canvas.renderAll();
};

/**
 * 레이어 순서에 따라 모든 객체 재정렬
 * @param {import('fabric').Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {Array} layerOrder - zIndex 높은 순서(UI 상단)로 정렬된 레이어 배열
 */
export const reorderObjectsByLayers = (canvas, layerOrder) => {
  // zIndex가 낮은 레이어(UI 하단)부터 순서대로 객체들을 맨 위로 가져와서
  // 올바른 순서로 쌓이도록 재정렬합니다.
  const bottomToTopLayers = [...layerOrder].reverse();

  bottomToTopLayers.forEach(layer => {
    const layerObjects = canvas.getObjects().filter(obj => obj.layerId === layer.id);
    // 한 레이어 내의 객체 순서는 유지하면서 그룹 전체를 위로 올립니다.
    layerObjects.forEach(obj => {
      canvas.bringObjectToFront(obj); // Correct v6 API
    });
  });

  // 레이어가 할당되지 않은 특수 객체들(예: 캔버스 경계선)은 항상 맨 뒤로 보냅니다.
  const unassignedObjects = canvas.getObjects().filter(obj => !obj.layerId);
  unassignedObjects.forEach(obj => {
    canvas.sendObjectToBack(obj); // Correct v6 API
  });

  canvas.renderAll();
};
