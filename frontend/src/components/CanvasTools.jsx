import React from "react";

export default function CanvasTools({ 
  drawingMode = 'draw', 
  eraserSize = 20,
  onModeChange,
  onClearAll 
}) {
  
  const buttonStyle = {
    border: '1px solid #ccc',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '8px',
    marginBottom: '8px',
    fontSize: '14px'
  };

  const getButtonStyle = (mode) => ({
    ...buttonStyle,
    backgroundColor: drawingMode === mode ? '#007bff' : '#f8f9fa',
    color: drawingMode === mode ? 'white' : 'black'
  });

  const clearButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#dc3545',
    color: 'white',
    border: '1px solid #dc3545',
    fontWeight: 'bold',
    marginRight: 0
  };

  return (
    <div style={{ padding: '12px 0' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
        캔버스 도구
      </h4>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
        <button 
          onClick={() => onModeChange('draw')}
          style={getButtonStyle('draw')}
          title="펜으로 그리기"
        >
          펜
        </button>
        
        <button 
          onClick={() => onModeChange('select')}
          style={getButtonStyle('select')}
          title="객체 선택 및 이동"
        >
          선택
        </button>
        
        <button 
          onClick={() => onModeChange('brush')}
          style={getButtonStyle('brush')}
          title="브러시로 점 찍기"
        >
          브러시
        </button>
        
        <button 
          onClick={() => onModeChange('erase')}
          style={getButtonStyle('erase')}
          title="선과 점 지우기"
        >
          선 지우개
        </button>
        
        <button 
          onClick={() => onModeChange('pixelErase')}
          style={getButtonStyle('pixelErase')}
          title="픽셀 지우개"
        >
          픽셀 지우개
        </button>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <button 
          onClick={onClearAll}
          style={clearButtonStyle}
          title="캔버스의 모든 내용 지우기"
        >
          전체 지우기
        </button>
      </div>

      <div style={{ 
        fontSize: '12px', 
        color: '#666', 
        lineHeight: '1.4'
      }}>
        {drawingMode === 'draw' && '펜 모드: 자유롭게 선을 그을 수 있습니다'}
        {drawingMode === 'select' && '선택 모드: 이미지를 클릭하여 이동/크기조절 가능'}
        {drawingMode === 'brush' && '브러시 모드: 클릭하여 점을 찍을 수 있습니다'}
        {drawingMode === 'erase' && `선 지우개: 선과 점을 지웁니다 (크기: ${eraserSize}px, 휠로 조절)`}
        {drawingMode === 'pixelErase' && `픽셀 지우개: 배경색으로 칠합니다 (크기: ${eraserSize}px, 휠로 조절)`}
      </div>
    </div>
  );
}