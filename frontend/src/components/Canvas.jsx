import { useRef, useState, useEffect } from "react";
import { Stage, Layer, Rect, Line, Image as KonvaImage } from "react-konva";

/**
 * - 드래그 가능한 사각형 1개
 * - 마우스 드로잉(자유곡선) 기본
 */
export default function Canvas({ width = 800, height = 500, imageUrl = "", stageRef: externalStageRef }) {
  const [lines, setLines] = useState([]); // { points: number[] }
  const isDrawing = useRef(false);
  const stageRef = externalStageRef || useRef(null);
  const [imageObj, setImageObj] = useState(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0, scale: 1 });

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

  // 이미지 로드 및 스케일 계산
  useEffect(() => {
    if (!imageUrl) {
      setImageObj(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImageObj(img);
      const scale = Math.min(width / img.width, height / img.height, 1);
      setImgSize({ w: img.width, h: img.height, scale: isFinite(scale) ? scale : 1 });
    };
    img.src = imageUrl;
  }, [imageUrl, width, height]);

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMousemove={handleMouseMove}
      onMouseup={handleMouseUp}
      style={{ border: "1px solid #ddd", background: "#fafafa" }}
    >
      <Layer>
        {imageObj && (
          <KonvaImage
            image={imageObj}
            x={(width - imgSize.w * imgSize.scale) / 2}
            y={(height - imgSize.h * imgSize.scale) / 2}
            width={imgSize.w * imgSize.scale}
            height={imgSize.h * imgSize.scale}
            listening={false}
          />
        )}
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
