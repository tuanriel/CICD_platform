import React, { useState, useEffect } from 'react';
import { PIPELINES, STAGE_PRESETS, WEBHOOK_DELIVERIES } from './data.jsx';
import { Button, Card, Icon, Input, LangDot, Modal, StatusBadge, StatusDot, Tag } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { EmptyConnectState } from './views-dashboard.jsx';
import { getSourceProviderRepos, syncSourceProvider } from './api/source-providers.js';
import { listRepositories, syncRepository } from './api/repositories.js';
import { listRepoPipelines, triggerPipeline } from './api/pipelines.js';

/* ============================================================
   Views — Repository list + detail
   ============================================================ */

function ReposList({ repos, account, onNav, addRepoOpen, setAddRepoOpen, onAddRepo, onSync, toast }) {
  const [q, setQ] = useState("");
  const [syncing, setSyncing] = useState(false);
  const filtered = repos.filter(
    (r) => r.name.toLowerCase().includes(q.toLowerCase()) || r.fullName.toLowerCase().includes(q.toLowerCase())
  );

  async function handleSync() {
    setSyncing(true);
    try { await onSync?.(); } finally { setSyncing(false); }
  }

  if (!account.connected) {
    return (
      <Page>
        <PageHeader title="Repository" icon="repo" subtitle="Quản lý các repository được ánh xạ từ GitHub." />
        <EmptyConnectState onNav={onNav} />
      </Page>
    );
  }

  return (
    <Page wide>
      <PageHeader title="Repository" icon="repo"
        subtitle="Các đối tượng Repository trên nền tảng, ánh xạ 1-1 với GitHub Repository."
        actions={
          <>
            <Button variant="secondary" icon="sync" loading={syncing} onClick={handleSync}>Đồng bộ</Button>
            <Button variant="primary" icon="plus" onClick={() => setAddRepoOpen(true)}>Thêm Repository</Button>
          </>
        } />

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Input value={q} onChange={setQ} placeholder="Tìm repository…" icon="search" full />
        <Button variant="secondary" icon="filter">Lọc</Button>
      </div>

      {repos.length === 0 ? (
        <Card style={{ padding: 48, textAlign: "center" }}>
          <Icon name="repo" size={28} style={{ color: "var(--text-3)", margin: "0 auto 14px", display: "block" }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Chưa có repository nào</div>
          <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 380, margin: "0 auto 20px", lineHeight: 1.5 }}>
            Nhấn <b>Thêm Repository</b> để đồng bộ repo từ GitHub về platform.
          </p>
          <Button variant="primary" icon="sync" onClick={() => setAddRepoOpen(true)}>Đồng bộ từ GitHub</Button>
        </Card>
      ) : (
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.7fr .8fr .9fr .9fr 40px", padding: "11px 18px",
            borderBottom: "1px solid var(--border)", fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em",
            textTransform: "uppercase", color: "var(--text-3)" }}>
            <span>Repository</span><span>Pipeline</span><span>Nhánh mặc định</span><span>Đồng bộ</span><span />
          </div>
          {filtered.map((r, i) => {
            const pls = PIPELINES.filter((p) => p.repoId === r.id);
            const anyFail = pls.some((p) => p.status === "failed");
            const anyRun  = pls.some((p) => p.status === "running");
            return (
              <div key={r.id} onClick={() => onNav({ view: "repo", repoId: r.id })}
                style={{ display: "grid", gridTemplateColumns: "1.7fr .8fr .9fr .9fr 40px", padding: "14px 18px",
                  alignItems: "center", cursor: "pointer",
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background .12s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--panel-2)", border: "1px solid var(--border)",
                    display: "grid", placeItems: "center", flexShrink: 0, position: "relative" }}>
                    <Icon name="repo" size={17} style={{ color: "var(--text-2)" }} />
                    <span style={{ position: "absolute", right: -3, bottom: -3, width: 8, height: 8, borderRadius: 99,
                      border: "2px solid var(--panel)",
                      background: anyRun ? "var(--amber)" : anyFail ? "var(--red)" : "var(--green)" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 14, fontWeight: 560 }}>{r.name}</span>
                      {r.private && <Icon name="lock" size={12} style={{ color: "var(--text-3)" }} />}
                    </div>
                    <div className="mono" style={{ fontSize: 11.5, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.fullName}
                    </div>
                  </div>
                </div>
                <div>
                  <Tag mono>{(pls.length || r.pipelineCount || 0)} pipeline</Tag>
                </div>
                <div>
                  {r.language ? <LangDot language={r.language} /> : null}
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: r.language ? 3 : 0, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="branch" size={11} />{r.defaultBranch || "main"}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>{r.lastSync}</div>
                <div style={{ textAlign: "right" }}>
                  <Icon name="chevronRight" size={16} style={{ color: "var(--text-3)" }} />
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>
              Không tìm thấy repository nào.
            </div>
          )}
        </Card>
      )}

      <AddRepoModal open={addRepoOpen} onClose={() => setAddRepoOpen(false)}
        existing={repos} account={account} onAddRepo={onAddRepo} toast={toast} />
    </Page>
  );
}

