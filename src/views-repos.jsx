import React, { useState, useEffect } from 'react';
import { PIPELINES, STAGE_PRESETS } from './data.jsx';
import { Button, Card, Icon, Input, LangDot, Modal, StatusBadge, StatusDot, Tag } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { EmptyConnectState } from './views-dashboard.jsx';
import { getSourceProviderGithubRepos, mapRepository } from './api/source-providers.js';
import { syncRepository, patchRepository } from './api/repositories.js';
import { listRepoPipelines, triggerPipeline, getPipelineJenkinsfile } from './api/pipelines.js';
import { listWebhookEvents } from './api/webhooks.js';
import { fmtTime } from './views-pipeline.jsx';

/* ============================================================
   Views — Repository list + detail
   ============================================================ */

function ReposList({ repos, account, onNav, addRepoOpen, setAddRepoOpen, onAddRepo, toast }) {
  const [q, setQ] = useState("");
  const filtered = repos.filter(
    (r) => r.name.toLowerCase().includes(q.toLowerCase()) || r.fullName.toLowerCase().includes(q.toLowerCase())
  );

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
          <Button variant="primary" icon="plus" onClick={() => setAddRepoOpen(true)}>Thêm Repository</Button>
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
            <span>Repository</span><span>Pipeline</span><span>Nhánh mặc định</span><span>Ngày thêm</span><span />
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
                    <Icon name="branch" size={11} />{r.syncBranch || r.defaultBranch || "main"}
                    {r.syncBranch && <Icon name="edit" size={10} style={{ color: "var(--accent)" }} />}
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

/* ---- AddRepoModal — chọn đúng một repo từ GitHub để ánh xạ, quét pipeline ngay sau khi map ---- */
function AddRepoModal({ open, onClose, existing, account, onAddRepo, toast }) {
  const [step, setStep]             = useState("loading"); // loading | pick | mapping | done
  const [availRepos, setAvailRepos] = useState([]);
  const [selected, setSelected]     = useState(null);
  const [branch, setBranch]         = useState("");
  const [q, setQ]                   = useState("");
  const [fetchError, setFetchError] = useState(null);
  const [mapError, setMapError]     = useState(null);
  const [mappedRepo, setMappedRepo] = useState(null);
  const [syncPipelines, setSyncPipelines] = useState([]);
  const [syncFailed, setSyncFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(null); setBranch(""); setQ("");
    setFetchError(null); setMapError(null);
    setMappedRepo(null); setSyncPipelines([]); setSyncFailed(false);
    setStep("loading");
    loadFromGitHub();
  }, [open]);                           // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFromGitHub() {
    setStep("loading");
    const existingNames = new Set(existing.map((r) => r.fullName));
    try {
      const data = await getSourceProviderGithubRepos(account.id);
      setAvailRepos((data ?? []).filter((r) => !existingNames.has(r.full_name)));
      setFetchError(null);
    } catch (err) {
      setFetchError(err.message || "Không tải được danh sách repo từ GitHub");
      setAvailRepos([]);
    }
    setStep("pick");
  }

  function pickRepo(r) {
    setSelected(r);
    setBranch(r.default_branch || "main");
  }

  async function startMap() {
    if (!selected) return;
    setMapError(null);
    setStep("mapping");
    let repo;
    try {
      repo = await mapRepository(account.id, selected.full_name);
    } catch (err) {
      const msgs = {
        RESOURCE_NOT_FOUND: "Không tìm thấy repository này trên GitHub, hoặc token không có quyền truy cập.",
        UPSTREAM_ERROR:     "Không kết nối được GitHub.",
      };
      setMapError(msgs[err.code] || err.message || "Ánh xạ thất bại");
      setStep("pick");
      return;
    }
    const trimmedBranch = branch.trim();
    if (trimmedBranch && trimmedBranch !== repo.default_branch) {
      try {
        repo = await patchRepository(repo.id, trimmedBranch);
      } catch (err) {
        toast?.(err.message || "Đặt nhánh sync thất bại — dùng tạm nhánh mặc định", "error");
      }
    }
    setMappedRepo(repo);
    try {
      const data = await syncRepository(repo.id);
      setSyncPipelines(data ?? []);
      setSyncFailed(false);
    } catch (err) {
      setSyncPipelines([]);
      setSyncFailed(true);
      toast?.(err.message || "Quét pipeline thất bại", "error");
    }
    setStep("done");
  }

  const filtered = availRepos.filter(
    (r) => r.name.toLowerCase().includes(q.toLowerCase()) ||
           r.full_name.toLowerCase().includes(q.toLowerCase())
  );

  // Sync KHÔNG parse YAML — mọi pipeline vừa sync xong đều "pending", nên chỉ đếm tổng số tìm thấy.
  const totalPl = syncPipelines.length;

  return (
    <Modal open={open} onClose={onClose} width={580}
      title="Thêm Repository"
      subtitle={
        step === "loading"  ? "Đang tải danh sách từ GitHub…" :
        step === "mapping"  ? selected?.full_name :
        step === "done"     ? `Đã thêm ${mappedRepo?.name ?? selected?.name}` :
        "Chọn một repository trên GitHub để ánh xạ vào platform."
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
            <button onClick={loadFromGitHub} title="Tải lại từ GitHub"
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

          {/* Repo list — mỗi repo hiển thị branch mặc định trên GitHub; có thể đổi nhánh sync sau khi chọn */}
          <div style={{ maxHeight: 248, overflowY: "auto", padding: "8px 10px" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                {availRepos.length === 0
                  ? "Không còn repository nào để thêm — mọi repo trên GitHub đã được ánh xạ."
                  : "Không tìm thấy repository nào."}
              </div>
            )}
            {filtered.map((r) => {
              const sel = selected?.full_name === r.full_name;
              return (
                <button key={r.full_name} onClick={() => pickRepo(r)}
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

          {/* Branch selector — tuỳ chọn, mặc định dùng default_branch của repo (đặt qua PATCH sync_branch sau khi map) */}
          {selected && (
            <div style={{ padding: "6px 16px 0", borderTop: "1px solid var(--border)", marginTop: 2 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 580, marginBottom: 6, color: "var(--text-2)", marginTop: 12 }}>
                Nhánh để sync <span style={{ fontWeight: 400, color: "var(--text-3)" }}>(tuỳ chọn)</span>
              </label>
              <Input value={branch} onChange={setBranch}
                placeholder={selected.default_branch || "main"} icon="branch" mono full />
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 5, marginBottom: 12 }}>
                Mặc định dùng nhánh chính của repo trên GitHub (<span className="mono">{selected.default_branch || "main"}</span>). Đổi nếu muốn quét <span className="mono">.viettelcloud/workflows/</span> trên nhánh khác — có thể đổi lại sau trong trang repository.
              </div>
            </div>
          )}

          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
              {selected
                ? <>Sẽ ánh xạ <b style={{ color: "var(--text-2)" }}>{selected.name}</b> · nhánh <span className="mono" style={{ color: "var(--text-2)" }}>{branch.trim() || selected.default_branch || "main"}</span> và quét pipeline ngay</>
                : "Chọn một repository"}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose}
                style={{ padding: "7px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--border)",
                  background: "transparent", color: "var(--text-2)", fontSize: 13.5, cursor: "pointer" }}>
                Huỷ
              </button>
              <button onClick={startMap} disabled={!selected}
                style={{ padding: "7px 16px", borderRadius: "var(--r-md)", fontSize: 13.5, fontWeight: 560,
                  background: "var(--accent)", color: "var(--accent-fg)", border: "none",
                  cursor: selected ? "pointer" : "not-allowed",
                  opacity: selected ? 1 : 0.45 }}>
                Thêm & quét pipeline
              </button>
            </div>
          </div>
        </>
      )}

      {/* MAPPING */}
      {step === "mapping" && (
        <div style={{ padding: "52px 22px", textAlign: "center" }}>
          <Icon name="sync" size={32} style={{ color: "var(--accent)", animation: "spin 1.2s linear infinite",
            display: "block", margin: "0 auto 20px" }} />
          <div style={{ fontSize: 14.5, fontWeight: 560, marginBottom: 6 }}>Đang ánh xạ & quét .viettelcloud/workflows/…</div>
          <div className="mono" style={{ fontSize: 12.5, color: "var(--text-3)" }}>{selected?.full_name}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 4 }}>
            Map repository · lưu cấu hình YAML · tạo pipeline
          </div>
        </div>
      )}

      {/* DONE */}
      {step === "done" && (
        <div style={{ padding: "32px 26px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14,
            background: syncFailed ? "var(--amber-dim,var(--panel-3))" : "var(--green-dim)",
            display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="check" size={26}
              style={{ color: syncFailed ? "var(--amber)" : "var(--green)" }} strokeWidth={2.5} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 620, letterSpacing: "-.02em", marginBottom: 8 }}>
            Đã thêm {mappedRepo?.name}
          </div>

          {/* Pipeline result summary — sync không parse YAML nên chỉ có thể báo tổng số tìm thấy, chưa biết pipeline nào hợp lệ */}
          <div style={{ display: "inline-flex", gap: 14, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
            {syncFailed ? (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--red)" }}>
                <Icon name="xCircle" size={14} strokeWidth={2} />
                Quét pipeline thất bại — thử lại trong trang repository
              </span>
            ) : totalPl > 0 ? (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-2)" }}>
                <Icon name="doc" size={14} strokeWidth={2} />
                {totalPl} pipeline được phát hiện
              </span>
            ) : (
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>
                Không tìm thấy file <span className="mono">.viettelcloud/workflows/*.yaml</span>
              </span>
            )}
          </div>

          {mappedRepo?.webhook_registered === false && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, textAlign: "left", margin: "0 auto 16px", maxWidth: 360,
              padding: "10px 12px", background: "var(--amber-dim)", border: "1px solid color-mix(in oklab, var(--amber) 35%, transparent)",
              borderRadius: "var(--r-sm)", fontSize: 12.5, color: "var(--amber)", lineHeight: 1.5 }}>
              <Icon name="info" size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              Đăng ký webhook GitHub thất bại (PAT thiếu quyền <span className="mono">admin:repo_hook</span> hoặc server chưa cấu hình) — build thủ công vẫn hoạt động, chỉ tự động trigger theo push/PR là không.
            </div>
          )}

          <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 360, margin: "0 auto 22px", lineHeight: 1.5 }}>
            Nhánh <span className="mono" style={{ color: "var(--text)" }}>{mappedRepo?.sync_branch || mappedRepo?.default_branch}</span> đã được đăng ký.
            {totalPl > 0 && " Vào trang repository và bấm Build để chạy pipeline."}
          </p>
          <button onClick={() => { onAddRepo?.(mappedRepo); onClose(); }}
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
function RepoDetail({ repoId, repos, onNav, toast, onDeleteRepo, onRepoUpdated }) {
  const repo = repos.find((r) => r.id === repoId);
  const [tab, setTab]               = useState("pipelines");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [apiPipelines, setApiPipelines] = useState([]);
  const [plLoading, setPlLoading]   = useState(true);
  const [triggerTarget, setTriggerTarget] = useState(null);
  const [editingBranch, setEditingBranch] = useState(false);
  const [branchDraft, setBranchDraft] = useState("");
  const [savingBranch, setSavingBranch] = useState(false);

  useEffect(() => {
    if (!repo?.id) return;
    setPlLoading(true);
    listRepoPipelines(repo.id)
      .then((data) => setApiPipelines(data ?? []))
      .catch(() => setApiPipelines([]))
      .finally(() => setPlLoading(false));
  }, [repo?.id]);

  if (!repo) return <Page><div style={{ padding: 40, color: "var(--text-3)" }}>Không tìm thấy repository.</div></Page>;

  async function handleDelete() {
    setDeleting(true);
    try { await onDeleteRepo?.(repo.id); } finally { setDeleting(false); }
  }

  async function handleSync() {
    toast?.("Đang quét .viettelcloud/workflows/…", "info");
    try {
      const data = await syncRepository(repo.id);
      setApiPipelines(data ?? []);
      // Sync không parse YAML — mọi pipeline trả về đều "pending" (kể cả pipeline từng active/error
      // trước đó bị reset lại), nên chỉ báo tổng số tìm thấy, không có khái niệm OK/lỗi ở bước này.
      const total = (data ?? []).length;
      toast?.(
        total > 0
          ? `Đồng bộ xong · ${total} pipeline`
          : "Đồng bộ xong · không tìm thấy pipeline nào",
        "success"
      );
    } catch (e) {
      toast?.(e.message || "Đồng bộ thất bại", "error");
    }
  }

  async function refreshPipelines() {
    try {
      const data = await listRepoPipelines(repo.id);
      setApiPipelines(data ?? []);
    } catch {}
  }

  async function saveBranch() {
    const newBranch = branchDraft.trim();
    setSavingBranch(true);
    try {
      const updated = await patchRepository(repo.id, newBranch || null);
      onRepoUpdated?.(updated);
      toast?.(newBranch ? `Đã đổi nhánh sync sang ${newBranch}` : "Đã bỏ nhánh tuỳ chỉnh — dùng lại nhánh mặc định", "success");
      setEditingBranch(false);
    } catch (e) {
      toast?.(e.message || "Đổi nhánh thất bại", "error");
    } finally {
      setSavingBranch(false);
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
        <div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 5, display: "flex", alignItems: "center", gap: 5, fontWeight: 500 }}>
            <Icon name="branch" size={12} />Nhánh sync
          </div>
          {editingBranch ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Input value={branchDraft} onChange={setBranchDraft} mono placeholder={repo.defaultBranch || "main"}
                style={{ height: 30, width: 150 }} onKeyDown={(e) => e.key === "Enter" && saveBranch()} />
              <button onClick={saveBranch} disabled={savingBranch} title="Lưu"
                style={{ color: "var(--accent)", padding: 4 }}><Icon name={savingBranch ? "refresh" : "check"} size={16} style={savingBranch ? { animation: "spin .7s linear infinite" } : {}} /></button>
              <button onClick={() => setEditingBranch(false)} disabled={savingBranch} title="Huỷ"
                style={{ color: "var(--text-3)", padding: 4 }}><Icon name="x" size={16} /></button>
            </div>
          ) : (
            <div style={{ fontSize: 13.5, fontWeight: 540, display: "flex", alignItems: "center", gap: 8 }}>
              <span className="mono">{repo.syncBranch || repo.defaultBranch || "main"}</span>
              {repo.syncBranch && <Tag mono>tuỳ chỉnh</Tag>}
              <button onClick={() => { setBranchDraft(repo.syncBranch || ""); setEditingBranch(true); }}
                style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 540 }}>Đổi</button>
            </div>
          )}
        </div>
        {repo.language && <MetaItem label="Ngôn ngữ" value={<LangDot language={repo.language} />} />}
        <MetaItem icon="pipeline" label="Pipeline" value={plLoading ? "…" : `${apiPipelines.length} đã đồng bộ`} />
        <MetaItem icon="clock" label="Đã thêm vào platform" value={repo.lastSync} />
        {repo.webhookRegistered !== undefined && (
          <MetaItem icon="webhook" label="Webhook GitHub" value={
            repo.webhookRegistered
              ? <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--green)" }}><Icon name="checkCircle" size={13} strokeWidth={2} />Đã đăng ký</span>
              : <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--amber)" }}><Icon name="xCircle" size={13} strokeWidth={2} />Đăng ký thất bại</span>
          } />
        )}
        <MetaItem label="Trạng thái" value={<StatusBadge status="active" size="sm" />} />
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {[["pipelines", "Pipeline", "pipeline"], ["workflow", ".viettelcloud/workflows", "doc"], ["webhook", "Webhook", "webhook"]].map(([id, label, icon]) => (
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
                    Chưa có pipeline nào — thêm file <span className="mono">.viettelcloud/workflows/*.yaml</span> vào repository rồi đồng bộ lại.
                  </Card>}
            </div>
      )}
      {tab === "workflow" && <WorkflowTree pipelines={apiPipelines} branch={repo.syncBranch || repo.defaultBranch || "main"} loading={plLoading} />}
      {tab === "webhook" && <RepoWebhookTab repo={repo} />}

      <TriggerModal
        open={!!triggerTarget}
        onClose={() => setTriggerTarget(null)}
        pipeline={triggerTarget}
        defaultRef={repo.syncBranch || repo.defaultBranch || "main"}
        onTriggered={refreshPipelines}
        toast={toast}
      />
    </Page>
  );
}

/* ---- Pipeline card (API object) — dùng cả trong RepoDetail (1 repo) lẫn trang Pipeline tổng hợp (nhiều repo) ---- */
function ApiPipelineCard({ pipeline: p, repo, onNav, onTrigger }) {
  // Lý do lỗi parse — lấy qua GET /pipelines/:id/jenkinsfile (KHÔNG tạo build như trigger).
  const [parseErr, setParseErr] = useState(null);
  const [loadingErr, setLoadingErr] = useState(false);

  async function showParseError() {
    setLoadingErr(true);
    try {
      await getPipelineJenkinsfile(p.id);
      setParseErr("Version hiện tại đã hợp lệ — đồng bộ lại repository để cập nhật trạng thái.");
    } catch (err) {
      setParseErr(err.message || "Không lấy được lý do lỗi.");
    } finally {
      setLoadingErr(false);
    }
  }

  // pending: chưa parse (mặc định ngay sau sync) — vẫn trigger được, đó là lúc parse xảy ra lần đầu.
  const canTrigger = p.status === "active" || p.status === "pending";
  const statusCfg = {
    active:   { badge: "active",  icon: "pipeline", iconColor: "var(--accent)",  iconBg: "var(--accent-dim)" },
    // pending: không hiển thị badge — với người dùng, pipeline vừa đồng bộ chỉ đơn giản là build được ngay.
    pending:  { badge: null,      icon: "pipeline", iconColor: "var(--text-3)", iconBg: "var(--panel-3)" },
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
            {repo && (
              <button onClick={() => onNav({ view: "repo", repoId: repo.id })}
                className="mono" style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 560, display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="repo" size={11} />{repo.name}
              </button>
            )}
            <button onClick={() => onNav({ view: "pipeline", pipelineId: p.id })}
              style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--text)"}>
              {p.name}
            </button>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>{p.file_path}</span>
          </div>
          {(p.trigger_events?.length > 0 || p.trigger_branches?.length > 0) && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
              {p.trigger_events?.map((e) => <Tag key={e} mono>{e}</Tag>)}
              {p.trigger_branches?.length > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-3)" }}>
                  <Icon name="branch" size={11} />{p.trigger_branches.join(", ")}
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {statusCfg.badge && <StatusBadge status={statusCfg.badge} size="sm" />}
          {canTrigger && (
            <Button variant="primary" size="sm" icon="play" onClick={() => onTrigger(p)}>
              Build
            </Button>
          )}
          {p.status === "error" && (
            <Button variant="secondary" size="sm" icon="info" loading={loadingErr} onClick={showParseError}>
              Xem lỗi
            </Button>
          )}
          {p.status === "disabled" && (
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>Đã tắt</span>
          )}
          <button onClick={() => onNav({ view: "pipeline", pipelineId: p.id })}
            style={{ width: 30, height: 30, display: "grid", placeItems: "center",
              border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
              background: "transparent", cursor: "pointer", color: "var(--text-3)" }}
            title="Xem chi tiết pipeline">
            <Icon name="chevronRight" size={15} />
          </button>
        </div>
      </div>

      {p.status === "error" && (
        <div style={{ padding: "8px 18px", borderTop: "1px solid color-mix(in oklab, var(--red) 25%, transparent)",
          background: "var(--red-dim)", fontSize: 12.5, color: "var(--red)",
          display: "flex", alignItems: "flex-start", gap: 8 }}>
          <Icon name="info" size={13} style={{ marginTop: 2, flexShrink: 0 }} />
          {parseErr
            ? <span className="mono" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{parseErr}</span>
            : <span>File <span className="mono" style={{ margin: "0 3px" }}>{p.file_path}</span>
                có lỗi cấu hình — bấm "Xem lỗi" để đọc lý do cụ thể, sửa YAML trên GitHub rồi đồng bộ lại.</span>}
        </div>
      )}
    </Card>
  );
}

/* ---- Build pipeline modal — tạo build THẬT trên Jenkins. ref/sha đều tuỳ chọn
   (default: sync branch của repo + HEAD của ref). onTriggered nhận BuildRef trả về. ---- */
function TriggerModal({ open, onClose, pipeline, defaultRef, onTriggered, toast }) {
  const [ref, setRef]       = useState("");
  const [sha, setSha]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (open) { setRef(defaultRef || ""); setSha(""); setError(null); }
  }, [open, defaultRef]);

  // sha tuỳ chọn — chỉ validate định dạng khi người dùng có nhập
  const shaValid = !sha.trim() || /^[0-9a-f]{40}$/i.test(sha.trim());

  async function submit() {
    if (!shaValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const build = await triggerPipeline(pipeline.id, { ref: ref.trim() || undefined, sha: sha.trim().toLowerCase() || undefined });
      toast?.(
        build?.build_number > 0
          ? `Đã bắt đầu build #${build.build_number} · ${pipeline.name}`
          : `Build "${pipeline.name}" đã vào hàng đợi Jenkins`,
        "success"
      );
      onTriggered?.(build);
      onClose();
    } catch (err) {
      const msgs = {
        PIPELINE_NOT_RUNNABLE: "Pipeline đang disabled, hoặc chưa từng sync (chưa có version) — không thể build.",
        RESOURCE_NOT_FOUND:    "Không tìm thấy pipeline.",
        UPSTREAM_ERROR:        "Không kết nối được Jenkins — kiểm tra Jenkins server rồi thử lại.",
      };
      if (err.code === "PIPELINE_PARSE_ERROR") {
        setError(`Lỗi cấu hình YAML: ${err.message}`);
        onTriggered?.(); // pipeline vừa chuyển sang status "error" ở backend — refresh để badge cập nhật
      } else {
        setError(msgs[err.code] || err.message || "Build thất bại");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={480}
      title={`Build · ${pipeline?.name ?? ""}`}
      subtitle="Chạy pipeline trên Jenkins. Bỏ trống để build nhánh sync tại commit mới nhất.">
      <div style={{ padding: "20px 22px" }}>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 560, marginBottom: 6 }}>
          Ref (nhánh hoặc tag) <span style={{ fontWeight: 400, color: "var(--text-3)" }}>tuỳ chọn</span>
        </label>
        <Input value={ref} onChange={setRef} placeholder={defaultRef ? `mặc định: ${defaultRef}` : "main, develop, v1.0.0…"} icon="branch" mono full
          onKeyDown={(e) => e.key === "Enter" && submit()} />

        <label style={{ display: "block", fontSize: 12.5, fontWeight: 560, marginTop: 14, marginBottom: 6 }}>
          Commit SHA <span style={{ fontWeight: 400, color: "var(--text-3)" }}>tuỳ chọn — bỏ trống = commit mới nhất của ref</span>
        </label>
        <Input value={sha} onChange={setSha} placeholder="40 ký tự hex, vd: a3f91c2…"
          icon="commit" mono full
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        {!shaValid && (
          <div style={{ fontSize: 12, color: "var(--red)", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <Icon name="xCircle" size={13} />SHA phải đúng 40 ký tự hex (0-9, a-f)
          </div>
        )}

        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 16, padding: "10px 12px",
          background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
          <Icon name="info" size={14} style={{ color: "var(--text-3)", marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
            Build chạy trên Jenkins. Lần build đầu tiên, platform kiểm tra cấu hình YAML — nếu YAML lỗi, build dừng lại và báo lý do cụ thể.
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
        <Button variant="primary" icon="play" loading={submitting} disabled={!shaValid}
          onClick={submit}>
          {submitting ? "Đang build…" : "Build"}
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
        <span className="mono" style={{ color: "var(--accent)" }}>.viettelcloud/workflows</span>
      </div>
      {pipelines.length ? pipelines.map((p, i) => {
        const isError = p.status === "error";
        const filePath = p.file_path || p.path || `.viettelcloud/workflows/${p.name}.yaml`;
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
                : p.status === "active"
                  ? <Tag mono color="var(--green)" bg="var(--green-dim)" icon="check">hợp lệ</Tag>
                  : <Tag mono color="var(--text-3)" bg="var(--panel-3)" icon="doc">đã đồng bộ</Tag>}
          </div>
        );
      }) : (
        <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          Chưa có file <span className="mono">.viettelcloud/workflows/*.yaml</span> nào.
        </div>
      )}
    </Card>
  );
}

const WEBHOOK_EVENT_STATUS_META = {
  received:   { color: "var(--text-3)", label: "Đã nhận" },
  processing: { color: "var(--amber)",  label: "Đang xử lý" },
  done:       { color: "var(--green)",  label: "Hoàn tất" },
  failed:     { color: "var(--red)",    label: "Lỗi xử lý" },
};

/* Audit trail thật từ GET /repositories/:id/webhook-events — không có payload gốc, chỉ metadata. */
function RepoWebhookTab({ repo }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await listWebhookEvents(repo.id);
      setEvents(data ?? []);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [repo.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="webhook" size={20} style={{ color: repo.webhookRegistered === false ? "var(--amber)" : "var(--accent)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 560 }}>
              {repo.webhookRegistered === false ? "Đăng ký webhook thất bại" : "Webhook GitHub"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2, lineHeight: 1.5 }}>
              Đăng ký tự động khi map repository — sự kiện <span className="mono">push</span>/<span className="mono">pull_request</span> tự trigger pipeline có block <span className="mono">trigger:</span> khớp trong YAML.
            </div>
          </div>
          {repo.webhookRegistered !== undefined && <StatusBadge status={repo.webhookRegistered ? "active" : "failed"} size="sm" />}
        </div>
        {repo.webhookRegistered === false && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.5 }}>
            Có thể do PAT thiếu quyền <span className="mono">admin:repo_hook</span> hoặc server chưa cấu hình <span className="mono">WEBHOOK_BASE_URL</span>. Map lại repository (Thêm Repository → chọn đúng repo này) để thử đăng ký lại.
          </div>
        )}
      </Card>

      <Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>Lần gửi gần đây</span>
          <button onClick={load} title="Tải lại" style={{ color: "var(--text-3)", padding: 4 }}>
            <Icon name="refresh" size={14} style={loading ? { animation: "spin .7s linear infinite" } : {}} />
          </button>
        </div>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Đang tải…</div>
        ) : error ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--red)", fontSize: 13 }}>{error.message || "Không tải được lịch sử webhook."}</div>
        ) : events.length ? events.map((e, i) => {
          const meta = WEBHOOK_EVENT_STATUS_META[e.process_status] || { color: "var(--text-3)", label: e.process_status };
          return (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < events.length - 1 ? "1px solid var(--border)" : "none" }}>
              <Tag mono color={e.signature_valid ? "var(--green)" : "var(--red)"} bg={e.signature_valid ? "var(--green-dim)" : "var(--red-dim)"}>
                {e.signature_valid ? "hợp lệ" : "sai chữ ký"}
              </Tag>
              <span className="mono" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{e.event_type}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }} title={e.delivery_id}>{e.delivery_id?.slice(0, 8)}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: meta.color, fontWeight: 540 }}>{meta.label}</span>
              <span style={{ fontSize: 12, color: "var(--text-3)", width: 150, textAlign: "right" }}>{fmtTime(e.received_at)}</span>
            </div>
          );
        }) : (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Chưa có lần gửi nào.</div>
        )}
      </Card>
    </div>
  );
}

export { ReposList, RepoDetail, AddRepoModal, PipelineCard, ApiPipelineCard, TriggerModal };
