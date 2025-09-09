import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaEyeDropper } from 'react-icons/fa';

const ColorPicker = React.memo(function ColorPicker({ color, onChange, onPreview }) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewColor, setPreviewColor] = useState(color);
  const canvasRef = useRef(null);
  const hueCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDraggingSaturation, setIsDraggingSaturation] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);

  // HSV to RGB conversion
  const hsvToRgb = (h, s, v) => {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r, g, b;

    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ];
  };

  // RGB to HSV conversion
  const rgbToHsv = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    if (diff !== 0) {
      if (max === r) h = ((g - b) / diff) % 6;
      else if (max === g) h = (b - r) / diff + 2;
      else h = (r - g) / diff + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    
    const s = max === 0 ? 0 : diff / max;
    const v = max;
    
    return [h, s, v];
  };

  // Hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  };

  // RGB to Hex
  const rgbToHex = (r, g, b) => {
    return "#" + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join('');
  };

  const [currentHsv, setCurrentHsv] = useState(() => {
    const [r, g, b] = hexToRgb(color);
    return rgbToHsv(r, g, b);
  });

  // 색상이 변경될 때 HSV와 미리보기 색상 동기화
  useEffect(() => {
    const [r, g, b] = hexToRgb(color);
    const newHsv = rgbToHsv(r, g, b);
    setCurrentHsv(newHsv);
    setPreviewColor(color);
  }, [color]);

  // Draw saturation/brightness canvas
  const drawSaturationCanvas = useCallback((hue) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Draw saturation gradient
    for (let x = 0; x < width; x++) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      const saturation = x / width;
      const [r, g, b] = hsvToRgb(hue, saturation, 1);
      
      gradient.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
      gradient.addColorStop(1, 'rgb(0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, 0, 1, height);
    }
  }, []);

  // Draw hue canvas (horizontal)
  const drawHueCanvas = useCallback(() => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    for (let x = 0; x < width; x++) {
      const hue = (x / width) * 360;
      const [r, g, b] = hsvToRgb(hue, 1, 1);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x, 0, 1, height);
    }
  }, []);

  // Initialize canvases
  useEffect(() => {
    // 컴포넌트가 마운트된 후 즉시 캔버스를 그리도록 setTimeout 사용
    const timer = setTimeout(() => {
      drawHueCanvas();
      drawSaturationCanvas(currentHsv[0]);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [drawHueCanvas, drawSaturationCanvas, currentHsv]);

  // 팔레트가 열릴 때마다 캔버스를 다시 그리기
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        drawHueCanvas();
        drawSaturationCanvas(currentHsv[0]);
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, drawHueCanvas, drawSaturationCanvas, currentHsv]);

  // Handle saturation/brightness canvas interaction
  const handleSaturationMouseMove = useCallback((e) => {
    if (!isDraggingSaturation && e.type !== 'mousedown') return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    
    const saturation = x / rect.width;
    const brightness = 1 - (y / rect.height);
    
    const newHsv = [currentHsv[0], saturation, brightness];
    setCurrentHsv(newHsv);
    
    const [r, g, b] = hsvToRgb(...newHsv);
    const hexColor = rgbToHex(r, g, b);
    setPreviewColor(hexColor);
    
    if (onPreview) {
      onPreview(hexColor);
    }
  }, [isDraggingSaturation, currentHsv, onPreview]);

  // Handle hue canvas interaction
  const handleHueMouseMove = useCallback((e) => {
    if (!isDraggingHue && e.type !== 'mousedown') return;
    const canvas = hueCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const hue = (x / rect.width) * 360;
    const newHsv = [hue, currentHsv[1], currentHsv[2]];
    setCurrentHsv(newHsv);
    
    drawSaturationCanvas(hue);
    
    const [r, g, b] = hsvToRgb(...newHsv);
    const hexColor = rgbToHex(r, g, b);
    setPreviewColor(hexColor);
    
    if (onPreview) {
      onPreview(hexColor);
    }
  }, [isDraggingHue, currentHsv, onPreview, drawSaturationCanvas]);

  // Mouse event handlers
  useEffect(() => {
    const handleMouseUp = (e) => {
      setIsDraggingSaturation(false);
      setIsDraggingHue(false);
      // 마우스를 떼도 onChange는 호출하지 않음 - 적용 버튼으로만 선택
    };

    const handleMouseMove = (e) => {
      handleSaturationMouseMove(e);
      handleHueMouseMove(e);
    };

    if (isDraggingSaturation || isDraggingHue) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingSaturation, isDraggingHue, handleSaturationMouseMove, handleHueMouseMove]);

  // 외부 클릭 감지로 팔레트 닫기 (드래그 중일 때는 닫지 않음)
  useEffect(() => {
    const handleClickOutside = (event) => {
      // 드래그 중이면 팔레트를 닫지 않음
      if (isDraggingSaturation || isDraggingHue) return;
      
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, isDraggingSaturation, isDraggingHue]);

  

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Color preview button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '40px',
            height: '30px',
            backgroundColor: previewColor,
            border: '2px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            padding: '0'
          }}
          title="색상 선택"
        />
        <div style={{
          fontSize: '12px',
          color: '#666',
          fontFamily: 'monospace'
        }}>
          {previewColor.toUpperCase()}
        </div>
      </div>

      {/* Color picker popup */}
      {isOpen && (
        <div 
          style={{
            position: 'absolute',
            top: '35px',
            left: '0',
            zIndex: 1000,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Saturation/Brightness canvas with handle */}
            <div style={{ position: 'relative', width: 200, height: 150 }}>
              <canvas
                ref={canvasRef}
                width={200}
                height={150}
                style={{
                  cursor: 'crosshair',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  display: 'block'
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsDraggingSaturation(true);
                  handleSaturationMouseMove(e);
                }}
              />
              {/* SV handle */}
              <div
                style={{
                  position: 'absolute',
                  left: `${Math.max(0, Math.min(200 * currentHsv[1], 200)) - 8}px`,
                  top: `${Math.max(0, Math.min(150 * (1 - currentHsv[2]), 150)) - 8}px`,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  boxShadow: '0 0 0 2px #000, inset 0 0 0 2px #fff',
                  pointerEvents: 'none'
                }}
              />
            </div>

            {/* Hue bar with handle (horizontal) */}
            <div style={{ position: 'relative', width: 200, height: 16 }}>
              <canvas
                ref={hueCanvasRef}
                width={200}
                height={16}
                style={{
                  cursor: 'crosshair',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  display: 'block'
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsDraggingHue(true);
                  handleHueMouseMove(e);
                }}
              />
              {/* Hue handle */}
              <div
                style={{
                  position: 'absolute',
                  left: `${Math.max(0, Math.min(200 * (currentHsv[0] / 360), 200)) - 8}px`,
                  top: '-6px',
                  width: 16,
                  height: 28,
                  borderRadius: 14,
                  background: 'transparent',
                  boxShadow: '0 0 0 2px #fff, 0 0 0 3px #0003',
                  pointerEvents: 'none'
                }}
              />
            </div>
          </div>
          
          {/* Color preview and controls */}
          <div style={{ marginTop: '8px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              marginBottom: '6px'
            }}>
              <div style={{
                width: '30px',
                height: '20px',
                backgroundColor: previewColor,
                border: '1px solid #ccc',
                borderRadius: '3px'
              }} />
              <input
                type="text"
                value={previewColor.toUpperCase()}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                    setPreviewColor(value);
                    const [r, g, b] = hexToRgb(value);
                    setCurrentHsv(rgbToHsv(r, g, b));
                    if (onPreview) onPreview(value);
                  }
                }}
                style={{
                  padding: '4px 6px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  width: '70px'
                }}
              />
              {/* Eyedropper */}
              <button
                onClick={async () => {
                  try {
                    if ('EyeDropper' in window) {
                      const eyeDropper = new window.EyeDropper();
                      const result = await eyeDropper.open();
                      const picked = result.sRGBHex;
                      setPreviewColor(picked);
                      const [r, g, b] = hexToRgb(picked);
                      const hsv = rgbToHsv(r, g, b);
                      setCurrentHsv(hsv);
                      drawSaturationCanvas(hsv[0]);
                      if (onPreview) onPreview(picked);
                    } else {
                      alert('이 브라우저는 스포이드(EyeDropper)를 지원하지 않습니다.');
                    }
                  } catch (err) {
                    // 사용자가 취소한 경우 등 무시
                  }
                }}
                title="스포이드로 색상 선택"
                style={{
                  width: 28,
                  height: 28,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                <FaEyeDropper />
              </button>

              <button
                onClick={() => {
                  if (onChange) onChange(previewColor);
                  setIsOpen(false);
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                적용
              </button>
            </div>
            
            {/* RGB values display */}
            <div style={{
              fontSize: '10px',
              color: '#666',
              fontFamily: 'monospace',
              display: 'flex',
              gap: '8px'
            }}>
              {(() => {
                const [r, g, b] = hsvToRgb(...currentHsv);
                return `RGB(${r}, ${g}, ${b})`;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ColorPicker;
