// src/api/projects.js
import client from "./client";

// 프로젝트 생성 (프론트에서 uuid 생성해서 전달)
export const createProject = ({
  id,
  project_name = "My Project",
  user_id = null,
}) =>
  client
    .post(`/api/projects`, { id, project_name, user_id })
    .then((res) => res.data);
