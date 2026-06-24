import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PIPELINES } from './data.jsx';
import { Avatar, Button, Card, Icon, Input, StatusBadge, StatusDot, fmtDur } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { EmptyConnectState } from './views-dashboard.jsx';
import { MiniStat } from './views-pipeline.jsx';

/* ============================================================
   Views — Lịch sử build (tổng hợp toàn bộ lần chạy pipeline)
   + Meta (dùng chung cho pipeline-create)
   ============================================================ */

/* ---------------- Meta grid cell ---------------- */
function Meta({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 5, fontWeight: 500 }}>{label}</div>
      <div className={mono ? "mono" : ""} style={{ fontSize: 13.5, fontWeight: 540, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

/* ---------------- Aggregate all pipeline runs ---------------- */
function allPipelineRuns(repos) {
  return PIPELINES.flatMap((p) => {
    const repo = repos.find((r) => r.id === p.repoId);
    return p.runs.map((r) => ({ ...r, pipeline: p, repo }));
  }).filter((r) => r.repo);
}

/* ---------------- Build history ---------------- */
function BuildHistory({ account, repos, onNav, toast }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  if (!account.connected) {
    return <Page><PageHeader title="Lịch sử build" icon="clock" subtitle="Toàn bộ lần chạy pipeline trên mọi repository." /><EmptyConnectState onNav={onNav} /></Page>;
  }

  const all = allPipelineRuns(repos);
  const runs = all
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .filter((r) => r.pipeline.title.toLowerCase().includes(q.toLowerCase())
      || r.repo.name.toLowerCase().includes(q.toLowerCase())
      || (r.author || "").toLowerCase().includes(q.toLowerCase())
      || (r.message || "").toLowerCase().includes(q.toLowerCase())
      || ("#" + r.number).includes(q));
  const selRun = runs.find((r) => r.pipeline.id + ":" + r.id === sel);

  const total = all.length;
  const success = all.filter((r) => r.status === "success").length;
  const failed = all.filter((r) => r.status === "failed").length;
  const running = all.filter((r) => r.status === "running").length;
  const rate = success + failed ? Math.round((success / (success + failed)) * 100) : 100;

  const FILTERS = [["all", "Tất cả", total], ["success", "Thành công", success], ["failed", "Thất bại", failed], ["running", "Đang chạy", running]];
  const COLS = "34px 1.5fr .9fr 1.2fr .8fr 1fr .7fr .9fr";

  return (
    <Page wide>
      <PageHeader title="Lịch sử build" icon="clock"
        subtitle="Toàn bộ lần chạy của mọi pipeline — trạng thái, người kích hoạt, thời lượng."
        actions={<>
          <Button variant="secondary" icon="terminal" disabled={!selRun} onClick={() => onNav({ view: "run", pipelineId: selRun.pipeline.id, runId: selRun.id })}>Xem chi tiết</Button>
          <Button variant="secondary" icon="refresh" disabled={!selRun} onClick={() => toast("Đang chạy lại pipeline…", "info")}>Chạy lại</Button>
        </>} />

      {/* stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
        <MiniStat label="Tổng số lần chạy" value={total} />
        <MiniStat label="Tỉ lệ thành công" value={rate + "%"} />
        <MiniStat label="Thất bại" value={failed} />
        <MiniStat label="Đang chạy" value={running} />
      </div>

      {/* search + filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Input value={q} onChange={setQ} placeholder="Tìm theo pipeline, repository, người chạy…" icon="search" full />
        <div style={{ display: "flex", gap: 4, background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: 3 }}>
          {FILTERS.map(([id, label, n]) => {
            const on = statusFilter === id;
            return (
              <button key={id} onClick={() => setStatusFilter(id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 6, fontSize: 12.5, fontWeight: 540,
                  background: on ? "var(--panel)" : "transparent", color: on ? "var(--text)" : "var(--text-3)", boxShadow: on ? "var(--shadow-sm)" : "none", whiteSpace: "nowrap" }}>
                {label}<span className="mono" style={{ fontSize: 11, color: on ? "var(--accent)" : "var(--text-3)" }}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {runs.length === 0 ? (
        <Card style={{ padding: 48, textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="clock" size={24} style={{ color: "var(--text-3)" }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Chưa có lần chạy nào</div>
          <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.5 }}>
            Lịch sử build sẽ xuất hiện ở đây sau khi pipeline được chạy — kích hoạt bằng webhook hoặc thủ công.
          </p>
          <Button variant="primary" icon="pipeline" onClick={() => onNav({ view: "pipelines" })}>Tới Pipeline</Button>
        </Card>
      ) : (
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "11px 18px", borderBottom: "1px solid var(--border)",
            fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-3)" }}>
            <span /><span>Lần chạy</span><span>Trạng thái</span><span>Pipeline</span><span>Nhánh</span><span>Người chạy</span><span>Thời lượng</span><span style={{ textAlign: "right" }}>Bắt đầu</span>
          </div>
          {runs.map((r, i) => {
            const key = r.pipeline.id + ":" + r.id;
            const isSel = sel === key;
            return (
              <div key={key} onClick={() => setSel(isSel ? null : key)}
                style={{ display: "grid", gridTemplateColumns: COLS, padding: "13px 18px", alignItems: "center",
                  cursor: "pointer", borderBottom: i < runs.length - 1 ? "1px solid var(--border)" : "none",
                  background: isSel ? "var(--accent-dim)" : "transparent", transition: "background .12s" }}
                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--panel-2)"; }}
                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ width: 17, height: 17, borderRadius: 99, border: `1.5px solid ${isSel ? "var(--accent)" : "var(--border-strong)"}`, display: "grid", placeItems: "center" }}>
                  {isSel && <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--accent)" }} />}
                </span>
                <button onClick={(e) => { e.stopPropagation(); onNav({ view: "run", pipelineId: r.pipeline.id, runId: r.id }); }}
                  style={{ textAlign: "left", overflow: "hidden", display: "flex", alignItems: "center", gap: 9 }}>
                  <StatusDot status={r.status} size={9} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)" }}>#{r.number}</span>
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{r.message}</span>
                  </span>
                </button>
                <span><StatusBadge status={r.status} size="sm" /></span>
                <button onClick={(e) => { e.stopPropagation(); onNav({ view: "pipeline", pipelineId: r.pipeline.id }); }} style={{ textAlign: "left", overflow: "hidden" }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 540, color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pipeline.title}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{r.repo.name}</span>
                </button>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-2)", overflow: "hidden" }}><Icon name="branch" size={12} style={{ flexShrink: 0 }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.branch}</span></span>
                <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text-2)", overflow: "hidden" }}><Avatar initials={r.avatar} size={20} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.author}</span></span>
                <span className="mono tnum" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{r.status === "running" ? "…" : fmtDur(r.duration)}</span>
                <span style={{ fontSize: 12, color: "var(--text-3)", textAlign: "right" }}>{r.status === "running" ? "đang chạy" : r.startedAt}</span>
              </div>
            );
          })}
        </Card>
      )}
    </Page>
  );
}

export { BuildHistory, Meta, allPipelineRuns };
