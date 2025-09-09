import React, { useMemo } from "react";
import ColorPicker from "./ColorPicker.jsx";

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
  const isDotOrCircle =
    selection &&
    (selection.customType === "svgDot" ||
      selection.customType === "drawnDot" ||
      selection.type === "circle");
  // Allow ColorPicker for multi-selection or supported single objects
  // (per request: use selection?.type check inline)
  const currentFill = useMemo(
    () => normalizeColorToHex(selection?.fill),
    [selection]
  );

  return (
    <div style={{ padding: 16 }}>
      <h4 style={{ margin: "0 0 12px 0" }}>媛쒖껜 ?띿꽦</h4>

      {!selection && (
        <div style={{ color: "#777", fontSize: 13 }}>媛쒖껜瑜??좏깮?섏꽭??</div>
      )}

      {selection && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: "#555" }}>
            Type: {selection.customType || selection.type || "-"}
          </div>

          {(selection?.type &&
            selection.type.toLowerCase() === "activeselection") ||
          selection?.multiple ||
          isDotOrCircle ||
          selection?.type === "path" ||
          typeof selection?.fill !== 'undefined' ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                채우기 색상{isMulti ? " (multi)" : ""}
              </div>
              <ColorPicker
                color={currentFill}
                onChange={(hex) => onChangeFill && onChangeFill(hex)}
                onPreview={() => {}}
              />
            </div>
          ) : (
            <div style={{ color: "#777", fontSize: 12 }}>
              ???ㅻ툕?앺듃??梨꾩슦湲??됱긽??吏?먰븯吏 ?딆뒿?덈떎.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
