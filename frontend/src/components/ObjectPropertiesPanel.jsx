import React, { useMemo, useState, useCallback, useEffect } from "react";
import ColorPicker from "./ColorPicker.jsx";
import "../styles/ObjectPropertiesPanel.css";

function normalizeColorToHex(color) {
  if (!color) return "#000000";
  if (typeof color === "string") {
    const hexMatch = color.match(/^#([0-9a-fA-F]{6})$/);
    if (hexMatch) return `#${hexMatch[1]}`.toUpperCase();
    const rgbMatch = color.match(
      /^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/
    );
    if (rgbMatch) {
      const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10)));
      const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10)));
      const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)));
      const toHex = (v) => v.toString(16).padStart(2, "0");
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }
  }
  return "#000000";
}

function getSelectedObjectOpacity(selection) {
  if (!selection) return 1.0;
  console.log("👍🏻",selection)
  console.log("👍🏻",selection.opacity)
  return selection.opacity || 1.0;
}

{/* 구분선 */}
<div className="separator"/>
// Brightness Control Component
const BrightnessControl = ({
  value = 1.0,
  onChange,
  min = 0.0,
  max = 1.0,
  step = 0.1,
  label = "Brightness"
}) => {
  const [inputValue, setInputValue] = useState(value.toString());
  const [sliderValue, setSliderValue] = useState(value);
  const [error, setError] = useState("");

  const validateAndUpdate = useCallback((newValue) => {
    const numValue = parseFloat(newValue);

    if (isNaN(numValue)) {
      setError("유효한 숫자를 입력해주세요");
      return false;
    }

    if (numValue < min || numValue > max) {
      setError(`값은 ${min}~${max} 범위 내여야 합니다`);
      return false;

    }

    setError("");
    setSliderValue(numValue);
    onChange?.(numValue);
    return true;
  }, [min, max, onChange]);

  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    validateAndUpdate(newValue);
  }, [validateAndUpdate]);

  const handleSliderChange = useCallback((e) => {
    const newValue = parseFloat(e.target.value);
    setInputValue(newValue.toString());
    setSliderValue(newValue);
    validateAndUpdate(newValue);
  }, [validateAndUpdate]);

  // selection이 변경될 때마다 값 동기화
  useEffect(() => {
    setInputValue(value.toString());
    setSliderValue(value);
    setError("");
  }, [value]);

  return (
    <div className="brightness-control">
      <div className="brightness-input-group">
        <label className="brightness-label">{label}</label>

        <div className="brightness-number-container">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace', 'Delete', 'Enter'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
              }
            }}
            className={`brightness-number-input ${error ? 'error' : ''}`}
            aria-label={`${label} 값 입력`}
            placeholder="1.0"
          />
          <span className="brightness-unit">배율</span>
        </div>

        <div className="brightness-slider-container">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={sliderValue}
            onChange={handleSliderChange}
            className="brightness-slider"
            aria-label={`${label} 슬라이더`}
          />
          <div className="brightness-slider-labels">
            <span className="slider-min">{min}</span>
            <span className="slider-current">{sliderValue.toFixed(1)}</span>
            <span className="slider-max">{max}</span>
          </div>
        </div>

        {error && (
          <div className="brightness-error" role="alert">
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default function ObjectPropertiesPanel({
  selection,
  onChangeFill,
  onChangeBrightness,
  triggerAutoSave,
  saveToHistory,
}) {
  const isMulti = selection?.type === "activeSelection";

  // 로컬 상태로 현재 편집 중인 값들을 관리
  const [localColor, setLocalColor] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // 원본값 메모이제이션 (필드별 적용 여부 판단)
  const originalColor = useMemo(
    () => normalizeColorToHex(selection?.fill || selection?.stroke),
    [selection]
  );
  const originalOpacity = useMemo(() => {
    return getSelectedObjectOpacity(selection);
  }, [selection])
  const [localOpacity, setLocalOpacity] = useState(originalOpacity);

  // 필드별 변경 여부
  const colorChanged = useMemo(
    () => !!localColor && originalColor && localColor.toUpperCase() !== originalColor.toUpperCase(),
    [localColor, originalColor]
  );
  const opacityChanged = useMemo(
    () => Math.abs(localOpacity - originalOpacity) > 1e-6,
    [localOpacity, originalOpacity]  // brightness -> opacity
  );

  // 색깔과 brightness 둘 다에서 사용할 공통 조건
  const supportsColorAndBrightness =
    selection &&
    ((selection?.type &&
      selection.type.toLowerCase() === "activeselection") ||
    selection?.multiple ||
    (selection.customType === "svgDot" ||
      selection.customType === "drawnDot" ||
      selection.type === "circle" ||
      selection.type === "path" ||
      selection.type === "line"));

  // selection이 변경될 때마다 로컬 상태 초기화
  useEffect(() => {
    if (selection) {
      const currentColor = normalizeColorToHex(selection?.fill || selection?.stroke);
      const currentBrightness = selection?.brightness || 1.0;

      setLocalColor(currentColor);
      setLocalOpacity(currentBrightness);
      setHasChanges(false);
    }
  }, [selection]);

  // 색상 변경 핸들러
  const handleColorChange = useCallback((hex) => {
    setLocalColor(hex);
    setHasChanges(true);
  }, []);

  // 밝기 변경 핸들러
  const handleBrightnessChange = useCallback((newBrightness) => {
    setLocalOpacity(newBrightness);
    setHasChanges(true);
  }, []);

  // 초기화 버튼 핸들러
  const handleResetChanges = useCallback(() => {
    if (selection) {
      const originalColor = normalizeColorToHex(selection?.fill || selection?.stroke);
      const originalBrightness = selection?.opacity || 1.0;

      setLocalColor(originalColor);
      setLocalOpacity(originalBrightness);
      setHasChanges(false);
    }
  }, [selection]);

  // 색상/밝기 개별 적용 및 취소
  const applyColor = useCallback(() => {
    if (onChangeFill && localColor) onChangeFill(localColor);
    setHasChanges(false);
  }, [onChangeFill, localColor]);
  const resetColor = useCallback(() => {
    setLocalColor(originalColor);
    setHasChanges(false);
  }, [originalColor]);
  const applyBrightness = useCallback(() => {
    if (onChangeBrightness) onChangeBrightness(localOpacity);
    setHasChanges(false);
  }, [onChangeBrightness, localOpacity]);
  const resetBrightness = useCallback(() => {
    setLocalOpacity(originalOpacity);
    setHasChanges(false);
  }, [originalOpacity]);

  return (
    <div className="properties-panel">
        {selection && (
          <div className="header-info">
            {hasChanges && (
              <span className="changes-indicator">
              <span className="changes-dot">●</span>
                변경됨
              </span>
            )}
          </div>
        )}
      <div className="properties-panel-body">
        {!selection && (
          <div className="properties-empty">개체를 선택하세요</div>
        )}

        {selection && (
          <div className="properties-section">
            {/* Fill Color Section */}
            {supportsColorAndBrightness ? (
              <div className="properties-field color-field">
                <div className="label">Fill Color{isMulti ? " (multi)" : ""}</div>
                <ColorPicker
                  color={localColor}
                  onChange={handleColorChange}
                  onPreview={() => {}}
                />
                {colorChanged && (
                  <div className="field-actions">
                    <button type="button" className="btn-apply btn-sm" onClick={applyColor}>색상 적용</button>
                    <button type="button" className="btn-reset btn-sm" onClick={resetColor}>취소</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="properties-note">이 객체는 채우기 색상을 지원하지 않습니다.</div>
            )}
            
            {/* 색상과 밝기 사이 구분선 */}
            <div className="separator" />

            {/* Brightness Section */}
            {supportsColorAndBrightness && (
              <div className="properties-field">
                <div className="field-header">
                  <div className="label">Brightness</div>
                  <div className="field-description">
                    객체의 밝기를 조정합니다 (0.0 = 완전 어두움, 1.0 = 기본 밝기)
                  </div>
                </div>
                <BrightnessControl
                  value={originalOpacity}
                  onChange={handleBrightnessChange}
                  min={0.0}
                  max={1.0}
                  step={0.1}
                  label="Brightness"
                />
                {opacityChanged && (
                  <div className="field-actions">
                    <button type="button" className="btn-apply btn-sm" onClick={applyBrightness}>밝기 적용</button>
                    <button type="button" className="btn-reset btn-sm" onClick={resetBrightness}>취소</button>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons - 변경사항이 있을 때만 표시 */}
            {false && (
              <div className="properties-actions">
                <button
                  type="button"
                  className="btn-apply"
                  onClick={handleApplyChanges}
                >
                  <span className="btn-icon">✓</span>
                  적용
                </button>
                <button
                  type="button"
                  className="btn-reset"
                  onClick={handleResetChanges}
                >
                  <span className="btn-icon">↻</span>
                  취소
                </button>
              </div>
            )}

            {/* Additional Properties Section */}
            <div className="properties-metadata">
              <div className="metadata-item">
                <span className="metadata-label">Type:</span>
                <span className="metadata-value">
                  {selection.customType || selection.type}
                </span>
              </div>
              {selection.width && selection.height && (
                <div className="metadata-item">
                  <span className="metadata-label">Size:</span>
                  <span className="metadata-value">
                    {Math.round(selection.width)} × {Math.round(selection.height)}px
                  </span>
                </div>
              )}
              {(selection.left !== undefined && selection.top !== undefined) && (
                <div className="metadata-item">
                  <span className="metadata-label">Position:</span>
                  <span className="metadata-value">
                    ({Math.round(selection.left)}, {Math.round(selection.top)})
                  </span>
                </div>
              )}
              
              {/* 현재 적용된 값 표시 */}
              {selection.brightness !== undefined && (
                <div className="metadata-item">
                  <span className="metadata-label">Applied Brightness:</span>
                  <span className="metadata-value">
                    {selection.brightness.toFixed(1)}
                  </span>
                </div>
              )}
              
              {/* 편집 중인 값 표시 (변경사항이 있을 때만) */}
              {hasChanges && (
                <div className="metadata-item pending">
                  <span className="metadata-label">Pending Brightness:</span>
                  <span className="metadata-value pending">
                    {localOpacity.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}