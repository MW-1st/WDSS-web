import { useState, useCallback } from 'react';

const useLayers = () => {
  const [layers, setLayers] = useState([
    {
      id: 'background',
      name: '배경',
      visible: true,
      locked: false,
      zIndex: 0,
      type: 'background'
    },
    {
      id: 'layer-1',
      name: '레이어 1',
      visible: true,
      locked: false,
      zIndex: 1,
      type: 'drawing'
    }
  ]);
  
  const [activeLayerId, setActiveLayerId] = useState('layer-1');
  
  // setActiveLayerId를 래핑해서 로그 추가
  const setActiveLayerIdWithLog = useCallback((newLayerId) => {
    console.log('=== ACTIVE LAYER CHANGE DEBUG ===');
    console.log('Previous activeLayerId:', activeLayerId);
    console.log('New activeLayerId:', newLayerId);
    console.log('All layers:', layers.map(l => ({ id: l.id, name: l.name })));
    setActiveLayerId(newLayerId);
    console.log('setActiveLayerId completed');
    console.log('=== ACTIVE LAYER CHANGE DEBUG END ===');
  }, [activeLayerId, layers]);

  // 새 레이어 생성
  const createLayer = useCallback((name = null) => {
    const layerId = `layer-${Date.now()}`;
    
    // 그리기 레이어만 카운트해서 순차적 번호 생성
    const drawingLayers = layers.filter(layer => layer.type === 'drawing');
    let layerNumber = drawingLayers.length + 1;
    
    // 기본 이름이 이미 있는지 확인하고 중복되지 않는 번호 찾기
    while (layers.some(layer => layer.name === `레이어 ${layerNumber}`)) {
      layerNumber++;
    }
    
    const layerName = name || `레이어 ${layerNumber}`;
    const maxZIndex = Math.max(...layers.map(layer => layer.zIndex));
    
    const newLayer = {
      id: layerId,
      name: layerName,
      visible: true,
      locked: false,
      zIndex: maxZIndex + 1,
      type: 'drawing'
    };
    
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(layerId);
    return newLayer;
  }, [layers]);

  // 레이어 삭제
  const deleteLayer = useCallback((layerId) => {
    if (layerId === 'background') return; // 배경 레이어는 삭제 불가
    
    setLayers(prev => {
      const filtered = prev.filter(layer => layer.id !== layerId);
      // 활성 레이어가 삭제되면 다른 레이어를 활성화
      if (activeLayerId === layerId) {
        const newActiveLayer = filtered.find(layer => layer.type === 'drawing') || filtered[0];
        setActiveLayerId(newActiveLayer?.id || 'background');
      }
      return filtered;
    });
  }, [activeLayerId]);

  // 레이어 가시성 토글
  const toggleLayerVisibility = useCallback((layerId) => {
    setLayers(prev => 
      prev.map(layer => 
        layer.id === layerId 
          ? { ...layer, visible: !layer.visible }
          : layer
      )
    );
  }, []);

  // 레이어 잠금 토글
  const toggleLayerLock = useCallback((layerId) => {
    setLayers(prev => 
      prev.map(layer => 
        layer.id === layerId 
          ? { ...layer, locked: !layer.locked }
          : layer
      )
    );
  }, []);

  // 레이어 이름 변경
  const renameLayer = useCallback((layerId, newName) => {
    setLayers(prev => 
      prev.map(layer => 
        layer.id === layerId 
          ? { ...layer, name: newName }
          : layer
      )
    );
  }, []);


  // 활성 레이어 정보 가져오기
  const getActiveLayer = useCallback(() => {
    return layers.find(layer => layer.id === activeLayerId);
  }, [layers, activeLayerId]);

  // 레이어ID로 레이어 정보 가져오기
  const getLayer = useCallback((layerId) => {
    return layers.find(layer => layer.id === layerId);
  }, [layers]);

  // zIndex 순으로 정렬된 레이어 목록
  const getSortedLayers = useCallback(() => {
    return [...layers].sort((a, b) => b.zIndex - a.zIndex); // 높은 zIndex부터 (UI에서 위에 표시)
  }, [layers]);

  // 드래그 앤 드롭으로 레이어 순서 변경
  const reorderLayers = useCallback((draggedLayerId, targetLayerId) => {
    console.log('useLayers reorderLayers called:', draggedLayerId, 'to', targetLayerId);
    setLayers(prev => {
      console.log('Previous layers:', prev.map(l => ({ id: l.id, name: l.name, zIndex: l.zIndex })));
      
      // UI 표시 순서와 동일하게 정렬 (높은 zIndex가 위에, 낮은 zIndex가 아래)
      const sortedLayers = [...prev].sort((a, b) => b.zIndex - a.zIndex);
      const draggedIndex = sortedLayers.findIndex(layer => layer.id === draggedLayerId);
      const targetIndex = sortedLayers.findIndex(layer => layer.id === targetLayerId);
      
      console.log('Sorted layers:', sortedLayers.map(l => ({ id: l.id, name: l.name, zIndex: l.zIndex })));
      console.log('Dragged index:', draggedIndex, 'Target index:', targetIndex);
      
      if (draggedIndex === -1 || targetIndex === -1) {
        console.log('Layer not found - draggedIndex:', draggedIndex, 'targetIndex:', targetIndex);
        return prev;
      }
      
      if (draggedIndex === targetIndex) {
        console.log('Same position, no change needed');
        return prev;
      }
      
      // 드래그된 레이어를 배열에서 제거
      const draggedLayer = sortedLayers[draggedIndex];
      const newOrder = [...sortedLayers];
      newOrder.splice(draggedIndex, 1); // 드래그된 레이어 제거
      
      // 타겟 레이어의 위치를 찾기
      const targetLayerInNewOrder = newOrder.find(layer => layer.id === targetLayerId);
      const targetLayerNewIndex = newOrder.indexOf(targetLayerInNewOrder);
      
      // 드래그된 레이어를 타겟 레이어의 자리에 삽입 (방향 관계없이 동일하게)
      newOrder.splice(targetLayerNewIndex, 0, draggedLayer);
      
      console.log('New order:', newOrder.map(l => ({ id: l.id, name: l.name })));
      
      // zIndex 재할당 - UI 표시 순서와 일치하도록
      const newLayers = [...prev];
      newOrder.forEach((layer, index) => {
        const layerInNew = newLayers.find(l => l.id === layer.id);
        if (layerInNew) {
          // 첫 번째 레이어(UI 맨 위)가 가장 높은 zIndex를 가지도록
          const newZIndex = newOrder.length - 1 - index;
          console.log(`Setting ${layer.name} zIndex from ${layerInNew.zIndex} to ${newZIndex} (UI index: ${index})`);
          layerInNew.zIndex = newZIndex;
        }
      });
      
      console.log('Final new layers:', newLayers.map(l => ({ id: l.id, name: l.name, zIndex: l.zIndex })));
      return newLayers;
    });
  }, []);

  return {
    layers,
    activeLayerId,
    setActiveLayerId: setActiveLayerIdWithLog,
    createLayer,
    deleteLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    renameLayer,
    reorderLayers,
    getActiveLayer,
    getLayer,
    getSortedLayers
  };
};

export default useLayers;