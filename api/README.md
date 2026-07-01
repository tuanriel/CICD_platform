# CI/CD Platform — API Reference

Base URL: `http://localhost:8080/api/v1`

## Tài liệu theo resource

| File | Resource |
|------|---------|
| [source-providers.md](source-providers.md) | Liên kết tài khoản Git (GitHub, v.v.) |
| [repositories.md](repositories.md) | Repository được sync về platform |
| [pipelines.md](pipelines.md) | Pipeline và Pipeline Versions |
| [pipeline-yaml.md](pipeline-yaml.md) | Định dạng file `.workflow/*.yaml` |

---

## Conventions

### Response envelope

Mọi response thành công đều bọc trong `data`:

```json
{ "data": { ... } }
```

Mọi lỗi trả về cùng cấu trúc:

```json
{
  "code": "ERROR_CODE",
  "message": "human-readable description",
  "request_id": "uuid"
}
```

### HTTP status codes

| Status | Ý nghĩa |
|--------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (xóa thành công) |
| 400 | Bad Request — payload sai hoặc thiếu field |
| 401 | Unauthorized — token không hợp lệ |
| 404 | Not Found |
| 409 | Conflict — đã tồn tại hoặc pipeline không thể chạy |
| 422 | Unprocessable — scope thiếu hoặc YAML lỗi |
| 500 | Internal Server Error |
| 502 | Bad Gateway — lỗi từ GitHub / Jenkins |

### Error codes

| Code | HTTP | Mô tả |
|------|------|-------|
| `INVALID_PAYLOAD` | 400 | Body JSON sai hoặc thiếu field bắt buộc |
| `INVALID_TOKEN` | 401 | GitHub PAT không hợp lệ hoặc đã hết hạn |
| `RESOURCE_NOT_FOUND` | 404 | ID không tồn tại |
| `MAPPING_EXISTS` | 409 | Source provider đã được liên kết |
| `PIPELINE_NOT_RUNNABLE` | 409 | Pipeline đang ở trạng thái `disabled` hoặc `error` |
| `INSUFFICIENT_SCOPE` | 422 | PAT thiếu scope `repo` |
| `PIPELINE_PARSE_ERROR` | 422 | File `.workflow/*.yaml` không hợp lệ |
| `UPSTREAM_ERROR` | 502 | GitHub API hoặc Jenkins không phản hồi |
| `INTERNAL_ERROR` | 500 | Lỗi server |

### Request ID

Mỗi response có header `X-Request-ID`. Khi báo lỗi, đính kèm giá trị này.

---

## Typical flow

```
1. POST /source-providers                       → kết nối tài khoản GitHub bằng PAT
2. POST /source-providers/:id/sync             → kéo danh sách repository về DB
3. GET  /repositories?source_provider_id=:id   → xem repo đã sync
4. POST /repositories/:id/sync                 → quét .workflow/, parse YAML, tạo pipeline + version
5. GET  /repositories/:id/pipelines            → xem pipeline, status, current_version_id
6. POST /pipelines/:id/trigger                 → trigger thủ công một pipeline cụ thể
```

**Bước 2 vs Bước 4:**
- Bước 2 chỉ kéo *danh sách* repository (metadata: tên, URL, branch...) — không đọc nội dung bên trong.
- Bước 4 đọc *nội dung* repository (đọc `.workflow/`), parse YAML, tạo pipeline records.

---

## CORS

Origin mặc định được phép: `http://localhost:5173`.

Cấu hình qua `.env`:

```env
CORS_ALLOW_ORIGINS=https://your-frontend.com,https://staging.your-app.com
```
