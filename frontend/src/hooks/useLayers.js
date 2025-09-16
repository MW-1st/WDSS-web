import { useState, useCallback, useMemo, useEffect } from 'react';

const createDefaultLayers = () => [
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
];

const useLayers = (currentSceneId = null) => {
  const [sceneLayersMap, setSceneLayersMap] = useState(new Map());
  const [sceneActiveLayerMap, setSceneActiveLayerMap] = useState(new Map());

  const initializeSceneIfNeeded = useCallback((sceneId) => {
    if (!sceneId) return;

    setSceneLayersMap(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(sceneId)) {
        newMap.set(sceneId, createDefaultLayers());
      }
      return newMap;
    });

    setSceneActiveLayerMap(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(sceneId)) {
        newMap.set(sceneId, 'layer-1');
      }
      return newMap;
    });
  }, []);

  useEffect(() => {
    if (currentSceneId) {
      initializeSceneIfNeeded(currentSceneId);
    }
  }, [currentSceneId, initializeSceneIfNeeded]);

  const layers = useMemo(() => {
    if (!currentSceneId) return createDefaultLayers();
    return sceneLayersMap.get(currentSceneId) || createDefaultLayers();
  }, [currentSceneId, sceneLayersMap]);

  const activeLayerId = useMemo(() => {
    if (!currentSceneId) return 'layer-1';
    return sceneActiveLayerMap.get(currentSceneId) || 'layer-1';
  }, [currentSceneId, sceneActiveLayerMap]);
  
  const setActiveLayerId = useCallback((newLayerId) => {
    if (!currentSceneId) return;
    setSceneActiveLayerMap(prev => {
      const newMap = new Map(prev);
      newMap.set(currentSceneId, newLayerId);
      return newMap;
    });
  }, [currentSceneId]);

  const createLayer = useCallback((name = null) => {
    if (!currentSceneId) return null;

    const layerId = `layer-${Date.now()}`;
    const drawingLayers = layers.filter(layer => layer.type === 'drawing');
    let layerNumber = drawingLayers.length + 1;

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

    setSceneLayersMap(prev => {
      const newMap = new Map(prev);
      const currentLayers = newMap.get(currentSceneId) || createDefaultLayers();
      newMap.set(currentSceneId, [...currentLayers, newLayer]);
      return newMap;
    });

    setActiveLayerId(layerId);
    return newLayer;
  }, [currentSceneId, layers, setActiveLayerId]);

  const deleteLayer = useCallback((layerId) => {
    if (layerId === 'background' || !currentSceneId) return;

    setSceneLayersMap(prev => {
      const newMap = new Map(prev);
      const currentLayers = newMap.get(currentSceneId) || createDefaultLayers();
      const filtered = currentLayers.filter(layer => layer.id !== layerId);

      if (activeLayerId === layerId) {
        const newActiveLayer = filtered.find(layer => layer.type === 'drawing') || filtered[0];
        setActiveLayerId(newActiveLayer?.id || 'background');
      }

      newMap.set(currentSceneId, filtered);
      return newMap;
    });
  }, [currentSceneId, activeLayerId, setActiveLayerId]);

  const toggleLayerVisibility = useCallback((layerId) => {
    if (!currentSceneId) return;

    setSceneLayersMap(prev => {
      const newMap = new Map(prev);
      const currentLayers = newMap.get(currentSceneId) || createDefaultLayers();
      const updatedLayers = currentLayers.map(layer =>
        layer.id === layerId
          ? { ...layer, visible: !layer.visible }
          : layer
      );
      newMap.set(currentSceneId, updatedLayers);
      return newMap;
    });
  }, [currentSceneId]);

  const toggleLayerLock = useCallback((layerId) => {
    if (!currentSceneId) return;

    setSceneLayersMap(prev => {
      const newMap = new Map(prev);
      const currentLayers = newMap.get(currentSceneId) || createDefaultLayers();
      const updatedLayers = currentLayers.map(layer =>
        layer.id === layerId
          ? { ...layer, locked: !layer.locked }
          : layer
      );
      newMap.set(currentSceneId, updatedLayers);
      return newMap;
    });
  }, [currentSceneId]);

  const renameLayer = useCallback((layerId, newName) => {
    if (!currentSceneId) return;

    setSceneLayersMap(prev => {
      const newMap = new Map(prev);
      const currentLayers = newMap.get(currentSceneId) || createDefaultLayers();
      const updatedLayers = currentLayers.map(layer =>
        layer.id === layerId
          ? { ...layer, name: newName }
          : layer
      );
      newMap.set(currentSceneId, updatedLayers);
      return newMap;
    });
  }, [currentSceneId]);


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
    return [...layers].sort((a, b) => a.zIndex - b.zIndex); // 낮은 zIndex부터 (배경이 아래에 표시)
  }, [layers]);

  const reorderLayers = useCallback((draggedLayerId, targetLayerId) => {
    if (draggedLayerId === 'background' || targetLayerId === 'background' || !currentSceneId) {
      return;
    }

    setSceneLayersMap(prev => {
      const newMap = new Map(prev);
      const currentLayers = newMap.get(currentSceneId) || createDefaultLayers();

      const layersWithoutBg = currentLayers.filter(l => l.id !== 'background');
      const backgroundLayer = currentLayers.find(l => l.id === 'background');

      const sortedLayers = [...layersWithoutBg].sort((a, b) => b.zIndex - a.zIndex);

      const draggedIndex = sortedLayers.findIndex(l => l.id === draggedLayerId);
      const targetIndex = sortedLayers.findIndex(l => l.id === targetLayerId);

      if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
        return prev;
      }

      const reordered = Array.from(sortedLayers);
      const [draggedItem] = reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, draggedItem);

      const updatedLayers = reordered.map((layer, index) => ({
        ...layer,
        zIndex: reordered.length - index,
      }));

      if (backgroundLayer) {
        updatedLayers.push({ ...backgroundLayer, zIndex: 0 });
      }

      newMap.set(currentSceneId, updatedLayers);
      return newMap;
    });
  }, [currentSceneId]);

  const loadSceneLayerState = useCallback((sceneId, layerData) => {
    if (!sceneId || !layerData) return;

    setSceneLayersMap(prev => {
      const newMap = new Map(prev);
      newMap.set(sceneId, layerData.layers || createDefaultLayers());
      return newMap;
    });

    setSceneActiveLayerMap(prev => {
      const newMap = new Map(prev);
      newMap.set(sceneId, layerData.activeLayerId || 'layer-1');
      return newMap;
    });
  }, []);

  const getSceneLayerState = useCallback((sceneId) => {
    if (!sceneId) return null;

    const sceneLayers = sceneLayersMap.get(sceneId);
    const sceneActiveLayerId = sceneActiveLayerMap.get(sceneId);

    if (!sceneLayers) return null;

    return {
      layers: sceneLayers,
      activeLayerId: sceneActiveLayerId || 'layer-1'
    };
  }, [sceneLayersMap, sceneActiveLayerMap]);

  return {
    layers,
    activeLayerId,
    setActiveLayerId,
    createLayer,
    deleteLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    renameLayer,
    reorderLayers,
    getActiveLayer,
    getLayer,
    getSortedLayers,
    loadSceneLayerState,
    getSceneLayerState
  };
};

export default useLayers;