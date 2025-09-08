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
    // 배경 레이어는 드래그하거나 다른 레이어의 타겟이 될 수 없음 (순서 고정)
    if (draggedLayerId === 'background' || targetLayerId === 'background') {
      return;
    }

    setLayers(prev => {
      const layersWithoutBg = prev.filter(l => l.id !== 'background');
      const backgroundLayer = prev.find(l => l.id === 'background');

      // UI에 표시되는 순서대로 정렬 (zIndex가 높은 것이 위)
      const sortedLayers = [...layersWithoutBg].sort((a, b) => b.zIndex - a.zIndex);

      const draggedIndex = sortedLayers.findIndex(l => l.id === draggedLayerId);
      const targetIndex = sortedLayers.findIndex(l => l.id === targetLayerId);

      if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
        return prev; // 변경 필요 없음
      }

      // 배열에서 드래그된 아이템을 제거하고 타겟 위치에 삽입
      const reordered = Array.from(sortedLayers);
      const [draggedItem] = reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, draggedItem);

      // zIndex를 UI 순서에 맞게 재할당
      // reordered 배열의 인덱스가 0일수록 UI에서 위에 있으므로 zIndex가 높아야 함
      const updatedLayers = reordered.map((layer, index) => ({
        ...layer,
        zIndex: reordered.length - index,
      }));

      // 배경 레이어가 있으면 zIndex: 0으로 다시 추가
      if (backgroundLayer) {
        updatedLayers.push({ ...backgroundLayer, zIndex: 0 });
      }

      return updatedLayers;
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