import React from "react";
import { MdDelete } from "react-icons/md";

export default function CanvasView({
  canvasRef,
  isDragOver,
  deleteIconPos,
  drawingMode,
  onDragOver,
  onDragLeave,
  onDrop,
  onDeleteSelection,
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        border: isDragOver ? "3px dashed #007bff" : "none",
        backgroundColor: isDragOver ? "rgba(0, 123, 255, 0.1)" : "transparent",
        transition: "all 0.2s ease",
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <canvas ref={canvasRef} />

      {isDragOver && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "rgba(0, 123, 255, 0.9)",
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: "bold",
            pointerEvents: "none",
            zIndex: 9999,
          }}
        >
          이미지를 여기에 놓으세요
        </div>
      )}
    </div>
  );
}
