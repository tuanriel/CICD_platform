import { request } from "./client.js";

/* ============================================================
   Auth — JWT (HS256), gate bằng env AUTH_ENABLED phía backend.
   Khi AUTH_ENABLED=false (mặc định), các endpoint này vẫn hoạt động nhưng
   không route nghiệp vụ nào đòi token. User dev seed sẵn không có mật khẩu
   nên không đăng nhập được — /auth/* chỉ có ý nghĩa khi test/khi bật auth.
   ============================================================ */

/* POST /auth/register { email, password } → { id, email, created_at }
   password 8-72 ký tự. Lỗi: 400 INVALID_PAYLOAD, 409 EMAIL_TAKEN. */
const register = ({ email, password }) =>
  request("POST", "/auth/register", { email, password });

/* POST /auth/login { email, password } → { access_token, token_type, expires_in, user }
   Lỗi: 400 INVALID_PAYLOAD, 401 UNAUTHORIZED (sai email hoặc mật khẩu). */
const login = ({ email, password }) =>
  request("POST", "/auth/login", { email, password });

/* GET /auth/me → user gắn với access_token đang gửi (hoặc user dev nếu auth tắt). */
const me = () => request("GET", "/auth/me");

export { register, login, me };
