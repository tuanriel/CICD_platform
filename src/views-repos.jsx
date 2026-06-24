import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GH_AVAILABLE_REPOS, PIPELINES, STAGE_PRESETS, WEBHOOK_DELIVERIES } from './data.jsx';
import { PAT_TOKENS } from './data-build.jsx';
import { Button, Card, Icon, Input, LangDot, Modal, StatusBadge, StatusDot, Tag } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { EmptyConnectState } from './views-dashboard.jsx';

/* ============================================================
   Views — Repository list + detail
   ============================================================ */

function ReposList({ repos, account, onNav, addRepoOpen, setAddRepoOpen, onAddRepo, toast }) {
  const [q, setQ] = useState("");
  const filtered = repos.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()) || r.fullName.toLowerCase().includes(q.toLowerCase()));

  if (!account.connected) {
    return <Page><PageHeader title="Repository" icon="repo" subtitle="Quản lý các repository được ánh xạ từ GitHub." /><EmptyConnectState onNav={onNav} /></Page>;
  }

  return (
    <Page wide>
      <PageHeader title="Repository" icon="repo"
        subtitle="Các đối tượng Repository trên nền tảng, ánh xạ 1-1 với GitHub Repository."
        actions={<><Button variant="secondary" icon="sync">Đồng bộ</Button><Button variant="primary" icon="plus" onClick={() => setAddRepoOpen(true)}>Thêm Repository</Button></>} />

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Input value={q} onChange={setQ} placeholder="Tìm repository…" icon="search" full />
        <Button variant="secondary" icon="filter">Lọc</Button>
      </div>

      <Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr .8fr .9fr .9fr 40px", padding: "11px 18px",
          borderBottom: "1px solid var(--border)", fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em",
          textTransform: "uppercase", color: "var(--text-3)" }}>
          <span>Repository</span><span>Pipeline</span><span>Nhánh ánh xạ</span><span>Đồng bộ</span><span />
        </div>
        {filtered.map((r, i) => {
          const pls = PIPELINES.filter((p) => p.repoId === r.id);
          const anyFail = pls.some((p) => p.status === "failed");
          const anyRun = pls.some((p) => p.status === "running");
          return (
            <div key={r.id} onClick={() => onNav({ view: "repo", repoId: r.id })}
              style={{ display: "grid", gridTemplateColumns: "1.7fr .8fr .9fr .9fr 40px", padding: "14px 18px",
                alignItems: "center", cursor: "pointer", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                transition: "background .12s" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", flexShrink: 0, position: "relative" }}>
                  <Icon name="repo" size={17} style={{ color: "var(--text-2)" }} />
                  <StatusDot status={anyRun ? "running" : anyFail ? "failed" : "success"} size={8} />
                  <span style={{ position: "absolute", right: -3, bottom: -3, width: 8, height: 8, borderRadius: 99, border: "2px solid var(--panel)", background: anyRun ? "var(--amber)" : anyFail ? "var(--red)" : "var(--green)" }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 14, fontWeight: 560 }}>{r.name}</span>
                    {r.private && <Icon name="lock" size={12} style={{ color: "var(--text-3)" }} />}
                  </div>
                  <div className="mono" style={{ fontSize: 11.5, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.fullName}</div>
                </div>
              </div>
              <div><Tag mono>{r.pipelineCount} pipeline</Tag></div>
              <div><LangDot language={r.language} /><div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}><Icon name="branch" size={11} />{r.mappedBranch || r.defaultBranch}</div></div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>{r.lastSync}</div>
              <div style={{ textAlign: "right" }}><Icon name="chevronRight" size={16} style={{ color: "var(--text-3)" }} /></div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>Không tìm thấy repository nào.</div>}
      </Card>

      <AddRepoModal open={addRepoOpen} onClose={() => setAddRepoOpen(false)} existing={repos} account={account} onAdd={onAddRepo} toast={toast} />
    </Page>
  );
}

function AddRepoModal({ open, onClose, existing, account, onAdd, toast }) {
  const [step, setStep] = useState("pick"); // pick | syncing | done
  const [selected, setSelected] = useState(null);
  const [branch, setBranch] = useState("");
  const [patId, setPatId] = useState("");
  const [q, setQ] = useState("");
  const [syncLog, setSyncLog] = useState([]);
  const timers = useRef([]);
  const existingNames = new Set(existing.map((r) => r.fullName));
  const patAccounts = (typeof PAT_TOKENS !== "undefined" ? PAT_TOKENS : []).filter((t) => t.provider === "github" && t.status === "active");

  function clearTimers() { timers.current.forEach((t) => clearTimeout(t)); timers.current = []; }
  useEffect(() => {
    if (open) {
      setStep("pick"); setSelected(null); setBranch(""); setQ(""); setSyncLog([]); clearTimers();
      setPatId(patAccounts[0]?.id || "");
    }
    return clearTimers;
  }, [open]);

  function pickRepo(r) {
    if (existingNames.has(r.fullName)) return;
    setSelected(r);
    setBranch((r.branches && r.branches[0]) || "main");
  }

  const avail = GH_AVAILABLE_REPOS.filter((r) => r.fullName.toLowerCase().includes(q.toLowerCase()));
  const pat = patAccounts.find((t) => t.id === patId);

  function startSync() {
    if (!selected || !branch || !patId) return;
    clearTimers();
    setStep("syncing");
    setSyncLog([]);
    const steps = [
      `Xác thực qua token ${pat?.name || "PAT"}…`,
      `Ánh xạ repository ${selected.name} (nhánh ${branch})…`,
      `Quét .github/workflows trên nhánh ${branch}…`,
      selected.hasWorkflow ? "Tìm thấy ci.yml, deploy.yml" : "Không tìm thấy file workflow nào",
      "Đăng ký webhook (push, pull_request)…",
      "Hoàn tất đồng bộ ✓",
    ];
    steps.forEach((line, idx) => {
      timers.current.push(setTimeout(() => setSyncLog((l) => [...l, line]), (idx + 1) * 480));
    });
    timers.current.push(setTimeout(() => setStep("done"), steps.length * 480 + 500));
  }

  return (
    <Modal open={open} onClose={onClose} width={580} title="Thêm Repository"
      subtitle={step === "pick" ? "Ánh xạ 1-1 một GitHub Repository vào nền tảng. Mỗi repo chỉ ánh xạ một lần." : selected?.fullName}>
      {step === "pick" && (
        <div>
          {/* PAT account selector */}
          <div style={{ padding: "16px 22px 0" }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 560, marginBottom: 7 }}>Tài khoản (PAT)</label>
            {patAccounts.length ? (
              <div style={{ position: "relative" }}>
                <select value={patId} onChange={(e) => setPatId(e.target.value)}
                  style={{ appearance: "none", width: "100%", height: 40, padding: "0 38px 0 38px", background: "var(--panel-2)",
                    border: "1px solid var(--border)", borderRadius: "var(--r-sm)", color: "var(--text)", fontSize: 13.5, cursor: "pointer" }}>
                  {patAccounts.map((t) => <option key={t.id} value={t.id}>{t.name} · @{t.account}</option>)}
                </select>
                <Icon name="github" size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-2)", pointerEvents: "none" }} />
                <Icon name="chevronDown" size={15} style={{ position: "absolute", right: 12, top: 12, color: "var(--text-3)", pointerEvents: "none" }} />
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 12.5, color: "var(--text-3)" }}>
                <Icon name="key" size={15} />Chưa có token PAT nào — hãy thêm trong mục Quản lý key PAT.
              </div>
            )}
          </div>

          <div style={{ padding: "14px 22px 0" }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 560, marginBottom: 7 }}>Repository</label>
            <Input value={q} onChange={setQ} placeholder="Tìm trong tài khoản GitHub…" icon="search" full />
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto", padding: "10px 14px" }}>
            {avail.map((r) => {
              const added = existingNames.has(r.fullName);
              const sel = selected?.fullName === r.fullName;
              return (
                <button key={r.fullName} disabled={added} onClick={() => pickRepo(r)}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 12px", borderRadius: "var(--r-md)",
                    border: `1px solid ${sel ? "var(--accent-border)" : "transparent"}`, background: sel ? "var(--accent-dim)" : "transparent",
                    opacity: added ? 0.5 : 1, cursor: added ? "default" : "pointer", textAlign: "left", marginBottom: 2, transition: "background .12s" }}
                  onMouseEnter={(e) => { if (!added && !sel) e.currentTarget.style.background = "var(--panel-2)"; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ width: 20, height: 20, borderRadius: 99, border: `1.5px solid ${sel ? "var(--accent)" : "var(--border-strong)"}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {sel && <span style={{ width: 9, height: 9, borderRadius: 99, background: "var(--accent)" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 560 }}>{r.name}</span>
                      {r.private && <Icon name="lock" size={11} style={{ color: "var(--text-3)" }} />}
                      {r.hasWorkflow && <Tag mono color="var(--accent)" bg="var(--accent-dim)">.workflow</Tag>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.desc}</div>
                  </div>
                  {added ? <Tag>Đã ánh xạ</Tag> : <LangDot language={r.language} />}
                </button>
              );
            })}
          </div>

          {/* Branch selector — shown after a repo is picked */}
          {selected && (
            <div style={{ padding: "4px 22px 0" }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 560, marginBottom: 7 }}>Nhánh để ánh xạ</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(selected.branches || ["main"]).map((b) => {
                  const on = branch === b;
                  return (
                    <button key={b} onClick={() => setBranch(b)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "7px 12px", borderRadius: "var(--r-sm)",
                        border: `1px solid ${on ? "var(--accent-border)" : "var(--border)"}`, background: on ? "var(--accent-dim)" : "var(--panel-2)",
                        color: on ? "var(--accent)" : "var(--text-2)", fontWeight: on ? 600 : 500 }}>
                      <Icon name="branch" size={13} /><span className="mono">{b}</span>
                      {on && <Icon name="check" size={13} strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 8 }}>Pipeline & webhook sẽ đồng bộ từ nhánh này.</div>
            </div>
          )}

          <div style={{ padding: "16px 22px", borderTop: "1px solid var(--border)", marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>{selected ? <>Ánh xạ <b style={{ color: "var(--text-2)" }}>{selected.name}</b> · nhánh <span className="mono" style={{ color: "var(--text-2)" }}>{branch}</span></> : "Chọn một repository"}</span>
            <div style={{ display: "flex", gap: 9 }}>
              <Button variant="ghost" onClick={onClose}>Huỷ</Button>
              <Button variant="primary" icon="sync" disabled={!selected || !branch || !patId} onClick={startSync}>Ánh xạ & Đồng bộ</Button>
            </div>
          </div>
        </div>
      )}

      {step === "syncing" && (
        <div style={{ padding: "26px 22px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <Icon name="sync" size={20} style={{ color: "var(--accent)", animation: "spin 1.2s linear infinite" }} />
            <div><div style={{ fontWeight: 560, fontSize: 14 }}>Đang đồng bộ…</div><div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Quét cấu hình pipeline từ kho mã nguồn</div></div>
          </div>
          <div className="mono" style={{ background: "var(--code-bg)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 14, fontSize: 12.5, lineHeight: 1.8, minHeight: 140 }}>
            {syncLog.filter(Boolean).map((l, i) => (
              <div key={i} style={{ color: l.includes("✓") || l.includes("Tìm thấy") ? "var(--green)" : l.includes("Không") ? "var(--amber)" : "var(--text-2)", display: "flex", gap: 8 }}>
                <span style={{ color: "var(--text-3)" }}>{i < syncLog.length - 1 || l.includes("✓") ? "✓" : "›"}</span>{l}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === "done" && (
        <div style={{ padding: "32px 26px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--green-dim)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="check" size={26} style={{ color: "var(--green)" }} strokeWidth={2.5} />
          </div>
          <div style={{ fontSize: 16.5, fontWeight: 620, letterSpacing: "-.02em", marginBottom: 6 }}>Đã ánh xạ {selected.name}</div>
          <p style={{ fontSize: 13.5, color: "var(--text-2)", maxWidth: 380, margin: "0 auto 22px", lineHeight: 1.5 }}>
            Nhánh <span className="mono" style={{ color: "var(--text)" }}>{branch}</span> đã được đồng bộ. {selected.hasWorkflow ? "Đã nhận diện 2 pipeline từ .github/workflows và đăng ký webhook thành công." : "Chưa có workflow nào — hãy thêm file vào .github/workflows rồi đồng bộ lại."}
          </p>
          <Button variant="primary" onClick={() => { onAdd(selected, { branch, patName: pat?.name }); onClose(); toast(`Đã ánh xạ ${selected.name} · nhánh ${branch}`, "success"); }}>Hoàn tất</Button>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- Repo detail ---------------- */
function RepoDetail({ repoId, repos, onNav, toast }) {
  const repo = repos.find((r) => r.id === repoId);
  const [tab, setTab] = useState("pipelines");
  if (!repo) return <Page><div style={{ color: "var(--text-3)" }}>Không tìm thấy repository.</div></Page>;
  const pipelines = PIPELINES.filter((p) => p.repoId === repo.id);
  const deliveries = WEBHOOK_DELIVERIES.filter((d) => d.repo === repo.name);

  return (
    <Page wide>
      <PageHeader icon="repo" title={repo.name}
        breadcrumb={[{ label: "Repository", to: { view: "repos" } }, { label: repo.name, mono: true }]} onNav={onNav}
        subtitle={<span className="mono" style={{ fontSize: 12.5 }}>{repo.fullName}</span>}
        actions={<><Button variant="secondary" icon="external">Mở GitHub</Button><Button variant="secondary" icon="sync" onClick={() => toast("Đang đồng bộ lại pipeline…", "info")}>Đồng bộ lại</Button></>} />

      <div style={{ display: "flex", gap: 22, marginBottom: 20, flexWrap: "wrap" }}>
        <MetaItem icon="branch" label="Nhánh ánh xạ" value={<span className="mono">{repo.mappedBranch || repo.defaultBranch}</span>} />
        <MetaItem label="Ngôn ngữ" value={<LangDot language={repo.language} />} />
        <MetaItem icon="pipeline" label="Pipeline" value={`${pipelines.length} đã đồng bộ`} />
        <MetaItem icon="clock" label="Đồng bộ gần nhất" value={repo.lastSync} />
        <MetaItem label="Trạng thái" value={<StatusBadge status="active" size="sm" />} />
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {[["pipelines", "Pipeline", "pipeline"], ["workflow", ".workflow", "doc"], ["webhook", "Webhook", "webhook"]].map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", fontSize: 13.5, fontWeight: 540,
              color: tab === id ? "var(--text)" : "var(--text-3)", borderBottom: `2px solid ${tab === id ? "var(--accent)" : "transparent"}`,
              marginBottom: -1, transition: "color .12s" }}>
            <Icon name={icon} size={15} />{label}
          </button>
        ))}
      </div>

      {tab === "pipelines" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pipelines.map((p) => <PipelineCard key={p.id} pipeline={p} onNav={onNav} />)}
        </div>
      )}
      {tab === "workflow" && <WorkflowTree pipelines={pipelines} />}
      {tab === "webhook" && <RepoWebhookTab deliveries={deliveries} repo={repo} />}
    </Page>
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

function WorkflowTree({ pipelines }) {
  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-2)" }}>
        <Icon name="branch" size={14} /><span className="mono">main</span><span style={{ color: "var(--text-3)" }}>/</span><span className="mono" style={{ color: "var(--accent)" }}>.workflow</span>
      </div>
      {pipelines.map((p, i) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 18px", borderBottom: i < pipelines.length - 1 ? "1px solid var(--border)" : "none" }}>
          <Icon name="doc" size={16} style={{ color: "var(--text-3)" }} />
          <span className="mono" style={{ fontSize: 13, flex: 1 }}>{p.name}</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{p.stages?.length || STAGE_PRESETS[p.preset].length} stages</span>
          <Tag mono color="var(--green)" bg="var(--green-dim)" icon="check">đã đồng bộ</Tag>
        </div>
      ))}
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
            <div className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>https://cicd.fpt-cloud.internal/hooks/{repo.name}</div>
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
            <span style={{ fontSize: 12.5, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 4 }}><Icon name="branch" size={11} />{d.branch}</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>→ {d.triggered}</span>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>{d.at}</span>
          </div>
        )) : <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Chưa có lần gửi nào.</div>}
      </Card>
    </div>
  );
}

export { ReposList, RepoDetail, AddRepoModal, PipelineCard };
