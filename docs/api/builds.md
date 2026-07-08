# Builds — chạy pipeline, lịch sử, console log, stages, timings

Toàn bộ dữ liệu build là **pure proxy từ Jenkins** — platform KHÔNG lưu
build vào DB. Jenkins là source of truth cho history/status/log/stages/
timings (Jenkins mặc định không xoá build cũ). Hệ quả frontend cần biết:

- **Jenkins không kết nối được → mọi endpoint ở trang này trả
  `502 UPSTREAM_ERROR`** (kể cả xem lịch sử). Hiển thị trạng thái "Jenkins
  unavailable" thay vì lỗi chung.
- Xoá build là xoá trên Jenkins — mất vĩnh viễn, không khôi phục.
- `build_number` là số build của Jenkins, **chỉ unique trong 1 pipeline**
  — vì vậy URL luôn nested: `/pipelines/:id/builds/:number`.
- Tổ chức trên Jenkins: **1 repository = 1 Folder** (`owner__repo`), mỗi
  pipeline là 1 job cố định trong folder (tên = tên pipeline). Tên đặt theo
  natural key nên chạy lại/re-sync không bao giờ tạo item mới — build
  number tích lũy liên tục (không reset về 1).
- Ngữ cảnh platform (trigger_type, branch, commit SHA) được truyền làm
  build parameters khi trigger và đọc ngược từ Jenkins; commit
  message/author lấy on-demand từ GitHub API (best-effort — GitHub lỗi thì
  2 field này rỗng, không làm hỏng trang).

Điều kiện tiên quyết: pipeline đã sync (`POST /repositories/:id/sync`).
Build đầu tiên của một version tự động parse YAML + cache Jenkinsfile —
frontend không cần điều phối gì.

---

## POST /pipelines/:id/trigger

Chạy pipeline ("user bấm build"). Backend: lấy script cache (parse nếu là
build đầu của version) → tạo/cập nhật job trên Jenkins → trigger → đợi tối
đa ~10s cho hàng đợi gán số build.

**Request** — body tùy chọn (bỏ trống cũng được):

```json
{ "ref": "main", "sha": "a3f91c2..." }
```

| Field | Bắt buộc | Default |
|-------|----------|---------|
| `ref` | ✗ | `sync_branch` của repo, fallback `default_branch` |
| `sha` | ✗ | HEAD của `ref` (resolve qua GitHub, best-effort) |

**Response 201**

```json
{
  "data": {
    "pipeline_id": "…uuid…",
    "build_number": 248,
    "status": "running",
    "branch": "main",
    "commit_sha": "a3f91c20c290876e6ece347bab5dee14d0eaefb"
  }
}
```

⚠️ `build_number: 0` + `status: "queued"` = Jenkins chưa kịp gán số (hàng
đợi đầy) — poll `GET /pipelines/:id/builds` để thấy build mới xuất hiện.

**Lỗi**: `404` pipeline không tồn tại · `409 PIPELINE_NOT_RUNNABLE`
(disabled/chưa sync) · `422 PIPELINE_PARSE_ERROR` (YAML lỗi — message kèm
chi tiết) · `502 UPSTREAM_ERROR` (Jenkins chết).

---

## GET /pipelines/:id/builds

Lịch sử build, mới nhất trước. Pipeline chưa build lần nào → `data: []`
(không lỗi). `meta.stats` = giống `/build-stats` (đỡ 1 round-trip).

```json
{
  "data": [
    { "number": 248, "status": "success", "started_at": "2026-07-02T04:41:40Z", "duration_ms": 176000, "estimated_ms": 180000 },
    { "number": 247, "status": "failure", "started_at": "…", "duration_ms": 60000, "estimated_ms": 180000 }
  ],
  "meta": { "stats": { /* xem build-stats */ } }
}
```

`status` ∈ `queued | running | success | failure | aborted | error`.

---

## GET /pipelines/:id/build-stats

Số liệu cho trang Trạng thái pipeline (tỉ lệ thành công, thời lượng TB,
tổng build, permalinks — Jenkins tính sẵn `lastBuild`/`lastSuccessfulBuild`/
`lastCompletedBuild`).

```json
{
  "data": {
    "total_builds": 5,
    "success_rate": 0.96,
    "avg_duration_ms": 184000,
    "latest":           { "number": 248, "status": "success" },
    "latest_success":   { "number": 248, "status": "success" },
    "latest_completed": { "number": 248, "status": "success" }
  }
}
```

`success_rate`/`avg_duration_ms` tính trên build **đã hoàn tất**; `null`
khi chưa có build nào hoàn tất. Pipeline chưa build → mọi field 0/null.

---

## GET /pipelines/:id/builds/:number

Chi tiết 1 build — đủ dữ liệu cho màn "Trạng thái" + "Timings":

