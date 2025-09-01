import React, { useRef, useState } from 'react';
import Canvas from "../components/Canvas.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
import client from "../api/client";

export default function EditorPage() {
  const [imageUrl, setImageUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const stageRef = useRef(null);

  const handleUploaded = (webUrl) => {
    setImageUrl(webUrl || "");
  };

  const handleTransform = async () => {
    if (!stageRef.current) return;
    try {
      setProcessing(true);
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      const formData = new FormData();
      formData.append("file", new File([blob], "canvas.png", { type: "image/png" }));

      const resp = await client.post("/image/process", formData);
      const outputPath = resp.data?.output_path || "";
      const normalized = String(outputPath).replace(/\\/g, "/");
      const publicPath = normalized.replace(/^\.?\/?uploaded_images\/?/, "uploads/");
      const webUrl = `${client.defaults.baseURL.replace(/\/$/, "")}/${publicPath.replace(/^\//, "")}`;
      setImageUrl(webUrl);
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

