# Source Providers

Source provider là liên kết giữa platform và một tài khoản Git (hiện chỉ
GitHub được implement) thông qua Personal Access Token (PAT). Token được mã
hóa AES-256-GCM trước khi lưu — **không bao giờ** trả lại plaintext hay
`access_token_enc` qua API.

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
| `id` | string (UUID) | Định danh duy nhất — dùng cho mọi endpoint con dưới đây |
| `provider_type` | string | `"github"` \| `"gitlab"` \| `"bitbucket"` — chỉ `"github"` có hoạt động thật, 2 giá trị còn lại backend chấp nhận nhưng **chưa có xử lý** phía sau |
| `account_login` | string | Username trên GitHub (lấy từ GitHub, không phải giá trị client gửi lên) |
| `account_id` | number | Numeric ID tài khoản trên GitHub |
| `token_scopes` | string \| null | Scope của PAT, lấy từ GitHub lúc validate (vd: `"repo, read:user"`) |
| `status` | string | `"active"` \| `"revoked"` \| `"expired"` — hiện luôn là `"active"` sau khi tạo, chưa có cơ chế tự chuyển sang `revoked`/`expired` |
| `created_at` | string (ISO 8601) | |
| `updated_at` | string (ISO 8601) | |

**Không có endpoint update.** Muốn đổi token (PAT bị revoke/hết hạn) phải
`DELETE` rồi `POST` lại — sẽ tạo `id` mới.

---

## Endpoints

### POST /source-providers

Liên kết tài khoản GitHub. Backend gọi GitHub để validate PAT (`GET /user` +
kiểm tra scope `repo`), sau đó mã hóa và lưu.

**Request**

```http
POST /api/v1/source-providers
Content-Type: application/json

{
  "provider_type": "github",
  "access_token": "ghp_xxxxxxxxxxxxxxxxxxxx"
}
```

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `provider_type` | string | ✓ | `"github"` \| `"gitlab"` \| `"bitbucket"` |
| `access_token` | string | ✓ | PAT. Với GitHub cần scope `repo` |

**Response 201** — Source Provider object.

**Lỗi**

| Code | Tình huống |
|------|-----------|
| `INVALID_PAYLOAD` | Thiếu field hoặc `provider_type` không hợp lệ |
| `INVALID_TOKEN` | PAT sai, đã hết hạn hoặc bị thu hồi |
| `INSUFFICIENT_SCOPE` | PAT thiếu scope `repo` |
| `MAPPING_EXISTS` | Tài khoản GitHub này đã được liên kết trước đó |
| `UPSTREAM_ERROR` | Không kết nối được GitHub |

---

### GET /source-providers

Lấy danh sách tất cả source providers.

⚠️ **Chưa filter theo user** (chưa có auth) — trả về **tất cả** source
provider trong DB, không phân biệt ai tạo. Sẽ đổi hành vi khi auth được
thêm.

**Response 200** — `data`: Source Provider object[].

---

### GET /source-providers/:id

**Response 200** — Source Provider object.

**Lỗi**: `RESOURCE_NOT_FOUND` (404)

---

### DELETE /source-providers/:id

Xóa source provider.

⚠️ Nếu source provider này còn repository đã map (`repositories` con), xoá
sẽ **lỗi ở tầng DB** (foreign key constraint) — backend hiện trả lỗi
`500 INTERNAL_ERROR` chung, không có `code` riêng biệt để phân biệt trường
hợp này. Frontend nên tự chặn: kiểm tra `GET :id/repositories` rỗng trước khi
cho phép xoá, hoặc hiển thị thông báo generic khi gặp 500 ở đây.

**Response 204** — không có body.

**Lỗi**: `RESOURCE_NOT_FOUND` (404), `INTERNAL_ERROR` (500, xem cảnh báo trên)

---

## Chọn & map repository

3 endpoint dưới đây thay cho việc "sync toàn bộ repo" — người dùng xem trước
danh sách trên GitHub rồi chọn **từng repo cụ thể** để đưa vào platform.

### GET /source-providers/:id/github-repos

Gọi GitHub API để lấy **toàn bộ** repository mà token có quyền truy cập.
Dữ liệu **live, không lưu vào DB** — dùng để hiển thị cho người dùng chọn,
trước khi gọi `POST .../repositories`.

**Response 200**

```json
{
  "data": [
    {
      "full_name": "octocat/hello-world",
      "owner": "octocat",
      "name": "hello-world",
      "repo_url": "https://github.com/octocat/hello-world.git",
      "default_branch": "main"
    }
  ]
}
```

Object trả về **không có `id`/`created_at`** — vì chưa được map. Dùng
`full_name` làm khoá để gọi bước map tiếp theo.

**Lỗi**: `RESOURCE_NOT_FOUND` (404, source provider không tồn tại),
`UPSTREAM_ERROR` (502)

Gọi lại endpoint này không có tác dụng phụ — có thể gọi mỗi lần mở modal
"chọn repository" để luôn thấy danh sách mới nhất trên GitHub.

---

### POST /source-providers/:id/repositories

Map **đúng một** repository cụ thể (chọn từ kết quả `github-repos`) vào
platform. Backend gọi GitHub lấy metadata của riêng repo đó rồi lưu vào DB —
không kéo toàn bộ danh sách.

**Request**

```http
POST /api/v1/source-providers/{id}/repositories
Content-Type: application/json

{ "full_name": "octocat/hello-world" }
```

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `full_name` | string | ✓ | `"owner/repo"`, lấy từ kết quả `github-repos` |

**Response 201** — Repository object (xem [repositories.md](repositories.md)),
giờ có `id` — **lưu lại UUID này**, dùng cho các endpoint trong
`repositories.md`. Response còn có thêm `webhook_registered` (bool): backend
tự đăng ký webhook GitHub cho repo ngay khi map (xem
[webhooks.md](webhooks.md)); `false` = đăng ký thất bại (PAT thiếu scope
`admin:repo_hook`, `WEBHOOK_BASE_URL` chưa cấu hình...) — map vẫn thành
công, chỉ auto-trigger không hoạt động; map lại để thử đăng ký lại.

**Lỗi**

| Code | Tình huống |
|------|-----------|
| `INVALID_PAYLOAD` | Thiếu `full_name` |
| `RESOURCE_NOT_FOUND` | Source provider không tồn tại, hoặc repo không tồn tại/token không có quyền truy cập trên GitHub |
| `UPSTREAM_ERROR` | Không kết nối được GitHub |

Gọi lại với `full_name` đã map trước đó **không lỗi** — chỉ cập nhật lại
metadata (idempotent), không tạo bản ghi trùng, `id` giữ nguyên.

---

### GET /source-providers/:id/repositories

Lấy danh sách repository **đã map** vào platform từ provider này — đọc từ
DB, không gọi GitHub. Tương đương
`GET /repositories?source_provider_id={id}` (xem
[repositories.md](repositories.md)) — dùng endpoint nào cũng được, cùng dữ
liệu.

**Response 200** — `data`: Repository object[] (xem
[repositories.md](repositories.md)).

**Lỗi**: `RESOURCE_NOT_FOUND` (404)
