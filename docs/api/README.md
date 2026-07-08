# CI/CD Platform — API Reference (Frontend)

Base URL: `http://localhost:8080/api/v1`

Tài liệu này viết cho đội frontend tích hợp trực tiếp với backend. Mỗi
resource có 1 file riêng, liệt kê đầy đủ field, request/response mẫu và mã
lỗi có thể gặp.

**Swagger UI**: `http://localhost:8080/swagger/index.html` (spec thô:
`/swagger/doc.json`, file: `docs/swagger/swagger.{json,yaml}`) — sinh tự
động từ annotation trên handler, luôn khớp code; dùng để thử request trực
tiếp. Các file Markdown ở đây bổ sung phần Swagger không nói được: luồng
nghiệp vụ, giới hạn hiện tại, quy ước lỗi. Backend đổi API thì chạy
`make swagger` để cập nhật spec.

## Tài liệu theo resource

| File | Resource | Khi nào cần đọc |
|------|---------|-----------------|
| [auth.md](auth.md) | Đăng ký, đăng nhập lấy JWT, xem user hiện tại | Màn hình Login/Register (chỉ khi bật `AUTH_ENABLED`) |
| [source-providers.md](source-providers.md) | Liên kết tài khoản GitHub, xem/map repository trên GitHub | Màn hình "Connect GitHub", "Chọn repository để import" |
| [repositories.md](repositories.md) | Repository đã map vào platform, quét pipeline | Màn hình danh sách repository, nút "Sync" |
| [pipelines.md](pipelines.md) | Pipeline, PipelineVersion, trigger thủ công | Màn hình danh sách/detail pipeline |
| [pipeline-yaml.md](pipeline-yaml.md) | Định dạng file `.viettelcloud/workflows/*.yaml` + API validate/generate Jenkinsfile | Editor YAML, preview Jenkinsfile, hiển thị lỗi parse |
| [builds.md](builds.md) | Chạy pipeline, lịch sử build, console log, stages, timings, stats, rerun/delete | Trang trạng thái pipeline, build detail, console output |
| [webhooks.md](webhooks.md) | Webhook GitHub: auto-đăng ký khi map repo, receiver, tự động trigger theo block `trigger:`, audit deliveries | Hiển thị `webhook_registered`, build `trigger_type: webhook`, màn hình webhook deliveries |

---

## Auth

**JWT có nhưng mặc định TẮT** — được gate bằng env `AUTH_ENABLED` (chi tiết:
[auth.md](auth.md)).

- **`AUTH_ENABLED=false` (mặc định)**: mọi request chạy dưới 1 user dev cố
  định ở backend — frontend **không cần** gửi `Authorization` header. Đây là
  chế độ dev/demo hiện tại.
- **`AUTH_ENABLED=true`**: `POST /auth/register` + `POST /auth/login` để lấy
  access token (JWT HS256), rồi gửi kèm header `Authorization: Bearer <token>`
  trên **mọi** route trừ `/auth/*`, `/webhooks/github` (xác thực bằng HMAC) và
  `/swagger`. Thiếu/sai token → `401 UNAUTHORIZED`.

---

## Conventions

### Response envelope

Mọi response thành công đều bọc trong `data`:

```json
{ "data": { ... } }
```

`data` có thể là object, array, hoặc rỗng (`[]`) — không bao giờ `null` ở top
level cho các endpoint trả list.

Mọi lỗi trả về cùng cấu trúc, HTTP status khác 2xx:

```json
{
  "code": "ERROR_CODE",
  "message": "human-readable description",
  "request_id": "a1b2c3d4..."
}
```

`DELETE` thành công trả `204 No Content` — **không có body**, đừng gọi
`response.json()` trên response này.

### HTTP status codes

| Status | Ý nghĩa |
|--------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (xóa thành công, không có body) |
| 400 | Bad Request — payload sai hoặc thiếu field |
| 401 | Unauthorized — token liên kết GitHub không hợp lệ |
| 404 | Not Found |
| 409 | Conflict — đã tồn tại hoặc pipeline không thể chạy |
| 422 | Unprocessable — scope thiếu hoặc YAML lỗi |
| 500 | Internal Server Error |
| 502 | Bad Gateway — lỗi từ GitHub hoặc Jenkins |

### Error codes

