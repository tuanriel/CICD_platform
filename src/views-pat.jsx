import React, { useState, useEffect, useCallback } from 'react';
import { PAT_PROVIDERS } from './data-build.jsx';
import { Button, Card, Icon, Input, Modal, StatusBadge, Tag } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { MiniStat } from './views-pipeline.jsx';
import {
  listSourceProviders,
  createSourceProvider,
  deleteSourceProvider,
} from './api/source-providers.js';

/* ============================================================
   Views — Quản lý key PAT (Personal Access Token)
   Dữ liệu được tải từ API: POST/GET/DELETE /api/v1/source-providers
   ============================================================ */

const API_ERROR_MESSAGES = {
  INVALID_TOKEN:      "Token không hợp lệ hoặc đã hết hạn",
  INSUFFICIENT_SCOPE: "Token thiếu quyền repo",
  MAPPING_EXISTS:     "Tài khoản này đã được liên kết",
  UPSTREAM_ERROR:     "Không kết nối được GitHub",
  INVALID_PAYLOAD:    "Thông tin không hợp lệ",
  NETWORK_ERROR:      "Không thể kết nối tới server",
};

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function PatManagement({ account, onNav, onConnect, toast }) {
  const [provider, setProvider] = useState("github");
  const [sourceProviders, setSourceProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const prov = PAT_PROVIDERS.find((p) => p.id === provider);
  const list = sourceProviders.filter((sp) => sp.provider_type === provider);
  const active = list.filter((sp) => sp.status === "active").length;

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSourceProviders();
      setSourceProviders(data ?? []);
    } catch {
      setSourceProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);

  async function handleAdd(providerObj) {
    await loadProviders();
    if (!account?.connected) onConnect?.(providerObj);
  }

  async function revoke(id) {
    try {
      await deleteSourceProvider(id);
      setSourceProviders((ps) => ps.filter((p) => p.id !== id));
      toast("Đã xoá source provider", "info");
    } catch (err) {
      toast(API_ERROR_MESSAGES[err.code] || err.message || "Xoá thất bại", "error");
    }
  }

  return (
    <Page wide>
      <PageHeader title="Quản lý key PAT" icon="key"
        subtitle="Lưu trữ và quản lý Personal Access Token theo từng nhà cung cấp mã nguồn để uỷ quyền truy cập."
        actions={<Button variant="primary" icon="plus" disabled={!prov.available} onClick={() => setAddOpen(true)}>Thêm token</Button>} />

      {/* Provider selector */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 22 }}>
        {PAT_PROVIDERS.map((p) => {
          const sel = provider === p.id;
          const cnt = sourceProviders.filter((sp) => sp.provider_type === p.id && sp.status === "active").length;
          return (
            <button key={p.id} onClick={() => p.available && setProvider(p.id)} disabled={!p.available}
              style={{ display: "flex", alignItems: "center", gap: 13, padding: "15px 16px", textAlign: "left",
                border: `1px solid ${sel ? "var(--accent-border)" : "var(--border)"}`, borderRadius: "var(--r-lg)",
                background: sel ? "var(--accent-dim)" : "var(--panel)", opacity: p.available ? 1 : 0.6,
                cursor: p.available ? "pointer" : "not-allowed", transition: "all .14s" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name={p.icon} size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{p.name}</span>
                  {!p.available && <Tag>Sắp ra mắt</Tag>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                  {p.available ? `${cnt} token đang hoạt động` : p.hint}
                </div>
              </div>
              {sel && <Icon name="check" size={17} style={{ color: "var(--accent)" }} strokeWidth={2.5} />}
            </button>
          );
        })}
      </div>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
        <MiniStat label="Nhà cung cấp" value={<span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name={prov.icon} size={16} />{prov.name}</span>} />
        <MiniStat label="Token hoạt động" value={active} />
        <MiniStat label="Trạng thái kết nối" value={active > 0 ? <StatusBadge status="active" size="sm" /> : <span style={{ fontSize: 13, color: "var(--text-3)" }}>Chưa kết nối</span>} />
        <MiniStat label="Phạm vi yêu cầu" value={<span className="mono" style={{ fontSize: 12 }}>repo, admin:repo_hook</span>} />
      </div>

      {/* Source provider table */}
      <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: "-.02em", marginBottom: 12 }}>
        Danh sách source provider · {prov.name}
      </div>

      {loading ? (
        <Card pad={44} style={{ textAlign: "center" }}>
          <Icon name="refresh" size={22} style={{ color: "var(--text-3)", animation: "spin .7s linear infinite", margin: "0 auto 10px", display: "block" }} />
          <span style={{ fontSize: 13.5, color: "var(--text-3)" }}>Đang tải...</span>
        </Card>
      ) : list.length ? (
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.8fr 1fr 1fr 40px", padding: "11px 18px",
            borderBottom: "1px solid var(--border)", fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em",
            textTransform: "uppercase", color: "var(--text-3)" }}>
            <span>Tài khoản</span><span>Phạm vi</span><span>Trạng thái</span><span>Ngày tạo</span><span />
          </div>
          {list.map((sp, i) => {
            const scopes = sp.token_scopes ? sp.token_scopes.split(",").map((s) => s.trim()).filter(Boolean) : [];
            const statusMap = { active: "active", expired: "queued", revoked: "failed" };
            return (
              <div key={sp.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1.8fr 1fr 1fr 40px",
                padding: "14px 18px", alignItems: "center",
                borderBottom: i < list.length - 1 ? "1px solid var(--border)" : "none",
                fontSize: 13, opacity: sp.status === "active" ? 1 : 0.6 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 560 }}>@{sp.account_login}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                    ID: {sp.account_id}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {scopes.length
                    ? scopes.map((s) => <Tag key={s} mono>{s}</Tag>)
                    : <span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span>}
                </div>
                <StatusBadge status={statusMap[sp.status] ?? "queued"} size="sm" />
                <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{fmtDate(sp.created_at)}</span>
                <div style={{ textAlign: "right" }}>
                  {sp.status === "active" && (
                    <button onClick={() => revoke(sp.id)} title="Xoá"
                      style={{ color: "var(--text-3)", padding: 4, borderRadius: 6 }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "var(--red)"}
                      onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-3)"}>
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      ) : (
        <Card style={{ padding: 44, textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--panel-2)", border: "1px solid var(--border)",
            display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="key" size={24} style={{ color: "var(--text-3)" }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Chưa có token nào cho {prov.name}</div>
          <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.5 }}>
            Thêm Personal Access Token để uỷ quyền nền tảng truy cập repository, đồng bộ pipeline và đăng ký webhook.
          </p>
          <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Thêm token</Button>
        </Card>
      )}

      {/* Info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 22 }}>
        {[
          ["shield", "Kiến trúc độc lập", "Không khoá cứng vào một nhà cung cấp — tránh Vendor Lock-in, dễ mở rộng sang GitLab, Bitbucket."],
          ["lock",   "Bảo mật",           "Token được mã hoá AES-256-GCM khi lưu, không bao giờ lưu plaintext."],
          ["sync",   "Đồng bộ tự động",   "Sau khi liên kết, pipeline trong .viettelcloud/workflows được nhận diện và đồng bộ tự động."],
        ].map(([icon, title, desc]) => (
          <Card key={title} pad={16}>
            <Icon name={icon} size={18} style={{ color: "var(--accent)", marginBottom: 10 }} />
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.5 }}>{desc}</div>
          </Card>
        ))}
      </div>

      <AddTokenModal open={addOpen} onClose={() => setAddOpen(false)} provider={prov} onAdd={handleAdd} toast={toast} />
    </Page>
  );
}

function AddTokenModal({ open, onClose, provider, onAdd, toast }) {
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) { setToken(""); setShow(false); } }, [open]);

  const trimmed = token.trim();
  const valid = trimmed.startsWith("ghp_") && trimmed.length >= 20;
  const masked = show ? token : token.replace(/./g, (c, i) => (i < 4 || i > token.length - 4 ? c : "•"));

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const data = await createSourceProvider({ provider_type: provider.id, access_token: trimmed });
      toast(`Đã kết nối tài khoản @${data.account_login}`, "success");
      await onAdd(data);
      onClose();
    } catch (err) {
      toast(API_ERROR_MESSAGES[err.code] || err.message || "Thêm token thất bại", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={520} title={`Thêm token · ${provider.name}`}
      subtitle="Dán Personal Access Token tạo từ nhà cung cấp.">
      <div style={{ padding: "20px 22px" }}>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 540, marginBottom: 7 }}>Access Token</label>
        <Input
          value={masked}
          onChange={(v) => { if (show) setToken(v); else setToken(v.replace(/•/g, "")); }}
          mono full icon="lock" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          suffix={
            <button onClick={() => setToken("ghp_R7t2KmZ9aQ4eXc1nB8vL")}
              style={{ fontSize: 11.5, color: "var(--accent)", whiteSpace: "nowrap", fontWeight: 540 }}>
              Dùng mẫu
            </button>
          }
        />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, fontSize: 12.5, color: "var(--text-3)", cursor: "pointer" }}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
          Hiện token
        </label>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 18, padding: "11px 13px",
          background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
          <Icon name="info" size={15} style={{ color: "var(--text-3)", marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
            Platform sẽ validate token với GitHub, lấy thông tin tài khoản và mã hoá AES-256-GCM trước khi lưu. Token cần có scope{" "}
            <span className="mono" style={{ color: "var(--text)" }}>repo</span>.
          </span>
        </div>

        {token && !valid && (
          <div style={{ fontSize: 12, color: "var(--red)", marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="xCircle" size={13} />Token không hợp lệ — phải bắt đầu bằng <span className="mono">ghp_</span>
          </div>
        )}
      </div>
      <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 9 }}>
        <Button variant="ghost" onClick={onClose}>Huỷ</Button>
        <Button variant="primary" icon={submitting ? null : "link"} loading={submitting} disabled={!valid} onClick={submit}>
          {submitting ? "Đang xác thực…" : "Thêm & xác thực"}
        </Button>
      </div>
    </Modal>
  );
}

export { PatManagement, AddTokenModal };
