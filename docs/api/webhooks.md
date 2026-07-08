# Webhooks — nhận event GitHub & tự động trigger pipeline

Backend nhận webhook từ GitHub (push, pull request), verify chữ ký, lưu lại
từng delivery và **tự động trigger các pipeline có block `trigger:` khớp**
trong nền. Frontend không gọi endpoint receiver — nó dành cho GitHub — nhưng
cần hiểu luồng này để hiển thị đúng (build có `trigger_type: "webhook"`,
audit trail delivery).

## Webhook được đăng ký tự động khi map repository

Khi `POST /source-providers/:id/repositories` (map repo) thành công, backend
tự đăng ký webhook trên GitHub cho repo đó:

- URL callback: `{WEBHOOK_BASE_URL}/api/v1/webhooks/github`
- Event đăng ký: `push`, `pull_request`
- Secret: sinh ngẫu nhiên **riêng cho từng repository**, lưu mã hoá
  (AES-256-GCM) trong `repositories.webhook_secret_enc` — dùng để verify
  HMAC mọi delivery sau này.

Response của map repo có thêm field:

```json
{ "data": { "id": "...", "full_name": "octocat/hello-world", ..., "webhook_registered": true } }
```

`webhook_registered: false` nghĩa là đăng ký thất bại (PAT thiếu scope
`admin:repo_hook`, GitHub lỗi, hoặc `WEBHOOK_BASE_URL` không được cấu hình)
— **map repo vẫn thành công**, chỉ có tự động trigger là không hoạt động.
Map lại đúng repo đó (idempotent) sẽ thử đăng ký lại.

⚠️ Repo đã map **trước khi** tính năng này tồn tại chưa có secret → mọi
delivery tới repo đó bị từ chối `401`. Cách sửa: map lại repo.

⚠️ `WEBHOOK_BASE_URL` phải là URL GitHub gọi tới được từ internet. Chạy
local thì dùng tunnel (ngrok, cloudflared...) và set biến này trước khi map
repo.

## POST /webhooks/github — receiver (GitHub gọi, không phải frontend)

Headers GitHub gửi kèm và cách backend dùng:

| Header | Dùng để |
|---|---|
| `X-GitHub-Event` | Phân loại: `push` / `pull_request` xử lý; `ping` trả pong; loại khác trả `ignored` |
| `X-GitHub-Delivery` | Idempotency — delivery ID trùng (GitHub redeliver) trả `200 {"status":"duplicate"}`, không xử lý lại |
| `X-Hub-Signature-256` | Verify HMAC-SHA256 trên raw body bằng secret riêng của repo |

Response:

| Status | Khi nào |
|---|---|
| `202` + `data` là WebhookEvent (`process_status: "received"`) | Delivery hợp lệ — xử lý tiếp trong nền |
| `200` `{"status":"pong"}` / `{"status":"duplicate"}` / `{"status":"ignored"}` | Ping / delivery trùng / event không đăng ký |
| `400 INVALID_PAYLOAD` | Body không phải payload GitHub |
| `401 INVALID_TOKEN` | Chữ ký sai hoặc repo chưa có webhook secret. Delivery vẫn được lưu với `signature_valid: false` để audit |
| `404 RESOURCE_NOT_FOUND` | `repository.full_name` trong payload chưa được map vào platform |

### Xử lý nền (sau khi trả 202)

1. **Push vào branch sync** (branch của `repo.SyncRef()`): re-sync
   `.viettelcloud/workflows/` trước — YAML mới/đổi được cập nhật version
   rồi mới match (best-effort: GitHub lỗi lúc này không chặn các pipeline
   đã sync sẵn).
2. Với **từng pipeline** của repo (bỏ qua `disabled`): parse lazy nếu version
   đang `pending` (giống trigger tay), rồi so block `trigger:` trong YAML với
   event:
   - **Pipeline không có block `trigger:` → không bao giờ tự chạy** (chỉ
     trigger tay được) — quy tắc sản phẩm có chủ đích.
   - `push.branches` / `push.tags`: rỗng cả hai → khớp mọi branch/tag; chỉ
     khai `branches` → chỉ những branch đó (tag không khớp), và ngược lại.
     So khớp exact, chưa hỗ trợ glob.
   - `merge_request`: `target_branches` so với branch đích (base) của PR;
     `actions` so với action đã chuẩn hoá — GitHub `opened→open`,
     `synchronize→update`, `reopened→reopen`, `closed`(merged)`→merge`,
     `closed→close`, `labeled→label`. `actions` rỗng → mặc định
     `open/update/reopen`. `labels` (nếu khai) phải giao với label của PR.
3. Pipeline khớp → tạo build Jenkins y hệt trigger tay, nhưng
   `trigger_type: "webhook"`; PR build checkout **head ref/sha** (branch
   nguồn), push build checkout branch/tag + SHA `after`.
4. Event chuyển `process_status`: `received → processing → done`
   (hoặc `failed` nếu payload không đọc được). Lỗi từng pipeline riêng lẻ
   (YAML hỏng, Jenkins sập) chỉ ghi log, không fail event.

## GET /repositories/:id/webhook-events — audit trail

Trả tối đa 100 delivery gần nhất của repo (mới nhất trước):

```json
{
  "data": [
    {
      "id": "3e0f...",
      "repository_id": "9a1b...",
      "event_type": "push",
      "delivery_id": "72d3162e-cc78-11e3-81ab-4c9367dc0958",
      "signature_valid": true,
      "process_status": "done",
      "received_at": "2026-07-02T10:00:00Z",
      "processed_at": "2026-07-02T10:00:01Z"
    }
  ]
}
```

Không có payload gốc trong response (chỉ xem được trong DB). Dùng cho màn
hình "Webhook deliveries" của repo: `signature_valid: false` = có request
chữ ký sai (hoặc repo chưa có secret); `process_status: "failed"` = payload
lỗi; `"received"`/`"processing"` kéo dài = server restart giữa chừng (chưa
có worker quét lại — xem giới hạn).

## Giới hạn hiện tại

- **Không có crash-recovery**: event đang `received`/`processing` khi server
  restart sẽ đứng nguyên trạng thái đó, không được xử lý lại (index
  `idx_webhook_event_process_status` đã có sẵn cho worker tương lai;
  `WebhookService.ProcessEvent` là hàm public để worker đó gọi lại).
- Chỉ subscribe `push` + `pull_request` — block `trigger.release` /
  `trigger.issue` trong DSL chưa có event tương ứng.
- So khớp branch/tag là **exact match**, chưa hỗ trợ pattern (`release/*`).
- `MRAction` dạng map (`comment: [recheck]`) chỉ match theo tên action,
  phần values chưa dùng (event comment không được subscribe).
