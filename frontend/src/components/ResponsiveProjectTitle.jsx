import React, { useState, useLayoutEffect, useRef } from 'react';

const ResponsiveProjectTitle = ({ title, className }) => {
  const [fontSize, setFontSize] = useState(null);
  const containerRef = useRef(null);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    // Capture the initial font size from CSS
    const initialFontSize = parseFloat(window.getComputedStyle(text).fontSize);

    const adjustFont = () => {
      // Temporarily reset font size to the original to get accurate scrollWidth
      text.style.fontSize = `${initialFontSize}px`;
      
      const containerWidth = container.offsetWidth;
      const textWidth = text.scrollWidth;

      // If text overflows, calculate and apply a new, smaller font size
      if (textWidth > containerWidth) {
        // Ensure font size doesn't get too small
        const newSize = Math.max(12, initialFontSize * (containerWidth / textWidth)); 
        setFontSize(`${newSize}px`);
      } else {
        // If it fits, use the default font size from the CSS class
        setFontSize(null);
      }
    };

    adjustFont();

    // Re-run on window resize
    window.addEventListener('resize', adjustFont);
    return () => window.removeEventListener('resize', adjustFont);

  }, [title]); // Re-run when the title text changes

return (
  <div ref={containerRef} className="w-full" style={{ textAlign: "center" }}>
    <div
      ref={textRef}
      className={className}
      style={{
        fontSize: fontSize || "28px", // 제목 기본 크기
        whiteSpace: "nowrap",
        transition: "font-size 0.1s ease-out",
        display: "inline-block",
      }}
      title={title}
    >
      <span 
        style={{ 
          color: "#9ca3af",       // 연회색
          fontSize: "0.7em",      // 제목보다 작게
          fontWeight: "400",      // 얇게
          marginRight: "6px"
        }}
      >
        title :
      </span>
      <span>{title}</span>
    </div>
  </div>
);


};

export default ResponsiveProjectTitle;
