import React, { useRef, useState } from "react";
import Canvas from "../components/Canvas.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
import ImageGallery from "../components/ImageGallery.jsx";
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
      
      // 캔버스에 펜으로 그린 내용이 있는지 확인
      const hasContent = stageRef.current.hasDrawnContent && stageRef.current.hasDrawnContent();
      
      if (hasContent) {
        console.log("캔버스에 그려진 내용이 있어서 캔버스를 변환합니다");
        // 현재 캔버스 내용을 이미지로 변환
        const canvasImage = stageRef.current.exportCanvasAsImage();
        
        if (!canvasImage) {
          alert("캔버스 이미지를 생성할 수 없습니다.");
          setProcessing(false);
          return;
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = async () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          // 캔버스를 blob으로 변환
          canvas.toBlob(async (blob) => {
            const fd = new FormData();
            fd.append('image', blob, 'canvas_drawing.png');
            
            try {
              // 먼저 캔버스 이미지를 업로드
              console.log("캔버스 이미지를 업로드합니다");
              const uploadResp = await client.post(`/projects/1/scenes/${sceneId}/upload-image`, fd);
              const uploadedImagePath = uploadResp.data?.image_url;
              
              if (!uploadedImagePath) {
                alert("캔버스 이미지 업로드에 실패했습니다.");
                setProcessing(false);
                return;
              }
              
              console.log("업로드된 이미지:", uploadedImagePath);
              
              // 업로드된 이미지를 변환
              const resp = await client.post(
                `/image/process?target_dots=${encodeURIComponent(targetDots)}&scene_id=${encodeURIComponent(sceneId)}`
              );
              let outputUrl = resp.data?.output_url || "";
              console.log("변환 완료, 서버 응답:", resp.data);
              console.log("새로운 SVG URL:", outputUrl);
              
              if (!outputUrl) {
                alert("서버에서 변환된 이미지 URL을 받지 못했습니다.");
                setProcessing(false);
                return;
              }
              
              // 먼저 캔버스 초기화 (기존 내용 제거)
              if (stageRef.current && stageRef.current.clear) {
                stageRef.current.clear();
              }
              
              let finalUrl;
              if (outputUrl.startsWith("http")) {
                finalUrl = outputUrl;
              } else {
                const base = client.defaults.baseURL?.replace(/\/$/, "") || "";
                const path = String(outputUrl).replace(/\\/g, "/");
                finalUrl = `${base}/${path.replace(/^\//, "")}`;
              }
              
              console.log("최종 이미지 URL:", finalUrl);
              setImageUrl(finalUrl);
            } catch (e) {
              console.error("Canvas transform error", e);
              alert("캔버스 변환 중 오류가 발생했습니다.");
            } finally {
              setProcessing(false);
            }
          }, 'image/png');
        };
        
        img.src = canvasImage;
      } else {
        console.log("캔버스에 그려진 내용이 없어서 기존 이미지를 변환합니다");
        // 기존 로직: 업로드된 이미지가 있을 때
        const resp = await client.post(
          `/image/process?target_dots=${encodeURIComponent(targetDots)}&scene_id=${encodeURIComponent(sceneId)}`
        );
        let outputUrl = resp.data?.output_url || "";
        if (outputUrl.startsWith("http")) {
          setImageUrl(outputUrl);
        } else {
          const base = client.defaults.baseURL?.replace(/\/$/, "") || "";
          const path = String(outputUrl).replace(/\\/g, "/");
          setImageUrl(`${base}/${path.replace(/^\//, "")}`);
        }
        setProcessing(false);
      }
    } catch (e) {
      console.error("Transform error", e);
      alert("이미지 변환 중 오류가 발생했습니다.");
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
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* 이미지 갤러리 사이드바 */}
      <ImageGallery projectId={1} sceneId={1} />
      
      {/* 메인 편집 영역 */}
      <section className="p-6" style={{ flex: 1, overflowY: 'auto' }}>
        <h1 className="text-2xl font-bold mb-4">Editor</h1>
        <p className="text-gray-600 mb-6">
          왼쪽에서 이미지를 업로드하고 캔버스로 드래그하여 배치할 수 있습니다. 
          캔버스에서 그리기 및 변환하거나 Unity 시뮬레이터와 연동할 수 있습니다.
        </p>

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
    </div>
  );
}
