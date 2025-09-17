import { useEffect, useMemo, useState } from "react";
import client from "../api/client";

export default function ProjectSettingsModal({ project, onClose, onSaved, mode: modeProp }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    project_name: "",
    max_scene: 15,
    max_drone: 1000,
    max_speed: 6.0,
    max_accel: 3.0,
    min_separation: 2.0,
  });

  const mode = useMemo(() => modeProp ?? (project?.id ? "edit" : "create"), [modeProp, project]);

  useEffect(() => {
    if (project) {
      setForm({
        project_name: project.project_name ?? "",
        max_scene: project.max_scene ?? 15,
        max_drone: project.max_drone ?? 1000,
        max_speed: project.max_speed ?? 6.0,
        max_accel: project.max_accel ?? 3.0,
        min_separation: project.min_separation ?? 2.0,
      });
    } else {
      setForm({
        project_name: "",
        max_scene: 15,
        max_drone: 1000,
        max_speed: 6.0,
        max_accel: 3.0,
        min_separation: 2.0,
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

    if (!form.project_name) {
      setError("프로젝트 이름을 입력하세요");
      return;
    }

    const numericKeys = ["max_scene", "max_drone", "max_speed", "max_accel", "min_separation"];
    for (const k of numericKeys) {
      if (form[k] === "" || Number.isNaN(Number(form[k]))) {
        setError("숫자 필드를 올바르게 입력하세요");
        return;
      }
    }

    const payload = {
      project_name: form.project_name,
      max_scene: Number(form.max_scene),
      max_drone: Number(form.max_drone),
      max_speed: Number(form.max_speed),
      max_accel: Number(form.max_accel),
      min_separation: Number(form.min_separation),
    };

    try {
      setSaving(true);
      if (mode === "edit") {
        if (!project?.id) {
          setError("수정할 프로젝트가 없습니다.");
          return;
        }
        const { data } = await client.put(`/projects/${project.id}`, payload, {
          headers: { "Content-Type": "application/json" },
        });
        if (data?.success && data?.project) {
          onSaved?.(data.project);
          onClose?.();
        } else {
          setError("요청에 실패했습니다. 다시 시도하세요");
        }
      } else {
        const { data } = await client.post(`/projects`, payload, {
          headers: { "Content-Type": "application/json" },
        });
        if (data?.success && data?.project) {
          onSaved?.(data.project);
          onClose?.();
        } else {
          setError("생성에 실패했습니다. 다시 시도하세요");
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "알 수 없는 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[2000] grid place-items-center p-4 bg-blurred backdrop-blur-sm bg-black/30">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 ">
          <h3 className="text-xl font-bold">{mode === "create" ? "프로젝트 생성" : "프로젝트 설정"}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded px-1.5 text-gray-500 hover:bg-gray-100"
          >
            ×
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
              <div className="text-sm font-medium mb-1">max_drone</div>
              <input
                type="number"
                inputMode="numeric"
                value={form.max_drone}
                onChange={updateField("max_drone")}
                className="w-full rounded border border-gray-300 px-3 py-2"
                min={100}
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
              {saving ? (mode === "create" ? "생성중.." : "저장중..") : (mode === "create" ? "생성" : "저장")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
