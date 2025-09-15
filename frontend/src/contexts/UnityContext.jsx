import React, { createContext, useContext, useState } from 'react';
import client from "../api/client.js";

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

  const showUnity = (projectId = null) => {
    try {
      const canvas = window?.editorAPI?.stageRef?.current;
      if (canvas && typeof canvas.discardActiveObject === 'function') {
        const actives = typeof canvas.getActiveObjects === 'function' ? canvas.getActiveObjects() : [];
        if (actives && actives.length > 0) {
          // Deselect any currently-selected objects to avoid floating UI over the Unity modal
          try { canvas.discardActiveObject(); } catch (_) {}
          try { canvas.requestRenderAll && canvas.requestRenderAll(); } catch (_) {}
        }
      }
    } catch (_) {}

    setIsUnityVisible(true);

    // Unity iframe을 찾고 프로젝트 ID를 전송하는 안전한 방법
    const sendProjectIdToUnity = (retryCount = 0) => {
      // 다양한 방법으로 Unity iframe 찾기
      let iframe = document.querySelector('iframe[title="Unity WebGL Simulator"]') ||
                   document.querySelector('iframe[src*="unity"]') ||
                   document.querySelector('iframe[src*="Build"]') ||
                   document.querySelector('#unity-container iframe') ||
                   document.querySelector('iframe');

      if (iframe && iframe.contentWindow) {
        // Send project ID to Unity via postMessage
        if (projectId) {
          console.log('웹에서 Unity로 프로젝트 ID 전송:', projectId);

          try {
            iframe.contentWindow.postMessage({
              type: 'SET_PROJECT_ID',
              projectId: projectId
            }, '*');

            // 성공 시 추가로 여러 번 전송 (Unity 초기화 타이밍 대응)
            setTimeout(() => {
              iframe.contentWindow.postMessage({
                type: 'SET_PROJECT_ID',
                projectId: projectId
              }, '*');
            }, 1000);

            setTimeout(() => {
              iframe.contentWindow.postMessage({
                type: 'SET_PROJECT_ID',
                projectId: projectId
              }, '*');
            }, 3000);

          } catch (error) {
            console.error('Unity postMessage 전송 실패:', error);
          }
        }

        // Unity 캔버스 활성화
        try {
          const canvas = iframe.contentDocument?.querySelector('#unity-canvas') ||
                        iframe.contentDocument?.querySelector('canvas');
          if (canvas) {
            canvas.focus();
            const clickEvent = new MouseEvent('click', {
              view: iframe.contentWindow,
              bubbles: true,
              cancelable: true
            });
            canvas.dispatchEvent(clickEvent);
          }
        } catch (error) {
          console.warn('Unity 캔버스 활성화 실패 (CORS 제한 가능):', error);
        }
      } else if (retryCount < 10) {
        // iframe을 찾지 못했으면 재시도 (최대 10회, 5초 대기)
        console.log(`Unity iframe을 찾지 못함. 재시도 ${retryCount + 1}/10`);
        setTimeout(() => sendProjectIdToUnity(retryCount + 1), 500);
      } else {
        console.error('Unity iframe을 찾을 수 없습니다. 수동으로 프로젝트 ID를 설정하세요.');
        // 전역 메시지로 폴백
        if (projectId) {
          window.postMessage({
            type: 'SET_PROJECT_ID',
            projectId: projectId
          }, '*');
        }
      }
    };

    // 지연 후 실행
    setTimeout(() => sendProjectIdToUnity(), 200);
  };
  
  const hideUnity = () => setIsUnityVisible(false);

  const sendTestData = async () => {
    try {
        const response = await client.post('/ws/test/broadcast', {});
        console.log('요청 성공:', response.data);
      } catch (error) {
        console.error('요청 실패:', error);
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
