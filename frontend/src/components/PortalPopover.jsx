// src/components/PortalPopover.jsx
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useState } from "react";

/**
 * anchorRef: 기준 버튼/요소 ref
 * open: 열림 여부
 * onClose: 닫기 콜백
 * width: 팝오버 예상 너비(정렬 계산용)
 * align: 'start' | 'end'
 * offset: 기준요소와의 간격(px)
 */
export default function PortalPopover({
  anchorRef,
  open,
  onClose,
  children,
  width = 320,
  align = "start",
  offset = 8,
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const recalc = () => {
    const el = anchorRef?.current;
    if (!el) return;
    const r = el.getBoundingClientRect();

    let left = align === "end" ? r.right - width : r.left;
    let top = r.bottom + offset;

    // 화면 밖으로 나가지 않도록 보정
    const maxLeft = window.innerWidth - width - 8;
    if (left > maxLeft) left = maxLeft;
    if (left < 8) left = 8;

    setPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    recalc();
    // 스크롤/리사이즈/폰트 로딩 등 위치 변동에 대응
    const opts = { capture: true, passive: true };
    window.addEventListener("scroll", recalc, opts);
    window.addEventListener("resize", recalc, opts);
    return () => {
      window.removeEventListener("scroll", recalc, opts);
      window.removeEventListener("resize", recalc, opts);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorRef, width, align, offset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    const onDown = (e) => {
      const el = anchorRef?.current;
      const pop = document.getElementById("portal-popover-root");
      if (!el || !pop) return;
      if (el.contains(e.target) || pop.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, anchorRef, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      id="portal-popover-root"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        background: "#fff",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        padding: 12,
        width,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>,
    document.body
  );
}
