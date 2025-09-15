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

      {deleteIconPos && drawingMode === "select" && (
        <button
          type="button"
          onClick={onDeleteSelection}
          style={{
            // CanvasView: <canvas> 요소와 UI 오버레이를 렌더링합니다.
            // - 드래그 오버 시 오버레이를 표시하고, 선택이 있을 때 삭제 버튼을 표시합니다.
            top: deleteIconPos.top,
            background: "#dc3545",
            color: "#fff",
            border: "none",
            borderRadius: 16,
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,.25)",
            cursor: "pointer",
            zIndex: 5000,
          }}
          title="선택 영역 삭제"
          aria-label="선택 영역 삭제"
        >
          <MdDelete size={18} />
        </button>
      )}

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
