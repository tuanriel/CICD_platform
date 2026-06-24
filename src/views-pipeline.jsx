import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PIPELINES, STAGE_PRESETS, buildLogScript } from './data.jsx';
import { Avatar, Breadcrumb, Button, Card, Icon, Input, STATUS_META, SectionLabel, StatusBadge, StatusDot, Tag, fmtDur } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { EmptyConnectState } from './views-dashboard.jsx';
import { Meta } from './views-build-history.jsx';

/* ============================================================
   Views — Pipelines list, Pipeline detail, Run detail (live logs)
   ============================================================ */

function PipelinesList({ repos, account, onNav, onTriggerBuild, toast }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  if (!account.connected) {
    return <Page><PageHeader title="Pipeline" icon="pipeline" subtitle="Quản lý tập trung toàn bộ pipeline đã đồng bộ." /><EmptyConnectState onNav={onNav} /></Page>;
  }
  const items = PIPELINES.map((p) => ({ ...p, repo: repos.find((r) => r.id === p.repoId) })).filter((p) => p.repo)
    .filter((p) => p.title.toLowerCase().includes(q.toLowerCase()) || p.repo.name.toLowerCase().includes(q.toLowerCase()) || p.name.toLowerCase().includes(q.toLowerCase()));

  const selP = items.find((p) => p.id === sel);
  function releaseChange() {
    if (!selP) return;
    const id = onTriggerBuild(selP.id);
    onNav({ view: "run", pipelineId: selP.id, runId: id, live: true });
  }

  const COLS = "36px 1.4fr 1fr 1.5fr 1fr 1fr";

  return (
    <Page wide>
      <PageHeader title="Pipeline" icon="pipeline"
        subtitle="Toàn bộ pipeline được đồng bộ từ GitHub Actions trong .github/workflows, quản lý tập trung."
        actions={<>
          <Button variant="secondary" icon="refresh" onClick={() => toast && toast("Đang đồng bộ lại từ GitHub…", "info")} />
          <Button variant="secondary" icon="clock" disabled={!selP} onClick={() => onNav({ view: "pipeline", pipelineId: sel })}>View history</Button>
          <Button variant="secondary" icon="play" disabled={!selP} onClick={releaseChange}>Release change</Button>
          <Button variant="secondary" icon="trash" disabled={!selP} onClick={() => toast && toast(`Xác nhận xoá pipeline ${selP.title}?`, "info")}>Delete pipeline</Button>
          <Button variant="primary" icon="plus" onClick={() => onNav({ view: "create-pipeline" })}>Create pipeline</Button>
        </>} />

      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
        <Input value={q} onChange={setQ} placeholder="Tìm pipeline theo tên…" icon="search" full />
      </div>

      {items.length === 0 ? (
        <Card style={{ padding: 48, textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="pipeline" size={24} style={{ color: "var(--text-3)" }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Chưa có pipeline nào</div>
          <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 440, margin: "0 auto 20px", lineHeight: 1.5 }}>
            Pipeline không tự sinh ra. Hãy quét một repository để phát hiện file GitHub Actions và parse thành pipeline được quản lý.
          </p>
          <Button variant="primary" icon="plus" onClick={() => onNav({ view: "create-pipeline" })}>Create pipeline</Button>
        </Card>
      ) : (
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "12px 18px", borderBottom: "1px solid var(--border)",
            fontSize: 11.5, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-3)" }}>
            <span /><span>Name</span><span>Latest execution status</span><span>Latest source revisions</span><span>Latest execution started</span><span>Most recent executions</span>
          </div>
          {items.map((p, i) => {
            const isSel = sel === p.id;
            const last = p.runs[0];
            return (
              <div key={p.id} onClick={() => setSel(isSel ? null : p.id)}
                style={{ display: "grid", gridTemplateColumns: COLS, padding: "15px 18px", alignItems: "center",
                  cursor: "pointer", borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
                  background: isSel ? "var(--accent-dim)" : "transparent", transition: "background .12s" }}
                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--panel-2)"; }}
                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ width: 17, height: 17, borderRadius: 99, border: `1.5px solid ${isSel ? "var(--accent)" : "var(--border-strong)"}`, display: "grid", placeItems: "center" }}>
                  {isSel && <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--accent)" }} />}
                </span>
                <button onClick={(e) => { e.stopPropagation(); onNav({ view: "pipeline", pipelineId: p.id }); }}
                  style={{ textAlign: "left", overflow: "hidden" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 560, color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{p.name}</div>
                </button>
                <span>{last ? <StatusBadge status={p.status} size="sm" /> : <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>Chưa chạy</span>}</span>
                <div style={{ minWidth: 0 }}>
                  {last ? (
                    <>
                      <div style={{ fontSize: 12.5 }}>
                        <span style={{ fontWeight: 600 }}>Source</span>
                        <span style={{ color: "var(--text-3)" }}> – </span>
                        <a href={p.repo.fullName ? "https://github.com/" + p.repo.fullName : "#"} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                          className="mono" style={{ color: "var(--accent)" }}>{typeof last.commit === "string" ? last.commit.slice(0, 7) : last.commit}</a>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last.message}</div>
                    </>
                  ) : <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>—</span>}
                </div>
                <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{last ? last.startedAt : "—"}</span>
                <span>
                  {last
                    ? <button onClick={(e) => { e.stopPropagation(); onNav({ view: "run", pipelineId: p.id, runId: last.id }); }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 540, color: "var(--accent)" }}>
                        <StatusDot status={p.status} size={8} />View details</button>
                    : <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>No executions yet</span>}
                </span>
              </div>
            );
          })}
        </Card>
      )}
    </Page>
  );
}

