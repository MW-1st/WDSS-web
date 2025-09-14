import React from "react";

export default function UnitySimulatorControls({
  isUnityVisible,
  showUnity,
  hideUnity,
  projectId  // 프로젝트 ID 추가
}) {
  const buttonStyle = {
    padding: "10px 20px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  };

  const closeButtonStyle = {
    ...buttonStyle,
    backgroundColor: "#dc3545"
  };

  return (
    <div
      style={{
        marginBottom: "20px",
        padding: "15px",
        backgroundColor: "#f8f9fa",
        borderRadius: "8px",
      }}
    >
      <div style={{ marginBottom: "15px" }}>
        {!isUnityVisible ? (
          <button style={buttonStyle} onClick={() => showUnity(projectId)}>
            🎮 Unity 시뮬레이터 열기
          </button>
        ) : (
          <button style={closeButtonStyle} onClick={hideUnity}>
            🎮 Unity 시뮬레이터 닫기
          </button>
        )}
      </div>
      <p style={{ fontSize: '14px', color: '#666', margin: '0' }}>
        Unity 시뮬레이터를 열고 'JSON 파일로만들기' 버튼을 클릭하면 Unity로 데이터가 자동 전송됩니다.
      </p>
    </div>
  );
}