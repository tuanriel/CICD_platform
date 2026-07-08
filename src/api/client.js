const BASE_URL = "https://apicicd.orbitai.vn/api/v1";

const TOKEN_STORAGE_KEY = "cicd_access_token";

let authToken = null;
try { authToken = localStorage.getItem(TOKEN_STORAGE_KEY) || null; } catch {}

let unauthorizedHandler = null;

/* Đăng ký callback gọi khi bất kỳ request nào trả lỗi UNAUTHORIZED (JWT thiếu/sai/hết hạn
   — khác với INVALID_TOKEN của GitHub PAT). Token bị xoá tự động trước khi callback chạy. */
function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

function getAuthToken() {
  return authToken;
}

function setAuthToken(token) {
  authToken = token || null;
  try {
    if (authToken) localStorage.setItem(TOKEN_STORAGE_KEY, authToken);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {}
}

function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function handleErrorPayload(json, status) {
  const err = new Error(json.message || `HTTP ${status}`);
  err.code = json.code || "UNKNOWN_ERROR";
  err.requestId = json.request_id;
  err.status = status;
  if (err.code === "UNAUTHORIZED") {
    setAuthToken(null);
    unauthorizedHandler?.();
  }
  return err;
}

async function request(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json", ...authHeaders() } };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, opts);
  } catch {
    const err = new Error("Không thể kết nối tới server");
    err.code = "NETWORK_ERROR";
    throw err;
  }

  if (res.status === 204) return null;

  const json = await res.json().catch(() => ({}));

  if (!res.ok) throw handleErrorPayload(json, res.status);

  return json.data;
}

/* Cho các endpoint trả text/plain (console log, stage log) — không có envelope { data }. */
async function requestText(method, path) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers: { ...authHeaders() } });
  } catch {
    const err = new Error("Không thể kết nối tới server");
    err.code = "NETWORK_ERROR";
    throw err;
  }

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw handleErrorPayload(json, res.status);
  }

  return res.text();
}

export { BASE_URL, request, requestText, getAuthToken, setAuthToken, onUnauthorized };