/* ---- AddRepoModal — chọn từng repo + nhánh để ánh xạ ---- */
function AddRepoModal({ open, onClose, existing, account, onAddRepo, toast }) {
  const [step, setStep]             = useState("loading"); // loading | pick | syncing | done
  const [availRepos, setAvailRepos] = useState([]);
  const [selected, setSelected]     = useState(null);
  const [branch, setBranch]         = useState("");
  const [q, setQ]                   = useState("");
  const [fetchError, setFetchError] = useState(null);
  const [mapError, setMapError]     = useState(null);
  const [syncPipelines, setSyncPipelines] = useState([]);

  useEffect(() => {
    if (!open) return;
    setSelected(null); setBranch(""); setQ("");
    setFetchError(null); setMapError(null); setSyncPipelines([]);
    setStep("loading");
    loadFromDb();
  }, [open]);                           // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFromDb() {
    const existingIds = new Set(existing.map((r) => r.id));
    try {
      const data = await listRepositories(account.id);
      setAvailRepos((data ?? []).filter((r) => !existingIds.has(r.id)));
      setFetchError(null);
    } catch (err) {
      setFetchError(err.message || "Không tải được danh sách repo");
      setAvailRepos([]);
    }
    setStep("pick");
  }

  async function refreshFromGitHub() {
    const existingIds = new Set(existing.map((r) => r.id));
    setStep("loading");
    setFetchError(null);
    try {
      const data = await syncSourceProvider(account.id);
      setAvailRepos((data ?? []).filter((r) => !existingIds.has(r.id)));
    } catch (err) {
      setFetchError(err.message || "Đồng bộ GitHub thất bại");
    }
    setStep("pick");
  }

  function pickRepo(r) {
    setSelected(r);
    setBranch(r.default_branch || "main");
  }

  async function startMap() {
    if (!selected || !branch.trim()) return;
    setMapError(null);
    setSyncPipelines([]);
    setStep("syncing");
    try {
      // Nếu selected chưa có platform UUID, lấy lại từ /repositories
      let repoId = selected.id;
      if (!repoId) {
        const allRepos = await listRepositories(account.id);
        const found = (allRepos ?? []).find((r) => r.full_name === selected.full_name);
        if (!found) throw Object.assign(new Error("Repository chưa được đồng bộ về platform — hãy nhấn ↻ để kéo từ GitHub trước."), { code: "RESOURCE_NOT_FOUND" });
        repoId = found.id;
      }
      const data = await syncRepository(repoId);
      setSyncPipelines(data ?? []);
      setStep("done");
    } catch (err) {
      const msgs = {
        RESOURCE_NOT_FOUND: "Repository chưa được đồng bộ về platform — hãy nhấn ↻ để kéo từ GitHub trước.",
        UPSTREAM_ERROR:     "Không kết nối được GitHub.",
      };
      setMapError(msgs[err.code] || err.message || "Đồng bộ thất bại");
      setStep("pick");
    }
  }

  const filtered = availRepos.filter(
    (r) => r.name.toLowerCase().includes(q.toLowerCase()) ||
           r.full_name.toLowerCase().includes(q.toLowerCase())
  );

  const plOk  = syncPipelines.filter((p) => p.status === "active").length;
  const plErr = syncPipelines.filter((p) => p.status === "error").length;

  return (
    <Modal open={open} onClose={onClose} width={580}
      title="Thêm Repository"
      subtitle={
        step === "loading"  ? "Đang tải danh sách…" :
        step === "syncing"  ? selected?.full_name :
        step === "done"     ? `Đã ánh xạ ${selected?.name}` :
        "Chọn repository và nhánh để ánh xạ vào platform."
      }>

      {/* LOADING */}
      {step === "loading" && (
        <div style={{ padding: "52px 22px", textAlign: "center" }}>
          <Icon name="sync" size={30} style={{ color: "var(--accent)", animation: "spin 1.2s linear infinite", display: "block", margin: "0 auto 16px" }} />
          <div style={{ fontSize: 13.5, color: "var(--text-3)" }}>Đang tải danh sách repository…</div>
        </div>
      )}

      {/* PICK */}
      {step === "pick" && (
        <>
          {/* Search + refresh */}
          <div style={{ padding: "14px 16px 0", display: "flex", gap: 8 }}>
            <Input value={q} onChange={setQ} placeholder="Tìm trong tài khoản GitHub…" icon="search" full />
            <button onClick={refreshFromGitHub} title="Kéo mới từ GitHub"
              style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "var(--r-md)",
                border: "1px solid var(--border)", background: "var(--panel-2)",
                display: "grid", placeItems: "center", cursor: "pointer", color: "var(--text-2)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-3)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "var(--panel-2)"}>
              <Icon name="sync" size={15} />
            </button>
          </div>

          {(fetchError || mapError) && (
            <div style={{ margin: "10px 16px 0", display: "flex", alignItems: "center", gap: 8,
              padding: "9px 12px", background: "var(--red-dim)",
              border: "1px solid color-mix(in oklab, var(--red) 40%, transparent)",
              borderRadius: "var(--r-sm)", fontSize: 12.5, color: "var(--red)" }}>
              <Icon name="xCircle" size={13} />{fetchError || mapError}
            </div>
          )}

          {/* Repo list */}
          <div style={{ maxHeight: 248, overflowY: "auto", padding: "8px 10px" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                {availRepos.length === 0
                  ? "Chưa có repo nào trong DB — nhấn ↻ để kéo từ GitHub."
                  : "Không tìm thấy repository nào."}
              </div>
            )}
            {filtered.map((r) => {
              const sel = selected?.id === r.id;
              return (
                <button key={r.id} onClick={() => pickRepo(r)}
                  style={{ display: "flex", alignItems: "center", gap: 11, width: "100%",
                    padding: "10px 11px", borderRadius: "var(--r-md)", marginBottom: 2,
                    border: `1px solid ${sel ? "var(--accent-border)" : "transparent"}`,
                    background: sel ? "var(--accent-dim)" : "transparent",
                    cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "var(--panel-2)"; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = sel ? "var(--accent-dim)" : "transparent"; }}>
                  {/* radio */}
                  <span style={{ width: 17, height: 17, borderRadius: 99, flexShrink: 0,
                    border: `1.5px solid ${sel ? "var(--accent)" : "var(--border-strong)"}`,
                    display: "grid", placeItems: "center" }}>
                    {sel && <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--accent)" }} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 560 }}>{r.name}</div>
                    <div className="mono" style={{ fontSize: 11.5, color: "var(--text-3)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.full_name}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-3)", flexShrink: 0 }}>
                    <Icon name="branch" size={11} />
                    <span className="mono">{r.default_branch || "main"}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Branch selector — shown after picking */}
          {selected && (
            <div style={{ padding: "6px 16px 0", borderTop: "1px solid var(--border)", marginTop: 2 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 580, marginBottom: 6, color: "var(--text-2)", marginTop: 12 }}>
                Nhánh để ánh xạ
              </label>
              <Input value={branch} onChange={setBranch}
                placeholder="vd: main, develop, release/v2" icon="branch" mono full />
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 5, marginBottom: 12 }}>
                Pipeline & webhook sẽ theo dõi nhánh này.
              </div>
            </div>
          )}

          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
              {selected
                ? <><b style={{ color: "var(--text-2)" }}>{selected.name}</b> · nhánh <span className="mono" style={{ color: "var(--text-2)" }}>{branch}</span></>
                : "Chọn một repository"}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose}
                style={{ padding: "7px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--border)",
                  background: "transparent", color: "var(--text-2)", fontSize: 13.5, cursor: "pointer" }}>
                Huỷ
              </button>
              <button onClick={startMap} disabled={!selected || !branch.trim()}
                style={{ padding: "7px 16px", borderRadius: "var(--r-md)", fontSize: 13.5, fontWeight: 560,
                  background: "var(--accent)", color: "var(--accent-fg)", border: "none",
                  cursor: selected && branch.trim() ? "pointer" : "not-allowed",
                  opacity: selected && branch.trim() ? 1 : 0.45 }}>
                Ánh xạ & Đồng bộ
              </button>
            </div>
          </div>
        </>
      )}

      {/* SYNCING */}
      {step === "syncing" && (
        <div style={{ padding: "52px 22px", textAlign: "center" }}>
          <Icon name="sync" size={32} style={{ color: "var(--accent)", animation: "spin 1.2s linear infinite",
            display: "block", margin: "0 auto 20px" }} />
          <div style={{ fontSize: 14.5, fontWeight: 560, marginBottom: 6 }}>Đang quét .workflow/…</div>
          <div className="mono" style={{ fontSize: 12.5, color: "var(--text-3)" }}>{selected?.full_name}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 4 }}>
            Parse YAML · upsert pipeline · tạo PipelineVersion
          </div>
        </div>
      )}

      {/* DONE */}
      {step === "done" && (
        <div style={{ padding: "32px 26px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14,
            background: plErr > 0 ? "var(--amber-dim,var(--panel-3))" : "var(--green-dim)",
            display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="check" size={26}
              style={{ color: plErr > 0 ? "var(--amber)" : "var(--green)" }} strokeWidth={2.5} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 620, letterSpacing: "-.02em", marginBottom: 8 }}>
            Đã ánh xạ {selected?.name}
          </div>

          {/* Pipeline result summary */}
          <div style={{ display: "inline-flex", gap: 14, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13,
              color: plOk > 0 ? "var(--green)" : "var(--text-3)" }}>
              <Icon name="checkCircle" size={14} strokeWidth={2} />
              {plOk} pipeline active
            </span>
            {plErr > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--red)" }}>
                <Icon name="xCircle" size={14} strokeWidth={2} />
                {plErr} lỗi parse YAML
              </span>
            )}
            {syncPipelines.length === 0 && (
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>
                Không tìm thấy file <span className="mono">.workflow/*.yaml</span>
              </span>
            )}
          </div>

          <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 360, margin: "0 auto 22px", lineHeight: 1.5 }}>
            Nhánh <span className="mono" style={{ color: "var(--text)" }}>{branch}</span> đã được đăng ký.
            {plErr > 0 && " Kiểm tra tab .workflow để xem chi tiết lỗi."}
          </p>
          <button onClick={() => { onAddRepo?.(selected, branch); onClose(); }}
            style={{ padding: "9px 24px", borderRadius: "var(--r-md)", fontSize: 14, fontWeight: 560,
              background: "var(--accent)", color: "var(--accent-fg)", border: "none", cursor: "pointer" }}>
            Hoàn tất
          </button>
        </div>
      )}
    </Modal>
  );
}

/* ---- Repo detail ---- */
function RepoDetail({ repoId, repos, onNav, toast, onDeleteRepo, onSync }) {
  const repo = repos.find((r) => r.id === repoId);
  const [tab, setTab]               = useState("pipelines");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [apiPipelines, setApiPipelines] = useState([]);
  const [plLoading, setPlLoading]   = useState(true);
  const [triggerTarget, setTriggerTarget] = useState(null);

  useEffect(() => {
    if (!repo?.id) return;
    setPlLoading(true);
    listRepoPipelines(repo.id)
      .then((data) => setApiPipelines(data ?? []))
      .catch(() => setApiPipelines([]))
      .finally(() => setPlLoading(false));
  }, [repo?.id]);

  if (!repo) return <Page><div style={{ padding: 40, color: "var(--text-3)" }}>Không tìm thấy repository.</div></Page>;

  const deliveries = WEBHOOK_DELIVERIES.filter((d) => d.repo === repo.name);

  async function handleDelete() {
    setDeleting(true);
    try { await onDeleteRepo?.(repo.id); } finally { setDeleting(false); }
  }

  async function handleSync() {
    toast?.("Đang quét .workflow/…", "info");
    try {
      const data = await syncRepository(repo.id);
      setApiPipelines(data ?? []);
      const ok  = (data ?? []).filter((p) => p.status === "active").length;
      const err = (data ?? []).filter((p) => p.status === "error").length;
      toast?.(
        err > 0
          ? `Đồng bộ xong · ${ok} pipeline OK · ${err} lỗi parse`
          : `Đồng bộ xong · ${ok} pipeline`,
        err > 0 ? "error" : "success"
      );
    } catch (e) {
      toast?.(e.message || "Đồng bộ thất bại", "error");
    }
  }

  return (
    <Page wide>
      <PageHeader icon="repo" title={repo.name}
        breadcrumb={[{ label: "Repository", to: { view: "repos" } }, { label: repo.name, mono: true }]} onNav={onNav}
        subtitle={<span className="mono" style={{ fontSize: 12.5 }}>{repo.fullName}</span>}
        actions={
          <>
            {repo.repoUrl && (
              <Button variant="secondary" icon="external" onClick={() => window.open(repo.repoUrl, "_blank")}>
                Mở GitHub
              </Button>
            )}
            <Button variant="secondary" icon="sync" onClick={handleSync}>Đồng bộ lại</Button>
            <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>Xoá mapping</Button>
          </>
        } />

      {/* Confirm delete strip */}
      {confirmDelete && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", marginBottom: 18,
          background: "var(--red-dim)", border: "1px solid color-mix(in oklab, var(--red) 35%, transparent)",
          borderRadius: "var(--r-md)", fontSize: 13.5 }}>
          <Icon name="xCircle" size={18} style={{ color: "var(--red)", flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            Xoá mapping sẽ xoá <b>{repo.name}</b> và toàn bộ pipeline liên quan khỏi platform. Không ảnh hưởng đến GitHub.
          </span>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Huỷ</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Xác nhận xoá</Button>
        </div>
      )}

      <div style={{ display: "flex", gap: 22, marginBottom: 20, flexWrap: "wrap" }}>
        <MetaItem icon="branch" label="Nhánh mặc định" value={<span className="mono">{repo.defaultBranch || "main"}</span>} />
        {repo.language && <MetaItem label="Ngôn ngữ" value={<LangDot language={repo.language} />} />}
        <MetaItem icon="pipeline" label="Pipeline" value={plLoading ? "…" : `${apiPipelines.length} đã đồng bộ`} />
        <MetaItem icon="clock" label="Đồng bộ gần nhất" value={repo.lastSync} />
        <MetaItem label="Trạng thái" value={<StatusBadge status="active" size="sm" />} />
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {[["pipelines", "Pipeline", "pipeline"], ["workflow", ".workflow", "doc"], ["webhook", "Webhook", "webhook"]].map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", fontSize: 13.5, fontWeight: 540,
              color: tab === id ? "var(--text)" : "var(--text-3)",
              borderBottom: `2px solid ${tab === id ? "var(--accent)" : "transparent"}`,
              marginBottom: -1, transition: "color .12s" }}>
            <Icon name={icon} size={15} />{label}
          </button>
        ))}
      </div>

      {tab === "pipelines" && (
        plLoading
          ? <Card style={{ padding: 44, textAlign: "center" }}>
              <Icon name="sync" size={22} style={{ color: "var(--text-3)", animation: "spin .7s linear infinite", margin: "0 auto 10px", display: "block" }} />
              <span style={{ fontSize: 13.5, color: "var(--text-3)" }}>Đang tải pipeline…</span>
            </Card>
          : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {apiPipelines.length
                ? apiPipelines.map((p) => (
                    <ApiPipelineCard key={p.id} pipeline={p} onNav={onNav} onTrigger={setTriggerTarget} />
                  ))
                : <Card style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>
                    Chưa có pipeline nào — thêm file <span className="mono">.workflow/*.yaml</span> vào repository rồi đồng bộ lại.
                  </Card>}
            </div>
      )}
      {tab === "workflow" && <WorkflowTree pipelines={apiPipelines} branch={repo.mappedBranch || repo.defaultBranch || "main"} loading={plLoading} />}
      {tab === "webhook" && <RepoWebhookTab deliveries={deliveries} repo={repo} />}

      <TriggerModal
        open={!!triggerTarget}
        onClose={() => setTriggerTarget(null)}
        pipeline={triggerTarget}
        defaultRef={repo.mappedBranch || repo.defaultBranch || "main"}
        toast={toast}
      />
    </Page>
  );
}

/* ---- Pipeline card (API object) ---- */
function ApiPipelineCard({ pipeline: p, onNav, onTrigger }) {
  const canTrigger = p.status === "active";
  const statusCfg = {
    active:   { badge: "active",  icon: "pipeline", iconColor: "var(--accent)",  iconBg: "var(--accent-dim)" },
    disabled: { badge: "queued",  icon: "pipeline", iconColor: "var(--text-3)", iconBg: "var(--panel-3)" },
    error:    { badge: "failed",  icon: "xCircle",  iconColor: "var(--red)",    iconBg: "var(--red-dim)" },
  }[p.status] ?? { badge: "queued", icon: "pipeline", iconColor: "var(--text-3)", iconBg: "var(--panel-3)" };

  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "15px 18px" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: statusCfg.iconBg, display: "grid", placeItems: "center" }}>
          <Icon name={statusCfg.icon} size={19} style={{ color: statusCfg.iconColor }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>{p.name}</span>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>{p.file_path}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
            {p.trigger_events?.length
              ? p.trigger_events.map((e) => <Tag key={e} mono>{e}</Tag>)
              : <span style={{ fontSize: 12, color: "var(--text-3)" }}>Chưa cấu hình trigger tự động</span>}
            {p.trigger_branches?.length > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-3)" }}>
                <Icon name="branch" size={11} />{p.trigger_branches.join(", ")}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <StatusBadge status={statusCfg.badge} size="sm" />
          {canTrigger && (
            <Button variant="primary" size="sm" icon="play" onClick={() => onTrigger(p)}>
              Trigger
            </Button>
          )}
          {p.status === "error" && (
            <span style={{ fontSize: 12, color: "var(--red)", display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="xCircle" size={13} />Lỗi YAML
            </span>
          )}
          {p.status === "disabled" && (
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>Đã tắt</span>
          )}
          <button onClick={() => onNav({ view: "pipeline", pipelineId: p.id })}
            style={{ width: 30, height: 30, display: "grid", placeItems: "center",
              border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
              background: "transparent", cursor: "pointer", color: "var(--text-3)" }}
            title="Xem chi tiết">
            <Icon name="chevronRight" size={15} />
          </button>
        </div>
      </div>

      {p.status === "error" && (
        <div style={{ padding: "8px 18px", borderTop: "1px solid color-mix(in oklab, var(--red) 25%, transparent)",
          background: "var(--red-dim)", fontSize: 12.5, color: "var(--red)",
          display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="info" size={13} />
          File <span className="mono" style={{ margin: "0 3px" }}>{p.file_path}</span>
          có lỗi cú pháp khi parse — kiểm tra YAML rồi đồng bộ lại.
        </div>
      )}
    </Card>
  );
}

/* ---- Trigger pipeline modal ---- */
function TriggerModal({ open, onClose, pipeline, defaultRef, toast }) {
  const [ref, setRef]       = useState("");
  const [sha, setSha]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (open) { setRef(defaultRef || "main"); setSha(""); setError(null); }
  }, [open, defaultRef]);

  const shaValid = /^[0-9a-f]{40}$/i.test(sha.trim());
  const refValid = ref.trim().length > 0;

  async function submit() {
    if (!refValid || !shaValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await triggerPipeline(pipeline.id, { ref: ref.trim(), sha: sha.trim().toLowerCase() });
      toast?.(`Đã trigger pipeline "${pipeline.name}" · ${ref.trim()}`, "success");
      onClose();
    } catch (err) {
      const msgs = {
        PIPELINE_NOT_RUNNABLE: "Pipeline đang ở trạng thái disabled hoặc error, không thể trigger.",
        RESOURCE_NOT_FOUND:    "Không tìm thấy pipeline.",
        INVALID_PAYLOAD:       "Thiếu ref hoặc sha.",
      };
      setError(msgs[err.code] || err.message || "Trigger thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={480}
      title={`Trigger · ${pipeline?.name ?? ""}`}
      subtitle="Chạy thủ công pipeline tại một commit cụ thể.">
      <div style={{ padding: "20px 22px" }}>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 560, marginBottom: 6 }}>
          Ref (nhánh hoặc tag)
        </label>
        <Input value={ref} onChange={setRef} placeholder="main, develop, v1.0.0…" icon="branch" mono full
          onKeyDown={(e) => e.key === "Enter" && shaValid && submit()} />

        <label style={{ display: "block", fontSize: 12.5, fontWeight: 560, marginTop: 14, marginBottom: 6 }}>
          Commit SHA <span style={{ fontWeight: 400, color: "var(--text-3)" }}>(40 ký tự hex)</span>
        </label>
        <Input value={sha} onChange={setSha} placeholder="abc123def456abc123def456abc123def456abc1"
          icon="commit" mono full
          onKeyDown={(e) => e.key === "Enter" && refValid && submit()}
          suffix={
            <button onClick={() => setSha("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2")}
              style={{ fontSize: 11.5, color: "var(--accent)", whiteSpace: "nowrap", fontWeight: 540 }}>
              Dùng mẫu
            </button>
          }
        />
        {sha && !shaValid && (
          <div style={{ fontSize: 12, color: "var(--red)", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <Icon name="xCircle" size={13} />SHA phải đúng 40 ký tự hex (0-9, a-f)
          </div>
        )}

        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 16, padding: "10px 12px",
          background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
          <Icon name="info" size={14} style={{ color: "var(--text-3)", marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
            Commit SHA có thể lấy từ GitHub: trang commit → copy full SHA (40 ký tự). Pipeline phải ở trạng thái <span className="mono">active</span> mới trigger được.
          </span>
        </div>

        {error && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "10px 13px",
            background: "var(--red-dim)", border: "1px solid color-mix(in oklab, var(--red) 40%, transparent)",
            borderRadius: "var(--r-sm)", fontSize: 13, color: "var(--red)" }}>
            <Icon name="xCircle" size={14} />{error}
          </div>
        )}
      </div>
      <div style={{ padding: "13px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 9 }}>
        <Button variant="ghost" onClick={onClose}>Huỷ</Button>
        <Button variant="primary" icon="play" loading={submitting} disabled={!refValid || !shaValid}
          onClick={submit}>
          {submitting ? "Đang trigger…" : "Trigger"}
        </Button>
      </div>
    </Modal>
  );
}

function MetaItem({ icon, label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 5, display: "flex", alignItems: "center", gap: 5, fontWeight: 500 }}>
        {icon && <Icon name={icon} size={12} />}{label}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 540 }}>{value}</div>
    </div>
  );
}

function MiniBars({ runs }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 30 }}>
      {runs.map((r, i) => {
        const colors = { success: "var(--green)", failed: "var(--red)", running: "var(--amber)" };
        const h = r.status === "queued" ? 8 : 12 + ((r.duration || 60) % 18);
        return <span key={i} style={{ width: 5, height: h, borderRadius: 2, background: colors[r.status] || "var(--text-3)", opacity: r.status === "success" ? 0.55 : 1 }} />;
      })}
    </div>
  );
}

