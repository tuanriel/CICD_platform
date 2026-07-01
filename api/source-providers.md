# Source Providers

Source provider là liên kết giữa platform và một tài khoản Git thông qua Personal Access Token (PAT). Token được mã hóa AES-256-GCM trước khi lưu vào DB — không bao giờ lưu plaintext.

---

## Object

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "provider_type": "github",
  "account_login": "octocat",
  "account_id": 583231,
  "token_scopes": "repo, read:user",
  "status": "active",
  "created_at": "2026-06-24T10:00:00Z",
  "updated_at": "2026-06-24T10:00:00Z"
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | string (UUID) | Định danh duy nhất |
| `provider_type` | string | `"github"` \| `"gitlab"` \| `"bitbucket"` |
| `account_login` | string | Username trên provider (vd: `"octocat"`) |
| `account_id` | number | Numeric ID của tài khoản trên provider |
| `token_scopes` | string \| null | Scope của PAT, lấy từ provider lúc validate |
| `status` | string | `"active"` \| `"revoked"` \| `"expired"` |
| `created_at` | string (ISO 8601) | |
| `updated_at` | string (ISO 8601) | |

---

## Endpoints

### POST /source-providers

Liên kết tài khoản Git. Platform validate PAT với provider, sau đó mã hóa và lưu.

**Request**

```http
POST /api/v1/source-providers
Content-Type: application/json
```

```json
{
  "provider_type": "github",
  "access_token": "ghp_xxxxxxxxxxxxxxxxxxxx"
}
```

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `provider_type` | string | ✓ | `"github"` \| `"gitlab"` \| `"bitbucket"` |
| `access_token` | string | ✓ | PAT. Với GitHub cần có scope `repo` |

**Response 201**

```json
{
  "data": { /* Source Provider object */ }
}
```

**Lỗi**

| Code | Tình huống |
|------|-----------|
| `INVALID_PAYLOAD` | Thiếu field hoặc `provider_type` không hợp lệ |
| `INVALID_TOKEN` | PAT đã hết hạn hoặc bị thu hồi |
| `INSUFFICIENT_SCOPE` | PAT thiếu scope `repo` |
| `MAPPING_EXISTS` | Tài khoản này đã được liên kết |
| `UPSTREAM_ERROR` | Không kết nối được GitHub |

---

### GET /source-providers

Lấy danh sách tất cả source providers.

**Response 200**

```json
{
  "data": [ /* Source Provider object[] */ ]
}
```

---

### GET /source-providers/:id

**Response 200**

```json
{
  "data": { /* Source Provider object */ }
}
```

**Lỗi**: `RESOURCE_NOT_FOUND` (404)

---

### DELETE /source-providers/:id

Xóa source provider. Repository đã sync **không** bị xóa theo.

**Response 204** — không có body.

**Lỗi**: `RESOURCE_NOT_FOUND` (404)

---

### GET /source-providers/:id/repositories

Lấy danh sách repository đã sync về platform từ provider này. Đây là dữ liệu trong DB, không gọi GitHub API. Để cập nhật, dùng endpoint sync.

**Response 200**

```json
{
  "data": [ /* Repository object[] — xem repositories.md */ ]
}
```

**Lỗi**: `RESOURCE_NOT_FOUND` (404)

---

### POST /source-providers/:id/sync

Gọi GitHub API để lấy toàn bộ repository accessible, upsert vào DB, trả về danh sách kết quả.

**Response 200**

```json
{
  "data": [ /* Repository object[] — xem repositories.md */ ]
}
```

**Lỗi**: `RESOURCE_NOT_FOUND` (404), `UPSTREAM_ERROR` (502)
