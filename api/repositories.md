# Repositories

Repository là bản ghi được sync về từ một source provider. Mỗi repository thuộc về đúng một source provider và có thể chứa nhiều pipelines.

---

## Object

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "full_name": "octocat/hello-world",
  "owner": "octocat",
  "name": "hello-world",
  "repo_url": "https://github.com/octocat/hello-world",
  "default_branch": "main",
  "provider": "github",
  "last_synced_at": "2026-06-24T10:05:00Z",
  "created_at": "2026-06-24T10:05:00Z"
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | string (UUID) | Định danh duy nhất trong platform |
| `full_name` | string | `"owner/repo"` — duy nhất trong cùng provider |
| `owner` | string | Username hoặc org trên provider |
| `name` | string | Tên repository |
| `repo_url` | string | URL clone của repository |
| `default_branch` | string | Branch mặc định (thường là `main` hoặc `master`) |
| `provider` | string | `"github"` \| `"gitlab"` \| `"bitbucket"` |
| `last_synced_at` | string \| null | Lần sync gần nhất (ISO 8601) |
| `created_at` | string (ISO 8601) | |

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

**Response 200**

```json
{
  "data": [ /* Repository object[] */ ]
}
```

**Lỗi**

| Code | Tình huống |
|------|-----------|
| `INVALID_PAYLOAD` | Thiếu query param `source_provider_id` |

---

### GET /repositories/:id

**Response 200**

```json
{
  "data": { /* Repository object */ }
}
```

**Lỗi**: `RESOURCE_NOT_FOUND` (404)

---

### DELETE /repositories/:id

Xóa mapping repository khỏi platform. Không ảnh hưởng đến repository trên GitHub. Cascade xóa pipelines và builds liên quan.

**Response 204** — không có body.

**Lỗi**: `RESOURCE_NOT_FOUND` (404)

---

### POST /repositories/:id/sync

Quét thư mục `.workflow/` của repository trên default branch, parse từng file `*.yaml` / `*.yml` thành Canonical Pipeline Model, upsert bản ghi `Pipeline`, và tạo `PipelineVersion` ghi lại kết quả parse.

Đây là bước bắt buộc sau khi sync repository để có pipeline data. Có thể gọi lại bất kỳ lúc nào để cập nhật pipeline khi file YAML thay đổi.

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

Trả về mảng rỗng `[]` nếu repository không có thư mục `.workflow/`.

Nếu một file YAML lỗi cú pháp, pipeline tương ứng được tạo với `status: "error"` và **vẫn được trả về** trong mảng kết quả — không làm dừng quá trình sync các file còn lại.

**Lỗi**

| Code | Tình huống |
|------|-----------|
| `RESOURCE_NOT_FOUND` | Repository ID không tồn tại |
| `UPSTREAM_ERROR` | Không kết nối được GitHub hoặc không lấy được file |

---

### POST /repositories/:id/sync

Quét thư mục `.workflow/` của repository, parse từng file YAML, upsert pipeline và tạo `PipelineVersion`. Xem [pipelines.md](pipelines.md#luồng-sync--pipeline).

### GET /repositories/:id/pipelines

Lấy danh sách pipeline của repository. Mỗi pipeline có `current_version_id` trỏ đến `PipelineVersion` của lần sync gần nhất. Xem [pipelines.md](pipelines.md).

### POST /pipelines/:id/trigger

Trigger thủ công một pipeline cụ thể (dùng pipeline UUID, không phải repository UUID). Xem [pipelines.md](pipelines.md).
