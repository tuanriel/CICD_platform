import { request } from "./client.js";

/* GET /repositories/:id/pipelines → Pipeline[] */
const listRepoPipelines = (repoId) =>
  request("GET", `/repositories/${repoId}/pipelines`);

/* POST /pipelines/:id/trigger → BuildRef { pipeline_id, build_number, status, branch, commit_sha }
   Tạo build THẬT trên Jenkins. body { ref?, sha? } đều tuỳ chọn — default: sync_branch của repo
   (fallback default_branch) + HEAD của ref. Build đầu tiên của một version tự parse YAML + cache
   Jenkinsfile; YAML lỗi → 422 PIPELINE_PARSE_ERROR (err.message là lý do cụ thể), status "error".
   build_number 0 + status "queued" = Jenkins chưa kịp gán số — poll GET /pipelines/:id/builds.
   409 PIPELINE_NOT_RUNNABLE (disabled/chưa sync) · 502 UPSTREAM_ERROR (Jenkins không kết nối được). */
const triggerPipeline = (id, { ref, sha } = {}) => {
  const body = {};
  if (ref) body.ref = ref;
  if (sha) body.sha = sha;
  return request("POST", `/pipelines/${id}/trigger`, body);
};

/* GET /pipelines/:id/jenkinsfile → { pipeline_id, pipeline_version_id, jenkinsfile }
   Scripted Jenkinsfile của version hiện tại (parse + cache lazy nếu version còn pending — cùng
   side effect trạng thái như trigger, nhưng KHÔNG tạo build). Cho phép cả pipeline disabled.
   422 PIPELINE_PARSE_ERROR kèm message — dùng endpoint này để hiển thị lý do pipeline error. */
const getPipelineJenkinsfile = (id) =>
  request("GET", `/pipelines/${id}/jenkinsfile`);

export { listRepoPipelines, triggerPipeline, getPipelineJenkinsfile };
