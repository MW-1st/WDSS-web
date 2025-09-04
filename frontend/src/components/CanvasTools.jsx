import React from "react";
import { FaPen, FaPaintBrush, FaEraser } from "react-icons/fa";
import { PiSelectionPlusBold } from "react-icons/pi";

export default function CanvasTools({
  drawingMode = "draw",
  eraserSize = 20,
  onModeChange,
  onClearAll,
}) {
  const [hovered, setHovered] = React.useState(null);

  const buttonStyle = {
    border: "1px solid #ccc",
    padding: "8px 16px",
    borderRadius: "4px",
    cursor: "pointer",
    marginBottom: "8px",
    fontSize: "16px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
  };

  const getButtonStyle = (mode) => ({
    ...buttonStyle,
    backgroundColor: drawingMode === mode ? "#007bff" : "#f8f9fa",
    color: drawingMode === mode ? "white" : "black",
  });

  const clearButtonStyle = {
    ...buttonStyle,
    backgroundColor: "#dc3545",
    color: "white",
    border: "1px solid #dc3545",
    fontWeight: "bold",
    marginRight: 0,
  };

  const Tooltip = ({ children }) => (
    <div
      style={{
        position: "absolute",
        left: "70px",
        top: "40%",
        transform: "translateY(-50%)",
        background: "#000",
        color: "#fff",
        padding: "6px 8px",
        borderRadius: 6,
        fontSize: 12,
        whiteSpace: "nowrap",
        zIndex: 9999,
        boxShadow: "0 2px 6px rgba(0,0,0,.2)",
      }}
    >
      {children}
    </div>
  );

  return (
    <div style={{ padding: "12px 0" }}>
      <h4 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: 600 }}>
        캔버스 도구
      </h4>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        {/* Draw */}
        <div
          style={{ position: "relative", display: "inline-flex", zIndex: 1000 }}
          onMouseEnter={() => setHovered("draw")}
          onMouseLeave={() => setHovered(null)}
        >
          <button
            onClick={() => onModeChange("draw")}
            style={getButtonStyle("draw")}
            aria-label="그리기"
          >
            <FaPen />
          </button>
          {hovered === "draw" && (
            <Tooltip>그리기: 자유곡선을 그립니다.</Tooltip>
          )}
        </div>

        {/* Select */}
        <div
          style={{ position: "relative", display: "inline-flex", zIndex: 1000 }}
          onMouseEnter={() => setHovered("select")}
          onMouseLeave={() => setHovered(null)}
        >
          <button
            onClick={() => onModeChange("select")}
            style={getButtonStyle("select")}
            aria-label="선택"
          >
            <PiSelectionPlusBold />
          </button>
          {hovered === "select" && (
            <Tooltip>선택: 객체 이동/크기 조절.</Tooltip>
          )}
        </div>

        {/* Brush */}
        <div
          style={{ position: "relative", display: "inline-flex", zIndex: 1000 }}
          onMouseEnter={() => setHovered("brush")}
          onMouseLeave={() => setHovered(null)}
        >
          <button
            onClick={() => onModeChange("brush")}
            style={getButtonStyle("brush")}
            aria-label="브러시"
          >
            <FaPaintBrush />
          </button>
          {hovered === "brush" && <Tooltip>브러시: 점을 찍습니다.</Tooltip>}
        </div>

        {/* Erase (line) */}
        <div
          style={{ position: "relative", display: "inline-flex", zIndex: 1000 }}
          onMouseEnter={() => setHovered("erase")}
          onMouseLeave={() => setHovered(null)}
        >
          <button
            onClick={() => onModeChange("erase")}
            style={getButtonStyle("erase")}
            aria-label="지우개"
          >
            <FaEraser />
          </button>
          {hovered === "erase" && (
            <Tooltip>지우개: 선과 점을 지웁니다.</Tooltip>
          )}
        </div>

        {/* Pixel Erase */}
        <div
          style={{ position: "relative", display: "inline-flex", zIndex: 1000 }}
          onMouseEnter={() => setHovered("pixelErase")}
          onMouseLeave={() => setHovered(null)}
        >
          <button
            onClick={() => onModeChange("pixelErase")}
            style={getButtonStyle("pixelErase")}
            aria-label="픽셀 지우개"
          >
            <FaEraser />
          </button>
          {hovered === "pixelErase" && (
            <Tooltip>픽셀 지우개: 배경을 칠합니다.</Tooltip>
          )}
        </div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <button
          onClick={onClearAll}
          style={clearButtonStyle}
          title="캔버스의 모든 내용 지우기"
        >
          전체 지우기
        </button>
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#666",
          lineHeight: 1.4,
        }}
      >
        {drawingMode === "draw" && "모드: 자유곡선을 그립니다."}
        {drawingMode === "select" && "모드: 객체 클릭 후 이동/크기 조절."}
        {drawingMode === "brush" && "모드: 브러시로 점을 찍습니다."}
        {drawingMode === "erase" &&
          `모드: 선/점을 지웁니다 (크기: ${eraserSize}px).`}
        {drawingMode === "pixelErase" &&
          `모드: 배경을 칠합니다 (크기: ${eraserSize}px).`}
      </div>
    </div>
  );
}