/* ---------------- Stage flow graph ---------------- */
function StageFlow({ stages, compact }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 0, overflowX: "auto", padding: compact ? "4px 0" : "2px 0" }}>
      {stages.map((s, i) => {
        const m = STATUS_META[s.status] || STATUS_META.queued;
        return (
          <React.Fragment key={i}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: compact ? 90 : 108 }}>
              <div style={{ position: "relative", width: 34, height: 34, borderRadius: 99, border: `1.5px solid ${s.status === "queued" || s.status === "skipped" ? "var(--border-strong)" : m.color}`,
                background: s.status === "success" ? m.dim : s.status === "running" ? m.dim : "var(--panel)", display: "grid", placeItems: "center", color: m.color }}>
                {s.status === "running"
                  ? <Icon name="refresh" size={16} style={{ animation: "spin .8s linear infinite" }} />
                  : s.status === "success" ? <Icon name="check" size={16} strokeWidth={2.5} />
                  : s.status === "failed" ? <Icon name="x" size={16} strokeWidth={2.5} />
                  : <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--text-3)" }} />}
                {s.status === "running" && <span style={{ position: "absolute", inset: -4, borderRadius: 99, border: "1.5px solid var(--amber)", opacity: .3, animation: "pulse-dot 1.2s ease-in-out infinite" }} />}
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 540, color: s.status === "queued" ? "var(--text-3)" : "var(--text)", whiteSpace: "nowrap" }}>{s.name}</div>
                {!compact && <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{s.duration ? fmtDur(s.duration) : s.status === "running" ? "…" : "—"}</div>}
              </div>
            </div>
            {i < stages.length - 1 && (
              <div style={{ flex: 1, minWidth: 16, height: 1.5, background: stages[i + 1].status !== "queued" && s.status === "success" ? m.color : "var(--border-strong)", marginTop: 17, alignSelf: "flex-start" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ---------------- Pipeline detail (Jenkins-style: sub-nav + builds) ---------------- */
function PipeSubNav({ items, active, onSelect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((it) => {
        if (it.divider) return <div key={it.id} style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />;
        const on = active === it.id;
        return (
          <button key={it.id} onClick={() => it.onClick ? it.onClick() : onSelect(it.id)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: "var(--r-sm)", textAlign: "left", width: "100%",
              fontSize: 13.5, fontWeight: on ? 600 : 500, color: it.danger ? "var(--red)" : on ? "var(--text)" : "var(--text-2)",
              background: on ? "var(--panel-2)" : "transparent", position: "relative", transition: "background .12s, color .12s" }}
            onMouseEnter={(e) => { if (!on) { e.currentTarget.style.background = "var(--panel)"; if (!it.danger) e.currentTarget.style.color = "var(--text)"; } }}
            onMouseLeave={(e) => { if (!on) { e.currentTarget.style.background = "transparent"; if (!it.danger) e.currentTarget.style.color = "var(--text-2)"; } }}>
            {on && <span style={{ position: "absolute", left: -10, top: 8, bottom: 8, width: 2.5, borderRadius: 99, background: "var(--accent)" }} />}
            <Icon name={it.icon} size={16} style={{ color: it.danger ? "var(--red)" : on ? "var(--accent)" : "var(--text-3)", flexShrink: 0 }} />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function BuildsPanel({ runs, onOpen, activeRunId }) {
  const [q, setQ] = useState("");
  const list = runs.filter((r) => ("#" + r.number + " " + (r.message || "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 14px 10px" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-.01em" }}>Builds</span>
        <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{runs.length}</span>
      </div>
      <div style={{ padding: "0 12px 10px" }}>
        <Input value={q} onChange={setQ} placeholder="Lọc…" icon="search" full />
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto", padding: "2px 8px 10px" }}>
        {list.length ? list.map((r) => {
          const on = activeRunId === r.id;
          return (
            <button key={r.id} onClick={() => onOpen(r)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 9px", borderRadius: "var(--r-sm)", textAlign: "left",
                background: on ? "var(--accent-dim)" : "transparent", transition: "background .12s" }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--panel-2)"; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
              <StatusDot status={r.status} size={9} />
              <span className="mono tnum" style={{ fontSize: 12.5, fontWeight: 560, width: 34 }}>#{r.number}</span>
              <span style={{ fontSize: 12, color: "var(--text-3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.startedAt}</span>
              <Icon name="chevronRight" size={14} style={{ color: "var(--text-3)" }} />
            </button>
          );
        }) : <div style={{ padding: "16px 10px", fontSize: 12.5, color: "var(--text-3)", textAlign: "center" }}>Chưa có build nào.</div>}
      </div>
    </Card>
  );
}

function PermalinkRow({ icon, label, run, onOpen }) {
  return (
    <button onClick={() => run && onOpen(run)} disabled={!run}
      style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", width: "100%", textAlign: "left",
        borderRadius: "var(--r-sm)", cursor: run ? "pointer" : "default", transition: "background .12s" }}
      onMouseEnter={(e) => { if (run) e.currentTarget.style.background = "var(--panel-2)"; }}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      <Icon name={icon} size={15} style={{ color: "var(--text-3)", flexShrink: 0 }} />
      <span style={{ fontSize: 13.5, color: "var(--text-2)" }}>{label}</span>
      {run ? <>
        <span className="mono" style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 560 }}>#{run.number}</span>
        <span style={{ fontSize: 12.5, color: "var(--text-3)", marginLeft: "auto" }}>{run.startedAt}</span>
      </> : <span style={{ fontSize: 12.5, color: "var(--text-3)", marginLeft: "auto" }}>—</span>}
    </button>
  );
}

/* ---------------- Stage matrix (build × stage, grouped by date) ---------------- */
function MatrixNode({ status }) {
  const m = STATUS_META[status] || STATUS_META.queued;
  const hollow = status === "queued" || status === "skipped";
  return (
    <div style={{ width: 30, height: 30, borderRadius: 99, flexShrink: 0, display: "grid", placeItems: "center",
      border: `1.5px solid ${hollow ? "var(--border-strong)" : m.color}`,
      background: hollow ? "transparent" : m.dim, color: m.color, position: "relative" }}>
      {status === "running"
        ? <Icon name="refresh" size={14} style={{ animation: "spin .8s linear infinite" }} />
        : status === "success" ? <Icon name="check" size={14} strokeWidth={2.6} />
        : status === "failed" ? <Icon name="x" size={14} strokeWidth={2.6} />
        : <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--border-strong)" }} />}
      {status === "running" && <span style={{ position: "absolute", inset: -4, borderRadius: 99, border: "1.5px solid var(--amber)", opacity: .3, animation: "pulse-dot 1.2s ease-in-out infinite" }} />}
    </div>
  );
}
const HollowDot = () => <span style={{ width: 9, height: 9, borderRadius: 99, border: "1.5px solid var(--border-strong)", flexShrink: 0 }} />;
const Conn = ({ on }) => <span style={{ width: 20, height: 2, background: on ? "var(--green)" : "var(--border-strong)", flexShrink: 0, opacity: on ? .55 : 1 }} />;

function StageFlowRow({ stages }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <HollowDot />
      {stages.map((s, i) => (
        <React.Fragment key={i}>
          <Conn on={s.status === "success" || s.status === "running" || s.status === "failed"} />
          <span title={`${s.name}${s.duration ? " · " + fmtDur(s.duration) : ""}`}><MatrixNode status={s.status} /></span>
        </React.Fragment>
      ))}
      <Conn on={stages.length > 0 && stages[stages.length - 1].status === "success"} />
      <HollowDot />
    </div>
  );
}

function runGroupLabel(startedAt) {
  const s = (startedAt || "").toLowerCase();
  if (s.includes("vừa") || s.includes("phút") || s.includes("giờ")) return "Hôm nay";
  if (s.includes("hôm qua")) return "Hôm qua";
  return "Trước đó";
}

function StageMatrix({ runs, stageNames, onOpen }) {
  if (!runs.length) {
    return <Card style={{ padding: 36, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>Chưa có lần chạy nào để hiển thị stage.</Card>;
  }
  const order = ["Hôm nay", "Hôm qua", "Trước đó"];
  const groups = {};
  runs.forEach((r) => { const g = runGroupLabel(r.startedAt); (groups[g] = groups[g] || []).push(r); });

  return (
    <div>
      {stageNames.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 4px 12px", marginLeft: 168, flexWrap: "wrap" }}>
          {stageNames.map((n, i) => (
            <span key={i} style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span className="mono" style={{ opacity: .6 }}>{i + 1}</span>{n}
            </span>
          ))}
        </div>
      )}
      {order.filter((g) => groups[g]).map((g) => (
        <div key={g} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 540, padding: "10px 4px 8px" }}>{g}</div>
          <Card pad={0} style={{ overflow: "hidden" }}>
            {groups[g].map((r, i) => (
              <button key={r.id} onClick={() => onOpen(r)}
                style={{ display: "flex", alignItems: "center", gap: 16, width: "100%", padding: "13px 16px", textAlign: "left",
                  borderBottom: i < groups[g].length - 1 ? "1px solid var(--border)" : "none", transition: "background .12s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, width: 152, flexShrink: 0 }}>
                  <StatusDot status={r.status} size={11} />
                  <div>
                    <div className="mono" style={{ fontSize: 13.5, fontWeight: 600 }}>#{r.number}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>{r.startedAt}{r.duration ? " · " + fmtDur(r.duration) : ""}</div>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}><StageFlowRow stages={r.stages} /></div>
              </button>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}

function PipelineDetail({ pipelineId, repos, onNav, onTriggerBuild, toast }) {
  const p = PIPELINES.find((x) => x.id === pipelineId);
  const [section, setSection] = useState("status");
  if (!p) return <Page><div style={{ color: "var(--text-3)" }}>Không tìm thấy pipeline.</div></Page>;
  const repo = repos.find((r) => r.id === p.repoId);
  const last = p.runs[0];
  const stageNames = p.stages || STAGE_PRESETS[p.preset] || [];
  const flowStages = last ? last.stages : stageNames.map((n) => ({ name: n, status: "queued", duration: 0 }));
  const openRun = (r) => onNav({ view: "run", pipelineId: p.id, runId: r.id });
  const runBuild = () => { const id = onTriggerBuild(p.id); onNav({ view: "run", pipelineId: p.id, runId: id, live: true }); };

  const lastSuccess = p.runs.find((r) => r.status === "success");
  const lastCompleted = p.runs.find((r) => r.status !== "running");

  const navItems = [
    { id: "status", label: "Trạng thái", icon: "file" },
    { id: "changes", label: "Thay đổi", icon: "code" },
    { id: "build", label: "Chạy pipeline", icon: "play", onClick: runBuild },
    { id: "configure", label: "Cấu hình", icon: "settings" },
    { id: "stages", label: "Các bước (Stages)", icon: "layers" },
    { id: "hook", label: "Nhật ký webhook", icon: "webhook" },
    { divider: true, id: "d1" },
    { id: "delete", label: "Xoá pipeline", icon: "trash", danger: true, onClick: () => toast(`Xác nhận xoá pipeline ${p.title}?`, "info") },
  ];

  return (
    <Page full>
      <PageHeader icon="pipeline" title={p.title}
        breadcrumb={[{ label: "Pipeline", to: { view: "pipelines" } }, { label: repo?.name, to: { view: "repo", repoId: repo?.id }, mono: true }, { label: p.name, mono: true }]} onNav={onNav}
        subtitle={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="github" size={13} /><span className="mono" style={{ fontSize: 12.5 }}>{repo?.fullName} · {p.path || ".github/workflows/" + p.name}</span></span>}
        actions={<Button variant="primary" icon="play" onClick={runBuild}>Chạy pipeline</Button>} />

      <div style={{ display: "grid", gridTemplateColumns: "236px 1fr", gap: 20, alignItems: "start" }}>
        {/* Left column: sub-nav + builds */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 16 }}>
          <PipeSubNav items={navItems} active={section} onSelect={setSection} />
          <BuildsPanel runs={p.runs} onOpen={openRun} />
        </div>

        {/* Right column: content */}
        <div style={{ minWidth: 0 }}>
          {section === "status" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 8 }}>
                <StatusDot status={p.status} size={18} />
                <h2 style={{ fontSize: 24, fontWeight: 640, letterSpacing: "-.03em" }}>{p.title}</h2>
                <StatusBadge status={p.status} />
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 26 }}>
                Tên đầy đủ: <span className="mono">{repo?.fullName} · {p.name}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 26 }}>
                <MiniStat label="Tỉ lệ thành công" value={p.runs.length ? p.successRate + "%" : "—"} />
                <MiniStat label="Thời lượng TB" value={p.runs.length ? fmtDur(p.avgDuration) : "—"} />
                <MiniStat label="Tổng số build" value={p.runs.length} />
              </div>

              <SectionLabel style={{ marginBottom: 10 }}>Permalinks</SectionLabel>
              <Card pad={6} style={{ marginBottom: 26 }}>
                <PermalinkRow icon="clock" label="Build gần nhất" run={last} onOpen={openRun} />
                <PermalinkRow icon="checkCircle" label="Build thành công gần nhất" run={lastSuccess} onOpen={openRun} />
                <PermalinkRow icon="check" label="Build hoàn tất gần nhất" run={lastCompleted} onOpen={openRun} />
              </Card>

              <SectionLabel style={{ marginBottom: 12 }}>Sơ đồ các bước</SectionLabel>
              <Card>{last || stageNames.length ? <StageFlow stages={flowStages} /> : <span style={{ fontSize: 13, color: "var(--text-3)" }}>—</span>}</Card>
            </div>
          )}

          {section === "changes" && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 620, letterSpacing: "-.02em", marginBottom: 4 }}>Thay đổi</h2>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 18 }}>Commit gắn với từng lần chạy của pipeline.</div>
              {p.runs.length ? (
                <Card pad={0} style={{ overflow: "hidden" }}>
                  {p.runs.map((r, i) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 16px", borderBottom: i < p.runs.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <Avatar initials={r.avatar} size={26} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 540, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.message}</div>
                        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2, display: "flex", gap: 10 }}>
                          <span>{r.author}</span><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="branch" size={11} />{r.branch}</span>
                        </div>
                      </div>
                      <a href={repo ? `https://github.com/${repo.fullName}/commit/${r.commit}` : "#"} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className="mono" style={{ fontSize: 12.5, color: "var(--accent)" }}>{typeof r.commit === "string" ? r.commit.slice(0, 7) : r.commit}</a>
                      <button onClick={() => openRun(r)} className="mono tnum" style={{ fontSize: 12, color: "var(--text-3)" }}>#{r.number}</button>
                    </div>
                  ))}
                </Card>
              ) : <Card style={{ padding: 36, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>Chưa có thay đổi nào.</Card>}
            </div>
          )}

          {section === "configure" && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 620, letterSpacing: "-.02em", marginBottom: 18 }}>Cấu hình</h2>
              <Card style={{ marginBottom: 16 }}>
                <SectionLabel style={{ marginBottom: 14 }}>Nguồn</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 18 }}>
                  <Meta label="Repository" value={repo?.fullName} mono />
                  <Meta label="File workflow" value={p.path || ".github/workflows/" + p.name} mono />
                  <Meta label="Nhánh" value={<span className="mono">{p.branchFilter || repo?.mappedBranch || "main"}</span>} />
                  <Meta label="Nguồn parse" value={p.parsedFrom || "GitHub Actions"} />
                </div>
              </Card>
              <Card style={{ marginBottom: 16 }}>
                <SectionLabel style={{ marginBottom: 14 }}>Trigger</SectionLabel>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{p.triggers.map((t) => <Tag key={t} mono>{t}</Tag>)}</div>
              </Card>
              {p.env && Object.keys(p.env).length > 0 && (
                <Card>
                  <SectionLabel style={{ marginBottom: 14 }}>Biến môi trường</SectionLabel>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{Object.entries(p.env).map(([k, v]) => <Tag key={k} mono>{k}={v}</Tag>)}</div>
                </Card>
              )}
            </div>
          )}

          {section === "stages" && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 620, letterSpacing: "-.02em", marginBottom: 4 }}>Các bước (Stages)</h2>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 18 }}>Tiến trình stage của từng lần chạy, nhóm theo thời gian. Bấm một dòng để xem chi tiết.</div>
              <StageMatrix runs={p.runs} stageNames={stageNames} onOpen={openRun} />
            </div>
          )}

          {section === "hook" && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 620, letterSpacing: "-.02em", marginBottom: 18 }}>Lần GitHub Push gần nhất</h2>
              <Card style={{ background: "var(--code-bg)" }}>
                {last ? (
                  <div className="mono" style={{ fontSize: 12.5, lineHeight: 1.9, color: "var(--text-2)" }}>
                    <div>Bắt đầu lúc {last.startedAt} · build #{last.number}</div>
                    <div>Kích hoạt bởi sự kiện từ <span style={{ color: "var(--text)" }}>10.5.0.11</span> ⇒ <a href={repo ? `https://github.com/${repo.fullName}` : "#"} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>https://ci.fpt-cloud/github-webhook/</a></div>
                    <div style={{ color: "var(--text-3)" }}>Nhánh <span className="mono" style={{ color: "var(--text-2)" }}>{last.branch}</span> · commit {typeof last.commit === "string" ? last.commit.slice(0, 7) : last.commit}</div>
                    <div style={{ color: "var(--green)" }}>Tìm thấy thay đổi (Changes found)</div>
                    <div>Hoàn tất · Took 2 ms</div>
                  </div>
                ) : <div style={{ fontSize: 13, color: "var(--text-3)" }}>Chưa nhận được sự kiện push nào từ GitHub.</div>}
              </Card>
              <div style={{ margintop: 14 }} />
              <Card style={{ marginTop: 16 }}>
                <SectionLabel style={{ marginBottom: 12 }}>Cấu hình webhook</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 18 }}>
                  <Meta label="Payload URL" value="https://ci.fpt-cloud/github-webhook/" mono />
                  <Meta label="Sự kiện" value={<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{p.triggers.map((t) => <Tag key={t} mono>{t}</Tag>)}</div>} />
                </div>
                <button onClick={() => onNav({ view: "webhooks" })} style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 540, marginTop: 14 }}>Quản lý webhook →</button>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

