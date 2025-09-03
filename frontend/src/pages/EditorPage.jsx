import React, { useRef, useState } from "react";
import Canvas from "../components/Canvas.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
import client from "../api/client";
import { useUnity } from "../contexts/UnityContext.jsx";

export default function EditorPage() {
  // image change 관련 상태
  const [imageUrl, setImageUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [targetDots, setTargetDots] = useState(2000);
  const stageRef = useRef(null);
  const sceneId = 1; // 현재 에디터의 씬 ID (임시 하드코딩)

  // unity 관련 상태
  const { isUnityVisible, showUnity, hideUnity, sendTestData } = useUnity();

  // 업로드 완료 핸들러
  const handleUploaded = (webUrl) => {
    setImageUrl(webUrl || "");
  };

  // 이미지 변환 핸들러
  const handleTransform = async () => {
    if (!stageRef.current) return;
    try {
      setProcessing(true);
      const resp = await client.post(
        `/image/process?target_dots=${encodeURIComponent(
          targetDots
        )}&scene_id=${encodeURIComponent(sceneId)}`
      );
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

  // 버튼 스타일
  const buttonStyle = {
    padding: "10px 20px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    marginRight: "10px",
  };
  const sendButtonStyle = { ...buttonStyle, backgroundColor: "#28a745" };
  const closeButtonStyle = { ...buttonStyle, backgroundColor: "#dc3545" };

  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold mb-4">Editor</h1>
      <p className="text-gray-600 mb-6">
        이미지 업로드 후 캔버스에서 확인/변환하거나 Unity 시뮬레이터와 연동할 수
        있습니다.
      </p>

      {/* 이미지 업로드 */}
      <ImageUpload projectId={1} sceneId={1} onUploaded={handleUploaded} />

      {/* 변환 기능 */}
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
        {/* JSON 파일 생성 버튼 */}
        <div className="mb-2">
          <button
            onClick={async () => {
              try {
                if (!stageRef.current || !stageRef.current.getCurrentCanvasAsSvg) {
                  alert("캔버스가 준비되지 않았습니다.");
                  return;
                }
                
                // 현재 캔버스의 수정된 상태를 SVG로 가져오기
                const canvasSvgData = stageRef.current.getCurrentCanvasAsSvg();
                
                if (!canvasSvgData || canvasSvgData.totalDots === 0) {
                  alert("그릴 도트가 없습니다. 먼저 이미지를 변환하거나 그림을 그려주세요.");
                  return;
                }
                
                // 수정된 캔버스 SVG를 Blob으로 변환
                const svgBlob = new Blob([canvasSvgData.svgString], { type: "image/svg+xml" });
                const fd = new FormData();
                fd.append(
                  "file",
                  new File([svgBlob], "modified_canvas.svg", { type: "image/svg+xml" })
                );
                
                // 기존 엔드포인트 사용
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
                    alert(`수정된 캔버스가 JSON으로 생성되었고 Unity로 데이터가 전송되었습니다! (총 ${canvasSvgData.totalDots}개 도트)`);
                  } else {
                    alert(`수정된 캔버스가 JSON으로 생성되었습니다! (총 ${canvasSvgData.totalDots}개 도트)`);
                  }
                } else {
                  alert("JSON 생성에 실패했습니다.");
                }
              } catch (e) {
                console.error("SVG to JSON error", e);
                alert("JSON 생성 중 오류가 발생했습니다.");
              }
            }}
            className="px-4 py-2 mr-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            JSON 파일로만들기
          </button>
        </div>
        <button
          onClick={handleTransform}
          disabled={processing}
          className={`px-4 py-2 rounded text-white ${
            processing ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {processing ? "변환 중..." : "변환"}
        </button>
      </div>

      {/* Unity 기능 */}
      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
        }}
      >
        <div style={{ marginBottom: "15px" }}>
          {!isUnityVisible ? (
            <button style={buttonStyle} onClick={showUnity}>
              🎮 Unity 시뮬레이터 열기
            </button>
          ) : (
            <button style={closeButtonStyle} onClick={hideUnity}>
              🎮 Unity 시뮬레이터 닫기
            </button>
          )}
        </div>
        <p style={{ fontSize: '14px', color: '#666', margin: '0' }}>
          Unity 시뮬레이터를 열고 'JSON 파일로만들기' 버튼을 클릭하면 Unity로 데이터가 자동 전송됩니다.
        </p>
      </div>

      {/* 캔버스 */}
      <Canvas
        width={800}
        height={500}
        imageUrl={imageUrl}
        stageRef={stageRef}
      />
    </section>
  );
}
