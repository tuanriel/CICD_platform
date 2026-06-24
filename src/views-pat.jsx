import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PAT_PROVIDERS, PAT_TOKENS } from './data-build.jsx';
import { Button, Card, Icon, Input, Modal, StatusBadge, StatusDot, Tag } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { MiniStat } from './views-pipeline.jsx';

/* ============================================================
   Views — Quản lý key PAT (Personal Access Token)
   Đa nhà cung cấp: GitHub (sẵn sàng), GitLab / Bitbucket (sắp ra mắt)
   ============================================================ */

function PatManagement({ account, onNav, onConnect, toast }) {
  const [provider, setProvider] = useState("github");
  const [tokens, setTokens] = useState(PAT_TOKENS);
  const [addOpen, setAddOpen] = useState(false);
  const prov = PAT_PROVIDERS.find((p) => p.id === provider);
  const list = tokens.filter((t) => t.provider === provider);
  const active = list.filter((t) => t.status === "active").length;

  function addToken(tok) {
    setTokens((ts) => [{ ...tok, id: "pat" + Date.now(), provider, status: "active", created: "hôm nay", lastUsed: "vừa xong", expiry: "Còn 90 ngày" }, ...ts]);
    if (!account.connected) onConnect?.();
  }
  function revoke(id) {
    setTokens((ts) => ts.map((t) => t.id === id ? { ...t, status: "revoked", expiry: "Đã thu hồi" } : t));
    toast("Đã thu hồi token", "info");
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
          const cnt = tokens.filter((t) => t.provider === p.id && t.status === "active").length;
          return (
            <button key={p.id} onClick={() => p.available && setProvider(p.id)} disabled={!p.available}
              style={{ display: "flex", alignItems: "center", gap: 13, padding: "15px 16px", textAlign: "left",
                border: `1px solid ${sel ? "var(--accent-border)" : "var(--border)"}`, borderRadius: "var(--r-lg)",
                background: sel ? "var(--accent-dim)" : "var(--panel)", opacity: p.available ? 1 : 0.6, cursor: p.available ? "pointer" : "not-allowed", transition: "all .14s" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name={p.icon} size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{p.name}</span>
                  {!p.available && <Tag>Sắp ra mắt</Tag>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{p.available ? `${cnt} token đang hoạt động` : p.hint}</div>
              </div>
              {sel && <Icon name="check" size={17} style={{ color: "var(--accent)" }} strokeWidth={2.5} />}
            </button>
          );
        })}
      </div>

      {/* Connection status strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
        <MiniStat label="Nhà cung cấp" value={<span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name={prov.icon} size={16} />{prov.name}</span>} />
        <MiniStat label="Token hoạt động" value={active} />
        <MiniStat label="Trạng thái kết nối" value={active > 0 ? <StatusBadge status="active" size="sm" /> : <span style={{ fontSize: 13, color: "var(--text-3)" }}>Chưa kết nối</span>} />
        <MiniStat label="Phạm vi yêu cầu" value={<span className="mono" style={{ fontSize: 12 }}>repo, admin:repo_hook</span>} />
      </div>

      {/* Token table */}
      <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: "-.02em", marginBottom: 12 }}>Danh sách token · {prov.name}</div>
      {list.length ? (
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1.4fr .9fr .9fr 40px", padding: "11px 18px", borderBottom: "1px solid var(--border)",
            fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-3)" }}>
            <span>Tên token</span><span>Token</span><span>Phạm vi</span><span>Tài khoản</span><span>Hết hạn</span><span />
          </div>
          {list.map((t, i) => (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1.4fr .9fr .9fr 40px", padding: "14px 18px", alignItems: "center",
              borderBottom: i < list.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13, opacity: t.status === "active" ? 1 : 0.6 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 560 }}>{t.name}</span>
                  {t.status === "active" ? <StatusDot status="active" size={7} /> : <span style={{ fontSize: 11, color: t.status === "expired" ? "var(--amber)" : "var(--red)" }}>{t.status === "expired" ? "hết hạn" : "thu hồi"}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Dùng gần nhất: {t.lastUsed}</div>
              </div>
              <span className="mono" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{t.token}</span>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{t.scopes.map((s) => <Tag key={s} mono>{s}</Tag>)}</div>
              <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>@{t.account}</span>
              <span style={{ fontSize: 12, color: t.status === "expired" ? "var(--amber)" : "var(--text-3)" }}>{t.expiry}</span>
              <div style={{ textAlign: "right" }}>
                {t.status === "active" && <button onClick={() => revoke(t.id)} title="Thu hồi" style={{ color: "var(--text-3)", padding: 4, borderRadius: 6 }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--red)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-3)"}><Icon name="trash" size={15} /></button>}
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <Card style={{ padding: 44, textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="key" size={24} style={{ color: "var(--text-3)" }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Chưa có token nào cho {prov.name}</div>
          <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.5 }}>
            Thêm Personal Access Token để uỷ quyền nền tảng truy cập repository, đồng bộ pipeline và đăng ký webhook.
          </p>
          <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Thêm token</Button>
        </Card>
      )}

      {/* Why PAT */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 22 }}>
        {[["shield", "Kiến trúc độc lập", "Không khoá cứng vào một nhà cung cấp — tránh Vendor Lock-in, dễ mở rộng sang GitLab, Bitbucket."], ["lock", "Bảo mật", "Token được mã hoá khi lưu, chỉ dùng để gọi API của nhà cung cấp."], ["sync", "Đồng bộ tự động", "Sau khi liên kết, pipeline trong .workflow được nhận diện và đồng bộ tự động."]].map(([i, t, d]) => (
          <Card key={t} pad={16}>
            <Icon name={i} size={18} style={{ color: "var(--accent)", marginBottom: 10 }} />
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{t}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.5 }}>{d}</div>
          </Card>
        ))}
      </div>

      <AddTokenModal open={addOpen} onClose={() => setAddOpen(false)} provider={prov} onAdd={addToken} toast={toast} />
    </Page>
  );
}

