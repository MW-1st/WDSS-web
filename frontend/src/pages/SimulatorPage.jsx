import React from 'react';

const simulatorPageStyle = {
  width: '100%',
  height: 'calc(100vh - 120px)', // Adjusted for button area
  border: 'none',
};

const buttonContainerStyle = {
  padding: '10px',
  backgroundColor: '#f0f0f0',
  borderBottom: '1px solid #ccc',
  display: 'flex',
  gap: '10px',
  alignItems: 'center',
};

const buttonStyle = {
  padding: '8px 16px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
};

const SimulatorPage = () => {
  const sendTestData = async () => {
    try {
      const response = await fetch('http://localhost:8000/ws/test/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        alert('테스트 데이터 전송 완료: ' + result.message);
      } else {
        alert('전송 실패: ' + response.status);
      }
    } catch (error) {
      alert('전송 오류: ' + error.message);
    }
  };

  return (
    <div>
      <div style={buttonContainerStyle}>
        <button style={buttonStyle} onClick={sendTestData}>
          Unity 테스트 데이터 전송
        </button>
        <span style={{ fontSize: '14px', color: '#666' }}>
          PlayerCube를 빨간색으로 변경하는 테스트 데이터를 전송합니다
        </span>
      </div>
      <iframe
        src="/unity-build/index.html"
        style={simulatorPageStyle}
        title="Unity WebGL Simulator"
      ></iframe>
    </div>
  );
};

export default SimulatorPage;