function MiniStat({ label, value }) {
  return (
    <Card pad={15}>
      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 8, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.02em" }} className="tnum">{value}</div>
    </Card>
  );
}

function RunRow({ run: r, onClick, last }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 18px", cursor: "pointer",
      borderBottom: last ? "none" : "1px solid var(--border)", transition: "background .12s" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      <StatusDot status={r.status} size={9} />
      <span className="mono tnum" style={{ fontSize: 12.5, color: "var(--text-3)", width: 42 }}>#{r.number}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 540, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.message}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3, fontSize: 12, color: "var(--text-3)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="branch" size={11} />{r.branch}</span>
          <span className="mono">{typeof r.commit === "string" ? r.commit.slice(0, 7) : r.commit}</span>
          <Tag mono>{r.trigger}</Tag>
        </div>
      </div>
      <Avatar initials={r.avatar} size={24} />
      <span style={{ fontSize: 12, color: "var(--text-3)", width: 90, textAlign: "right" }}>{fmtDur(r.duration)}</span>
      <span style={{ fontSize: 12, color: "var(--text-3)", width: 92, textAlign: "right" }}>{r.startedAt}</span>
      <Icon name="chevronRight" size={16} style={{ color: "var(--text-3)" }} />
    </div>
  );
}

/* ---------------- Run detail — Pipeline Overview style ---------------- */
function RunDetail({ pipelineId, runId, live, repos, onNav, onRunComplete, toast }) {
  const p = PIPELINES.find((x) => x.id === pipelineId);
  const repo = repos.find((r) => r.id === p?.repoId);
  const baseRun = p?.runs.find((r) => r.id === runId);
  const stageNames = p ? (p.stages || STAGE_PRESETS[p.preset]) : [];
  const agent = "default-" + (runId || "x").replace(/[^a-z0-9]/gi, "").slice(-5).padStart(5, "x");

  const [stages, setStages] = useState(() => live ? stageNames.map((n) => ({ name: n, status: "queued", duration: 0 })) : baseRun?.stages || []);
  const [logsByStage, setLogsByStage] = useState({});
  const [status, setStatus] = useState(live ? "running" : baseRun?.status);
  const [elapsed, setElapsed] = useState(0);
  const [sel, setSel] = useState(0);
  const [section, setSection] = useState("status");
  const [autoscroll, setAutoscroll] = useState(true);
  const logRef = useRef(null);
  const followRef = useRef(true);

  // static per-stage logs for finished runs
  useEffect(() => {
    if (!live && baseRun) {
      const map = {};
      baseRun.stages.forEach((s, i) => {
        if (s.status === "skipped" || s.status === "queued") { map[i] = [{ level: "meta", text: "Stage bị bỏ qua." }]; return; }
        const lines = buildLogScript([s.name]).filter((l) => l.level !== "group");
        if (s.status === "failed") {
          lines.push({ level: "error", text: `✗ ${s.name} thất bại — exit code 1` });
          lines.push({ level: "error", text: "Pipeline dừng do stage thất bại." });
        } else { lines.push({ level: "ok", text: `✓ ${s.name} hoàn tất · ${fmtDur(s.duration)}` }); }
        map[i] = lines;
      });
      setLogsByStage(map);
      const failIdx = baseRun.stages.findIndex((s) => s.status === "failed");
      setSel(failIdx >= 0 ? failIdx : Math.max(0, baseRun.stages.filter((s) => s.status === "success").length - 1));
    }
  }, [live, runId]);

  // live streaming
  useEffect(() => {
    if (!live) return;
    let stageIdx = 0, lineQueue = [], done = false;
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    const startStage = (i) => {
      setStages((prev) => prev.map((s, idx) => idx === i ? { ...s, status: "running" } : s));
      if (followRef.current) setSel(i);
      const lines = buildLogScript([stageNames[i]]).filter((l) => l.level !== "group" && l.level !== "meta");
      lineQueue = [{ level: "meta", text: `Bắt đầu stage ${stageNames[i]} · agent ${agent}` }, ...lines];
      setLogsByStage((prev) => ({ ...prev, [i]: [] }));
    };
    const finishStage = (i) => {
      const dur = 6 + Math.floor(Math.random() * 24);
      setStages((prev) => prev.map((s, idx) => idx === i ? { ...s, status: "success", duration: dur } : s));
      setLogsByStage((prev) => ({ ...prev, [i]: [...(prev[i] || []), { level: "ok", text: `✓ ${stageNames[i]} hoàn tất · ${fmtDur(dur)}` }] }));
    };
    startStage(0);
    const drip = setInterval(() => {
      if (done) return;
      if (lineQueue.length > 0) {
        const line = lineQueue.shift();
        setLogsByStage((prev) => ({ ...prev, [stageIdx]: [...(prev[stageIdx] || []), line] }));
      } else {
        finishStage(stageIdx);
        stageIdx++;
        if (stageIdx >= stageNames.length) {
          done = true; clearInterval(drip); clearInterval(tick);
          setStatus("success");
          onRunComplete?.(pipelineId, runId, "success");
        } else { startStage(stageIdx); }
      }
    }, 520);
    return () => { clearInterval(drip); clearInterval(tick); };
  }, [live]);

  useEffect(() => { if (autoscroll && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logsByStage, sel, autoscroll]);

  if (!p || (!baseRun && !live)) return <Page><div style={{ color: "var(--text-3)" }}>Không tìm thấy lần chạy.</div></Page>;
  const run = baseRun || { number: "—", branch: "main", commit: "live", message: "Build thủ công", author: "you", avatar: "ME", trigger: "manual", startedAt: "vừa xong" };

  // prev/next build navigation
  const idx = p.runs.findIndex((r) => r.id === runId);
  const prevRun = idx >= 0 && idx < p.runs.length - 1 ? p.runs[idx + 1] : null; // older
  const nextRun = idx > 0 ? p.runs[idx - 1] : null; // newer
  const selStage = stages[sel];
  const selLogs = logsByStage[sel] || [];

  // derived timings
  const totalSec = (live || status === "running") ? elapsed : (run.duration || 0);
  const waitSec = Math.min(13, Math.max(2, Math.round(totalSec * 0.12)));
  const buildSec = Math.max(0, totalSec - waitSec);
  // flat console (all stages in order)
  const flatLogs = stages.flatMap((s, i) => {
    const head = { level: "group", text: `[Pipeline] { (${s.name})` };
    return [head, ...(logsByStage[i] || [])];
  });
  const runningIdx = stages.findIndex((s) => s.status === "running");

  const navItems = [
    { id: "status", label: "Trạng thái", icon: "file" },
    { id: "changes", label: "Thay đổi", icon: "code" },
    { id: "console", label: "Console Output", icon: "terminal" },
    { id: "timings", label: "Timings", icon: "clock" },
    { id: "overview", label: "Pipeline Overview", icon: "pipeline" },
    { divider: true, id: "d1" },
    { id: "rerun", label: "Chạy lại (Rerun)", icon: "refresh", onClick: () => toast("Đang chạy lại pipeline…", "info") },
    { id: "del", label: "Xoá build #" + run.number, icon: "trash", danger: true, onClick: () => toast(`Xác nhận xoá build #${run.number}?`, "info") },
  ];

  return (
    <Page full>
      <div style={{ marginBottom: 12 }}>
        <Breadcrumb items={[{ label: "Pipeline", to: { view: "pipelines" } }, { label: p.title, to: { view: "pipeline", pipelineId: p.id } }, { label: "#" + run.number, mono: true }]} onNav={onNav} />
      </div>

      {/* header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <StatusDot status={status} size={20} />
        <h1 className="mono" style={{ fontSize: 23, fontWeight: 680, letterSpacing: "-.02em" }}>#{run.number}</h1>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => prevRun && onNav({ view: "run", pipelineId: p.id, runId: prevRun.id })} disabled={!prevRun}
            title="Build trước" style={{ width: 30, height: 30, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", border: "1px solid var(--border)", background: "var(--panel)", color: prevRun ? "var(--text-2)" : "var(--text-3)", opacity: prevRun ? 1 : .4 }}><Icon name="chevronLeft" size={15} /></button>
          <button onClick={() => nextRun && onNav({ view: "run", pipelineId: p.id, runId: nextRun.id })} disabled={!nextRun}
            title="Build sau" style={{ width: 30, height: 30, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", border: "1px solid var(--border)", background: "var(--panel)", color: nextRun ? "var(--text-2)" : "var(--text-3)", opacity: nextRun ? 1 : .4 }}><Icon name="chevronRight" size={15} /></button>
        </div>
        <span style={{ fontSize: 13.5, color: "var(--text-3)" }}>{run.startedAt}</span>
        <div style={{ flex: 1 }} />
        {status === "running"
          ? <Button variant="danger" icon="x" onClick={() => toast("Đã yêu cầu huỷ pipeline", "info")}>Huỷ</Button>
          : <Button variant="primary" icon="refresh" onClick={() => toast("Đang chạy lại pipeline…", "info")}>Rerun</Button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "212px 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ position: "sticky", top: 16 }}><PipeSubNav items={navItems} active={section} onSelect={setSection} /></div>

        <div style={{ minWidth: 0 }}>
          {/* STATUS */}
          {section === "status" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 24 }}>
                <StatusDot status={status} size={18} />
                <h2 className="mono" style={{ fontSize: 21, fontWeight: 640, letterSpacing: "-.02em" }}>#{run.number}</h2>
                <StatusBadge status={status} />
                <div style={{ flex: 1 }} />
                <div style={{ textAlign: "right", fontSize: 12.5, color: "var(--text-3)" }}>
                  <div>Bắt đầu {run.startedAt}</div>
                  <div>Mất <span className="mono" style={{ color: "var(--text-2)" }}>{fmtDur(totalSec)}</span></div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                <div style={{ display: "flex", gap: 14 }}>
                  <Icon name="clock" size={20} style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 14 }}>{run.trigger === "manual" ? <>Chạy thủ công bởi <a style={{ color: "var(--accent)" }}>{run.author}</a></> : <>Kích hoạt bởi webhook GitHub · <span className="mono">{run.branch}</span></>}</div>
                </div>

                <div style={{ display: "flex", gap: 14 }}>
                  <Icon name="activity" size={20} style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 14, marginBottom: 8 }}>Lần chạy này mất:</div>
                    <ul style={{ listStyle: "disc", paddingLeft: 20, fontSize: 13.5, color: "var(--text-2)", display: "flex", flexDirection: "column", gap: 5 }}>
                      <li><span className="mono">{fmtDur(waitSec)}</span> chờ trong hàng đợi;</li>
                      <li><span className="mono">{fmtDur(buildSec)}</span> thời lượng build;</li>
                      <li><span className="mono">{fmtDur(totalSec)}</span> tổng từ lúc lên lịch đến khi hoàn tất.</li>
                    </ul>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 14 }}>
                  <Icon name="commit" size={20} style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
                    <div><b>Revision:</b> <span className="mono" style={{ color: "var(--text-2)" }}>{typeof run.commit === "string" ? run.commit : String(run.commit)}{typeof run.commit === "string" && run.commit.length < 12 ? "0c290876e6ece347bab5dee14d0eaefb".slice(0, 40 - run.commit.length) : ""}</span></div>
                    <div><b>Repository:</b> <a href={repo ? `https://github.com/${repo.fullName}.git` : "#"} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>https://github.com/{repo?.fullName}.git</a></div>
                    <ul style={{ listStyle: "disc", paddingLeft: 20, marginTop: 6, color: "var(--text-3)" }}><li className="mono">refs/remotes/origin/{run.branch}</li></ul>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 14 }}>
                  <Icon name="code" size={20} style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 14 }}>{run.message ? <><b>Thay đổi:</b> {run.message}</> : "Không có thay đổi."}</div>
                </div>
              </div>
            </div>
          )}

          {/* CHANGES */}
          {section === "changes" && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 620, letterSpacing: "-.02em", marginBottom: 18 }}>Thay đổi</h2>
              <Card pad={0} style={{ overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 16px" }}>
                  <Avatar initials={run.avatar} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 540 }}>{run.message}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2, display: "flex", gap: 10 }}><span>{run.author}</span><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="branch" size={11} />{run.branch}</span></div>
                  </div>
                  <a href={repo ? `https://github.com/${repo.fullName}/commit/${run.commit}` : "#"} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 12.5, color: "var(--accent)" }}>{typeof run.commit === "string" ? run.commit.slice(0, 7) : run.commit}</a>
                </div>
              </Card>
              <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 12 }}>Hiển thị commit kích hoạt lần chạy này. Diff chi tiết xem trên GitHub.</div>
            </div>
          )}

          {/* CONSOLE OUTPUT */}
          {section === "console" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <Icon name="terminal" size={20} style={{ color: "var(--accent)" }} />
                <h2 style={{ fontSize: 20, fontWeight: 620, letterSpacing: "-.02em" }}>Console Output</h2>
                {status === "running" && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--amber)" }}><span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--amber)", animation: "pulse-dot 1.1s infinite" }} />trực tiếp</span>}
                <div style={{ flex: 1 }} />
                <Button variant="ghost" size="sm" icon="download" onClick={() => toast("Đang tải logs…", "info")}>Tải xuống</Button>
                <Button variant="ghost" size="sm" icon="copy" onClick={() => toast("Đã sao chép logs", "success")}>Copy</Button>
              </div>
              <div ref={logRef} className="mono" style={{ background: "var(--code-bg)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)",
                padding: "14px 4px 14px 0", fontSize: 12.5, lineHeight: 1.7, maxHeight: 560, overflowY: "auto", scrollBehavior: "smooth" }}>
                <LogLine line={{ level: "meta", text: `Chạy bởi ${run.author}` }} n={0} />
                <LogLine line={{ level: "info", text: `Lấy cấu hình từ git https://github.com/${repo?.fullName}.git` }} n={1} />
                {flatLogs.map((l, i) => <LogLine key={i} line={l} n={i + 2} />)}
                {status === "running" && <div style={{ paddingLeft: 56, color: "var(--amber)" }}><span style={{ display: "inline-block", width: 8, height: 14, background: "var(--amber)", animation: "pulse-dot 1s steps(1) infinite", verticalAlign: "middle" }} /></div>}
              </div>
            </div>
          )}

          {/* TIMINGS */}
          {section === "timings" && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 620, letterSpacing: "-.02em", marginBottom: 18 }}>Timings</h2>
              <Card pad={0} style={{ overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", padding: "13px 18px", borderBottom: "1px solid var(--border)", fontSize: 12.5, fontWeight: 600, color: "var(--text-3)" }}>
                  <span /><span style={{ textAlign: "center" }}>Primary task</span><span style={{ textAlign: "center" }}>Including subtasks</span>
                </div>
                {[
                  ["In queue · Waiting", "1 ms", "1 ms"],
                  ["In queue · Blocked", "0 ms", "0 ms"],
                  ["In queue · Buildable", "0 ms", fmtDur(waitSec)],
                  ["In queue · Total", "4 ms", fmtDur(waitSec)],
                  ["Building", fmtDur(totalSec), fmtDur(buildSec)],
                  ["Scheduled to completion", "", fmtDur(totalSec)],
                  ["Number of subtasks", "", String(stages.length)],
                  ["Average executor utilization", "", "0.6"],
                ].map(([label, a, b], i, arr) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", padding: "12px 18px", alignItems: "center", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
                    <span style={{ color: "var(--text-2)" }}>{label}</span>
                    <span className="mono tnum" style={{ textAlign: "center", color: "var(--text)" }}>{a}</span>
                    <span className="mono tnum" style={{ textAlign: "center", color: "var(--text)" }}>{b}</span>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* PIPELINE OVERVIEW */}
          {section === "overview" && (
            <div>
              <Card style={{ marginBottom: 16 }}>
                <SectionLabel style={{ marginBottom: 16 }}>Graph</SectionLabel>
                <StageFlow stages={stages} />
              </Card>
              <div style={{ display: "grid", gridTemplateColumns: "248px 1fr", gap: 16, alignItems: "start" }}>
                <Card pad={6} style={{ overflow: "hidden" }}>
                  {stages.map((s, i) => {
                    const on = sel === i;
                    return (
                      <button key={i} onClick={() => { followRef.current = false; setSel(i); }}
                        style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "11px 12px", borderRadius: "var(--r-sm)", textAlign: "left",
                          background: on ? "var(--accent-dim)" : "transparent", transition: "background .12s" }}
                        onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--panel-2)"; }}
                        onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                        <MatrixNode status={s.status} />
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: on ? 600 : 500, color: on ? "var(--text)" : "var(--text-2)" }}>{s.name}</span>
                        <span className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>{s.status === "running" ? "…" : s.duration ? fmtDur(s.duration) : ""}</span>
                      </button>
                    );
                  })}
                </Card>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "var(--r-md) var(--r-md) 0 0", borderBottom: "none",
                    background: selStage && (selStage.status === "success" ? "var(--green-dim)" : selStage.status === "failed" ? "var(--red-dim)" : selStage.status === "running" ? "var(--amber-dim)" : "var(--panel)") }}>
                    <MatrixNode status={selStage?.status || "queued"} />
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{selStage?.name || "—"}</span>
                    <div style={{ flex: 1 }} />
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-3)" }}><Icon name="clock" size={13} />{selStage?.status === "running" ? fmtDur(elapsed) : selStage?.duration ? fmtDur(selStage.duration) : "—"}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-3)" }}><Icon name="cpu" size={13} /><span className="mono">{agent}</span></span>
                    <button onClick={() => toast("Đã sao chép logs", "success")} style={{ color: "var(--text-3)", padding: 3 }}><Icon name="copy" size={15} /></button>
                  </div>
                  <div ref={logRef} className="mono" style={{ background: "var(--code-bg)", border: "1px solid var(--border)", borderRadius: "0 0 var(--r-md) var(--r-md)",
                    padding: "12px 4px 12px 0", fontSize: 12.5, lineHeight: 1.7, maxHeight: 460, overflowY: "auto", scrollBehavior: "smooth" }}>
                    {selLogs.length ? selLogs.map((l, i) => <LogLine key={i} line={l} n={i} />)
                      : <div style={{ paddingLeft: 56, color: "var(--text-3)", fontSize: 12.5 }}>{selStage?.status === "queued" ? "Stage chưa chạy." : "Không có log."}</div>}
                    {status === "running" && sel === runningIdx && <div style={{ paddingLeft: 56, color: "var(--amber)" }}><span style={{ display: "inline-block", width: 8, height: 14, background: "var(--amber)", animation: "pulse-dot 1s steps(1) infinite", verticalAlign: "middle" }} /></div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, fontSize: 12, color: "var(--text-3)" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input type="checkbox" checked={autoscroll} onChange={(e) => setAutoscroll(e.target.checked)} style={{ accentColor: "var(--accent)" }} />Tự cuộn
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

function LogLine({ line, n }) {
  const colors = { meta: "var(--text-3)", cmd: "var(--accent)", info: "var(--text-2)", warn: "var(--amber)", error: "var(--red)", ok: "var(--green)", group: "var(--violet)" };
  if (line.level === "group") {
    return (
      <div style={{ display: "flex", gap: 0, padding: "6px 0 4px", marginTop: 4 }}>
        <span style={{ width: 50, textAlign: "right", paddingRight: 14, color: "var(--text-3)", opacity: .4, flexShrink: 0, userSelect: "none" }}>{n}</span>
        <span style={{ color: "var(--violet)", fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
          <Icon name="chevronDown" size={13} />▌ {line.text}
        </span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 0, padding: "0.5px 0" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in oklab, var(--text) 4%, transparent)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      <span style={{ width: 50, textAlign: "right", paddingRight: 14, color: "var(--text-3)", opacity: .4, flexShrink: 0, userSelect: "none" }}>{n}</span>
      <span style={{ color: colors[line.level] || "var(--text-2)", whiteSpace: "pre-wrap", wordBreak: "break-word", paddingRight: 14 }}>{line.text}</span>
    </div>
  );
}

export { PipelinesList, PipelineDetail, RunDetail, StageFlow, MiniStat };
