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

  // 새 레이어 생성
  const createLayer = useCallback((name = null) => {
    const layerId = `layer-${Date.now()}`;
    const layerName = name || `레이어 ${layers.length}`;
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

  // 레이어 순서 변경
  const moveLayer = useCallback((layerId, direction) => {
    setLayers(prev => {
      const sortedLayers = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const currentIndex = sortedLayers.findIndex(layer => layer.id === layerId);
      
      if (currentIndex === -1) return prev;
      
      let newIndex;
      if (direction === 'up') {
        newIndex = Math.min(currentIndex + 1, sortedLayers.length - 1);
      } else {
        newIndex = Math.max(currentIndex - 1, 0);
      }
      
      if (newIndex === currentIndex) return prev;
      
      // zIndex 재계산
      const newLayers = [...prev];
      const targetLayer = newLayers.find(layer => layer.id === layerId);
      const swapLayer = sortedLayers[newIndex];
      
      if (targetLayer && swapLayer) {
        const tempZIndex = targetLayer.zIndex;
        targetLayer.zIndex = swapLayer.zIndex;
        const swapLayerInNew = newLayers.find(layer => layer.id === swapLayer.id);
        if (swapLayerInNew) {
          swapLayerInNew.zIndex = tempZIndex;
        }
      }
      
      return newLayers;
    });
  }, []);

  // 레이어를 맨 위로
  const bringToFront = useCallback((layerId) => {
    setLayers(prev => {
      const maxZIndex = Math.max(...prev.map(layer => layer.zIndex));
      return prev.map(layer => 
        layer.id === layerId 
          ? { ...layer, zIndex: maxZIndex + 1 }
          : layer
      );
    });
  }, []);

  // 레이어를 맨 아래로
  const sendToBack = useCallback((layerId) => {
    if (layerId === 'background') return; // 배경은 항상 맨 아래
    
    setLayers(prev => {
      const minZIndex = Math.min(...prev.filter(layer => layer.id !== 'background').map(layer => layer.zIndex));
      return prev.map(layer => 
        layer.id === layerId 
          ? { ...layer, zIndex: minZIndex - 1 }
          : layer
      );
    });
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

  return {
    layers,
    activeLayerId,
    setActiveLayerId,
    createLayer,
    deleteLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    renameLayer,
    moveLayer,
    bringToFront,
    sendToBack,
    getActiveLayer,
    getLayer,
    getSortedLayers
  };
};

export default useLayers;