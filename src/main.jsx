import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import './index.css';
import { listSourceProviders, deleteSourceProvider } from './api/source-providers.js';
import { listRepositories, deleteRepository } from './api/repositories.js';
import { getAuthToken, setAuthToken, onUnauthorized } from './api/client.js';
import { me as apiMe } from './api/auth.js';
import { TweakColor, TweakRadio, TweakSection, TweakSlider, TweaksPanel, useTweaks } from './tweaks-panel.jsx';
import { Icon, Tag, Toast } from './primitives.jsx';
import { NAV_FLAT, Sidebar, Topbar } from './layout.jsx';
import { Dashboard, GitHubConnect } from './views-dashboard.jsx';
import { AuthView } from './views-auth.jsx';
import { RepoDetail, ReposList } from './views-repos.jsx';
import { PipelineDetail, PipelinesList, RunDetail } from './views-pipeline.jsx';
import { CreatePipeline } from './views-pipeline-create.jsx';
import { JenkinsView, WebhooksView } from './views-integrations.jsx';
import { BuildHistory } from './views-build-history.jsx';
import { PatManagement } from './views-pat.jsx';

/* ============================================================
   App — router, state, tweaks, command palette
   ============================================================ */

const ACCENTS = {
  teal:   { accent: "#14b8a6", fg: "#02120e" },
  blue:   { accent: "#3b82f6", fg: "#ffffff" },
  violet: { accent: "#8b5cf6", fg: "#ffffff" },
  green:  { accent: "#22c55e", fg: "#04130b" },
  amber:  { accent: "#f59e0b", fg: "#1a1200" },
  rose:   { accent: "#f43f5e", fg: "#ffffff" },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#14b8a6",
  "theme": "dark",
  "radius": 9
}/*EDITMODE-END*/;

function applyTheme(t) {
  const root = document.documentElement;
  root.setAttribute("data-theme", t.theme);
  root.style.setProperty("--accent", t.accent);
  root.style.setProperty("--accent-hover", `color-mix(in oklab, ${t.accent} 78%, white)`);
  const fg = Object.values(ACCENTS).find((a) => a.accent.toLowerCase() === String(t.accent).toLowerCase())?.fg || "#ffffff";
  root.style.setProperty("--accent-fg", fg);
  root.style.setProperty("--r-md", t.radius + "px");
  root.style.setProperty("--r-lg", (t.radius + 4) + "px");
}

function getInitials(login) {
  if (!login) return "?";
  const p = login.split(/[._\-]/);
  return (p.length >= 2 ? p[0][0] + p[1][0] : login.slice(0, 2)).toUpperCase();
}

function providerToAccount(sp) {
  return {
    connected: true,
    id: sp.id,
    username: sp.account_login,
    name: sp.account_login,
    avatar: getInitials(sp.account_login),
    email: "",
    tokenName: "—",
    scopes: sp.token_scopes ? sp.token_scopes.split(",").map((s) => s.trim()).filter(Boolean) : [],
  };
}

