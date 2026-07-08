import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Icon, Input, StatusBadge, StatusDot } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { EmptyConnectState } from './views-dashboard.jsx';
import { MiniStat, fetchAllPipelines, fetchBuildsForPipelines, JenkinsDownCard, mapBuildStatus, fmtMs, fmtTime } from './views-pipeline.jsx';
import { rerunBuild } from './api/builds.js';

/* ============================================================
   Views — Lịch sử build (tổng hợp build thật từ Jenkins, xuyên suốt mọi pipeline/repo)
   ============================================================ */

/* Lấy toàn bộ pipeline (mọi repo đã map) rồi GET /pipelines/:id/builds cho từng cái, gộp lại. */
async function fetchAllBuilds(repos) {
  const pipelines = await fetchAllPipelines(repos);
  const { builds, jenkinsDown } = await fetchBuildsForPipelines(pipelines);
  return { builds, pipelineCount: pipelines.length, jenkinsDown };
}

/* ---------------- Build history ---------------- */
function BuildHistory({ account, repos, onNav, toast }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [all, setAll] = useState([]);
  const [pipelineCount, setPipelineCount] = useState(0);
  const [jenkinsDown, setJenkinsDown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);

  const load = useCallback(() => {
    if (!account.connected || repos.length === 0) { setAll([]); setPipelineCount(0); setLoading(false); return; }
    setLoading(true);
    fetchAllBuilds(repos).then(({ builds, pipelineCount, jenkinsDown }) => {
      setAll(builds); setPipelineCount(pipelineCount); setJenkinsDown(jenkinsDown);
    }).finally(() => setLoading(false));
  }, [repos, account.connected]);

  useEffect(() => { load(); }, [load]);

  if (!account.connected) {
    return <Page><PageHeader title="Lịch sử build" icon="clock" subtitle="Toàn bộ lần chạy pipeline trên mọi repository." /><EmptyConnectState onNav={onNav} /></Page>;
  }

  const runs = all
    .filter((r) => statusFilter === "all" || mapBuildStatus(r.status) === statusFilter)
    .filter((r) => r.pipeline.name.toLowerCase().includes(q.toLowerCase())
      || r.repo.name.toLowerCase().includes(q.toLowerCase())
      || ("#" + r.number).includes(q));
  const selRun = runs.find((r) => r.pipeline.id + ":" + r.number === sel);

  const total = all.length;
  const success = all.filter((r) => r.status === "success").length;
  const failed = all.filter((r) => r.status === "failure" || r.status === "error").length;
  const running = all.filter((r) => r.status === "running" || r.status === "queued").length;
  const rate = success + failed ? Math.round((success / (success + failed)) * 100) : 100;

  const FILTERS = [["all", "Tất cả", total], ["success", "Thành công", success], ["failed", "Thất bại", failed], ["running", "Đang chạy", running]];
  const COLS = "34px 1.4fr .9fr 1.6fr 1fr 1.1fr";

  async function handleRerun() {
    if (!selRun) return;
    setRerunning(true);
    try {
      const b = await rerunBuild(selRun.pipeline.id, selRun.number);
      toast?.(b?.build_number > 0 ? `Đã bắt đầu build #${b.build_number}` : "Build đã vào hàng đợi Jenkins", "success");
      if (b?.build_number > 0) onNav({ view: "run", pipelineId: selRun.pipeline.id, runId: b.build_number });
      load();
    } catch (e) {
      toast?.(e.message || "Chạy lại thất bại", "error");
    } finally {
      setRerunning(false);
    }
  }

  return (
    <Page wide>
      <PageHeader title="Lịch sử build" icon="clock"
        subtitle="Toàn bộ lần build của mọi pipeline, đọc trực tiếp từ Jenkins."
        actions={<>
          <Button variant="secondary" icon="refresh" loading={loading} onClick={load}>Tải lại</Button>
          <Button variant="secondary" icon="terminal" disabled={!selRun} onClick={() => onNav({ view: "run", pipelineId: selRun.pipeline.id, runId: selRun.number })}>Xem chi tiết</Button>
          <Button variant="secondary" icon="refresh" loading={rerunning} disabled={!selRun} onClick={handleRerun}>Chạy lại</Button>
        </>} />

      {jenkinsDown ? (
        <JenkinsDownCard onRetry={load} />
      ) : (
        <>
          {/* stat strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
            <MiniStat label="Tổng số lần chạy" value={total} />
            <MiniStat label="Tỉ lệ thành công" value={rate + "%"} />
            <MiniStat label="Thất bại" value={failed} />
            <MiniStat label="Đang chạy" value={running} />
          </div>

          {/* search + filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
            <Input value={q} onChange={setQ} placeholder="Tìm theo pipeline, repository, #build…" icon="search" full />
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

          {loading ? (
            <Card style={{ padding: 44, textAlign: "center" }}>
              <Icon name="sync" size={22} style={{ color: "var(--text-3)", animation: "spin .7s linear infinite", margin: "0 auto 10px", display: "block" }} />
              <span style={{ fontSize: 13.5, color: "var(--text-3)" }}>Đang tải lịch sử build…</span>
            </Card>
          ) : repos.length === 0 || pipelineCount === 0 ? (
            <Card style={{ padding: 48, textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                <Icon name="clock" size={24} style={{ color: "var(--text-3)" }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Chưa có pipeline nào</div>
              <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.5 }}>
                Lịch sử build cần ít nhất một pipeline đã đồng bộ. Vào trang Repository để thêm và đồng bộ.
              </p>
              <Button variant="primary" icon="pipeline" onClick={() => onNav({ view: "pipelines" })}>Tới Pipeline</Button>
            </Card>
          ) : runs.length === 0 ? (
            <Card style={{ padding: 48, textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                <Icon name="clock" size={24} style={{ color: "var(--text-3)" }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{total === 0 ? "Chưa có lần build nào" : "Không tìm thấy build nào"}</div>
              <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.5 }}>
                {total === 0 ? "Lịch sử build sẽ xuất hiện ở đây sau khi bạn bấm Build ở một pipeline." : "Thử đổi từ khoá tìm kiếm hoặc bộ lọc trạng thái."}
              </p>
              {total === 0 && <Button variant="primary" icon="pipeline" onClick={() => onNav({ view: "pipelines" })}>Tới Pipeline</Button>}
            </Card>
          ) : (
            <Card pad={0} style={{ overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "11px 18px", borderBottom: "1px solid var(--border)",
                fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-3)" }}>
                <span /><span>Build</span><span>Trạng thái</span><span>Pipeline</span><span>Thời lượng</span><span style={{ textAlign: "right" }}>Bắt đầu</span>
              </div>
              {runs.map((r, i) => {
                const key = r.pipeline.id + ":" + r.number;
                const isSel = sel === key;
                const st = mapBuildStatus(r.status);
                const isLive = r.status === "running" || r.status === "queued";
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
                    <button onClick={(e) => { e.stopPropagation(); onNav({ view: "run", pipelineId: r.pipeline.id, runId: r.number }); }}
                      style={{ textAlign: "left", overflow: "hidden", display: "flex", alignItems: "center", gap: 9 }}>
                      <StatusDot status={st} size={9} />
                      <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>#{r.number}</span>
                    </button>
                    <span><StatusBadge status={st} size="sm" /></span>
                    <button onClick={(e) => { e.stopPropagation(); onNav({ view: "pipeline", pipelineId: r.pipeline.id }); }} style={{ textAlign: "left", overflow: "hidden" }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 540, color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pipeline.name}</span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{r.repo.name}</span>
                    </button>
                    <span className="mono tnum" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{isLive ? "…" : fmtMs(r.duration_ms)}</span>
                    <span style={{ fontSize: 12, color: "var(--text-3)", textAlign: "right" }}>{isLive ? "đang chạy" : fmtTime(r.started_at)}</span>
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}
    </Page>
  );
}

export { BuildHistory };
