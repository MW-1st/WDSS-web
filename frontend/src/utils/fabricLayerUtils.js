// Fabric.js 캔버스에서 레이어(z-index) 제어를 위한 유틸리티 함수들

/**
 * 객체를 한 단계 앞으로 이동 (intersecting object 고려)
 * @param {fabric.Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {fabric.Object} object - 이동할 객체
 */
export const bringForward = (canvas, object) => {
  const objects = canvas.getObjects();
  const idx = objects.indexOf(object);
  let nextIntersectingIdx = idx;

  // 객체가 스택의 맨 위에 있지 않다면
  if (idx !== objects.length - 1) {
    // 위쪽으로 스택을 순회하며 가장 가까운 교차하는 객체 찾기
    for (let i = idx + 1; i < objects.length; i++) {
      const isIntersecting = object.intersectsWithObject(objects[i]) ||
                            object.isContainedWithinObject(objects[i]) ||
                            objects[i].isContainedWithinObject(object);

      if (isIntersecting) {
        nextIntersectingIdx = i;
        break;
      }
    }
    
    // 배열에서 객체 제거 후 새로운 위치에 삽입
    objects.splice(idx, 1);
    objects.splice(nextIntersectingIdx, 0, object);
    canvas.renderAll();
  }
};

/**
 * 객체를 한 단계 뒤로 이동 (intersecting object 고려)
 * @param {fabric.Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {fabric.Object} object - 이동할 객체
 */
export const sendBackwards = (canvas, object) => {
  const objects = canvas.getObjects();
  const idx = objects.indexOf(object);
  let prevIntersectingIdx = idx;

  // 객체가 스택의 맨 아래에 있지 않다면
  if (idx !== 0) {
    // 아래쪽으로 스택을 순회하며 가장 가까운 교차하는 객체 찾기
    for (let i = idx - 1; i >= 0; i--) {
      const isIntersecting = object.intersectsWithObject(objects[i]) ||
                            object.isContainedWithinObject(objects[i]) ||
                            objects[i].isContainedWithinObject(object);

      if (isIntersecting) {
        prevIntersectingIdx = i;
        break;
      }
    }
    
    // 배열에서 객체 제거 후 새로운 위치에 삽입
    objects.splice(idx, 1);
    objects.splice(prevIntersectingIdx, 0, object);
    canvas.renderAll();
  }
};

/**
 * 객체를 맨 앞으로 이동
 * @param {fabric.Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {fabric.Object} object - 이동할 객체
 */
export const bringToFront = (canvas, object) => {
  canvas.bringToFront(object);
};

/**
 * 객체를 맨 뒤로 이동
 * @param {fabric.Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {fabric.Object} object - 이동할 객체
 */
export const sendToBack = (canvas, object) => {
  canvas.sendToBack(object);
};

/**
 * 특정 레이어의 모든 객체를 앞으로 이동
 * @param {fabric.Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 */
export const bringLayerForward = (canvas, layerId) => {
  const objects = canvas.getObjects();
  const layerObjects = objects.filter(obj => obj.layerId === layerId);
  
  layerObjects.forEach(obj => {
    bringForward(canvas, obj);
  });
};

/**
 * 특정 레이어의 모든 객체를 뒤로 이동
 * @param {fabric.Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 */
export const sendLayerBackwards = (canvas, layerId) => {
  const objects = canvas.getObjects();
  const layerObjects = objects.filter(obj => obj.layerId === layerId).reverse(); // 역순으로 처리
  
  layerObjects.forEach(obj => {
    sendBackwards(canvas, obj);
  });
};

/**
 * 특정 레이어의 모든 객체를 맨 앞으로 이동
 * @param {fabric.Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 */
export const bringLayerToFront = (canvas, layerId) => {
  const objects = canvas.getObjects();
  const layerObjects = objects.filter(obj => obj.layerId === layerId);
  
  layerObjects.forEach(obj => {
    canvas.bringToFront(obj);
  });
};

/**
 * 특정 레이어의 모든 객체를 맨 뒤로 이동
 * @param {fabric.Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 */
export const sendLayerToBack = (canvas, layerId) => {
  const objects = canvas.getObjects();
  const layerObjects = objects.filter(obj => obj.layerId === layerId).reverse(); // 역순으로 처리
  
  layerObjects.forEach(obj => {
    canvas.sendToBack(obj);
  });
};

/**
 * 레이어 가시성 제어
 * @param {fabric.Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 * @param {boolean} visible - 가시성 상태
 */
export const setLayerVisibility = (canvas, layerId, visible) => {
  const objects = canvas.getObjects();
  objects.forEach(obj => {
    if (obj.layerId === layerId) {
      obj.visible = visible;
      obj.set('visible', visible);
    }
  });
  canvas.renderAll();
};

/**
 * 레이어 잠금 제어
 * @param {fabric.Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 * @param {boolean} locked - 잠금 상태
 */
export const setLayerLock = (canvas, layerId, locked) => {
  const objects = canvas.getObjects();
  objects.forEach(obj => {
    if (obj.layerId === layerId) {
      obj.selectable = !locked;
      obj.evented = !locked;
      obj.set('selectable', !locked);
      obj.set('evented', !locked);
    }
  });
  canvas.renderAll();
};

/**
 * 객체에 레이어 정보 할당
 * @param {fabric.Object} object - Fabric.js 객체
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
 * @param {fabric.Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @returns {string|null} 선택된 객체의 레이어 ID
 */
export const getSelectedObjectLayerId = (canvas) => {
  const activeObject = canvas.getActiveObject();
  if (activeObject && activeObject.layerId) {
    return activeObject.layerId;
  }
  return null;
};

/**
 * 특정 레이어의 모든 객체 가져오기
 * @param {fabric.Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {string} layerId - 레이어 ID
 * @returns {Array} 레이어의 객체들
 */
export const getLayerObjects = (canvas, layerId) => {
  return canvas.getObjects().filter(obj => obj.layerId === layerId);
};

/**
 * 레이어 순서에 따라 모든 객체 재정렬
 * @param {fabric.Canvas} canvas - Fabric.js 캔버스 인스턴스
 * @param {Array} layerOrder - zIndex 순으로 정렬된 레이어 배열
 */
export const reorderObjectsByLayers = (canvas, layerOrder) => {
  const allObjects = canvas.getObjects();
  const orderedObjects = [];
  
  // 레이어 순서대로 객체들을 정렬
  layerOrder.forEach(layer => {
    const layerObjects = allObjects.filter(obj => obj.layerId === layer.id);
    orderedObjects.push(...layerObjects);
  });
  
  // 레이어가 할당되지 않은 객체들도 추가
  const unassignedObjects = allObjects.filter(obj => !obj.layerId);
  orderedObjects.push(...unassignedObjects);
  
  // 캔버스에서 모든 객체 제거
  canvas.clear();
  
  // 순서대로 다시 추가
  orderedObjects.forEach(obj => {
    canvas.add(obj);
  });
  
  canvas.renderAll();
};