import { request } from "./client.js";

/* GET /repositories?source_provider_id={uuid} → Repository[] */
const listRepositories = (sourceProviderId) =>
  request("GET", `/repositories?source_provider_id=${sourceProviderId}`);

/* GET /repositories/:id → Repository */
const getRepository = (id) =>
  request("GET", `/repositories/${id}`);

/* DELETE /repositories/:id → null (204) */
const deleteRepository = (id) =>
  request("DELETE", `/repositories/${id}`);

/* POST /repositories/:id/sync → Pipeline[]
   Quét .workflow/*.yaml trên default_branch, parse + upsert pipelines, trả về Pipeline[]. */
const syncRepository = (id) =>
  request("POST", `/repositories/${id}/sync`);

export { listRepositories, getRepository, deleteRepository, syncRepository };
