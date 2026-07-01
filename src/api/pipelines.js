import { request } from "./client.js";

/* GET /repositories/:id/pipelines → Pipeline[] */
const listRepoPipelines = (repoId) =>
  request("GET", `/repositories/${repoId}/pipelines`);

/* POST /pipelines/:id/trigger → Pipeline
   body: { ref: string, sha: string (40 hex) } */
const triggerPipeline = (id, { ref, sha }) =>
  request("POST", `/pipelines/${id}/trigger`, { ref, sha });

export { listRepoPipelines, triggerPipeline };
