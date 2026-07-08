import { request } from "./client.js";

/* GET /source-providers */
const listSourceProviders = () =>
  request("GET", "/source-providers");

/* GET /source-providers/:id */
const getSourceProvider = (id) =>
  request("GET", `/source-providers/${id}`);

/* POST /source-providers  { provider_type, access_token } → SourceProvider */
const createSourceProvider = ({ provider_type, access_token }) =>
  request("POST", "/source-providers", { provider_type, access_token });

/* DELETE /source-providers/:id → null (204) */
const deleteSourceProvider = (id) =>
  request("DELETE", `/source-providers/${id}`);

/* GET /source-providers/:id/repositories → Repository[]
   Repo đã map vào platform (đọc từ DB). */
const getSourceProviderRepos = (id) =>
  request("GET", `/source-providers/${id}/repositories`);

/* GET /source-providers/:id/github-repos → { full_name, owner, name, repo_url, default_branch }[]
   Live từ GitHub, KHÔNG lưu DB, không có id — dùng để hiển thị cho người dùng chọn repo để map. */
const getSourceProviderGithubRepos = (id) =>
  request("GET", `/source-providers/${id}/github-repos`);

/* POST /source-providers/:id/repositories { full_name } → Repository
   Map đúng một repo cụ thể (chọn từ github-repos) vào platform. Idempotent theo full_name. */
const mapRepository = (id, fullName) =>
  request("POST", `/source-providers/${id}/repositories`, { full_name: fullName });

export {
  listSourceProviders,
  getSourceProvider,
  createSourceProvider,
  deleteSourceProvider,
  getSourceProviderRepos,
  getSourceProviderGithubRepos,
  mapRepository,
};
