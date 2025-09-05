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
  onMoveLayer,
  onBringToFront,
  onSendToBack
}) => {
  const [editingLayerId, setEditingLayerId] = useState(null);
  const [editingName, setEditingName] = useState('');

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

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">
        <h3>레이어</h3>
        <button 
          type="button"
          className="create-layer-btn"
          onClick={(e) => {
            e.preventDefault();
            onCreateLayer();
          }}
          title="새 레이어 생성"
        >
          +
        </button>
      </div>
      
      <div className="layer-list">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={`layer-item ${activeLayerId === layer.id ? 'active' : ''} ${selectedObjectLayerId === layer.id ? 'has-selected-object' : ''}`}
            onClick={() => onLayerSelect(layer.id)}
          >
            <div className="layer-controls">
              <button
                type="button"
                className={`visibility-btn ${layer.visible ? 'visible' : 'hidden'}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleVisibility(layer.id);
                }}
                title={layer.visible ? '숨기기' : '보이기'}
              >
                {layer.visible ? '👁' : '🙈'}
              </button>
              
              <button
                type="button"
                className={`lock-btn ${layer.locked ? 'locked' : 'unlocked'}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleLock(layer.id);
                }}
                title={layer.locked ? '잠금 해제' : '잠금'}
              >
                {layer.locked ? '🔒' : '🔓'}
              </button>
            </div>
            
            <div className="layer-name">
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
              <div className="layer-order-controls">
                <button
                  type="button"
                  className="order-btn"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onMoveLayer(layer.id, 'up');
                  }}
                  title="위로"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="order-btn"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onMoveLayer(layer.id, 'down');
                  }}
                  title="아래로"
                >
                  ▼
                </button>
              </div>
              
              <div className="layer-z-controls">
                <button
                  type="button"
                  className="z-btn"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onBringToFront(layer.id);
                  }}
                  title="맨 앞으로"
                >
                  ⬆
                </button>
                <button
                  type="button"
                  className="z-btn"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onSendToBack(layer.id);
                  }}
                  title="맨 뒤로"
                >
                  ⬇
                </button>
              </div>
              
              {layer.type !== 'background' && (
                <button
                  type="button"
                  className="delete-btn"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
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
        ))}
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