function PipelineCard({ pipeline: p, onNav }) {
  const last = p.runs[0];
  return (
    <Card hover pad={0} onClick={() => onNav({ view: "pipeline", pipelineId: p.id })} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon name="pipeline" size={19} style={{ color: "var(--accent)" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-.01em" }}>{p.title}</span>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>{p.path}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 5, fontSize: 12, color: "var(--text-3)" }}>
            <span style={{ display: "flex", gap: 5 }}>{p.triggers.map((t) => <Tag key={t} mono>{t}</Tag>)}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, display: "flex", alignItems: "center", gap: 22 }}>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 4 }}>Tỉ lệ thành công</div>
            <div style={{ fontSize: 14, fontWeight: 600 }} className="tnum">{p.successRate}%</div>
          </div>
          <MiniBars runs={[...p.runs].reverse().slice(-6)} />
          <StatusBadge status={p.status} />
          <Icon name="chevronRight" size={17} style={{ color: "var(--text-3)" }} />
        </div>
      </div>
    </Card>
  );
}

function WorkflowTree({ pipelines, branch = "main", loading }) {
  if (loading) {
    return (
      <Card style={{ padding: 44, textAlign: "center" }}>
        <Icon name="sync" size={20} style={{ color: "var(--text-3)", animation: "spin .7s linear infinite", margin: "0 auto 10px", display: "block" }} />
        <span style={{ fontSize: 13.5, color: "var(--text-3)" }}>Đang tải…</span>
      </Card>
    );
  }
  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-2)" }}>
        <Icon name="branch" size={14} />
        <span className="mono">{branch}</span>
        <span style={{ color: "var(--text-3)" }}>/</span>
        <span className="mono" style={{ color: "var(--accent)" }}>.workflow</span>
      </div>
      {pipelines.length ? pipelines.map((p, i) => {
        const isError = p.status === "error";
        const filePath = p.file_path || p.path || `.workflow/${p.name}.yaml`;
        return (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 18px",
            borderBottom: i < pipelines.length - 1 ? "1px solid var(--border)" : "none",
            background: isError ? "var(--red-dim)" : "transparent" }}>
            <Icon name="doc" size={16} style={{ color: isError ? "var(--red)" : "var(--text-3)" }} />
            <span className="mono" style={{ fontSize: 13, flex: 1, color: isError ? "var(--red)" : "inherit" }}>
              {filePath}
            </span>
            {isError
              ? <Tag mono color="var(--red)" bg="color-mix(in oklab, var(--red) 18%, transparent)" icon="xCircle">lỗi parse</Tag>
              : p.status === "disabled"
                ? <Tag mono color="var(--text-3)" bg="var(--panel-3)">disabled</Tag>
                : <Tag mono color="var(--green)" bg="var(--green-dim)" icon="check">đã đồng bộ</Tag>}
          </div>
        );
      }) : (
        <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          Chưa có file <span className="mono">.workflow/*.yaml</span> nào.
        </div>
      )}
    </Card>
  );
}

function RepoWebhookTab({ deliveries, repo }) {
  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="webhook" size={20} style={{ color: "var(--accent)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 560 }}>Webhook đang hoạt động</div>
            <div className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>
              https://cicd.fpt-cloud.internal/hooks/{repo.name}
            </div>
          </div>
          <StatusBadge status="active" size="sm" />
        </div>
      </Card>
      <Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13.5 }}>Lần gửi gần đây</div>
        {deliveries.length ? deliveries.map((d, i) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < deliveries.length - 1 ? "1px solid var(--border)" : "none" }}>
            <Tag mono color={d.status < 400 ? "var(--green)" : "var(--red)"} bg={d.status < 400 ? "var(--green-dim)" : "var(--red-dim)"}>{d.status}</Tag>
            <span className="mono" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{d.event}</span>
            <span style={{ fontSize: 12.5, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="branch" size={11} />{d.branch}
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>→ {d.triggered}</span>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>{d.at}</span>
          </div>
        )) : (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Chưa có lần gửi nào.</div>
        )}
      </Card>
    </div>
  );
}

export { ReposList, RepoDetail, AddRepoModal, PipelineCard };
