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

/* PATCH /repositories/:id { sync_branch } → Repository
   Đặt/xoá branch dùng thay cho default_branch khi gọi :id/sync. Gửi null (hoặc "") để xoá,
   quay lại dùng default_branch. Không đổi field nào khác. */
const patchRepository = (id, syncBranch) =>
  request("PATCH", `/repositories/${id}`, { sync_branch: syncBranch || null });

/* POST /repositories/:id/sync → Pipeline[]
   Quét .viettelcloud/workflows/*.yaml trên sync_branch nếu đã đặt, ngược lại default_branch.
   KHÔNG parse YAML ở bước này — lưu raw YAML vào PipelineVersion mới và upsert Pipeline với
   status luôn "pending" (kể cả YAML lỗi cú pháp, kể cả pipeline đã từng active/error trước đó).
   Trả về Pipeline[] (rỗng nếu không có thư mục .viettelcloud/workflows/). Parse thật chỉ xảy ra
   lazy lúc POST /pipelines/:id/trigger (xem pipelines.js). last_synced_at trên Repository luôn null. */
const syncRepository = (id) =>
  request("POST", `/repositories/${id}/sync`);

export { listRepositories, getRepository, deleteRepository, patchRepository, syncRepository };
