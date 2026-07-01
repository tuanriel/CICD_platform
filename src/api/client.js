const BASE_URL = "http://localhost:8080/api/v1";

async function request(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
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

  if (!res.ok) {
    const err = new Error(json.message || `HTTP ${res.status}`);
    err.code = json.code || "UNKNOWN_ERROR";
    err.requestId = json.request_id;
    err.status = res.status;
    throw err;
  }

  return json.data;
}

export { BASE_URL, request };
