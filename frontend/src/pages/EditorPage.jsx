import React, { useState } from 'react';
import client from "../api/client"; // axios 인스턴스
import Canvas from "../components/Canvas.jsx";

const ImageUpload = ({ projectId = 1, sceneId = 1 }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  // 🚀 1. 파일 선택과 업로드를 한 번에 처리하는 함수로 변경
  const handleFileChangeAndUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadStatus('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // 업로드를 위해 상태 업데이트
    setSelectedFile(file);
    setUploading(true);
    setUploadStatus('업로드 중...');

    try {
      const formData = new FormData();
      formData.append('image', file); // state 대신 방금 선택한 file 변수 사용

      const response = await client.post(`/projects/${projectId}/scenes/${sceneId}/upload-image`, formData);

      setUploadStatus('업로드 완료!');
      console.log('Upload success:', response.data);

      setSelectedFile(null); // 성공 후 선택된 파일 정보 초기화
      event.target.value = ''; // 파일 입력(input) 자체를 초기화

    } catch (error) {
      console.error('Upload error:', error);
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || `서버 오류 (${status})`;

        if (status === 404) {
          setUploadStatus('업로드 실패: API 엔드포인트를 찾을 수 없습니다.');
        } else {
          setUploadStatus(`업로드 실패: ${message}`);
        }
      } else if (error.request) {
        setUploadStatus('업로드 실패: 서버에서 응답이 없습니다.');
      } else {
        setUploadStatus('업로드 중 오류가 발생했습니다.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">이미지 업로드</h3>

      <div className="space-y-4">
        <div>
          <input
            id="fileInput"
            type="file"
            accept="image/*"
            // 🚀 2. onChange 이벤트에 새로운 통합 함수를 연결
            onChange={handleFileChangeAndUpload}
            className="block w-full text-sm text-gray-500
                     file:mr-4 file:py-2 file:px-4
                     file:rounded-full file:border-0
                     file:text-sm file:font-semibold
                     file:bg-blue-50 file:text-blue-700
                     hover:file:bg-blue-100"
            disabled={uploading}
          />
        </div>

        {selectedFile && (
          <div className="text-sm text-gray-600">
            <p>선택된 파일: {selectedFile.name}</p>
            <p>크기: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            <p>타입: {selectedFile.type}</p>
          </div>
        )}

        {/* 🚀 3. 업로드 버튼 제거 */}
        {/* <button onClick={handleUpload} ... /> */}

        {uploadStatus && (
          <div className={`text-sm p-2 rounded ${
            uploadStatus.includes('완료') 
              ? 'bg-green-100 text-green-700' 
              : uploadStatus.includes('실패') || uploadStatus.includes('오류')
              ? 'bg-red-100 text-red-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {uploadStatus}
          </div>
        )}
      </div>
    </div>
  );
};

export default function EditorPage() {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold mb-4">Editor</h1>
      <p className="text-gray-600 mb-6">간단한 Konva 캔버스 예시입니다.</p>

      <ImageUpload projectId={1} sceneId={1} />
      <Canvas width={800} height={500} />
    </section>
  );
}