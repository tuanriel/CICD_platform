import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Avatar, Breadcrumb, Button, Icon, SectionLabel } from './primitives.jsx';

/* ============================================================
   Layout — Sidebar (grouped nav) + Topbar
   ============================================================ */

const NAV = [
  { id: "dashboard", label: "Tổng quan", icon: "dashboard", to: "/" },
  {
    id: "g-repo", label: "Repository", icon: "repo", group: true, children: [
      { id: "repos",     label: "Danh sách repository", icon: "repo",     to: "/repos" },
      { id: "pipelines", label: "Pipeline",              icon: "pipeline", to: "/pipelines" },
      // { id: "webhooks",  label: "Webhook",               icon: "webhook",  to: "/webhooks" },
    ],
  },
  { id: "build-history", label: "Lịch sử build",   icon: "clock", to: "/build-history" },
  { id: "pat",           label: "Quản lý key PAT", icon: "key",   to: "/pat" },
];

// leaf views available to the command palette
const NAV_FLAT = NAV.flatMap((n) => n.group ? n.children : [n]);

// kept for backward compat, not used internally anymore
const VIEW_TO_NAV = {
  dashboard: "dashboard",
  "build-history": "build-history",
  repos: "repos", repo: "repos",
  pipelines: "pipelines", pipeline: "pipelines", run: "pipelines", jenkins: "pipelines", "create-pipeline": "pipelines",
  webhooks: "webhooks",
  pat: "pat", github: "pat",
};

function getActiveNavId(pathname) {
  if (pathname === '/') return 'dashboard';
  if (pathname.startsWith('/repos')) return 'repos';
  if (pathname.startsWith('/pipelines')) return 'pipelines';
  if (pathname.startsWith('/webhooks')) return 'webhooks';
  if (pathname.startsWith('/build-history')) return 'build-history';
  if (pathname.startsWith('/pat') || pathname.startsWith('/github')) return 'pat';
  return 'dashboard';
}

function NavLeaf({ item, activeId, nested }) {
  const navigate = useNavigate();
  const active = activeId === item.id;
  return (
    <button onClick={() => navigate(item.to)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: nested ? "7px 9px 7px 12px" : "8px 9px", borderRadius: "var(--r-sm)",
        color: active ? "var(--text)" : "var(--text-2)", background: active ? "var(--panel-2)" : "transparent",
        fontWeight: active ? 560 : 500, fontSize: 13.5, letterSpacing: "-.01em", transition: "background .12s, color .12s",
        position: "relative", textAlign: "left", width: "100%" }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "var(--panel)"; e.currentTarget.style.color = "var(--text)"; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-2)"; } }}>
      {active && <span style={{ position: "absolute", left: nested ? -16 : -10, top: 7, bottom: 7, width: 2.5, borderRadius: 99, background: "var(--accent)" }} />}
      <Icon name={item.icon} size={nested ? 15 : 17} style={{ color: active ? "var(--accent)" : "inherit" }} />
      {item.label}
    </button>
  );
}

function NavGroup({ item, activeId }) {
  const containsActive = item.children.some((c) => c.id === activeId);
  const [open, setOpen] = useState(true);
  useEffect(() => { if (containsActive) setOpen(true); }, [containsActive]);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 9px", borderRadius: "var(--r-sm)", width: "100%",
          color: containsActive ? "var(--text)" : "var(--text-2)", fontWeight: 560, fontSize: 13.5, letterSpacing: "-.01em", textAlign: "left", transition: "color .12s" }}
        onMouseEnter={(e) => e.currentTarget.style.color = "var(--text)"}
        onMouseLeave={(e) => e.currentTarget.style.color = containsActive ? "var(--text)" : "var(--text-2)"}>
        <Icon name={item.icon} size={17} style={{ color: containsActive ? "var(--accent)" : "var(--text-3)" }} />
        <span style={{ flex: 1 }}>{item.label}</span>
        <Icon name={open ? "chevronDown" : "chevronRight"} size={14} style={{ color: "var(--text-3)" }} />
      </button>
      {open && (
        <div style={{ marginLeft: 18, paddingLeft: 10, borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 2, marginTop: 2, marginBottom: 2 }}>
          {item.children.map((c) => <NavLeaf key={c.id} item={c} activeId={activeId} nested />)}
        </div>
      )}
    </div>
  );
}

