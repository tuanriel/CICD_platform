import { request } from "./client.js";

/* GET /repositories/:id/webhook-events → WebhookEvent[]
   Audit trail tối đa 100 delivery gần nhất (mới nhất trước). Không có payload gốc. */
const listWebhookEvents = (repoId) =>
  request("GET", `/repositories/${repoId}/webhook-events`);

export { listWebhookEvents };
