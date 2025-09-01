import React from 'react';
import Canvas from "../components/Canvas.jsx";
import ImageUpload from "../components/ImageUpload.jsx"; // 🚀 분리된 컴포넌트를 import 합니다.

export default function EditorPage() {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold mb-4">Editor</h1>
      <p className="text-gray-600 mb-6">간단한 Konva 캔버스 예시입니다.</p>

      {/* 이미지 업로드 컴포넌트 */}
      {/* 일단은 1,1로 고정 */}
      <ImageUpload projectId={1} sceneId={1} />

      {/* 캔버스 컴포넌트 */}
      <Canvas width={800} height={500} />
    </section>
  );
}