
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaPen, FaPaintBrush, FaEraser, FaRegTrashAlt } from "react-icons/fa";
import { PiSelectionPlusBold } from "react-icons/pi";
import ColorPicker from "./ColorPicker.jsx";
import "../styles/CanvasTools.css"; // 이렇게 수정


const CanvasTools = React.memo(function CanvasTools({
  drawingMode = "draw",
  eraserSize = 20,
  drawingColor = "#222222",
  onModeChange,
  onClearAll,
  onColorChange,
  onColorPreview,
}) {
  const [hovered, setHovered] = useState(null);

  const anchorRefs = {
    draw: useRef(null),
    select: useRef(null),
    brush: useRef(null),
    erase: useRef(null),
    pixelErase: useRef(null),
    clear: useRef(null),
    color: useRef(null),
  };

  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  const getTooltipText = (mode) => {
    switch (mode) {
      case "draw":
        return "그리기(P): 자유곡선을 그립니다.";
      // case "select":
      //   return "선택(V): 객체 이동/크기 조절.";
      case "brush":
        return "브러시(B): 점을 찍습니다.";
      case "erase":
        return "지우개(E): 선과 점을 지웁니다.";
      case "pixelErase":
        return "픽셀 지우개: 배경을 칠합니다.";
      default:
        return "";
    }
  };

  useEffect(() => {
    if (!hovered) return;
    const el = anchorRefs[hovered]?.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setTooltipPos({
        top: Math.round(r.top + r.height / 2),
        left: Math.round(r.right + 8),
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [hovered]);

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

  const TooltipPortal = () =>
    hovered
      ? createPortal(
          <div
            style={{
              position: "fixed",
              top: tooltipPos.top,
              left: tooltipPos.left,
              transform: "translateY(-50%)",
              background: "#000",
              color: "#fff",
              padding: "6px 8px",
              borderRadius: 6,
              fontSize: 12,
              whiteSpace: "nowrap",
              zIndex: 9999,
              boxShadow: "0 2px 6px rgba(0,0,0,.2)",
              pointerEvents: "none",
            }}
          >
            {hovered === "clear"
              ? "전체 지우기: 캔버스의 모든 내용 삭제."
              : getTooltipText(hovered)}
          </div>,
          document.body
        )
      : null;

  const handleNativeColorChange = (e) => {
    const newColor = e.target.value;
    onColorChange?.(newColor);
  };

  return (
    <div style={{ padding: "12px 0" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div
          ref={anchorRefs.draw}
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
        </div>

        <div
          ref={anchorRefs.select}
          style={{ position: "relative", display: "inline-flex", zIndex: 1000 }}
          onMouseEnter={() => setHovered("select")}
          onMouseLeave={() => setHovered(null)}
        >
          {/* <button
            onClick={() => onModeChange("select")}
            style={getButtonStyle("select")}
            aria-label="선택"
          >
            <PiSelectionPlusBold />
          </button> */}
        </div>

        <div
          ref={anchorRefs.brush}
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
        </div>

        <div
          ref={anchorRefs.erase}
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
        </div>

        <div
          ref={anchorRefs.pixelErase}
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
        </div>
      </div>

      {/* 색상 선택 - 완전한 정사각형 (내부도 정사각형) */}
      <div style={{ marginBottom: "12px" }}>
        <h5 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: 600 }}>
          색상 선택
        </h5>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
          <input
            ref={anchorRefs.color}
            type="color"
            value={drawingColor}
            onChange={handleNativeColorChange}
            className="square-color-picker"
            aria-label="색상 선택"
            title={drawingColor}
            style={{
              width: 32,
              height: 32,
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "scale(1.1)";
              e.target.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
            }}
          />
          <span style={{ 
            fontFamily: "monospace", 
            fontSize: 13,
            color: "#666",
            marginLeft: 2
          }}>
            {drawingColor}
          </span>
        </div>
      </div>

      {/* 전체 지우기 버튼 */}
      <div style={{ marginBottom: "12px" }}>
        <button
          ref={anchorRefs.clear}
          onClick={onClearAll}
          style={clearButtonStyle}
          aria-label="전체 지우기"
          onMouseEnter={() => setHovered("clear")}
          onMouseLeave={() => setHovered(null)}
          title="캔버스의 모든 내용 지우기"
        >
          <FaRegTrashAlt />
        </button>
      </div>

      <TooltipPortal />
    </div>
  );
});

export default CanvasTools;