| Code | HTTP | Mô tả | Khi nào gặp |
|------|------|-------|-------------|
| `INVALID_PAYLOAD` | 400 | Body JSON sai hoặc thiếu field bắt buộc | Thiếu `access_token`, `full_name`, `ref`/`sha`, hoặc thiếu query param bắt buộc |
| `INVALID_TOKEN` | 401 | PAT không hợp lệ, hoặc chữ ký webhook sai | `POST /source-providers`; `POST /webhooks/github` (HMAC mismatch) |
| `UNAUTHORIZED` | 401 | Sai email/mật khẩu, hoặc thiếu/sai JWT (khi `AUTH_ENABLED`) | `POST /auth/login`; mọi route bảo vệ khi thiếu `Authorization: Bearer` |
| `EMAIL_TAKEN` | 409 | Email đã được đăng ký | `POST /auth/register` |
| `RESOURCE_NOT_FOUND` | 404 | ID không tồn tại | Mọi endpoint có `:id` |
| `MAPPING_EXISTS` | 409 | Tài khoản GitHub này đã được liên kết trước đó | `POST /source-providers` |
| `PIPELINE_NOT_RUNNABLE` | 409 | Pipeline đang ở trạng thái `disabled` hoặc `error` | `POST /pipelines/:id/trigger` |
| `INSUFFICIENT_SCOPE` | 422 | PAT thiếu scope `repo` | `POST /source-providers` |
| `PIPELINE_PARSE_ERROR` | 422 | YAML lỗi cú pháp — phát hiện lúc trigger (sync không parse, xem [pipelines.md](pipelines.md)) | `POST /pipelines/:id/trigger` |
| `UPSTREAM_ERROR` | 502 | GitHub API không phản hồi hoặc trả lỗi | Các endpoint gọi GitHub (`github-repos`, `repositories`, `:id/sync`) |
| `INTERNAL_ERROR` | 500 | Lỗi server ngoài dự kiến | — |

### Request ID

Mỗi response (cả thành công và lỗi) có header `X-Request-ID`. Nếu frontend
tự gửi header `X-Request-ID` trong request, backend sẽ echo lại đúng giá trị
đó — hữu ích để nối log frontend ↔ backend khi debug. Khi báo lỗi cho người
dùng hoặc report bug, luôn đính kèm giá trị này.

### CORS

Cấu hình qua env `CORS_ALLOW_ORIGINS` (danh sách origin, phân tách bằng dấu
phẩy). **Nếu biến này không được set (mặc định khi chạy local), server cho
phép mọi origin** — không cần cấu hình gì thêm khi dev. Khi origin được giới
hạn (production), origin của frontend phải nằm trong danh sách này thì mới
có `Access-Control-Allow-Origin` trong response.

---

## Luồng tích hợp đầy đủ (happy path)

Đây là toàn bộ chuỗi gọi API để đi từ "chưa có gì" tới "thấy danh sách
pipeline của một repository". Xem từng bước chi tiết (field, lỗi) trong file
tương ứng.

```
1. POST   /source-providers                     — liên kết GitHub bằng PAT
2. GET    /source-providers/:id/github-repos     — xem trước repo trên GitHub (live)
3. POST   /source-providers/:id/repositories     — map 1 repo đã chọn vào platform
4. GET    /repositories?source_provider_id=:id   — xem repo đã map (tùy chọn, để refresh UI)
5. POST   /repositories/:id/sync                 — quét .viettelcloud/workflows/, tạo pipeline
6. GET    /repositories/:id/pipelines             — hiển thị danh sách pipeline
7. POST   /pipelines/:id/trigger                  — chạy build thật trên Jenkins → BuildRef
8. GET    /pipelines/:id/builds                   — lịch sử build (+ /builds/:n, /logs, /stages...)
```

### Bước 1 — Liên kết GitHub

```http
POST /api/v1/source-providers
Content-Type: application/json

{ "provider_type": "github", "access_token": "ghp_xxx" }
```

→ `201`, lưu lại `data.id` (UUID của source provider) — dùng cho các bước
sau. Xem lỗi có thể gặp (token sai, thiếu scope, đã liên kết trước) trong
[source-providers.md](source-providers.md).

### Bước 2 — Cho người dùng chọn repository

```http
GET /api/v1/source-providers/{sourceProviderId}/github-repos
```

→ `200`, `data` là toàn bộ repo mà token thấy được (**live từ GitHub, chưa
lưu DB**). Hiển thị danh sách này cho người dùng chọn — mỗi item chỉ có
`full_name`/`owner`/`name`/`repo_url`/`default_branch`, **không có `id`**.

### Bước 3 — Map repository đã chọn

```http
POST /api/v1/source-providers/{sourceProviderId}/repositories
Content-Type: application/json

{ "full_name": "octocat/hello-world" }
```

→ `201`, `data` giờ có `id` — đây là **Repository UUID trong platform**,
dùng cho bước 5 và 6. Gọi lại với `full_name` đã map trước đó không lỗi
(idempotent — chỉ cập nhật metadata).

### Bước 5 — Quét pipeline

```http
POST /api/v1/repositories/{repositoryId}/sync
```

