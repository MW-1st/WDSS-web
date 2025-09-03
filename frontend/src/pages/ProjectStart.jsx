// src/pages/ProjectStart.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { createProject } from "../api/projects";

export default function ProjectStart() {
  const nav = useNavigate();

  const handleCreate = async () => {
    const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : // 대부분 브라우저 지원
      ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)); // 폴백
    try {
      const proj = await createProject({ id, project_name: "Demo Project" });
      nav(`/editor/${proj.id}`); // 생성 후 에디터로 이동
    } catch (e) {
      console.error(e);
      alert("프로젝트 생성 실패");
    }
  };

  return (
    <section style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"48px 0" }}>
      <h1 style={{ margin:0 }}>프로젝트 시작</h1>
      <button
        onClick={handleCreate}
        style={{
          padding: "12px 18px",
          borderRadius: 8,
          border: "1px solid #cfcfe6",
          background: "#fff",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          cursor: "pointer",
          fontSize: 16,
        }}
      >
        프로젝트 생성하기
      </button>
    </section>
  );
}
