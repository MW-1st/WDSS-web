import React from "react";
import client from "../api/client";

export default function ImageTransformControls({
  targetDots,
  setTargetDots,
  processing,
  onTransform,
  imageUrl,
  sceneId = 1,
  layout = "full",
}) {
  // Local state for smooth slider drag
  const [localDots, setLocalDots] = React.useState(Number(targetDots) || 2000);
  React.useEffect(() => {
    setLocalDots(Number(targetDots) || 2000);
  }, [targetDots]);

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const handleRangeImmediate = (e) => {
    const v = Number(e.target.value);
    const safe = Number.isFinite(v) ? clamp(v, 100, 10000) : 2000;
    setLocalDots(safe);
  };
  const commitToParent = () => {
    const safe = clamp(Number(localDots) || 2000, 100, 10000);
    if (safe !== targetDots) setTargetDots(safe);
  };
  const handleJsonGeneration = async () => {
    try {
      if (!stageRef.current || !stageRef.current.getCurrentCanvasAsSvg) {
        alert("캔버스가 준비되지 않았습니다.");
        return;
      }

      // 현재 캔버스의 수정된 상태를 SVG로 가져오기
      const canvasSvgData = stageRef.current.getCurrentCanvasAsSvg();

      if (!canvasSvgData || canvasSvgData.totalDots === 0) {
        alert(
          "그릴 도트가 없습니다. 먼저 이미지를 변환하거나 그림을 그려주세요."
        );
        return;
      }

      // 수정된 캔버스 SVG를 Blob으로 변환
      const svgBlob = new Blob([canvasSvgData.svgString], {
        type: "image/svg+xml",
      });
      const fd = new FormData();
      fd.append(
        "file",
        new File([svgBlob], "modified_canvas.svg", { type: "image/svg+xml" })
      );

      const jsonResp = await client.post("/image/svg-to-json", fd);
      const jsonUrl = jsonResp.data?.json_url;
      const unitySent = jsonResp.data?.unity_sent;

      if (jsonUrl) {
        const base = client.defaults.baseURL?.replace(/\/$/, "") || "";
        const full = jsonUrl.startsWith("http")
          ? jsonUrl
          : `${base}/${jsonUrl.replace(/^\//, "")}`;
        window.open(full, "_blank", "noopener");

        if (unitySent) {
          alert(
            `수정된 캔버스가 JSON으로 생성되었고 Unity로 데이터가 전송되었습니다! (총 ${canvasSvgData.totalDots}개 도트)`
          );
        } else {
          alert(
            `수정된 캔버스가 JSON으로 생성되었습니다! (총 ${canvasSvgData.totalDots}개 도트)`
          );
        }
      } else {
        alert("JSON 생성에 실패했습니다.");
      }
    } catch (e) {
      console.error("SVG to JSON error", e);
      alert("JSON 생성 중 오류가 발생했습니다.");
    }
  };

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm text-gray-700 mb-1">
          Target dots:
          <span className="ml-2 inline-block min-w-[50px] text-right">
            {localDots}
          </span>
        </label>
        <input
          type="range"
          min={100}
          max={10000}
          step={10}
          value={Number(localDots) || 0}
          onChange={handleRangeImmediate}
          onInput={handleRangeImmediate}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onMouseUp={commitToParent}
          onTouchEnd={commitToParent}
          onKeyUp={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) commitToParent();
          }}
          className={`${layout === "sidebar" ? "w-full" : "w-64"} cursor-pointer`}
        />
      </div>

      <div className="mb-2">
        <button
          onClick={handleJsonGeneration}
          className="px-4 py-2 mr-3 rounded !bg-blue-600 hover:!bg-blue-700 text-white"
        >
          JSON 파일로만들기
        </button>
      </div>

      <button
        onClick={onTransform}
        disabled={processing || !sceneId}
        title={
          processing
            ? "변환 중입니다"
            : !sceneId
              ? "먼저 씬을 추가/선택해 주세요"
              : undefined
        }
        className={`px-4 py-2 rounded text-white ${
          processing ? "!bg-blue-600" : "!bg-blue-600 hover:!bg-blue-700"
        }`}
      >
        {processing ? "변환 중..." : "변환"}
      </button>
    </div>
  );
}
