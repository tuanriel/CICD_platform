# Auth — Đăng ký / Đăng nhập (JWT)

Base URL: `http://localhost:8080/api/v1`

Xác thực bằng JWT (HS256), **gate bằng env `AUTH_ENABLED`**:

- `AUTH_ENABLED=false` (mặc định): mọi request chạy dưới user dev cố định,
  không cần token. `/auth/register` + `/auth/login` vẫn hoạt động nếu muốn
  thử, nhưng các route nghiệp vụ **không** đòi token. `/auth/me` trả về user
  dev.
- `AUTH_ENABLED=true`: các route nghiệp vụ đòi `Authorization: Bearer <token>`.
  Ngoại lệ (luôn public): `/auth/register`, `/auth/login`, `/webhooks/github`
  (xác thực bằng HMAC riêng), `/swagger/*`.

Cấu hình liên quan (xem `.env.example`): `AUTH_ENABLED`, `JWT_SECRET` (bắt
buộc khi bật — server từ chối khởi động nếu thiếu), `JWT_EXPIRY` (mặc định
`24h`).

> Mật khẩu được hash bằng **bcrypt** trước khi lưu; response **không bao giờ**
> trả `password_hash`. User dev seed sẵn (`dev@localhost`) không có mật khẩu
> nên **không đăng nhập được** — chỉ phục vụ chế độ `AUTH_ENABLED=false`.

---

## POST /auth/register

Tạo tài khoản mới. Public.

```http
POST /api/v1/auth/register
Content-Type: application/json

{ "email": "alice@example.com", "password": "hunter2password" }
```

| Field | Bắt buộc | Ràng buộc |
|-------|----------|-----------|
| `email` | ✓ | Định dạng email hợp lệ (được normalize về chữ thường) |
| `password` | ✓ | 8–72 ký tự (bcrypt giới hạn input 72 byte) |

→ `201`:

```json
{ "data": { "id": "…uuid…", "email": "alice@example.com", "created_at": "2026-07-08T…Z" } }
```

Lỗi: `400 INVALID_PAYLOAD` (email/password không hợp lệ), `409 EMAIL_TAKEN`
(email đã đăng ký).

---

## POST /auth/login

Xác thực và nhận access token. Public.

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "alice@example.com", "password": "hunter2password" }
```

→ `200`:

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…",
    "token_type": "Bearer",
    "expires_in": 86400,
    "user": { "id": "…uuid…", "email": "alice@example.com", "created_at": "…" }
  }
}
```

`expires_in` là số **giây** token còn hiệu lực. Lưu `access_token` và gửi kèm
mọi request sau: `Authorization: Bearer <access_token>`.

Lỗi: `400 INVALID_PAYLOAD`; `401 UNAUTHORIZED` (sai email **hoặc** mật khẩu —
message không tiết lộ field nào sai, tránh dò tài khoản).

---

## GET /auth/me

Trả về user gắn với token đang gửi. Route bảo vệ (đòi token khi
`AUTH_ENABLED=true`; khi tắt thì trả user dev).

```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

→ `200`:

```json
{ "data": { "id": "…uuid…", "email": "alice@example.com", "created_at": "…" } }
```

Lỗi: `401 UNAUTHORIZED` (thiếu/sai/hết hạn token), `404 RESOURCE_NOT_FOUND`
(user trong token không còn tồn tại).

---

## Luồng frontend (khi bật auth)

```
1. POST /auth/register            — (tùy chọn) tạo tài khoản
2. POST /auth/login               — lấy access_token
3. Lưu token, đính header "Authorization: Bearer <token>" cho mọi call sau
4. GET  /auth/me                  — hiển thị user đang đăng nhập
5. Khi bất kỳ call nào trả 401 → token hết hạn/không hợp lệ → điều hướng login lại
```

Token là JWT tự-chứa, backend **không lưu session** — “đăng xuất” chỉ là xóa
token phía client. Chưa có refresh token (access token hết hạn thì đăng nhập
lại).