function Sidebar({ account }) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeId = getActiveNavId(location.pathname);
  return (
    <aside style={{ background: "var(--bg-subtle)", borderRight: "1px solid var(--border)", display: "flex",
      flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Brand */}
      <div style={{ padding: "18px 16px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent)", color: "var(--accent-fg)",
          display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "0 2px 10px -2px var(--accent-dim)" }}>
          <Icon name="box" size={18} strokeWidth={2} />
        </div>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontWeight: 640, fontSize: 14.5, letterSpacing: "-.02em" }}>CICD Platform</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: ".01em" }}>Build & Automation</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "6px 10px", display: "flex", flexDirection: "column", gap: 3, flex: 1, overflowY: "auto" }}>
        <SectionLabel style={{ padding: "10px 8px 6px" }}>Điều hướng</SectionLabel>
        {NAV.map((n) => n.group
          ? <NavGroup key={n.id} item={n} activeId={activeId} />
          : <NavLeaf key={n.id} item={n} activeId={activeId} />)}
      </nav>

      {/* GitHub connection card */}
      <div style={{ padding: 12 }}>
        <div onClick={() => navigate('/pat')}
          style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r-md)",
            padding: 12, cursor: "pointer", transition: "border-color .15s" }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border-strong)"}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}>
          {account.connected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar initials={account.avatar} size={32} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 560, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.username}</div>
                <div style={{ fontSize: 11, color: "var(--green)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--green)" }} />GitHub đã kết nối
                </div>
              </div>
              <Icon name="key" size={15} style={{ color: "var(--text-3)" }} />
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Icon name="github" size={18} />
                <span style={{ fontSize: 13, fontWeight: 560 }}>Chưa kết nối</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 10, lineHeight: 1.4 }}>Thêm key PAT để đồng bộ và build.</div>
              <Button variant="outline" size="sm" icon="key" full onClick={() => navigate('/pat')}>Quản lý PAT</Button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function Topbar({ route, onNav, onSearch, theme, onToggleTheme, navCollapsed, onToggleNav, user, onLogin, onLogout }) {
  return (
    <header style={{ height: 56, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center",
      gap: 14, padding: "0 22px", background: "color-mix(in oklab, var(--bg) 86%, transparent)",
      backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 30 }}>
      <button onClick={onToggleNav} title={navCollapsed ? "Hiện menu" : "Ẩn menu"}
        style={{ width: 34, height: 34, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center",
          color: navCollapsed ? "var(--accent)" : "var(--text-2)", border: `1px solid ${navCollapsed ? "var(--accent-border)" : "var(--border)"}`,
          background: navCollapsed ? "var(--accent-dim)" : "var(--panel)", flexShrink: 0, transition: "all .14s" }}>
        <Icon name="menu" size={16} />
      </button>
      <div style={{ flex: 1, maxWidth: 420 }}>
        <button onClick={onSearch} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%",
          height: 34, padding: "0 11px", background: "var(--panel)", border: "1px solid var(--border)",
          borderRadius: "var(--r-sm)", color: "var(--text-3)", fontSize: 13, transition: "border-color .14s" }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border-strong)"}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}>
          <Icon name="search" size={15} />
          <span style={{ flex: 1, textAlign: "left" }}>Tìm project, build, repository…</span>
          <kbd style={{ fontSize: 11, fontFamily: "var(--font-mono)", background: "var(--panel-3)", padding: "1px 6px", borderRadius: 4, color: "var(--text-3)" }}>⌘K</kbd>
        </button>
      </div>
      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 99,
        background: "var(--panel)", border: "1px solid var(--border)", fontSize: 12.5, color: "var(--text-2)" }}>
        <Icon name="pipeline" size={13} style={{ color: "var(--green)" }} />
        Pipeline service
        <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--green)" }} />
      </div>

      {user ? (
        <>
          <div title={user.email} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 99,
            background: "var(--panel)", border: "1px solid var(--border)", fontSize: 12.5, color: "var(--text-2)" }}>
            <Icon name="user" size={13} style={{ color: "var(--accent)" }} />
            <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
          </div>
          <button onClick={onLogout} title="Đăng xuất"
            style={{ width: 34, height: 34, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center",
              color: "var(--text-2)", border: "1px solid var(--border)", background: "var(--panel)" }}>
            <Icon name="logout" size={16} />
          </button>
        </>
      ) : (
        <button onClick={onLogin} title="Đăng nhập tài khoản platform"
          style={{ display: "flex", alignItems: "center", gap: 7, height: 34, padding: "0 13px", borderRadius: "var(--r-sm)",
            color: "var(--text)", border: "1px solid var(--border)", background: "var(--panel)", fontSize: 13, fontWeight: 540 }}>
          <Icon name="user" size={15} />Đăng nhập
        </button>
      )}

      <button onClick={onToggleTheme} title="Đổi giao diện sáng/tối"
        style={{ width: 34, height: 34, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center",
          color: "var(--text-2)", border: "1px solid var(--border)", background: "var(--panel)" }}>
        <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
      </button>
      <button title="Thông báo" style={{ width: 34, height: 34, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center",
        color: "var(--text-2)", border: "1px solid var(--border)", background: "var(--panel)", position: "relative" }}>
        <Icon name="bell" size={16} />
        <span style={{ position: "absolute", top: 8, right: 9, width: 6, height: 6, borderRadius: 99, background: "var(--accent)", border: "1.5px solid var(--panel)" }} />
      </button>
    </header>
  );
}

/* Page container with consistent padding + max width */
function Page({ children, wide, full }) {
  return (
    <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
      <div style={{ maxWidth: full ? "none" : wide ? 1180 : 1040, margin: "0 auto", padding: full ? "26px 40px 80px" : "28px 32px 80px" }}>
        {children}
      </div>
    </main>
  );
}

function PageHeader({ title, subtitle, actions, breadcrumb, onNav, icon }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {breadcrumb && <div style={{ marginBottom: 14 }}><Breadcrumb items={breadcrumb} onNav={onNav} /></div>}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
          {icon && (
            <div style={{ width: 40, height: 40, borderRadius: "var(--r-md)", background: "var(--panel-2)",
              border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
              <Icon name={icon} size={20} />
            </div>
          )}
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 640, letterSpacing: "-.03em", lineHeight: 1.2 }}>{title}</h1>
            {subtitle && <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 3, maxWidth: 620 }}>{subtitle}</div>}
          </div>
        </div>
        {actions && <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>{actions}</div>}
      </div>
    </div>
  );
}

export { Sidebar, Topbar, Page, PageHeader, NAV, NAV_FLAT, VIEW_TO_NAV };
