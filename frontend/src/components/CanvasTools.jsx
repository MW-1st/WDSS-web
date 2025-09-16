import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaPen, FaPaintBrush, FaEraser, FaRegTrashAlt } from "react-icons/fa";
import "../styles/CanvasTools.css";

const CanvasTools = React.memo(function CanvasTools({
  drawingMode = "draw",
  drawingColor = "#222222",
  onModeChange,
  onClearAll,
  onColorChange,
  isSceneTransformed = false,
}) {
  const [hovered, setHovered] = useState(null);

  const anchorRefs = {
    drawTool: useRef(null),
    erase: useRef(null),
    pixelErase: useRef(null),
    clear: useRef(null),
    color: useRef(null),
  };

  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  const getTooltipText = (mode) => {
    switch (mode) {
      case "drawTool":
        return isSceneTransformed
          ? "브러시(P): 점을 찍습니다."
          : "그리기(P): 자유곡선을 그립니다.";
      case "erase":
        return "지우개(E): 선과 점을 지웁니다.";
      case "pixelErase":
        return "픽셀 지우개: 배경을 칠합니다.";
      default:
        return "";
    }
  };

  const handleDrawToolClick = () => {
    const targetMode = isSceneTransformed ? 'brush' : 'draw';
    onModeChange(targetMode);
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

  const getButtonClasses = (mode) => {
    let isActive = false;
    if (mode === "drawTool") {
      isActive = drawingMode === 'draw' || drawingMode === 'brush';
    } else {
      isActive = drawingMode === mode;
    }
    return `tool-button ${isActive ? 'active' : ''}`;
  };

  const TooltipPortal = () =>
    hovered
      ? createPortal(
          <div className="tooltip" style={{ top: tooltipPos.top, left: tooltipPos.left }}>
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
    <div className="canvas-tools-container">
      <div
        ref={anchorRefs.drawTool}
        className="tool-anchor"
        onMouseEnter={() => setHovered("drawTool")}
        onMouseLeave={() => setHovered(null)}
      >
        <button
          onClick={handleDrawToolClick}
          className={getButtonClasses("drawTool")}
          aria-label={isSceneTransformed ? "브러시" : "그리기"}
        >
          {isSceneTransformed ? <FaPaintBrush /> : <FaPen />}
        </button>
      </div>

      <div className="tool-anchor color-picker-group">
        <div className="color-picker-wrapper">
          <input
            ref={anchorRefs.color}
            type="color"
            value={drawingColor}
            onChange={handleNativeColorChange}
            className="square-color-picker"
            aria-label="색상 선택"
            title={drawingColor}
          />
        </div>
      </div>

      <div
        ref={anchorRefs.erase}
        className="tool-anchor"
        onMouseEnter={() => setHovered("erase")}
        onMouseLeave={() => setHovered(null)}
      >
        <button
          onClick={() => onModeChange("erase")}
          className={getButtonClasses("erase")}
          aria-label="지우개"
        >
          <FaEraser />
        </button>
      </div>

      <div
        ref={anchorRefs.pixelErase}
        className="tool-anchor"
        onMouseEnter={() => setHovered("pixelErase")}
        onMouseLeave={() => setHovered(null)}
      >
        <button
          onClick={() => onModeChange("pixelErase")}
          className={getButtonClasses("pixelErase")}
          aria-label="픽셀 지우개"
        >
          <FaEraser />
        </button>
      </div>

      <div
        ref={anchorRefs.clear}
        className="tool-anchor"
        onMouseEnter={() => setHovered("clear")}
        onMouseLeave={() => setHovered(null)}
      >
        <button
          onClick={onClearAll}
          className="tool-button clear-button"
          aria-label="전체 지우기"
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
