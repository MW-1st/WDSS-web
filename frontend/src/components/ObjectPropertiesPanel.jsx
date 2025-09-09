import React, { useMemo } from "react";
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

export default function ObjectPropertiesPanel({ selection, onChangeFill }) {
  const isMulti = selection?.type === "activeSelection";
  const isDotOrCircleOrPath =
    selection &&
    (selection.customType === "svgDot" ||
      selection.customType === "drawnDot" ||
      selection.type === "circle" ||
      selection.type === "path" ||
      selection.type === "line");

  const currentColor = useMemo(
    () => normalizeColorToHex(selection?.fill || selection?.stroke),
    [selection]
  );

  return (
    <div className="properties-panel">
      <div className="properties-panel-header">
        <h3>개체 속성</h3>
        {selection && (
          <span className="type-badge">{selection.customType || selection.type || "-"}</span>
        )}
      </div>

      <div className="properties-panel-body">
        {!selection && (
          <div className="properties-empty">개체를 선택하세요</div>
        )}

        {selection && (
          <div className="properties-section">
            {(selection?.type &&
              selection.type.toLowerCase() === "activeselection") ||
            selection?.multiple ||
            isDotOrCircleOrPath ? (
              <div className="properties-field">
                <div className="label">Fill Color{isMulti ? " (multi)" : ""}</div>
                <ColorPicker
                  color={currentColor}
                  onChange={(hex) => onChangeFill && onChangeFill(hex)}
                  onPreview={() => {}}
                />
              </div>
            ) : (
              <div className="properties-note">이 객체는 채우기 색상을 지원하지 않습니다.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
