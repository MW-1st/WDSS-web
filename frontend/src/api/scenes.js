// src/api/scenes.js
import client from "./client";

/* ────────────────────────────────────────────
 * 얇은 래퍼(shim): EditorPage에서 api.get/post/put을 기대하므로 제공
 * ──────────────────────────────────────────── */
export const get = (url, config) =>
  client.get(url, config).then((res) => res.data);
export const post = (url, data, config) =>
  client.post(url, data, config).then((res) => res.data);
export const put = (url, data, config) =>
  client.put(url, data, config).then((res) => res.data);

/* ────────────────────────────────────────────
 * 고수준 API (기존 함수들 유지)
 * ──────────────────────────────────────────── */

// 씬 목록 조회
export const listScenes = (projectId) =>
  get(`/api/projects/${projectId}/scenes`);

// 씬 생성
export const createScene = (projectId, scene_num) =>
  post(`/api/projects/${projectId}/scenes`, {
    project_id: projectId,
    scene_num,
  });

// 씬 상세 조회
export const getScene = (projectId, sceneId) =>
  get(`/api/projects/${projectId}/scenes/${sceneId}`);

// 씬 저장
export const saveScene = (projectId, sceneId, drones, preview = null) =>
  put(`/api/projects/${projectId}/scenes/${sceneId}`, {
    project_id: projectId,
    scene_id: sceneId,
    drones,
    preview,
  });

// 씬 삭제
export const deleteScene = (projectId, sceneId) =>
  client
    .delete(`/api/projects/${projectId}/scenes/${sceneId}`)
    .then((res) => res.data);
