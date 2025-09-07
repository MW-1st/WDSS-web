import React, { useState } from 'react';
import './LayerPanel.css';

const LayerPanel = ({
  layers,
  activeLayerId,
  selectedObjectLayerId,
  onLayerSelect,
  onCreateLayer,
  onDeleteLayer,
  onToggleVisibility,
  onToggleLock,
  onRenameLayer,
  onLayerReorder
}) => {
  const [editingLayerId, setEditingLayerId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [draggedLayerId, setDraggedLayerId] = useState(null);
  const [dragOverLayerId, setDragOverLayerId] = useState(null);

  const handleRenameStart = (layer) => {
    setEditingLayerId(layer.id);
    setEditingName(layer.name);
  };

  const handleRenameSubmit = (layerId) => {
    if (editingName.trim()) {
      onRenameLayer(layerId, editingName.trim());
    }
    setEditingLayerId(null);
    setEditingName('');
  };

  const handleRenameCancel = () => {
    setEditingLayerId(null);
    setEditingName('');
  };

  const handleKeyDown = (e, layerId) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(layerId);
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  // 드래그 앤 드롭 핸들러들
  const handleDragStart = (e, layerId) => {
    setDraggedLayerId(layerId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', layerId);
  };

  const handleDragOver = (e, layerId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (layerId !== draggedLayerId) {
      setDragOverLayerId(layerId);
    }
  };

  const handleDragLeave = () => {
    setDragOverLayerId(null);
  };

  const handleDrop = (e, targetLayerId) => {
    e.preventDefault();
    
    if (draggedLayerId && targetLayerId && draggedLayerId !== targetLayerId) {
      onLayerReorder(draggedLayerId, targetLayerId);
    }
    
    setDraggedLayerId(null);
    setDragOverLayerId(null);
  };

  const handleDragEnd = () => {
    setDraggedLayerId(null);
    setDragOverLayerId(null);
  };

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">
        <h3>레이어</h3>
        <button 
          type="button"
          className="create-layer-btn"
          onClick={onCreateLayer}
          title="새 레이어 생성"
        >
          +
        </button>
      </div>
      
      <div className="layer-list">
        {console.log('=== LayerPanel DEBUG ===', layers.map(l => ({ id: l.id, name: l.name, zIndex: l.zIndex })))}
        {layers.map((layer) => {
          const handleLayerItemClick = () => {
            console.log('Layer item clicked:', layer.id, layer.name);
            onLayerSelect(layer.id);
          };

          const handleVisibilityClick = (e) => {
            e.stopPropagation();
            onToggleVisibility(layer.id);
          };

          const handleLockClick = (e) => {
            e.stopPropagation();
            onToggleLock(layer.id);
          };

          const isBeingDragged = draggedLayerId === layer.id;
          const isDraggedOver = dragOverLayerId === layer.id;

          return (
            <div
              key={layer.id}
              className={`layer-item ${activeLayerId === layer.id ? 'active' : ''} ${selectedObjectLayerId === layer.id ? 'has-selected-object' : ''} ${isBeingDragged ? 'dragging' : ''} ${isDraggedOver ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, layer.id)}
              onClick={handleLayerItemClick}
            >
              <div className="layer-controls">
                {layer.type !== 'background' && (
                  <div 
                    className="drag-handle" 
                    title="드래그해서 순서 변경"
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, layer.id)}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => e.stopPropagation()}
                  >
                    ⋮⋮
                  </div>
                )}
                
                <button
                  type="button"
                  className={`visibility-btn ${layer.visible ? 'visible' : 'hidden'}`}
                  onClick={handleVisibilityClick}
                  title={layer.visible ? '숨기기' : '보이기'}
                >
                  {layer.visible ? '👁' : '🙈'}
                </button>
                
                <button
                  type="button"
                  className={`lock-btn ${layer.locked ? 'locked' : 'unlocked'}`}
                  onClick={handleLockClick}
                  title={layer.locked ? '잠금 해제' : '잠금'}
                >
                  {layer.locked ? '🔒' : '🔓'}
                </button>
              </div>
            
            <div className="layer-name-area">
              {editingLayerId === layer.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRenameSubmit(layer.id)}
                  onKeyDown={(e) => handleKeyDown(e, layer.id)}
                  className="layer-name-input"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="layer-name-text"
                  onDoubleClick={() => handleRenameStart(layer)}
                >
                  {layer.name}
                </span>
              )}
            </div>
            
            <div className="layer-actions">
              {layer.type !== 'background' && (
                <button
                  type="button"
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`'${layer.name}' 레이어를 삭제하시겠습니까?`)) {
                      onDeleteLayer(layer.id);
                    }
                  }}
                  title="레이어 삭제"
                >
                  🗑
                </button>
              )}
            </div>
          </div>
          );
        })}
      </div>
      
      <div className="layer-panel-footer">
        <small>
          활성 레이어: {layers.find(l => l.id === activeLayerId)?.name || '없음'}
        </small>
      </div>
    </div>
  );
};

export default LayerPanel;