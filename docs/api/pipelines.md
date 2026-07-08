# Pipelines & Pipeline Versions

Pipeline là đơn vị CI/CD tương ứng với một file `.viettelcloud/workflows/*.yaml`
trong repository. Pipeline được tạo tự động khi gọi
`POST /repositories/:id/sync` (xem [repositories.md](repositories.md)) — mỗi
file YAML tạo ra một pipeline, kèm một `PipelineVersion` lưu snapshot nội
dung.

⚠️ **Sync KHÔNG parse YAML.** Sync chỉ fetch + lưu nguyên văn nội dung file
— pipeline luôn ở trạng thái `pending` ngay sau sync, **bất kể YAML hợp lệ
hay không**. Việc parse (và do đó biết pipeline có chạy được hay không) chỉ
xảy ra **lazy**, đúng lúc cần — cụ thể là khi gọi
`POST /pipelines/:id/trigger`. (Tương lai: cũng sẽ parse khi webhook phát
hiện file YAML thay đổi — chưa implement.) Lý do: sync nhanh hơn (không tốn
CPU parse mọi file mỗi lần quét), và 1 file đang sửa dở/lỗi cú pháp trên
GitHub không làm pipeline bị đánh dấu `error` nếu chưa ai định trigger nó.

Xem [pipeline-yaml.md](pipeline-yaml.md) để biết định dạng file YAML.

---

## Pipeline object

```json
{
  "id": "a3bb189e-8bf9-3888-9912-ace4e6543002",
  "repository_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "name": "build",
  "file_path": ".viettelcloud/workflows/build.yaml",
  "jenkins_job_name": null,
  "status": "pending",
  "current_version_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "trigger_events": null,
  "trigger_branches": null,
  "created_at": "2026-06-24T10:10:00Z",
  "updated_at": "2026-06-24T10:10:00Z"
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | string (UUID) | Định danh duy nhất — dùng cho `POST /pipelines/:id/trigger` |
| `repository_id` | string (UUID) | Repository chứa pipeline này |
| `name` | string | Tên pipeline, lấy từ tên file (bỏ extension). Vd: `build.yaml` → `build` |
| `file_path` | string | Đường dẫn tương đối trong repo, vd: `.viettelcloud/workflows/build.yaml` |
| `jenkins_job_name` | string \| null | Tên job Jenkins dạng `owner__repo/tên-pipeline` (1 repo = 1 folder trên Jenkins), được set ở **lần build đầu tiên**; `null` khi pipeline chưa build lần nào. FE không cần dùng field này — mọi thao tác build đi qua API platform ([builds.md](builds.md)) |
| `status` | string | Xem bảng "Pipeline status" dưới — **ngay sau sync luôn là `pending`**, chỉ đổi khi trigger |
| `current_version_id` | string (UUID) \| null | ID của `PipelineVersion` mới nhất — **chỉ là ID**, không có endpoint để lấy nội dung version này qua API (xem mục "PipelineVersion" dưới) |
| `trigger_events` | string[] \| null | ⚠️ **Luôn `null`** — field dự trù cho auto-trigger theo event (push/PR), backend chưa có logic điền giá trị này |
| `trigger_branches` | string[] \| null | ⚠️ **Luôn `null`** — tương tự, dự trù cho auto-trigger theo branch, chưa dùng |
| `created_at` | string (ISO 8601) | |
| `updated_at` | string (ISO 8601) | |

### Pipeline status

| Status | Mô tả | Có thể trigger? |
|--------|-------|----------------|
| `pending` | Đã sync (lưu raw YAML), **chưa parse** — trạng thái mặc định ngay sau mọi lần sync | ✓ (trigger sẽ parse ngay lúc đó) |
| `active` | Đã parse lúc trigger (lần này hoặc lần trước) và YAML hợp lệ | ✓ |
| `disabled` | Trạng thái dự trù cho "tắt thủ công" — ⚠️ **chưa có endpoint nào set được trạng thái này** (không có PATCH riêng cho status), nên trong thực tế sẽ không gặp | ✗ |
| `error` | Đã parse lúc trigger (lần này hoặc lần trước) và YAML **lỗi cú pháp** — xem lỗi `PIPELINE_PARSE_ERROR` ở mục trigger dưới | ✗ |

Re-sync (`POST /repositories/:id/sync` gọi lại) luôn đưa pipeline **về lại
`pending`**, kể cả pipeline đã từng `active`/`error` — vì nội dung mới chưa
được xác minh lại.

---

## PipelineVersion — có dữ liệu, nhưng KHÔNG có endpoint riêng

Mỗi lần `sync` tạo ra một `PipelineVersion` lưu snapshot nội dung YAML gốc
tại thời điểm đó. Object này tồn tại trong DB với hình dạng như sau — nêu ra
để bạn biết dữ liệu nào tồn tại phía backend, **nhưng hiện chưa có API trả
về nó**:

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "pipeline_id": "a3bb189e-8bf9-3888-9912-ace4e6543002",
  "commit_sha": null,
  "raw_yaml": "version: \"1.0\"\nstages:\n  ...",
  "parsed_canonical": null,
  "parse_status": "pending",
  "parse_error": null,
  "created_at": "2026-06-24T10:10:00Z"
}
```

