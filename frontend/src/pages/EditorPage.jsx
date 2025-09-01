import React, { useRef, useState } from 'react';
import Canvas from "../components/Canvas.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
import client from "../api/client";

export default function EditorPage() {
  const [imageUrl, setImageUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [targetDots, setTargetDots] = useState(2000);
  const stageRef = useRef(null);
  const sceneId = 1; // 현재 에디터의 씬 ID (임시 하드코딩)

  const handleUploaded = (webUrl) => {
    setImageUrl(webUrl || "");
  };

  const handleTransform = async () => {
    if (!stageRef.current) return;
    try {
      setProcessing(true);
      // 원본 이미지(서버 저장본)를 기준으로 변환 요청
      const resp = await client.post(`/image/process?target_dots=${encodeURIComponent(targetDots)}&scene_id=${encodeURIComponent(sceneId)}`);
      let outputUrl = resp.data?.output_url || "";
      if (outputUrl.startsWith("http")) {
        setImageUrl(outputUrl);
      } else {
        const base = client.defaults.baseURL?.replace(/\/$/, "") || "";
        const path = String(outputUrl).replace(/\\/g, "/");
        setImageUrl(`${base}/${path.replace(/^\//, "")}`);
      }
    } catch (e) {
      console.error("Transform error", e);
      alert("이미지 변환 중 오류가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold mb-4">Editor</h1>
      <p className="text-gray-600 mb-6">이미지 업로드 후 캔버스에서 확인하고 변환할 수 있습니다.</p>

      {/* 이미지 업로드 */}
      <ImageUpload projectId={1} sceneId={1} onUploaded={handleUploaded} />

      {/* 변환 버튼 */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-3">
          <label className="text-sm text-gray-700">Target dots: {targetDots}</label>
          <input
            type="range"
            min={100}
            max={20000}
            step={100}
            value={targetDots}
            onChange={(e) => setTargetDots(parseInt(e.target.value, 10))}
          />
        </div>
        {/* JSON 파일로 만들기 버튼 (SVG → JSON) */}
        <div className="mb-2">
          <button
            onClick={async () => {
              try {
                if (!imageUrl || !imageUrl.endsWith('.svg')) {
                  alert('먼저 변환하여 SVG를 생성해주세요.');
                  return;
                }
                const resp = await fetch(imageUrl);
                const svgBlob = await resp.blob();
                const fd = new FormData();
                fd.append('file', new File([svgBlob], 'canvas.svg', { type: 'image/svg+xml' }));
                const jsonResp = await client.post('/image/svg-to-json', fd);
                const jsonUrl = jsonResp.data?.json_url;
                if (jsonUrl) {
                  const base = client.defaults.baseURL?.replace(/\/$/, '') || '';
                  const full = jsonUrl.startsWith('http') ? jsonUrl : `${base}/${jsonUrl.replace(/^\//,'')}`;
                  // 간단 알림 및 새 탭 열기
                  window.open(full, '_blank', 'noopener');
                } else {
                  alert('JSON 생성에 실패했습니다.');
                }
              } catch (e) {
                console.error('SVG to JSON error', e);
                alert('JSON 생성 중 오류가 발생했습니다.');
              }
            }}
            className="px-4 py-2 mr-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            JSON 파일로만들기
          </button>
          {/* Unity 보내기 버튼이 있다면 이 버튼 위에 위치합니다. */}
        </div>
        <button
          onClick={handleTransform}
          disabled={processing}
          className={`px-4 py-2 rounded text-white ${processing ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {processing ? "변환 중..." : "변환"}
        </button>
      </div>

      {/* 캔버스 */}
      <Canvas width={800} height={500} imageUrl={imageUrl} stageRef={stageRef} />
    </section>
  );
}
