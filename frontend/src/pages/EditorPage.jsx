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
