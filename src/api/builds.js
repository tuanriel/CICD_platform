import { BASE_URL, request, requestText } from "./client.js";

/* ============================================================
   Builds — pure proxy từ Jenkins, platform KHÔNG lưu build vào DB.
   Jenkins không kết nối được → mọi endpoint ở đây trả 502 UPSTREAM_ERROR
   (kể cả xem lịch sử) — UI nên hiển thị "Jenkins unavailable" riêng.
   build_number chỉ unique trong 1 pipeline → URL luôn nested.
   ============================================================ */

/* GET /pipelines/:id/builds → Build[] (mới nhất trước; [] nếu chưa build lần nào)
   status ∈ queued | running | success | failure | aborted | error */
const listBuilds = (pipelineId) =>
  request("GET", `/pipelines/${pipelineId}/builds`);

/* GET /pipelines/:id/build-stats → { total_builds, success_rate, avg_duration_ms,
   latest, latest_success, latest_completed } — success_rate/avg null khi chưa có build hoàn tất. */
const getBuildStats = (pipelineId) =>
  request("GET", `/pipelines/${pipelineId}/build-stats`);

/* GET /pipelines/:id/builds/:number → chi tiết 1 build (trigger_type, branch, commit, timings…)
   Build đang chạy: duration_ms = 0 — FE tự tính elapsed từ started_at. */
const getBuild = (pipelineId, number) =>
  request("GET", `/pipelines/${pipelineId}/builds/${number}`);

/* GET /pipelines/:id/builds/:number/logs → console output dạng text/plain.
   Build đang chạy trả log tới thời điểm hiện tại — poll để theo dõi. */
const getBuildLogs = (pipelineId, number) =>
  requestText("GET", `/pipelines/${pipelineId}/builds/${number}/logs`);

/* URL tải log (?download=1 → Content-Disposition: attachment) — dùng cho nút Tải xuống. */
const buildLogsDownloadUrl = (pipelineId, number) =>
  `${BASE_URL}/pipelines/${pipelineId}/builds/${number}/logs?download=1`;

/* GET /pipelines/:id/builds/:number/stages → { id, name, status, started_at, duration_ms }[]
   status theo wfapi Jenkins: SUCCESS | FAILED | IN_PROGRESS | ABORTED | NOT_EXECUTED | UNSTABLE */
const getBuildStages = (pipelineId, number) =>
  request("GET", `/pipelines/${pipelineId}/builds/${number}/stages`);

/* GET /pipelines/:id/builds/:number/stages/:stageId/log → text/plain (gộp log mọi step trong stage).
   404 khi Jenkins đã dọn dữ liệu flow-node. */
const getStageLog = (pipelineId, number, stageId) =>
  requestText("GET", `/pipelines/${pipelineId}/builds/${number}/stages/${stageId}/log`);

/* POST /pipelines/:id/builds/:number/rerun → BuildRef (build number MỚI, cùng branch+commit). */
const rerunBuild = (pipelineId, number) =>
  request("POST", `/pipelines/${pipelineId}/builds/${number}/rerun`);

/* DELETE /pipelines/:id/builds/:number → 204. Xoá trên Jenkins, KHÔNG khôi phục được — confirm ở UI. */
const deleteBuild = (pipelineId, number) =>
  request("DELETE", `/pipelines/${pipelineId}/builds/${number}`);

export {
  listBuilds,
  getBuildStats,
  getBuild,
  getBuildLogs,
  buildLogsDownloadUrl,
  getBuildStages,
  getStageLog,
  rerunBuild,
  deleteBuild,
};
