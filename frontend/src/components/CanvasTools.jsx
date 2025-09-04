import React from "react";
import { FaPen, FaPaintBrush, FaEraser } from "react-icons/fa";
import { PiSelectionPlusBold } from "react-icons/pi";

export default function CanvasTools({
  drawingMode = "draw",
  eraserSize = 20,
  onModeChange,
  onClearAll,
}) {
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

  return (
    <div style={{ padding: "12px 0" }}>
      <h4 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: 600 }}>
        캔버스 도구
      </h4>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          flexDirection: "column",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <button
          onClick={() => onModeChange("draw")}
          style={getButtonStyle("draw")}
          title="펜으로 그리기"
          aria-label="펜"
        >
          <FaPen />
        </button>

        <button
          onClick={() => onModeChange("select")}
          style={getButtonStyle("select")}
          title="객체 선택"
          aria-label="선택"
        >
          <PiSelectionPlusBold />
        </button>

        <button
          onClick={() => onModeChange("brush")}
          style={getButtonStyle("brush")}
          title="브러쉬로 점 찍기"
          aria-label="브러쉬"
        >
          <FaPaintBrush />
        </button>

        <button
          onClick={() => onModeChange("erase")}
          style={getButtonStyle("erase")}
          title="선 지우개"
          aria-label="선 지우개"
        >
          <FaEraser />
        </button>

        <button
          onClick={() => onModeChange("pixelErase")}
          style={getButtonStyle("pixelErase")}
          title="픽셀 지우개"
          aria-label="픽셀 지우개"
        >
          <FaEraser />
        </button>
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
        {drawingMode === "draw" && "펜 모드: 자유롭게 선을 그립니다."}
        {drawingMode === "select" && "선택 모드: 객체를 클릭해 이동/크기 조절."}
        {drawingMode === "brush" && "브러쉬 모드: 클릭하여 점을 찍습니다."}
        {drawingMode === "erase" &&
          `선 지우개: 선과 점을 지웁니다 (크기: ${eraserSize}px).`}
        {drawingMode === "pixelErase" &&
          `픽셀 지우개: 배경을 칠합니다 (크기: ${eraserSize}px).`}
      </div>
    </div>
  );
}
