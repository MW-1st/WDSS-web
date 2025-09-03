import React, { useState } from "react";
import client from "../api/client";

export default function ImageUpload({
  projectId = 1,
  sceneId = 1,
  onUploaded,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const handleFileChangeAndUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadStatus("이미지 파일만 업로드 가능합니다.");
      return;
    }

    setSelectedFile(file);
    setUploading(true);
    setUploadStatus("업로드 중..");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await client.post(
        `/projects/${projectId}/scenes/${sceneId}/upload-image`,
        formData
      );

      setUploadStatus("업로드 완료!");
      console.log("Upload success:", response.data);

      // 공개 URL 생성 (/uploads/*)
      const filePath = String(response.data?.image_url || "");
      const normalized = filePath.replace(/\\/g, "/");
      const parts = normalized.split("/");
      const filename = parts[parts.length - 1] || "";
      const webUrl = `${client.defaults.baseURL.replace(
        /\/$/,
        ""
      )}/uploads/${filename}`;
      if (typeof onUploaded === "function") onUploaded(webUrl);

      setSelectedFile(null);
      event.target.value = "";
    } catch (error) {
      console.error("Upload error:", error);
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || `서버 오류 (${status})`;
        if (status === 404) {
          setUploadStatus("업로드 실패: API 엔드포인트를 찾을 수 없습니다.");
        } else {
          setUploadStatus(`업로드 실패: ${message}`);
        }
      } else if (error.request) {
        setUploadStatus("업로드 실패: 서버에서 응답이 없습니다.");
      } else {
        setUploadStatus("업로드 중 예기치 않은 오류가 발생했습니다.");
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
            onChange={handleFileChangeAndUpload}
            className="block w-full text-sm text-white
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
            <p>선택 파일: {selectedFile.name}</p>
            <p>크기: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            <p>타입: {selectedFile.type}</p>
          </div>
        )}

        {uploadStatus && (
          <div
            className={`text-sm p-2 rounded ${
              uploadStatus.includes("완료")
                ? "bg-green-100 text-green-700"
                : uploadStatus.includes("실패") || uploadStatus.includes("오류")
                ? "bg-red-100 text-red-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {uploadStatus}
          </div>
        )}
      </div>
    </div>
  );
}
