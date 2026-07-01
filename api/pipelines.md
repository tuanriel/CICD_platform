# Pipelines & Pipeline Versions

Pipeline là đơn vị CI/CD tương ứng với một file `.workflow/*.yaml` trong repository. Pipeline được tạo tự động khi sync — mỗi file YAML trong thư mục `.workflow/` tạo ra một pipeline kèm một `PipelineVersion` ghi lại kết quả parse.

Xem [pipeline-yaml.md](pipeline-yaml.md) để biết định dạng file YAML.

---

## Pipeline object

```json
{
  "id": "a3bb189e-8bf9-3888-9912-ace4e6543002",
  "repository_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "name": "build",
  "file_path": ".workflow/build.yaml",
  "jenkins_job_name": null,
  "status": "active",
  "current_version_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "trigger_events": null,
  "trigger_branches": null,
  "created_at": "2026-06-24T10:10:00Z",
  "updated_at": "2026-06-24T10:10:00Z"
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | string (UUID) | Định danh duy nhất |
| `repository_id` | string (UUID) | Repository chứa pipeline này |
| `name` | string | Tên pipeline, lấy từ tên file (bỏ extension). Vd: `build.yaml` → `build` |
| `file_path` | string | Đường dẫn tương đối trong repo, vd: `.workflow/build.yaml` |
| `jenkins_job_name` | string \| null | Tên job trên Jenkins (null cho đến khi Jenkins integration được kích hoạt) |
| `status` | string | Xem bảng bên dưới |
| `current_version_id` | string (UUID) \| null | ID của `PipelineVersion` được tạo lần sync gần nhất |
| `trigger_events` | string[] \| null | Sự kiện kích hoạt tự động, vd: `["push", "pull_request"]` — hiện chưa sử dụng |
| `trigger_branches` | string[] \| null | Branch kích hoạt tự động, vd: `["main"]` — hiện chưa sử dụng |
| `created_at` | string (ISO 8601) | |
| `updated_at` | string (ISO 8601) | |

### Pipeline status

| Status | Mô tả | Có thể trigger? |
|--------|-------|----------------|
| `active` | File YAML hợp lệ, pipeline đang hoạt động | ✓ |
| `disabled` | Bị tắt thủ công | ✗ |
| `error` | File YAML lỗi cú pháp khi parse | ✗ |

---

## PipelineVersion object

Mỗi lần sync tạo ra một `PipelineVersion` lưu snapshot kết quả parse của file YAML tại thời điểm đó.

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "pipeline_id": "a3bb189e-8bf9-3888-9912-ace4e6543002",
  "commit_sha": null,
  "raw_yaml": "version: \"1.0\"\nstages:\n  ...",
  "parsed_canonical": {
    "version": "1.0",
    "stages": [
      {
        "name": "build",
        "steps": [
          {
            "name": "compile",
            "image": "golang:1.22-alpine",
            "command": ["go", "build", "-o", "server", "./cmd/server"],
            "env": { "CGO_ENABLED": "0", "GOOS": "linux" }
          }
        ]
      }
    ]
  },
  "parse_status": "success",
  "parse_error": null,
  "created_at": "2026-06-24T10:10:00Z"
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | string (UUID) | Định danh duy nhất |
| `pipeline_id` | string (UUID) | Pipeline cha |
| `commit_sha` | string \| null | Commit SHA lúc sync (null nếu sync thủ công chưa gắn commit) |
| `raw_yaml` | string | Nội dung file `.workflow/*.yaml` gốc |
| `parsed_canonical` | object \| null | Canonical Pipeline Model sau khi parse thành công; null nếu parse lỗi |
| `parse_status` | string | `"success"` \| `"failed"` |
| `parse_error` | string \| null | Thông báo lỗi parse chi tiết (null nếu thành công) |
| `created_at` | string (ISO 8601) | |

---

## Endpoints

### GET /repositories/:id/pipelines

Lấy danh sách tất cả pipeline của một repository.

**Request**

```http
GET /api/v1/repositories/{repository_id}/pipelines
```

**Response 200**

```json
{
  "data": [ /* Pipeline object[] */ ]
}
```

**Lỗi**: `RESOURCE_NOT_FOUND` (404) nếu repository không tồn tại.

---

### POST /pipelines/:id/trigger

Trigger thủ công một pipeline tại một commit cụ thể. Pipeline phải ở trạng thái `active`.

**Request**

```http
POST /api/v1/pipelines/{pipeline_id}/trigger
Content-Type: application/json
```

```json
{
  "ref": "main",
  "sha": "abc123def456abc123def456abc123def456abc1"
}
```

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `ref` | string | ✓ | Branch hoặc tag (vd: `"main"`, `"v1.0.0"`) |
| `sha` | string | ✓ | Commit SHA đầy đủ 40 ký tự |

**Response 201**

```json
{
  "data": { /* Pipeline object */ }
}
```

**Lỗi**

| Code | Tình huống |
|------|-----------|
| `INVALID_PAYLOAD` | Thiếu field trong body |
| `RESOURCE_NOT_FOUND` | Pipeline ID không tồn tại |
| `PIPELINE_NOT_RUNNABLE` | Pipeline ở trạng thái `disabled` hoặc `error` |

---

## Luồng sync → pipeline

Khi `POST /source-providers/:id/sync` được gọi, platform thực hiện:

```
GitHub API (Contents API)
  └── .workflow/*.yaml        ← đọc từng file YAML
        ├── parser.ParseToCanonical()
        │     ├── OK  → ParseStatus = "success", lưu Canonical JSON
        │     └── ERR → ParseStatus = "failed",  lưu parse_error
        ├── Upsert Pipeline    (status = "active" | "error")
        ├── Create PipelineVersion
        └── Update Pipeline.current_version_id
```

Nếu parse lỗi, pipeline được tạo với `status: "error"` và **không thể trigger**. Xem `parse_error` trong PipelineVersion để biết chi tiết lỗi.
