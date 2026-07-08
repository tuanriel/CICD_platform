# Repositories

Repository là bản ghi ánh xạ (map) một repo GitHub cụ thể vào platform. Mỗi
repository thuộc về đúng một source provider và có thể chứa nhiều pipelines.

Để tạo một Repository, xem [source-providers.md](source-providers.md) mục
"Chọn & map repository" — **không có** endpoint `POST /repositories` trực
tiếp ở file này, việc tạo luôn đi qua `POST /source-providers/:id/repositories`.

---

## Object

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "full_name": "octocat/hello-world",
  "owner": "octocat",
  "name": "hello-world",
  "repo_url": "https://github.com/octocat/hello-world.git",
  "default_branch": "main",
  "sync_branch": null,
  "provider": "github",
  "last_synced_at": null,
  "created_at": "2026-06-24T10:05:00Z"
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | string (UUID) | Định danh duy nhất trong platform — dùng cho các endpoint dưới |
| `full_name` | string | `"owner/repo"` — duy nhất trong cùng provider |
| `owner` | string | Username hoặc org trên GitHub |
| `name` | string | Tên repository |
| `repo_url` | string | Clone URL |
| `default_branch` | string | Branch mặc định trên GitHub (thường `main` hoặc `master`) — do GitHub trả về, không sửa qua API |
| `sync_branch` | string \| null | Branch được người dùng chọn để `:id/sync` đọc thay cho `default_branch`. `null` = dùng `default_branch` (hành vi mặc định). Đặt qua `PATCH /repositories/:id`. Field bị omit trong JSON khi `null` (`omitempty`). |
| `provider` | string | `"github"` \| `"gitlab"` \| `"bitbucket"` |
| `last_synced_at` | string \| null | ⚠️ **Luôn `null`** — cột dự trù, backend chưa cập nhật giá trị này dù sync pipeline đã thành công. Đừng hiển thị "last synced X phút trước" dựa vào field này. |
| `created_at` | string (ISO 8601) | |

Không có `updated_at` trong response. Riêng response của map repo
(`POST /source-providers/:id/repositories`) có thêm `webhook_registered`
(bool) — kết quả tự động đăng ký webhook GitHub, xem
[webhooks.md](webhooks.md).

---

## Endpoints

### GET /repositories

Lấy danh sách repository, **bắt buộc** lọc theo source provider.

**Request**

```http
GET /api/v1/repositories?source_provider_id={uuid}
```

| Query param | Bắt buộc | Mô tả |
|-------------|---------|-------|
| `source_provider_id` | ✓ | UUID của source provider |

**Response 200** — `data`: Repository object[].

**Lỗi**

| Code | Tình huống |
|------|-----------|
| `INVALID_PAYLOAD` | Thiếu query param `source_provider_id` |

---

### GET /repositories/:id

**Response 200** — Repository object.

**Lỗi**: `RESOURCE_NOT_FOUND` (404)

---

### PATCH /repositories/:id

Đặt hoặc xoá `sync_branch` — branch dùng thay cho `default_branch` khi gọi
`:id/sync`. Không đổi field nào khác của repository (không phải PATCH tổng
quát).

**Request**

```http
PATCH /api/v1/repositories/{repository_id}
Content-Type: application/json

{ "sync_branch": "develop" }
```

Gửi `{"sync_branch": null}` (hoặc `""`) để xoá, quay lại dùng `default_branch`.

**Response 200** — Repository object (đã cập nhật).

**Lỗi**

| Code | Tình huống |
|------|-----------|
| `INVALID_PAYLOAD` | Body không phải JSON hợp lệ |
| `RESOURCE_NOT_FOUND` | Repository ID không tồn tại |

---

### DELETE /repositories/:id

Xóa mapping repository khỏi platform. **Không** ảnh hưởng đến repository
trên GitHub. Cascade xóa toàn bộ `pipelines` (và `pipeline_versions`) của
repository này.

**Response 204** — không có body.

**Lỗi**: `RESOURCE_NOT_FOUND` (404)

---

### POST /repositories/:id/sync

Quét thư mục `.viettelcloud/workflows/` của repository trên
**`sync_branch` nếu đã đặt, ngược lại `default_branch`** (xem
`PATCH /repositories/:id` để đổi branch), lưu nguyên văn từng file
`*.yaml` / `*.yml` vào một `PipelineVersion` mới, upsert bản ghi `Pipeline`
tương ứng.

⚠️ **Không parse YAML ở bước này** — pipeline mới (hoặc có nội dung đổi)
được tạo/cập nhật với `status: "pending"`. Parse chỉ xảy ra lazy, lúc gọi
`POST /pipelines/:id/trigger` (xem [pipelines.md](pipelines.md)).

Đây là bước bắt buộc sau khi map repository để có dữ liệu pipeline. Có thể
gọi lại bất kỳ lúc nào để cập nhật khi file YAML trên GitHub thay đổi.
**Sync có so sánh nội dung**: file không đổi so với version hiện tại →
**không tạo version mới, không đổi status** (pipeline `active` với script đã
build sẵn vẫn giữ nguyên, chạy lại ngay không cần parse). Chỉ khi nội dung
file thực sự khác, sync mới tạo `PipelineVersion` mới và đưa
`Pipeline.status` về `pending` — vì nội dung mới chưa được xác minh lại
(lần build kế tiếp sẽ tự parse + cache lại script).

**Request**

```http
POST /api/v1/repositories/{repository_id}/sync
```

Không có body.

**Response 200**

```json
{
  "data": [ /* Pipeline object[] — xem pipelines.md */ ]
}
```

Trả về mảng rỗng `[]` nếu repository không có thư mục
`.viettelcloud/workflows/` (không phải lỗi).

Kể cả file YAML lỗi cú pháp cũng được lưu bình thường với `status:
"pending"` (không parse nên không biết lỗi ở bước này) — lỗi cú pháp chỉ lộ
ra khi có ai gọi `POST /pipelines/:id/trigger` cho pipeline đó (trả `422
PIPELINE_PARSE_ERROR`, xem [pipelines.md](pipelines.md)).

**Lỗi**

| Code | Tình huống |
|------|-----------|
| `RESOURCE_NOT_FOUND` | Repository ID không tồn tại |
| `UPSTREAM_ERROR` | Không kết nối được GitHub, hoặc không đọc được nội dung file |

---

### GET /repositories/:id/pipelines

Lấy danh sách pipeline đã được sync của repository. Xem
[pipelines.md](pipelines.md) để biết chi tiết object và endpoint trigger.

**Response 200** — `data`: Pipeline object[] (mảng rỗng nếu chưa `sync` lần
nào).

**Lỗi**: `RESOURCE_NOT_FOUND` (404) nếu repository không tồn tại.

---

### GET /repositories/:id/webhook-events

Audit trail các webhook delivery GitHub đã gửi tới repo này (tối đa 100,
mới nhất trước). Xem chi tiết object và ý nghĩa từng trạng thái trong
[webhooks.md](webhooks.md).
