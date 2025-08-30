import React from 'react';

const simulatorPageStyle = {
  width: '100%',
  height: 'calc(100vh - 60px)', // Assuming a header height of 60px
  border: 'none',
};

const SimulatorPage = () => {
  return (
    <div>
      <iframe
        src="/unity-build/index.html"
        style={simulatorPageStyle}
        title="Unity WebGL Simulator"
      ></iframe>
    </div>
  );
};

export default SimulatorPage;
