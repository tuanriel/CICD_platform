import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import './index.css';
import { TweakColor, TweakRadio, TweakSection, TweakSlider, TweaksPanel, useTweaks } from './tweaks-panel.jsx';
import { INITIAL_REPOS, PIPELINES, STAGE_PRESETS } from './data.jsx';
import { Icon, Tag, Toast } from './primitives.jsx';
import { NAV_FLAT, Sidebar, Topbar } from './layout.jsx';
import { Dashboard, GitHubConnect } from './views-dashboard.jsx';
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

const CONNECTED_ACCOUNT = {
  connected: true, username: "trang.nguyen", name: "Nguyễn Thuỳ Trang", avatar: "TN",
  email: "trang.nguyen@fpt.com", tokenName: "ghp_••••••••aQ4e", scopes: ["repo", "admin:repo_hook", "read:org"],
};

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
    default:                return '/';
  }
}

/* Route wrapper components — read URL params, pass as props to views */
function RepoDetailRoute({ repos, onNav, toast }) {
  const { repoId } = useParams();
  return <RepoDetail repoId={repoId} repos={repos} onNav={onNav} toast={toast} />;
}

function PipelineDetailRoute({ repos, onNav, onTriggerBuild, toast }) {
  const { pipelineId } = useParams();
  return <PipelineDetail pipelineId={pipelineId} repos={repos} onNav={onNav} onTriggerBuild={onTriggerBuild} toast={toast} />;
}

function RunDetailRoute({ repos, onNav, onRunComplete, toast }) {
  const { pipelineId, runId } = useParams();
  const [searchParams] = useSearchParams();
  const live = searchParams.get('live') === '1';
  return <RunDetail key={runId + (live ? '_live' : '')} pipelineId={pipelineId} runId={runId} live={live} repos={repos} onNav={onNav} onRunComplete={onRunComplete} toast={toast} />;
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
    ...PIPELINES.map((p) => ({ type: "Pipeline", label: `${p.title} · ${p.name}`, icon: "pipeline", to: { view: "pipeline", pipelineId: p.id } })),
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
  const [account, setAccount] = useState(CONNECTED_ACCOUNT);
  const [repos, setRepos] = useState(INITIAL_REPOS);
  const [toast, setToastState] = useState(null);
  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [, force] = useState(0);
  const toastTimer = useRef(null);

  useEffect(() => { applyTheme(t); }, [t]);

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

  function connect() { setAccount(CONNECTED_ACCOUNT); showToast("Đã kết nối GitHub thành công", "success"); }
  function disconnect() { setAccount({ connected: false }); showToast("Đã ngắt kết nối GitHub", "info"); navigate('/github'); }

  function addRepo(ghRepo, opts = {}) {
    const id = "r" + Date.now();
    const branch = opts.branch || (ghRepo.branches && ghRepo.branches[0]) || "main";
    setRepos((rs) => [...rs, { id, fullName: ghRepo.fullName, name: ghRepo.name, private: ghRepo.private, language: ghRepo.language, defaultBranch: branch, mappedBranch: branch, patName: opts.patName, lastSync: "vừa xong", pipelineCount: ghRepo.hasWorkflow ? 2 : 0, status: "active" }]);
  }

  function createPipeline(cfg) {
    PIPELINES.unshift({
      id: "pl_" + Date.now(), repoId: cfg.repoId, name: cfg.name, path: cfg.path, title: cfg.title,
      preset: cfg.preset, stages: cfg.stages, status: "queued", triggers: cfg.triggers,
      branchFilter: cfg.branchFilter, lastRun: "chưa chạy", successRate: 0, avgDuration: 0,
      env: cfg.env, jobs: cfg.jobs, runs: [],
    });
    setRepos((rs) => rs.map((r) => r.id === cfg.repoId ? { ...r, pipelineCount: (r.pipelineCount || 0) + 1, lastSync: "vừa xong" } : r));
    force((n) => n + 1);
  }

  function triggerBuild(pid) {
    const p = PIPELINES.find((x) => x.id === pid);
    const num = Math.max(0, ...p.runs.map((r) => typeof r.number === "number" ? r.number : 0)) + 1;
    const stageNames = p.stages || STAGE_PRESETS[p.preset];
    const run = {
      id: "run_live_" + Date.now(), number: num, status: "running", branch: "main",
      commit: Math.random().toString(16).slice(2, 9), message: "Build thủ công · trigger từ giao diện",
      author: account.username || "you", avatar: account.avatar || "ME", trigger: "manual",
      startedAt: "vừa xong", duration: null,
      stages: stageNames.map((n) => ({ name: n, status: "queued", duration: 0 })),
    };
    p.runs = [run, ...p.runs];
    p.status = "running";
    showToast(`Đã chạy pipeline #${num} · ${p.name}`, "info");
    return run.id;
  }

  function runComplete(pid, runId, status) {
    const p = PIPELINES.find((x) => x.id === pid);
    if (!p) return;
    const run = p.runs.find((r) => r.id === runId);
    if (run) { run.status = status; run.duration = 60 + Math.floor(Math.random() * 120); }
    p.status = status;
    force((n) => n + 1);
    showToast(`Build #${run?.number} ${status === "success" ? "thành công" : "thất bại"}`, status === "success" ? "success" : "error");
  }

  const shared = { onNav: nav, toast: showToast };

  return (
    <div className={"app" + (navCollapsed ? " collapsed" : "")}>
      <Sidebar account={account} />
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <Topbar onSearch={() => setPaletteOpen(true)} theme={t.theme}
          navCollapsed={navCollapsed} onToggleNav={() => setNavCollapsed((c) => !c)}
          onToggleTheme={() => setTweak("theme", t.theme === "dark" ? "light" : "dark")} />
        <Routes>
          <Route path="/"                                       element={<Dashboard repos={repos} account={account} {...shared} />} />
          <Route path="/github"                                 element={<GitHubConnect account={account} onConnect={connect} onDisconnect={disconnect} {...shared} />} />
          <Route path="/repos"                                  element={<ReposList repos={repos} account={account} addRepoOpen={addRepoOpen} setAddRepoOpen={setAddRepoOpen} onAddRepo={addRepo} {...shared} />} />
          <Route path="/repos/:repoId"                          element={<RepoDetailRoute repos={repos} {...shared} />} />
          <Route path="/pipelines"                              element={<PipelinesList repos={repos} account={account} onTriggerBuild={triggerBuild} {...shared} />} />
          <Route path="/pipelines/new"                          element={<CreatePipeline repos={repos} account={account} onCreate={createPipeline} {...shared} />} />
          <Route path="/pipelines/:pipelineId"                  element={<PipelineDetailRoute repos={repos} onTriggerBuild={triggerBuild} {...shared} />} />
          <Route path="/pipelines/:pipelineId/runs/:runId"      element={<RunDetailRoute repos={repos} onRunComplete={runComplete} {...shared} />} />
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
