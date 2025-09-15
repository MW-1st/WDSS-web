import { useRef, useEffect, useState } from "react";

export default function useCanvasState({
  externalDrawingMode,
  externalEraserSize,
  externalDrawingColor,
  onSelectionChange,
  onCanvasChange,
} = {}) {
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);
  const [drawingMode, setDrawingMode] = useState(externalDrawingMode);
  const [eraserSize, setEraserSize] = useState(externalEraserSize);
  const [drawingColor, setDrawingColor] = useState(externalDrawingColor);
  const currentColorRef = useRef(externalDrawingColor);
  useEffect(() => {
    currentColorRef.current = externalDrawingColor;
  }, [externalDrawingColor]);

  const drawingModeRef = useRef(drawingMode);
  useEffect(() => {
    drawingModeRef.current = drawingMode;
  }, [drawingMode]);

  const eraseHandlers = useRef({});
  const selectionHandlers = useRef({});

  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);
  const onCanvasChangeRef = useRef(onCanvasChange);
  useEffect(() => {
    onCanvasChangeRef.current = onCanvasChange;
  }, [onCanvasChange]);

  const [isDragOver, setIsDragOver] = useState(false);
  const [canvasRevision, setCanvasRevision] = useState(0);
  const [deleteIconPos, setDeleteIconPos] = useState(null);
  const maxDroneWarningShownRef = useRef(false);
  const prevInteractMapRef = useRef(new WeakMap());

  return {
    canvasRef,
    fabricCanvas,
    drawingMode,
    setDrawingMode,
    eraserSize,
    setEraserSize,
    drawingColor,
    setDrawingColor,
    currentColorRef,
    drawingModeRef,
    eraseHandlers,
    selectionHandlers,
    onSelectionChangeRef,
    onCanvasChangeRef,
    isDragOver,
    setIsDragOver,
    canvasRevision,
    setCanvasRevision,
    deleteIconPos,
    setDeleteIconPos,
    maxDroneWarningShownRef,
    prevInteractMapRef,
  };
}