`parse_status`/`parsed_canonical`/`parse_error`/`generated_jenkinsfile` bắt
đầu là `pending`/`null`/`null`/`null` (giống hệt `Pipeline.status` — cùng
lúc chuyển trạng thái) và chỉ được cập nhật **khi pipeline được build lần
đầu** (`parsed_canonical` + `generated_jenkinsfile` (script cache) +
`parse_status: "success"` nếu hợp lệ, hoặc `parse_error` +
`parse_status: "failed"` nếu không). Các lần build sau **không parse lại,
không generate lại** — dùng thẳng script đã cache. Sync có so sánh nội
dung: file không đổi thì version (và cache) giữ nguyên, chỉ file đổi mới
tạo version `pending` mới.

**Hệ quả cho frontend**: `Pipeline.current_version_id` chỉ là một UUID —
không thể dùng nó để fetch nội dung YAML gốc hay xem `parse_error` chi tiết
qua API hiện tại (vẫn thiếu API xem version). Muốn biết *vì sao* một
pipeline `error`: gọi `GET /pipelines/:id/jenkinsfile` (xem dưới) — response
lỗi `422 PIPELINE_PARSE_ERROR` kèm message cụ thể, không có side effect gì
thêm ngoài lazy-parse giống trigger.

---

## Endpoints

### GET /repositories/:id/pipelines

Xem [repositories.md](repositories.md) — liệt kê ở đây để tiện tra cứu.

**Response 200** — `data`: Pipeline object[].

---

### POST /pipelines/:id/trigger

Trigger thủ công một pipeline ("user bấm build") — **giờ tạo build THẬT
trên Jenkins** và trả về `BuildRef` (không còn trả Pipeline object như
trước — breaking change đã cập nhật ở [builds.md](builds.md), nơi mô tả
đầy đủ endpoint này + toàn bộ API build/logs/stages/stats).

Backend tự xử lý toàn bộ phần parse: **build đầu tiên của một version**
(hoặc build đầu sau khi file đổi — sync chỉ tạo version mới khi nội dung
thực sự khác) parse YAML và **cache luôn Jenkinsfile đã generate vào
version**; mọi lần build sau dùng thẳng script đã lưu, không parse/generate
lại. Frontend không cần biết hay điều phối luồng này — cứ gọi trigger.

**Luồng xử lý** (theo `pipeline.status` + `version.parse_status` hiện tại):

| Trạng thái trước khi gọi | Hành vi | Kết quả |
|---|---|---|
| `pending` (version cũng `pending`) | Parse + generate Jenkinsfile, cache vào version, tạo job + build trên Jenkins | YAML hợp lệ → `201 BuildRef`, status `active`. YAML lỗi → `422 PIPELINE_PARSE_ERROR`, status chuyển `error` |
| `active` (đã build trước đó) | Không parse lại — script cache sẵn, tạo build ngay | `201 BuildRef` |
| `error` (đã parse lỗi trước đó) | Không parse lại | `422 PIPELINE_PARSE_ERROR` ngay (dùng lại message đã lưu) |
| `disabled` | — | `409 PIPELINE_NOT_RUNNABLE` |
| Chưa từng `sync` (không có version) | — | `409 PIPELINE_NOT_RUNNABLE` |

**Request/Response/Lỗi chi tiết**: xem [builds.md](builds.md) — tóm tắt:
body `{ref?, sha?}` đều tùy chọn (default: sync branch + HEAD), response
`201 {data:{pipeline_id, build_number, status, branch, commit_sha}}`,
thêm `502 UPSTREAM_ERROR` khi Jenkins không kết nối được.

---

### GET /pipelines/:id/jenkinsfile

Trả về **scripted Jenkinsfile** của version hiện tại — đọc từ cache
`generated_jenkinsfile` trên version nếu đã build trước đó; nếu version còn
`pending` thì parse + generate + cache ngay lúc này (cùng side effect trạng
thái như trigger, bảng trên). **Khác trigger**: cho phép cả pipeline
`disabled` (chỉ xem script, không chạy gì).

**Response 200**

```json
{
  "data": {
    "pipeline_id": "…uuid…",
    "pipeline_version_id": "…uuid…",
    "jenkinsfile": "// Generated by CI/CD Platform — do not edit manually.\nnode('docker') {\n…"
  }
}
```

**Lỗi**

| Code | HTTP | Tình huống |
|------|------|-----------|
| `RESOURCE_NOT_FOUND` | 404 | Pipeline ID không tồn tại |
| `PIPELINE_NOT_RUNNABLE` | 409 | Chưa từng sync (không có version) |
| `PIPELINE_PARSE_ERROR` | 422 | YAML của version hiện tại không hợp lệ — `message` kèm chi tiết. Dùng endpoint này để hiển thị lý do pipeline `error` |

Chi tiết định dạng YAML đầu vào + 2 endpoint stateless
`POST /pipeline-yaml/validate` và `POST /pipeline-yaml/generate` (cho editor
frontend): xem [pipeline-yaml.md](pipeline-yaml.md).
