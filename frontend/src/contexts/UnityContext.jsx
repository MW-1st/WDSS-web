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

  const showUnity = () => {
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
