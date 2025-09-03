import React from "react";
import client from "../api/client";

export default function ImageTransformControls({
  targetDots,
  setTargetDots,
  processing,
  onTransform,
  imageUrl,
  sceneId = 1
}) {
  const handleJsonGeneration = async () => {
    try {
      if (!imageUrl || !imageUrl.endsWith(".svg")) {
        alert("먼저 변환하여 SVG를 생성해주세요.");
        return;
      }

      const resp = await fetch(imageUrl);
      const svgBlob = await resp.blob();
      const fd = new FormData();
      fd.append(
        "file",
        new File([svgBlob], "canvas.svg", { type: "image/svg+xml" })
      );

      const jsonResp = await client.post("/image/svg-to-json", fd);
      const jsonUrl = jsonResp.data?.json_url;
      const unitySent = jsonResp.data?.unity_sent;

      if (jsonUrl) {
        const base = client.defaults.baseURL?.replace(/\/$/, '') || '';
        const full = jsonUrl.startsWith('http')
          ? jsonUrl
          : `${base}/${jsonUrl.replace(/^\//,'')}`;
        window.open(full, '_blank', 'noopener');

        if (unitySent) {
          alert('JSON 파일이 생성되었고 Unity로 데이터가 전송되었습니다!');
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
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-3">
        <label className="text-sm text-gray-700 flex items-center">
          Target dots:
          <span
            style={{
              display: "inline-block",
              minWidth: "50px",
              textAlign: "right",
            }}
          >
            {targetDots}
          </span>
        </label>
        <input
          type="range"
          min={100}
          max={10000}
          step={100}
          value={targetDots}
          onChange={(e) => setTargetDots(parseInt(e.target.value, 10))}
        />
      </div>

      <div className="mb-2">
        <button
          onClick={handleJsonGeneration}
          className="px-4 py-2 mr-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          JSON 파일로만들기
        </button>
      </div>

      <button
        onClick={onTransform}
        disabled={processing}
        className={`px-4 py-2 rounded text-white ${
          processing ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {processing ? "변환 중..." : "변환"}
      </button>
    </div>
  );
}