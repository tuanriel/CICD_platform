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

/* GET /source-providers/:id/repositories → Repository[] */
const getSourceProviderRepos = (id) =>
  request("GET", `/source-providers/${id}/repositories`);

/* POST /source-providers/:id/sync → Repository[] */
const syncSourceProvider = (id) =>
  request("POST", `/source-providers/${id}/sync`);

export {
  listSourceProviders,
  getSourceProvider,
  createSourceProvider,
  deleteSourceProvider,
  getSourceProviderRepos,
  syncSourceProvider,
};
