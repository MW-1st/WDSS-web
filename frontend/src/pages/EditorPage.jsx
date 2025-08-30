import React, { useState } from 'react';
import client from "../api/client"; // axios 인스턴스
import Canvas from "../components/Canvas.jsx";

const ImageUpload = ({ projectId = 1, sceneId = 1 }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setSelectedFile(file);
        setUploadStatus('');
      } else {
        setUploadStatus('이미지 파일만 업로드 가능합니다.');
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('파일을 선택해주세요.');
      return;
    }

    setUploading(true);
    setUploadStatus('업로드 중...');

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      // 🚀 1. API 호출 (이 부분은 원래 코드와 동일)
      const response = await client.post(`/projects/${projectId}/scenes/${sceneId}/upload-image`, formData);

      // 🚀 2. 성공 처리 (axios는 2xx 상태 코드만 try 블록으로 전달)
      // response.status가 200인지 확인할 필요 없이, 이 코드가 실행되면 성공한 것입니다.
      // response.data에 자동으로 파싱된 JSON 객체가 들어 있습니다.
      setUploadStatus('업로드 완료!');
      console.log('Upload success:', response.data);

      setSelectedFile(null);
      document.getElementById('fileInput').value = '';

    } catch (error) {
      // 🚀 3. 에러 처리 (4xx, 5xx 상태 코드나 네트워크 오류는 모두 catch 블록으로 전달)
      console.error('Upload error:', error);

      // 서버가 응답을 한 경우 (4xx, 5xx 에러)
      if (error.response) {
        const status = error.response.status;
        // 서버가 보낸 에러 메시지가 있다면 사용하고, 없다면 기본 메시지 사용
        const message = error.response.data?.message || `서버 오류 (${status})`;

        if (status === 404) {
          setUploadStatus('업로드 실패: API 엔드포인트를 찾을 수 없습니다.');
        } else {
          setUploadStatus(`업로드 실패: ${message}`);
        }
      }
      // 서버가 응답하지 않은 경우 (네트워크 문제 등)
      else if (error.request) {
        setUploadStatus('업로드 실패: 서버에서 응답이 없습니다.');
      }
      // 요청을 보내기 전에 발생한 오류
      else {
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
        {/* 파일 선택 */}
        <div>
          <input
            id="fileInput"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500
                     file:mr-4 file:py-2 file:px-4
                     file:rounded-full file:border-0
                     file:text-sm file:font-semibold
                     file:bg-blue-50 file:text-blue-700
                     hover:file:bg-blue-100"
            disabled={uploading}
          />
        </div>

        {/* 선택된 파일 정보 */}
        {selectedFile && (
          <div className="text-sm text-gray-600">
            <p>선택된 파일: {selectedFile.name}</p>
            <p>크기: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            <p>타입: {selectedFile.type}</p>
          </div>
        )}

        {/* 업로드 버튼 */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600
                   disabled:bg-gray-300 disabled:cursor-not-allowed
                   transition-colors duration-200"
        >
          {uploading ? '업로드 중...' : '이미지 업로드'}
        </button>

        {/* 상태 메시지 */}
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

      {/* 이미지 업로드 컴포넌트 */}
      <ImageUpload projectId={1} sceneId={1} />

      {/* 캔버스 컴포넌트 */}
      <Canvas width={800} height={500} />
    </section>
  );
}