→ `200`, `data` là danh sách `Pipeline` (pipeline mới hoặc có nội dung đổi
mang `status: "pending"` — sync không parse YAML, xem
[pipelines.md](pipelines.md)). Có thể rỗng `[]` nếu repo không có thư mục
`.viettelcloud/workflows/`. Gọi lại bất kỳ lúc nào: **sync có so sánh nội
dung** — file không đổi thì không tạo version mới, không đổi status;
chỉ file thực sự thay đổi mới tạo `PipelineVersion` mới + đưa pipeline về
`pending`.

### Bước 7 — Chạy build ("Run pipeline")

```http
POST /api/v1/pipelines/{pipelineId}/trigger
Content-Type: application/json

{}
```

→ `201`, `data` là `BuildRef` `{pipeline_id, build_number, status, branch,
commit_sha}` — build **chạy thật trên Jenkins**. Body tùy chọn
(`{ref?, sha?}` — mặc định sync branch + HEAD). Điều hướng người dùng tới
trang build detail bằng `build_number`, rồi poll
`GET /pipelines/:id/builds/:number` tới khi `success`/`failure`. Toàn bộ
API build (lịch sử, console log, stages, timings, stats, rerun, delete):
xem [builds.md](builds.md).

---

## Giới hạn hiện tại — QUAN TRỌNG cho frontend

- **Build đã chạy THẬT trên Jenkins** (xem [builds.md](builds.md)):
  `POST /pipelines/:id/trigger` tạo build thật, có đủ API lịch sử/detail/
  console log/stages/timings/stats/rerun/delete. Lưu ý kiến trúc: dữ liệu
  build là **pure proxy từ Jenkins**, không lưu DB — **Jenkins không kết
  nối được thì mọi endpoint build trả `502 UPSTREAM_ERROR`**, kể cả xem
  lịch sử. `commit.message`/`author` trong build detail lấy từ GitHub
  (best-effort — có thể rỗng).
- **Không có endpoint xem chi tiết `PipelineVersion`** (nội dung YAML gốc,
  JSON đã parse). `GET /repositories/:id/pipelines` chỉ trả
  `current_version_id` (một UUID) — không trả nội dung. Muốn biết *vì sao*
  một pipeline `error`: gọi `GET /pipelines/:id/jenkinsfile` — response lỗi
  `422 PIPELINE_PARSE_ERROR` có message cụ thể (không cần gọi trigger).
- **API parse/generate Jenkinsfile** (xem
  [pipeline-yaml.md](pipeline-yaml.md)): `POST /pipeline-yaml/validate`,
  `POST /pipeline-yaml/generate` (stateless, cho editor), và
  `GET /pipelines/:id/jenkinsfile` (từ version đã sync).
- **`trigger_events`/`trigger_branches` trên Pipeline object luôn `null`.**
  2 cột JSONB này không được dùng — logic tự động trigger đọc thẳng block
  `trigger:` từ YAML đã parse (`parsed_canonical`), không đọc 2 cột này.
  Đừng dùng field này để quyết định hiển thị UI; muốn biết pipeline có tự
  động trigger không, đọc block `trigger:` trong YAML.
- **Webhook GitHub ĐÃ hoạt động** (xem [webhooks.md](webhooks.md)):
  webhook được đăng ký tự động khi map repo (response có
  `webhook_registered`); push/PR trên GitHub tự động trigger pipeline có
  block `trigger:` khớp, build sinh ra có `trigger_type: "webhook"`. Repo
  map từ trước khi có tính năng này phải **map lại** để có webhook secret.
  Yêu cầu `WEBHOOK_BASE_URL` trỏ tới URL public (ngrok khi chạy local).
- **`last_synced_at` trên Repository object luôn `null`** — chưa có code
  cập nhật cột này, dù đã sync pipeline thành công.
- **Repo PRIVATE checkout được bình thường** (từ 2026-07-08): step
  `gitCheckout` tự dùng credential Jenkins do backend đính kèm mỗi build —
  frontend không cần (và không thể) truyền credential nào qua API.
- **`validate` pass ≠ build chạy được**: parser không kiểm tra tham chiếu
  biến, nên YAML dùng `$config.*` (biến KHÔNG tồn tại — xem cảnh báo trong
  [pipeline-yaml.md](pipeline-yaml.md)) vẫn validate/generate OK nhưng
  build sẽ FAIL trên Jenkins với `MissingPropertyException`. Nếu làm
  editor, nên hiển thị cảnh báo khi phát hiện chuỗi `$config.`.

Khi các phần trên được implement, mục này sẽ được cập nhật — nếu thấy hành
vi khác với mô tả ở đây, đó là dấu hiệu doc đã lỗi thời, hãy đối chiếu lại
với backend.
