import React, { useState, useRef, useEffect } from 'react';
import Canvas from '../components/Canvas';
import LayerPanel from '../components/LayerPanel';
import './CanvasWithLayersExample.css';

const CanvasWithLayersExample = () => {
  const stageRef = useRef(null);
  const [drawingMode, setDrawingMode] = useState('draw');
  const [drawingColor, setDrawingColor] = useState('#222222');
  const [eraserSize, setEraserSize] = useState(20);
  const [imageUrl, setImageUrl] = useState('');
  const [layerPanelKey, setLayerPanelKey] = useState(0); // 레이어 패널 강제 리렌더링용

  // 레이어 패널을 업데이트하는 함수
  const updateLayerPanel = () => {
    setLayerPanelKey(prev => prev + 1);
  };

  // 레이어 관련 핸들러들
  const handleLayerSelect = (layerId) => {
    if (stageRef.current && stageRef.current.layers) {
      stageRef.current.layers.setActiveLayer(layerId);
      updateLayerPanel();
    }
  };

  const handleCreateLayer = () => {
    if (stageRef.current && stageRef.current.layers) {
      const layerName = prompt('새 레이어 이름을 입력하세요:', `레이어 ${Date.now().toString().slice(-4)}`);
      if (layerName) {
        stageRef.current.layers.createLayer(layerName);
        updateLayerPanel();
      }
    }
  };

  const handleDeleteLayer = (layerId) => {
    if (stageRef.current && stageRef.current.layers) {
      stageRef.current.layers.deleteLayer(layerId);
      updateLayerPanel();
    }
  };

  const handleToggleVisibility = (layerId) => {
    if (stageRef.current && stageRef.current.layers) {
      stageRef.current.layers.toggleVisibility(layerId);
      updateLayerPanel();
    }
  };

  const handleToggleLock = (layerId) => {
    if (stageRef.current && stageRef.current.layers) {
      stageRef.current.layers.toggleLock(layerId);
      updateLayerPanel();
    }
  };

  const handleRenameLayer = (layerId, newName) => {
    if (stageRef.current && stageRef.current.layers) {
      stageRef.current.layers.renameLayer(layerId, newName);
      updateLayerPanel();
    }
  };

  const handleMoveLayer = (layerId, direction) => {
    if (stageRef.current && stageRef.current.layers) {
      stageRef.current.layers.moveLayer(layerId, direction);
      updateLayerPanel();
    }
  };

  const handleBringToFront = (layerId) => {
    if (stageRef.current && stageRef.current.layers) {
      stageRef.current.layers.bringToFront(layerId);
      updateLayerPanel();
    }
  };

  const handleSendToBack = (layerId) => {
    if (stageRef.current && stageRef.current.layers) {
      stageRef.current.layers.sendToBack(layerId);
      updateLayerPanel();
    }
  };

  // 레이어 정보 가져오기
  const getLayers = () => {
    if (stageRef.current && stageRef.current.layers) {
      return stageRef.current.layers.getLayers();
    }
    return [];
  };

  const getActiveLayerId = () => {
    if (stageRef.current && stageRef.current.layers) {
      return stageRef.current.layers.getActiveLayerId();
    }
    return null;
  };

  return (
    <div className="canvas-with-layers-example">
      <div className="example-header">
        <h2>Canvas with Layers Example</h2>
        <p>레이어 기능이 통합된 캔버스 예시입니다.</p>
      </div>
      
      <div className="example-controls">
        <div className="tool-group">
          <label>그리기 모드:</label>
          <select 
            value={drawingMode} 
            onChange={(e) => setDrawingMode(e.target.value)}
          >
            <option value="draw">펜</option>
            <option value="brush">브러시</option>
            <option value="erase">지우개</option>
            <option value="pixelErase">픽셀 지우개</option>
            <option value="select">선택</option>
          </select>
        </div>
        
        <div className="tool-group">
          <label>색상:</label>
          <input
            type="color"
            value={drawingColor}
            onChange={(e) => setDrawingColor(e.target.value)}
          />
        </div>
        
        <div className="tool-group">
          <label>지우개 크기:</label>
          <input
            type="range"
            min="5"
            max="100"
            value={eraserSize}
            onChange={(e) => setEraserSize(Number(e.target.value))}
          />
          <span>{eraserSize}px</span>
        </div>
        
        <div className="tool-group">
          <label>배경 이미지:</label>
          <input
            type="url"
            placeholder="이미지 URL을 입력하세요"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>
        
        <button
          onClick={() => {
            if (stageRef.current && stageRef.current.clear) {
              if (confirm('캔버스를 초기화하시겠습니까?')) {
                stageRef.current.clear();
              }
            }
          }}
          className="clear-btn"
        >
          전체 지우기
        </button>
      </div>

      <div className="example-content">
        <div className="canvas-area">
          <Canvas
            width={800}
            height={500}
            imageUrl={imageUrl}
            stageRef={stageRef}
            drawingMode={drawingMode}
            eraserSize={eraserSize}
            drawingColor={drawingColor}
            onModeChange={setDrawingMode}
          />
        </div>
        
        <div className="layer-panel-area">
          <LayerPanel
            key={layerPanelKey}
            layers={getLayers()}
            activeLayerId={getActiveLayerId()}
            onLayerSelect={handleLayerSelect}
            onCreateLayer={handleCreateLayer}
            onDeleteLayer={handleDeleteLayer}
            onToggleVisibility={handleToggleVisibility}
            onToggleLock={handleToggleLock}
            onRenameLayer={handleRenameLayer}
            onMoveLayer={handleMoveLayer}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
          />
        </div>
      </div>
      
      <div className="example-instructions">
        <h3>사용 방법:</h3>
        <ul>
          <li><strong>레이어 생성:</strong> 레이어 패널의 "+" 버튼을 클릭</li>
          <li><strong>레이어 선택:</strong> 레이어 패널에서 레이어를 클릭</li>
          <li><strong>가시성 토글:</strong> 👁/🙈 버튼을 클릭</li>
          <li><strong>잠금 토글:</strong> 🔓/🔒 버튼을 클릭</li>
          <li><strong>레이어 순서 변경:</strong> ▲▼ 버튼으로 한 단계씩, ⬆⬇ 버튼으로 맨 앞/뒤로</li>
          <li><strong>레이어 이름 변경:</strong> 레이어 이름을 더블클릭</li>
          <li><strong>레이어 삭제:</strong> 🗑 버튼을 클릭 (배경 레이어는 삭제 불가)</li>
          <li><strong>이미지 드래그&드롭:</strong> 이미지 갤러리에서 캔버스로 이미지를 끌어다 놓기</li>
        </ul>
      </div>
    </div>
  );
};

export default CanvasWithLayersExample;