```json
{
  "data": {
    "pipeline_id": "…uuid…",
    "number": 248,
    "status": "success",
    "trigger_type": "manual",
    "branch": "main",
    "repo_url": "https://github.com/fpt-cloud/payment-gateway.git",
    "commit": {
      "sha": "a3f91c20c290876e6ece347bab5dee14d0eaefb",
      "message": "feat: thêm endpoint refund",
      "author": "trang.nguyen"
    },
    "started_at": "2026-07-02T04:41:40Z",
    "duration_ms": 176000,
    "estimated_ms": 180000,
    "timings": {
      "queue_ms": 13001,
      "build_ms": 163000,
      "total_ms": 176000,
      "waiting_ms": 1,
      "blocked_ms": 0,
      "buildable_ms": 13000,
      "subtasks": 8,
      "executor_utilization": 0.6
    }
  }
}
```

- `trigger_type`/`branch`/`commit.sha`: từ build parameters platform đã
  truyền. Build được tạo ngoài platform (bấm tay trên Jenkins UI) sẽ
  thiếu các field này.
- `commit.message`/`author`: GitHub API on-demand — rỗng khi GitHub lỗi.
- `timings.waiting_ms`…`executor_utilization`: từ plugin `metrics` của
  Jenkins; `null` nếu plugin thiếu. `queue_ms` = waiting+blocked+buildable.
- Build đang chạy: `duration_ms: 0`, `status: "running"` — FE tự hiển thị
  elapsed từ `started_at`, ước lượng bằng `estimated_ms`.

---

## GET /pipelines/:id/builds/:number/logs

Console output, **`text/plain`** (không phải JSON envelope) — phục vụ nút
Copy. Thêm `?download=1` để có `Content-Disposition: attachment` (nút Tải
xuống). Build đang chạy trả log tới thời điểm hiện tại — poll để theo dõi.

## GET /pipelines/:id/builds/:number/stages

Sơ đồ các bước (màn Pipeline Overview):

```json
{
  "data": [
    { "id": "6",  "name": "Checkout",  "status": "SUCCESS",     "started_at": "…", "duration_ms": 88000 },
    { "id": "13", "name": "Run Tests", "status": "IN_PROGRESS", "started_at": "…", "duration_ms": 0 }
  ]
}
```

`status` theo vocabulary wfapi của Jenkins: `SUCCESS | FAILED |
IN_PROGRESS | ABORTED | NOT_EXECUTED | UNSTABLE`.

## GET /pipelines/:id/builds/:number/stages/:stageId/log

Log của 1 stage (`text/plain`), `stageId` lấy từ endpoint stages. Ghép log
mọi step trong stage. `404` khi Jenkins đã dọn dữ liệu flow-node.

---

## POST /pipelines/:id/builds/:number/abort

Dừng một build đang chạy (dùng khi build **treo/đơ** không tự kết thúc).
Build kết thúc với `status: "aborted"`.

```http
POST /api/v1/pipelines/{id}/builds/{number}/abort          ← dừng mềm (graceful)
POST /api/v1/pipelines/{id}/builds/{number}/abort?force=1  ← ép dừng (build treo cứng)
```

**Response 202** (abort là bất đồng bộ — Jenkins kết thúc build sau đó):

```json
{ "data": { "pipeline_id": "…", "build_number": 248, "status": "aborting", "forced": false } }
```

Flow cho UI: bấm "Dừng build" → gọi abort → poll
`GET /builds/:number` tới khi `status: "aborted"` (thường 1–3s). Nếu sau
~10s vẫn `running` (script bẫy tín hiệu, agent chết) → hiện nút "Ép dừng"
gọi lại với `?force=1`. Abort build đã kết thúc là no-op (vẫn `202`).

⚠️ Lưu ý ngữ nghĩa: Jenkins **không có "tạm dừng rồi chạy tiếp"** cho build
đang chạy — abort là dừng hẳn; muốn chạy lại dùng **Rerun** (build number
mới).

| Lỗi | Khi nào |
|-----|--------|
| `404 RESOURCE_NOT_FOUND` | Build/pipeline không tồn tại, hoặc pipeline chưa build lần nào |
| `502 UPSTREAM_ERROR` | Jenkins không kết nối được |

## POST /pipelines/:id/builds/:number/rerun

Chạy lại đúng branch + commit của build cũ, tạo **build number mới**.
Response `201` giống trigger.

## DELETE /pipelines/:id/builds/:number

Xoá build khỏi Jenkins. `204`. Không undo được — confirm phía UI.

---

## Ghi chú thiết kế (cho báo cáo)

Quyết định pure-proxy đồng nghĩa UC-08 ("đồng bộ trạng thái, build, logs
với hệ thống") được hiện thực dưới dạng **expose real-time qua API chuẩn
hoá của platform** thay vì replicate về DB: platform luôn phản ánh đúng
trạng thái Jenkins tại thời điểm gọi, không có độ trễ đồng bộ, không drift.
Trade-off: lịch sử build phụ thuộc vòng đời dữ liệu Jenkins, và không lưu
được "build này chạy PipelineVersion nào" (bảng `builds` trong schema được
giữ lại cho nhu cầu tương lai nếu cần chuyển sang mô hình lưu trữ).
