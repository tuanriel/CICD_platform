import React, { useState } from 'react';
import { Button, Card, Icon, Input } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { register as apiRegister, login as apiLogin } from './api/auth.js';

/* ============================================================
   Views — Đăng nhập / Đăng ký tài khoản platform (JWT)
   Tách biệt với PAT GitHub (đó là uỷ quyền truy cập repo, đây là tài khoản
   dùng chính platform). Chỉ thật sự bắt buộc khi backend bật AUTH_ENABLED —
   xem docs/api/auth.md. Khi tắt, các route khác vẫn dùng được bình thường
   mà không cần đăng nhập.
   ============================================================ */

const API_ERROR_MESSAGES = {
  INVALID_PAYLOAD: "Email hoặc mật khẩu không hợp lệ.",
  EMAIL_TAKEN:      "Email này đã được đăng ký — hãy đăng nhập.",
  UNAUTHORIZED:     "Sai email hoặc mật khẩu.",
  NETWORK_ERROR:    "Không thể kết nối tới server.",
};

function AuthView({ onLoggedIn, onNav, toast }) {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 8 && password.length <= 72;
  const canSubmit = emailValid && passwordValid && !submitting;

  function switchMode(next) {
    setMode(next);
    setError(null);
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "register") {
        await apiRegister({ email: email.trim(), password });
      }
      const data = await apiLogin({ email: email.trim(), password });
      onLoggedIn?.(data);
      toast?.(`Xin chào ${data.user.email}`, "success");
      onNav?.({ view: "dashboard" });
    } catch (err) {
      setError(API_ERROR_MESSAGES[err.code] || err.message || "Thao tác thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page>
      <PageHeader title={mode === "login" ? "Đăng nhập" : "Đăng ký tài khoản"} icon="user"
        subtitle="Tài khoản dùng cho platform — tách biệt với Personal Access Token GitHub. Chỉ bắt buộc khi backend bật xác thực." />

      <div style={{ maxWidth: 420 }}>
        <Card>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 540, color: "var(--text-2)", marginBottom: 7 }}>Email</label>
          <Input value={email} onChange={setEmail} placeholder="ban@example.com" icon="user" full
            onKeyDown={(e) => e.key === "Enter" && canSubmit && submit()} />

          <label style={{ display: "block", fontSize: 12.5, fontWeight: 540, color: "var(--text-2)", marginTop: 14, marginBottom: 7 }}>
            Mật khẩu <span style={{ fontWeight: 400, color: "var(--text-3)" }}>(8–72 ký tự)</span>
          </label>
          <Input value={password} onChange={setPassword} placeholder="••••••••" icon="lock" type="password" full
            onKeyDown={(e) => e.key === "Enter" && canSubmit && submit()} />

          {error && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, padding: "10px 13px",
              background: "var(--red-dim)", border: "1px solid color-mix(in oklab, var(--red) 40%, transparent)",
              borderRadius: "var(--r-sm)", fontSize: 13, color: "var(--red)" }}>
              <Icon name="xCircle" size={14} />{error}
            </div>
          )}

          <Button variant="primary" size="lg" full loading={submitting} disabled={!canSubmit} onClick={submit}
            style={{ marginTop: 18 }}>
            {submitting ? (mode === "login" ? "Đang đăng nhập…" : "Đang đăng ký…") : (mode === "login" ? "Đăng nhập" : "Đăng ký")}
          </Button>

          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--text-3)" }}>
            {mode === "login" ? (
              <>Chưa có tài khoản? <button onClick={() => switchMode("register")} style={{ color: "var(--accent)", fontWeight: 560 }}>Đăng ký</button></>
            ) : (
              <>Đã có tài khoản? <button onClick={() => switchMode("login")} style={{ color: "var(--accent)", fontWeight: 560 }}>Đăng nhập</button></>
            )}
          </div>
        </Card>
      </div>
    </Page>
  );
}

export { AuthView };