function AddTokenModal({ open, onClose, provider, onAdd, toast }) {
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [account, setAccount] = useState("");
  const [show, setShow] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => { if (open) { setName(""); setToken(""); setAccount(""); setShow(false); } }, [open]);

  const valid = name.trim().length >= 2 && token.trim().startsWith("ghp_") && token.trim().length >= 20 && account.trim();

  function submit() {
    if (!valid) return;
    setValidating(true);
    setTimeout(() => {
      setValidating(false);
      onAdd({ name: name.trim(), token: "ghp_••••••••••••" + token.trim().slice(-4), account: account.trim(), scopes: ["đã cấu hình trên GitHub"] });
      toast(`Đã thêm token ${name.trim()}`, "success");
      onClose();
    }, 1200);
  }

  return (
    <Modal open={open} onClose={onClose} width={520} title={`Thêm token · ${provider.name}`} subtitle="Dán Personal Access Token tạo từ nhà cung cấp.">
      <div style={{ padding: "20px 22px" }}>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 540, marginBottom: 7 }}>Tên gợi nhớ</label>
        <Input value={name} onChange={setName} placeholder="vd: ci-platform-token" full />

        <label style={{ display: "block", fontSize: 12.5, fontWeight: 540, margin: "16px 0 7px" }}>Tài khoản / tổ chức</label>
        <Input value={account} onChange={setAccount} placeholder="vd: trang.nguyen" full prefix="@" />

        <label style={{ display: "block", fontSize: 12.5, fontWeight: 540, margin: "16px 0 7px" }}>Access Token</label>
        <Input value={show ? token : token.replace(/./g, (c, i) => i < 4 || i > token.length - 4 ? c : "•")}
          onChange={(v) => { if (show) setToken(v); else setToken(v.replace(/•/g, "")); }} mono full icon="lock" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          suffix={<button onClick={() => setToken("ghp_R7t2KmZ9aQ4eXc1nB8vL")} style={{ fontSize: 11.5, color: "var(--accent)", whiteSpace: "nowrap", fontWeight: 540 }}>Dùng mẫu</button>} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, fontSize: 12.5, color: "var(--text-3)", cursor: "pointer" }}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} style={{ accentColor: "var(--accent)" }} />Hiện token
        </label>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 18, padding: "11px 13px", background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
          <Icon name="info" size={15} style={{ color: "var(--text-3)", marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>Phạm vi (scopes) được cấu hình trực tiếp khi tạo token trên GitHub. Nền tảng sử dụng đúng quyền mà token đã được cấp.</span>
        </div>
      </div>
      <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 9 }}>
        <Button variant="ghost" onClick={onClose}>Huỷ</Button>
        <Button variant="primary" icon={validating ? null : "link"} loading={validating} disabled={!valid} onClick={submit}>{validating ? "Đang xác thực…" : "Thêm & xác thực"}</Button>
      </div>
    </Modal>
  );
}

export { PatManagement, AddTokenModal };
