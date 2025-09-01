import React, { createContext, useContext, useState } from 'react';

const UnityContext = createContext();

export const useUnity = () => {
  const context = useContext(UnityContext);
  if (!context) {
    throw new Error('useUnity must be used within UnityProvider');
  }
  return context;
};

export const UnityProvider = ({ children }) => {
  const [isUnityVisible, setIsUnityVisible] = useState(false);

  const showUnity = () => {
    setIsUnityVisible(true);
    // Try to reactivate Unity when showing
    setTimeout(() => {
      const iframe = document.querySelector('iframe[title="Unity WebGL Simulator"]');
      if (iframe && iframe.contentWindow) {
        const canvas = iframe.contentDocument?.querySelector('#unity-canvas');
        if (canvas) {
          canvas.focus();
          // Simulate click to reactivate Unity
          const clickEvent = new MouseEvent('click', {
            view: iframe.contentWindow,
            bubbles: true,
            cancelable: true
          });
          canvas.dispatchEvent(clickEvent);
        }
      }
    }, 200);
  };
  
  const hideUnity = () => setIsUnityVisible(false);

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

  const value = {
    isUnityVisible,
    showUnity,
    hideUnity,
    sendTestData
  };

  return (
    <UnityContext.Provider value={value}>
      {children}
    </UnityContext.Provider>
  );
};