import React, { createContext, useState, useContext } from 'react';

const EditorContext = createContext();

export const useEditor = () => useContext(EditorContext);

export const EditorProvider = ({ children }) => {
  const [dotCount, setDotCount] = useState(0);

  const value = {
    dotCount,
    setDotCount,
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
};