const USER_STORAGE_KEY = "cicd_user";
function loadCachedUser() {
  try { const raw = localStorage.getItem(USER_STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveCachedUser(user) {
  try {
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_STORAGE_KEY);
  } catch {}
}

function fmtRelTime(iso) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)      return "vừa xong";
  if (diff < 3600)    return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800)  return `${Math.floor(diff / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

function mapApiRepo(r) {
  return {
    id:            r.id,
    fullName:      r.full_name,
    name:          r.name,
    owner:         r.owner,
    repoUrl:       r.repo_url,
    defaultBranch: r.default_branch,
    syncBranch:    r.sync_branch || null,
    provider:      r.provider,
    // webhook_registered chỉ có trong response map repo (POST .../repositories) — các GET khác
    // không trả field này. undefined = "không rõ" (đã biết trước đó nhưng response này không nói tới),
    // giữ nguyên qua updateRepo() thay vì bị ghi đè về false gây hiểu lầm.
    webhookRegistered: Object.prototype.hasOwnProperty.call(r, "webhook_registered") ? r.webhook_registered : undefined,
    language:      null,
    private:       false,
    pipelineCount: 0,
    status:        "active",
    // last_synced_at luôn null ở backend hiện tại (chưa implement) — dùng created_at (thời điểm map) để hiển thị.
    lastSync:      fmtRelTime(r.created_at),
  };
}

/* Converts legacy { view, repoId, ... } objects → URL path */
function routeToPath(r) {
  switch (r.view) {
    case 'dashboard':       return '/';
    case 'github':          return '/github';
    case 'repos':           return '/repos';
    case 'repo':            return `/repos/${r.repoId}`;
    case 'pipelines':       return '/pipelines';
    case 'create-pipeline': return '/pipelines/new';
    case 'pipeline':        return `/pipelines/${r.pipelineId}`;
    case 'run':             return `/pipelines/${r.pipelineId}/runs/${r.runId}${r.live ? '?live=1' : ''}`;
    case 'jenkins':         return r.pipelineId ? `/pipelines/${r.pipelineId}/jenkins` : '/jenkins';
    case 'webhooks':        return '/webhooks';
    case 'build-history':   return '/build-history';
    case 'pat':             return '/pat';
    case 'login':           return '/login';
    default:                return '/';
  }
}

/* Route wrapper components — read URL params, pass as props to views */
function RepoDetailRoute({ repos, onNav, toast, onDeleteRepo, onRepoUpdated }) {
  const { repoId } = useParams();
  return <RepoDetail repoId={repoId} repos={repos} onNav={onNav} toast={toast} onDeleteRepo={onDeleteRepo} onRepoUpdated={onRepoUpdated} />;
}

function PipelineDetailRoute({ repos, onNav, toast }) {
  const { pipelineId } = useParams();
  return <PipelineDetail pipelineId={pipelineId} repos={repos} onNav={onNav} toast={toast} />;
}

function RunDetailRoute({ repos, onNav, toast }) {
  const { pipelineId, runId } = useParams();
  return <RunDetail key={pipelineId + ":" + runId} pipelineId={pipelineId} runId={runId} repos={repos} onNav={onNav} toast={toast} />;
}

function JenkinsPipelineRoute({ account, repos, onNav, toast }) {
  const { pipelineId } = useParams();
  return <JenkinsView pipelineId={pipelineId} account={account} repos={repos} onNav={onNav} toast={toast} />;
}

function CommandPalette({ open, onClose, repos, onNav }) {
  const [q, setQ] = useState("");
  useEffect(() => { if (open) setQ(""); }, [open]);
  if (!open) return null;
  const cmds = [
    ...NAV_FLAT.map((n) => ({ type: "Trang", label: n.label, icon: n.icon, to: { view: n.id } })),
    ...repos.map((r) => ({ type: "Repository", label: r.name, icon: "repo", to: { view: "repo", repoId: r.id } })),
  ].filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 150, background: "var(--overlay)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", paddingTop: "14vh", animation: "fade-in .14s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "92vw", height: "fit-content", maxHeight: 460, background: "var(--panel)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)", overflow: "hidden", animation: "scale-in .18s cubic-bezier(.2,.7,.3,1)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <Icon name="search" size={18} style={{ color: "var(--text-3)" }} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Đi tới repository, pipeline, trang…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 14.5 }} />
          <kbd style={{ fontSize: 11, fontFamily: "var(--font-mono)", background: "var(--panel-3)", padding: "2px 6px", borderRadius: 4, color: "var(--text-3)" }}>esc</kbd>
        </div>
        <div style={{ overflowY: "auto", padding: 8 }}>
          {cmds.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>Không có kết quả.</div>}
          {cmds.slice(0, 9).map((c, i) => (
            <button key={i} onClick={() => { onNav(c.to); onClose(); }}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", textAlign: "left", transition: "background .1s" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <Icon name={c.icon} size={16} style={{ color: "var(--text-3)" }} />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{c.label}</span>
              <Tag>{c.type}</Tag>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [account, setAccount] = useState({ connected: false });
  const [user, setUserRaw] = useState(() => (getAuthToken() ? loadCachedUser() : null));
  const [repos, setRepos] = useState([]);
  const [toast, setToastState] = useState(null);
  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const toastTimer = useRef(null);

  // Bọc setState để luôn đồng bộ cache localStorage — khôi phục ngay lúc mount (initial state ở trên)
  // thay vì đợi round-trip /auth/me.
  function setUser(u) {
    setUserRaw(u);
    saveCachedUser(u);
  }

  useEffect(() => { applyTheme(t); }, [t]);

  // Chỉ gọi /auth/me khi có token nhưng KHÔNG có cache (vd cache bị xoá thủ công) — để xác thực token
  // còn sống. KHÔNG dùng response này để ghi đè danh tính đã cache: khi backend chạy AUTH_ENABLED=false
  // (mặc định hiện tại), /auth/me luôn trả về user dev cố định bất kể token gửi lên là gì — tin response
  // đó sẽ xoá mất danh tính thật vừa đăng nhập.
  useEffect(() => {
    if (getAuthToken() && !loadCachedUser()) {
      apiMe().then(setUser).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // JWT hết hạn/không hợp lệ ở bất kỳ request nào → client.js đã tự xoá token, ở đây chỉ cần
  // đồng bộ lại UI + báo cho người dùng.
  useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      showToast("Phiên đăng nhập hết hạn — vui lòng đăng nhập lại", "error");
      navigate('/login');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listSourceProviders()
      .then((data) => {
        const active = (data ?? []).find((sp) => sp.status === "active");
        if (active) setAccount(providerToAccount(active));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!account.id) { setRepos([]); return; }
    listRepositories(account.id)
      .then((data) => setRepos((data ?? []).map(mapApiRepo)))
      .catch(() => {});
  }, [account.id]);

  useEffect(() => {
    const isPipelineDetail = /^\/pipelines\/[^/]+$/.test(location.pathname) && location.pathname !== '/pipelines/new';
    const isRunDetail = /^\/pipelines\/[^/]+\/runs\/[^/]+$/.test(location.pathname);
    setNavCollapsed(isPipelineDetail || isRunDetail);
  }, [location.pathname]);

  function showToast(message, type = "info") {
    clearTimeout(toastTimer.current);
    setToastState({ message, type, id: Date.now() });
    toastTimer.current = setTimeout(() => setToastState(null), 2600);
  }

  function nav(r) {
    if (r.addRepo) { navigate('/repos'); setAddRepoOpen(true); return; }
    setAddRepoOpen(false);
    navigate(routeToPath(r));
    document.querySelector("main")?.scrollTo({ top: 0 });
  }

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  function connect(providerData) {
    if (providerData?.id) setAccount(providerToAccount(providerData));
  }

  function handleLoggedIn(data) {
    setAuthToken(data.access_token);
    setUser(data.user);
  }

  function logout() {
    setAuthToken(null);
    setUser(null);
    showToast("Đã đăng xuất", "info");
  }

  async function disconnect() {
    if (account.id) {
      try { await deleteSourceProvider(account.id); } catch {}
    }
    setAccount({ connected: false });
    showToast("Đã ngắt kết nối GitHub", "info");
    navigate('/github');
  }

  function addRepo(apiRepo) {
    const mapped = mapApiRepo(apiRepo);
    setRepos((rs) => rs.some((r) => r.id === apiRepo.id) ? rs : [...rs, mapped]);
  }

  function updateRepo(apiRepo) {
    const mapped = mapApiRepo(apiRepo);
    setRepos((rs) => rs.map((r) => {
      if (r.id !== mapped.id) return r;
      // webhookRegistered chỉ có ở response map — response PATCH (đổi nhánh) không có field này,
      // đừng để nó ghi đè giá trị đã biết trước đó về "không rõ".
      return { ...r, ...mapped, webhookRegistered: mapped.webhookRegistered !== undefined ? mapped.webhookRegistered : r.webhookRegistered };
    }));
  }

  async function deleteRepo(repoId) {
    try {
      await deleteRepository(repoId);
      setRepos((rs) => rs.filter((r) => r.id !== repoId));
      showToast("Đã xoá mapping repository", "info");
      navigate('/repos');
    } catch (err) {
      showToast(err.message || "Xoá thất bại", "error");
    }
  }

  const shared = { onNav: nav, toast: showToast };

  return (
    <div className={"app" + (navCollapsed ? " collapsed" : "")}>
      <Sidebar account={account} />
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <Topbar onSearch={() => setPaletteOpen(true)} theme={t.theme}
          navCollapsed={navCollapsed} onToggleNav={() => setNavCollapsed((c) => !c)}
          onToggleTheme={() => setTweak("theme", t.theme === "dark" ? "light" : "dark")}
          user={user} onLogin={() => navigate('/login')} onLogout={logout} />
        <Routes>
          <Route path="/"                                       element={<Dashboard repos={repos} account={account} {...shared} />} />
          <Route path="/login"                                  element={<AuthView onLoggedIn={handleLoggedIn} {...shared} />} />
          <Route path="/github"                                 element={<GitHubConnect account={account} onConnect={connect} onDisconnect={disconnect} {...shared} />} />
          <Route path="/repos"                                  element={<ReposList repos={repos} account={account} addRepoOpen={addRepoOpen} setAddRepoOpen={setAddRepoOpen} onAddRepo={addRepo} {...shared} />} />
          <Route path="/repos/:repoId"                          element={<RepoDetailRoute repos={repos} onDeleteRepo={deleteRepo} onRepoUpdated={updateRepo} {...shared} />} />
          <Route path="/pipelines"                              element={<PipelinesList repos={repos} account={account} {...shared} />} />
          <Route path="/pipelines/new"                          element={<CreatePipeline repos={repos} account={account} {...shared} />} />
          <Route path="/pipelines/:pipelineId"                  element={<PipelineDetailRoute repos={repos} {...shared} />} />
          <Route path="/pipelines/:pipelineId/runs/:runId"      element={<RunDetailRoute repos={repos} {...shared} />} />
          <Route path="/pipelines/:pipelineId/jenkins"          element={<JenkinsPipelineRoute account={account} repos={repos} {...shared} />} />
          <Route path="/jenkins"                                element={<JenkinsView account={account} repos={repos} {...shared} />} />
          <Route path="/webhooks"                               element={<WebhooksView account={account} {...shared} />} />
          <Route path="/build-history"                          element={<BuildHistory account={account} repos={repos} {...shared} />} />
          <Route path="/pat"                                    element={<PatManagement account={account} onConnect={connect} {...shared} />} />
          <Route path="*"                                       element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} repos={repos} onNav={nav} />
      <Toast toast={toast} />

      <TweaksPanel>
        <TweakSection label="Giao diện" />
        <TweakRadio label="Chế độ" value={t.theme} options={["dark", "light"]} onChange={(v) => setTweak("theme", v)} />
        <TweakColor label="Màu nhấn" value={t.accent} options={Object.values(ACCENTS).map((a) => a.accent)} onChange={(v) => setTweak("accent", v)} />
        <TweakSlider label="Bo góc" value={t.radius} min={4} max={16} step={1} unit="px" onChange={(v) => setTweak("radius", v)} />
      </TweaksPanel>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
