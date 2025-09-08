import React, { useState, useEffect, useCallback  } from "react";
import client from "../api/client.js";
import { getImageUrl } from '../utils/imageUtils';

export default function ImageGallery({ onImageDragStart }) {
  
  const [uploadedImages, setUploadedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  

  // // localStorage에서 이미지 목록 로드
  // useEffect(() => {
  //   const savedImages = localStorage.getItem('gallery_images');
  //   if (savedImages) {
  //     try {
  //       setUploadedImages(JSON.parse(savedImages));
  //     } catch (e) {
  //       console.error('이미지 목록 로드 실패:', e);
  //     }
  //   }
  // }, []);
  //
  // // 이미지 목록이 변경될 때 localStorage에 저장
  // useEffect(() => {
  //   if (uploadedImages.length > 0) {
  //     localStorage.setItem('gallery_images', JSON.stringify(uploadedImages));
  //   }
  // }, [uploadedImages]);
  //
  // const handleFileUpload = (event) => {
  //   const files = event.target.files;
  //   if (files) {
  //     Array.from(files).forEach(file => {
  //       const reader = new FileReader();
  //       reader.onload = (e) => {
  //         const imageUrl = e.target.result;
  //         setUploadedImages(prev => {
  //           if (prev.includes(imageUrl)) return prev;
  //           return [...prev, imageUrl];
  //         });
  //       };
  //       reader.readAsDataURL(file);
  //     });
  //   }
  // };

  // ✨ 1. 이미지 목록을 불러오는 함수를 분리하고 useCallback으로 감싸줍니다.
  const fetchUploadedImages = useCallback(async () => {
    try {
      const { data } = await client.get('/image/my-images');
      if (data.images) {
        const fullUrls = data.images.map(relativeUrl => getImageUrl(relativeUrl));
        setUploadedImages(fullUrls);
      }
    } catch (error) {
      console.error("갤러리 이미지를 불러오는 데 실패했습니다:", error);
    }
  }, []); // 의존성 배열을 비워 이 함수가 재생성되지 않도록 합니다.


  // ✨ 2. 컴포넌트가 처음 로드될 때 위에서 만든 함수를 호출합니다.
  useEffect(() => {
    fetchUploadedImages();
  }, [fetchUploadedImages]); // fetchUploadedImages를 의존성 배열에 추가합니다.


  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(async (file) => {
        try {
          const formData = new FormData();
          formData.append("image", file);

          const endpointUrl = `/image/upload`;
          const { data } = await client.post(endpointUrl, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          // ✨ 3. 업로드 성공 시, 주석을 해제하고 서버에서 목록을 다시 불러옵니다.
          if (data.success && data.image_url) {
            console.log(`'${file.name}' 업로드 성공!`);
            // 최신 이미지 목록을 다시 불러와 갤러리를 갱신합니다.
            await fetchUploadedImages();
          }
        } catch (error) {
          console.error(`'${file.name}' 업로드 실패:`, error);
          alert(`'${file.name}'을 업로드하는 중 오류가 발생했습니다.`);
        }
      });
    }
  }

  const handleDragStart = (e, imageUrl) => {
    e.dataTransfer.setData("text/plain", imageUrl);
    e.dataTransfer.effectAllowed = "copy";
    if (onImageDragStart) {
      onImageDragStart(imageUrl);
    }
  };

  // const removeImage = (indexToRemove) => {
  //   setUploadedImages(prev => {
  //     const updated = prev.filter((_, index) => index !== indexToRemove);
  //     // localStorage 업데이트
  //     if (updated.length > 0) {
  //       localStorage.setItem('gallery_images', JSON.stringify(updated));
  //     } else {
  //       localStorage.removeItem('gallery_images');
  //     }
  //     return updated;
  //   });
  // };

  const removeImage = async (imageUrlToRemove) => {
    // 사용자에게 삭제 여부를 다시 한번 확인합니다.
    if (!window.confirm("이 이미지를 영구적으로 삭제하시겠습니까?")) {
      return;
    }

    try {
      setLoading(true); // 로딩 상태 시작

      // 1. 백엔드에 이미지 URL을 보내 삭제를 요청합니다.
      await client.delete('/image/delete', {
        data: { imageUrl: imageUrlToRemove } // axios.delete에서 body는 data 객체 안에 넣어야 합니다.
      });

      console.log(`'${imageUrlToRemove}' 삭제 성공!`);

      // 2. 삭제 성공 후, 서버에서 최신 이미지 목록을 다시 불러옵니다.
      await fetchUploadedImages();

    } catch (error) {
      console.error("이미지 삭제 실패:", error);
      alert("이미지를 삭제하는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false); // 로딩 상태 종료
    }
  };

  return (
    <div style={{ 
      width: '250px', 
      padding: '10px', 
      backgroundColor: '#f8f9fa',
      borderRight: '1px solid #dee2e6',
      height: '100vh',
      overflowY: 'auto'
    }}>
      <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>이미지 갤러리</h3>
      
      {/* 이미지 업로드 섹션 */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
      </div>

      {/* 업로드된 이미지들 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {uploadedImages.map((imageUrl, index) => (
          <div key={index} style={{ 
            position: 'relative',
            border: '1px solid #ddd',
            borderRadius: '4px',
            overflow: 'hidden',
            backgroundColor: 'white'
          }}>
            <img
              src={imageUrl}
              alt={`업로드된 이미지 ${index + 1}`}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, imageUrl)}
              style={{
                width: '100%',
                height: '120px',
                objectFit: 'cover',
                cursor: 'grab',
                userSelect: 'none'
              }}
              onDragEnd={(e) => {
                e.target.style.cursor = 'grab';
              }}
              onMouseDown={(e) => {
                e.target.style.cursor = 'grabbing';
              }}
              onMouseUp={(e) => {
                e.target.style.cursor = 'grab';
              }}
            />
            <button
              // onClick={() => removeImage(index)}
              onClick={() => removeImage(imageUrl)}
              style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                background: 'rgba(255, 255, 255, 0.8)',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
            <div style={{
              position: 'absolute',
              bottom: '0',
              left: '0',
              right: '0',
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '4px 8px',
              fontSize: '12px',
              textAlign: 'center'
            }}>
              드래그해서 캔버스에 추가
            </div>
          </div>
        ))}
        
        {uploadedImages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#6c757d',
            fontSize: '14px',
            marginTop: '20px',
            padding: '20px'
          }}>
            이미지를 업로드하면<br/>
            여기에 표시됩니다
          </div>
        )}
      </div>
    </div>
  );
}