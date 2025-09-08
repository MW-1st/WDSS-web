import { useEffect, useState } from "react";
import client from "../api/client";

export default function ProjectSettingsModal({ project, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    project_name: "",
    max_scene: 0,
    max_speed: 0,
    max_accel: 0,
    min_separation: 0,
  });

  useEffect(() => {
    if (project) {
      setForm({
        project_name: project.project_name ?? "",
        max_scene: project.max_scene ?? 0,
        max_speed: project.max_speed ?? 0,
        max_accel: project.max_accel ?? 0,
        min_separation: project.min_separation ?? 0,
      });
    }
  }, [project]);

  const updateField = (key) => (e) => {
    const val = e.target.value;
    setForm((prev) => ({
      ...prev,
      [key]: key === "project_name" ? val : val === "" ? "" : Number(val),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    if (!project?.id) return;

    // Basic validation
    if (!form.project_name) {
      setError("프로젝트 이름을 입력하세요.");
      return;
    }

    const numericKeys = ["max_scene", "max_speed", "max_accel", "min_separation"]; 
    for (const k of numericKeys) {
      if (form[k] === "" || Number.isNaN(Number(form[k]))) {
        setError("수치 항목은 숫자로 입력하세요.");
        return;
      }
    }

    const payload = {
      project_name: form.project_name,
      max_scene: Number(form.max_scene),
      max_speed: Number(form.max_speed),
      max_accel: Number(form.max_accel),
      min_separation: Number(form.min_separation),
    };

    try {
      setSaving(true);
      const { data } = await client.put(`/projects/${project.id}`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      if (data?.success && data?.project) {
        onSaved?.(data.project);
        onClose?.();
      } else {
        setError("저장에 실패했습니다. 다시 시도하세요.");
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "저장 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // Close on ESC
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4 bg-black/30">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b">
          <h3 className="text-xl font-bold">프로젝트 설정</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">프로젝트 이름</label>
            <input
              type="text"
              value={form.project_name}
              onChange={updateField("project_name")}
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="프로젝트 이름"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm font-medium mb-1">max_scene</div>
              <input
                type="number"
                inputMode="numeric"
                value={form.max_scene}
                onChange={updateField("max_scene")}
                className="w-full rounded border border-gray-300 px-3 py-2"
                min={0}
              />
            </label>
            <label className="block">
              <div className="text-sm font-medium mb-1">max_speed</div>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={form.max_speed}
                onChange={updateField("max_speed")}
                className="w-full rounded border border-gray-300 px-3 py-2"
                min={0}
              />
            </label>
            <label className="block">
              <div className="text-sm font-medium mb-1">max_accel</div>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={form.max_accel}
                onChange={updateField("max_accel")}
                className="w-full rounded border border-gray-300 px-3 py-2"
                min={0}
              />
            </label>
            <label className="block">
              <div className="text-sm font-medium mb-1">min_separation</div>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={form.min_separation}
                onChange={updateField("min_separation")}
                className="w-full rounded border border-gray-300 px-3 py-2"
                min={0}
              />
            </label>
          </div>

          {error && (
            <div className="text-red-600 text-sm" role="alert">{error}</div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

