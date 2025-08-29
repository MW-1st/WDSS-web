import { useRef, useState, useEffect } from "react";
import { Stage, Layer, Rect, Line } from "react-konva";

/**
 * - 드래그 가능한 사각형 1개
 * - 마우스 드로잉(자유곡선) 기본
 */
export default function Canvas({ width = 800, height = 500 }) {
  const [lines, setLines] = useState([]); // { points: number[] }
  const isDrawing = useRef(false);

  const handleMouseDown = (e) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines((prev) => [...prev, { points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    setLines((prev) => {
      const last = prev[prev.length - 1];
      last.points = last.points.concat([point.x, point.y]);
      return [...prev.slice(0, prev.length - 1), last];
    });
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  // 캔버스 크기 반응형(옵션)
  useEffect(() => {
    // 필요 시 리사이즈 로직 추가
  }, []);

  return (
    <Stage
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMousemove={handleMouseMove}
      onMouseup={handleMouseUp}
      style={{ border: "1px solid #ddd", background: "#fafafa" }}
    >
      <Layer>
        <Rect
          x={50}
          y={50}
          width={120}
          height={80}
          fill="#ddd"
          stroke="#333"
          draggable
          cornerRadius={8}
        />
        {lines.map((l, i) => (
          <Line
            key={i}
            points={l.points}
            stroke="#222"
            strokeWidth={2}
            tension={0.3}
            lineCap="round"
            lineJoin="round"
          />
        ))}
      </Layer>
    </Stage>
  );
}
