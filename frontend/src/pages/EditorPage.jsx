import React from 'react';
import Canvas from "../components/Canvas.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
import { useUnity } from "../contexts/UnityContext.jsx";

export default function EditorPage() {
  const { isUnityVisible, showUnity, hideUnity, sendTestData } = useUnity();

  const buttonStyle = {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '10px'
  };

  const sendButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#28a745'
  };

  const closeButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#dc3545'
  };

  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold mb-4">Editor</h1>
      <p className="text-gray-600 mb-6">간단한 Konva 캔버스 예시입니다.</p>

      {/* 이미지 업로드 컴포넌트 */}
      {/* 일단은 1,1로 고정 */}
      <ImageUpload projectId={1} sceneId={1} />

            
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <div style={{ marginBottom: '15px' }}>
          {!isUnityVisible ? (
            <button style={buttonStyle} onClick={showUnity}>
              🎮 Unity 시뮬레이터 열기
            </button>
          ) : (
            <button style={closeButtonStyle} onClick={hideUnity}>
              🎮 Unity 시뮬레이터 닫기
            </button>
          )}
          
          <button style={sendButtonStyle} onClick={sendTestData}>
            Unity로 데이터 전송
          </button>
        </div>
        
        <p style={{ fontSize: '14px', color: '#666', margin: '0' }}>
          Unity 시뮬레이터를 열고 데이터를 전송해보세요. Unity 인스턴스는 페이지 이동 시에도 메모리가 유지됩니다.
        </p>
      </div>
      

      {/* 캔버스 컴포넌트 */}
      <Canvas width={800} height={500} />
    </section>
  );
}