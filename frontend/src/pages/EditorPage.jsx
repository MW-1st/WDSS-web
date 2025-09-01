import Canvas from "../components/Canvas.jsx";
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
    <section>
      <h1>Editor</h1>
      <p>간단한 Konva 캔버스 예시입니다.</p>
      
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
      
      <Canvas width={800} height={500} />
    </section>
  );
}
