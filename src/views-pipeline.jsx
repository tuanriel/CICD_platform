import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Breadcrumb, Button, Card, Icon, Input, STATUS_META, SectionLabel, StatusBadge, StatusDot, Tag, fmtDur } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { EmptyConnectState } from './views-dashboard.jsx';
import { ApiPipelineCard, TriggerModal } from './views-repos.jsx';
import { listRepoPipelines } from './api/pipelines.js';
import { listBuilds, getBuildStats, getBuild, getBuildLogs, buildLogsDownloadUrl, getBuildStages, getStageLog, rerunBuild, deleteBuild } from './api/builds.js';

/* ============================================================
   Views — Pipelines list, Pipeline detail, Build detail
   Toàn bộ dữ liệu build là proxy real-time từ Jenkins (xem docs/api/builds.md):
   Jenkins không kết nối được → 502 UPSTREAM_ERROR trên mọi endpoint build.
   ============================================================ */

/* Jenkins build status → key trong STATUS_META */
const BUILD_STATUS_MAP = { success: "success", failure: "failed", running: "running", queued: "queued", aborted: "aborted", error: "failed" };
const mapBuildStatus = (s) => BUILD_STATUS_MAP[s] || "queued";

/* wfapi stage status → key trong STATUS_META */
const WF_STATUS_MAP = { SUCCESS: "success", FAILED: "failed", IN_PROGRESS: "running", ABORTED: "aborted", NOT_EXECUTED: "queued", UNSTABLE: "unstable" };
const mapStageStatus = (s) => WF_STATUS_MAP[s] || "queued";

const fmtMs = (ms) => (ms == null ? "—" : fmtDur(Math.round(ms / 1000)));
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const isJenkinsDown = (e) => e?.code === "UPSTREAM_ERROR";

/* Gọi GET /repositories/:id/pipelines cho từng repo đã map, gộp lại kèm repo context */
async function fetchAllPipelines(repos) {
  const lists = await Promise.all(repos.map((r) =>
    listRepoPipelines(r.id).then((data) => (data ?? []).map((p) => ({ ...p, repo: r }))).catch(() => [])
  ));
  return lists.flat();
}

/* Gọi GET /pipelines/:id/builds cho từng pipeline đã có sẵn (từ fetchAllPipelines), gộp lại kèm
   pipeline+repo context, sắp theo thời gian mới nhất. Jenkins chết → jenkinsDown=true, builds=[]. */
async function fetchBuildsForPipelines(pipelines) {
  if (pipelines.length === 0) return { builds: [], jenkinsDown: false };
  let jenkinsDown = false;
  const lists = await Promise.all(pipelines.map((p) =>
    listBuilds(p.id)
      .then((data) => (data ?? []).map((b) => ({ ...b, pipeline: p, repo: p.repo })))
      .catch((e) => { if (isJenkinsDown(e)) jenkinsDown = true; return []; })
  ));
  const builds = lists.flat().sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0));
  return { builds, jenkinsDown };
}

/* ---------------- Jenkins-unavailable strip ---------------- */
function JenkinsDownCard({ onRetry }) {
  return (
    <Card style={{ padding: 36, textAlign: "center" }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--amber-dim)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
        <Icon name="jenkins" size={24} style={{ color: "var(--amber)" }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Không kết nối được Jenkins</div>
      <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 420, margin: "0 auto 18px", lineHeight: 1.5 }}>
        Dữ liệu build được đọc trực tiếp từ Jenkins. Kiểm tra Jenkins server đang chạy rồi thử lại.
      </p>
      {onRetry && <Button variant="secondary" icon="refresh" onClick={onRetry}>Thử lại</Button>}
    </Card>
  );
}

/* ============================================================
   Pipelines list — dữ liệu thật, tổng hợp mọi repo
   ============================================================ */
function PipelinesList({ repos, account, onNav, toast }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggerTarget, setTriggerTarget] = useState(null);

  useEffect(() => {
    if (!account.connected || repos.length === 0) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchAllPipelines(repos).then((all) => { if (!cancelled) setItems(all); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [repos, account.connected]);

  async function refresh() {
    setLoading(true);
    try { setItems(await fetchAllPipelines(repos)); } finally { setLoading(false); }
  }

  if (!account.connected) {
    return <Page><PageHeader title="Pipeline" icon="pipeline" subtitle="Quản lý tập trung toàn bộ pipeline đã đồng bộ." /><EmptyConnectState onNav={onNav} /></Page>;
  }

  const filtered = items.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.repo.name.toLowerCase().includes(q.toLowerCase()) ||
    p.repo.fullName.toLowerCase().includes(q.toLowerCase()));

  return (
    <Page wide>
      <PageHeader title="Pipeline" icon="pipeline"
        subtitle="Toàn bộ pipeline được đồng bộ từ .viettelcloud/workflows/ trên các repository đã ánh xạ."
        actions={<>
          <Button variant="secondary" icon="refresh" loading={loading} onClick={refresh}>Tải lại</Button>
          <Button variant="primary" icon="plus" onClick={() => onNav({ view: "create-pipeline" })}>Đồng bộ pipeline</Button>
        </>} />

      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
        <Input value={q} onChange={setQ} placeholder="Tìm theo tên pipeline hoặc repository…" icon="search" full />
      </div>

      {loading ? (
        <Card style={{ padding: 44, textAlign: "center" }}>
          <Icon name="sync" size={22} style={{ color: "var(--text-3)", animation: "spin .7s linear infinite", margin: "0 auto 10px", display: "block" }} />
          <span style={{ fontSize: 13.5, color: "var(--text-3)" }}>Đang tải pipeline…</span>
        </Card>
      ) : repos.length === 0 ? (
        <Card style={{ padding: 48, textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="repo" size={24} style={{ color: "var(--text-3)" }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Chưa có repository nào được ánh xạ</div>
          <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 440, margin: "0 auto 20px", lineHeight: 1.5 }}>
            Pipeline được đồng bộ từ repository. Hãy thêm ít nhất một repository trước.
          </p>
          <Button variant="primary" icon="plus" onClick={() => onNav({ view: "repos" })}>Đến trang Repository</Button>
        </Card>
      ) : items.length === 0 ? (
        <Card style={{ padding: 48, textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="pipeline" size={24} style={{ color: "var(--text-3)" }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Chưa có pipeline nào</div>
          <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 440, margin: "0 auto 20px", lineHeight: 1.5 }}>
            Pipeline không tự sinh ra. Vào từng repository và bấm "Đồng bộ lại" để quét file <span className="mono">.viettelcloud/workflows/*.yaml</span>.
          </p>
          <Button variant="primary" icon="repo" onClick={() => onNav({ view: "repos" })}>Đến trang Repository</Button>
        </Card>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>Không tìm thấy pipeline nào.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((p) => (
            <ApiPipelineCard key={p.id} pipeline={p} repo={p.repo} onNav={onNav} onTrigger={setTriggerTarget} />
          ))}
        </div>
      )}

      <TriggerModal
        open={!!triggerTarget}
        onClose={() => setTriggerTarget(null)}
        pipeline={triggerTarget}
        defaultRef={triggerTarget?.repo?.syncBranch || triggerTarget?.repo?.defaultBranch || "main"}
        onTriggered={(build) => {
          refresh();
          if (build?.build_number > 0 && triggerTarget) onNav({ view: "run", pipelineId: triggerTarget.id, runId: build.build_number });
        }}
        toast={toast}
      />
    </Page>
  );
}

/* ---------------- Sub-nav (dùng chung cho pipeline detail & build detail) ---------------- */
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

function MiniStat({ label, value }) {
  return (
    <Card pad={15}>
      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 8, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.02em" }} className="tnum">{value}</div>
    </Card>
  );
}

/* ---------------- Builds panel (danh sách build từ Jenkins) ---------------- */
function BuildsPanel({ builds, onOpen, activeNumber }) {
  const [q, setQ] = useState("");
  const list = builds.filter((b) => ("#" + b.number).includes(q));
  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 14px 10px" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-.01em" }}>Builds</span>
        <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{builds.length}</span>
      </div>
      <div style={{ padding: "0 12px 10px" }}>
        <Input value={q} onChange={setQ} placeholder="Lọc theo số build…" icon="search" full />
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto", padding: "2px 8px 10px" }}>
        {list.length ? list.map((b) => {
          const on = activeNumber === b.number;
          return (
            <button key={b.number} onClick={() => onOpen(b)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 9px", borderRadius: "var(--r-sm)", textAlign: "left",
                background: on ? "var(--accent-dim)" : "transparent", transition: "background .12s" }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--panel-2)"; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
              <StatusDot status={mapBuildStatus(b.status)} size={9} />
              <span className="mono tnum" style={{ fontSize: 12.5, fontWeight: 560, width: 40 }}>#{b.number}</span>
              <span style={{ fontSize: 11.5, color: "var(--text-3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtTime(b.started_at)}</span>
              <Icon name="chevronRight" size={14} style={{ color: "var(--text-3)" }} />
            </button>
          );
        }) : <div style={{ padding: "16px 10px", fontSize: 12.5, color: "var(--text-3)", textAlign: "center" }}>Chưa có build nào.</div>}
      </div>
    </Card>
  );
}

function PermalinkRow({ icon, label, buildRef, onOpen }) {
  return (
    <button onClick={() => buildRef && onOpen(buildRef.number)} disabled={!buildRef}
      style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", width: "100%", textAlign: "left",
        borderRadius: "var(--r-sm)", cursor: buildRef ? "pointer" : "default", transition: "background .12s" }}
      onMouseEnter={(e) => { if (buildRef) e.currentTarget.style.background = "var(--panel-2)"; }}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      <Icon name={icon} size={15} style={{ color: "var(--text-3)", flexShrink: 0 }} />
      <span style={{ fontSize: 13.5, color: "var(--text-2)" }}>{label}</span>
      {buildRef ? <>
        <span className="mono" style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 560 }}>#{buildRef.number}</span>
        <span style={{ marginLeft: "auto" }}><StatusBadge status={mapBuildStatus(buildRef.status)} size="sm" /></span>
      </> : <span style={{ fontSize: 12.5, color: "var(--text-3)", marginLeft: "auto" }}>—</span>}
    </button>
  );
}

/* ============================================================
   Pipeline detail — stats + lịch sử build (Jenkins) + Jenkinsfile
   ============================================================ */
function PipelineDetail({ pipelineId, repos, onNav, toast }) {
  const [pipeline, setPipeline] = useState(null);
  const [plLoading, setPlLoading] = useState(true);
  const [builds, setBuilds] = useState([]);
  const [stats, setStats] = useState(null);
  const [buildsErr, setBuildsErr] = useState(null);
  const [buildsLoading, setBuildsLoading] = useState(true);
  const [section, setSection] = useState("status");
  const [triggerOpen, setTriggerOpen] = useState(false);

  // Không có GET /pipelines/:id — tìm pipeline qua danh sách pipeline của các repo đã map.
  useEffect(() => {
    let cancelled = false;
    setPlLoading(true);
    fetchAllPipelines(repos)
      .then((all) => { if (!cancelled) setPipeline(all.find((p) => p.id === pipelineId) || null); })
      .finally(() => { if (!cancelled) setPlLoading(false); });
    return () => { cancelled = true; };
  }, [pipelineId, repos]);

  const loadBuilds = useCallback(async () => {
    setBuildsLoading(true);
    try {
      const [b, s] = await Promise.all([listBuilds(pipelineId), getBuildStats(pipelineId)]);
      setBuilds(b ?? []);
      setStats(s);
      setBuildsErr(null);
    } catch (e) {
      setBuildsErr(e);
    } finally {
      setBuildsLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => { loadBuilds(); }, [loadBuilds]);

  if (plLoading) {
    return <Page><Card style={{ padding: 44, textAlign: "center" }}>
      <Icon name="sync" size={22} style={{ color: "var(--text-3)", animation: "spin .7s linear infinite", margin: "0 auto 10px", display: "block" }} />
      <span style={{ fontSize: 13.5, color: "var(--text-3)" }}>Đang tải pipeline…</span>
    </Card></Page>;
  }
  if (!pipeline) return <Page><div style={{ color: "var(--text-3)" }}>Không tìm thấy pipeline.</div></Page>;

  const repo = pipeline.repo;
  const openRun = (number) => onNav({ view: "run", pipelineId, runId: number });

  const navItems = [
    { id: "status", label: "Trạng thái", icon: "activity" },
    { id: "build", label: "Build pipeline", icon: "play", onClick: () => setTriggerOpen(true) },
  ];

  return (
    <Page full>
      <PageHeader icon="pipeline" title={pipeline.name}
        breadcrumb={[{ label: "Pipeline", to: { view: "pipelines" } }, { label: repo?.name, to: { view: "repo", repoId: repo?.id }, mono: true }, { label: pipeline.name, mono: true }]} onNav={onNav}
        subtitle={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="github" size={13} /><span className="mono" style={{ fontSize: 12.5 }}>{repo?.fullName} · {pipeline.file_path}</span></span>}
        actions={<>
          <Button variant="secondary" icon="refresh" loading={buildsLoading} onClick={loadBuilds}>Tải lại</Button>
          <Button variant="primary" icon="play" onClick={() => setTriggerOpen(true)}>Build</Button>
        </>} />

      <div style={{ display: "grid", gridTemplateColumns: "236px 1fr", gap: 20, alignItems: "start" }}>
        {/* Left: sub-nav + builds */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 16 }}>
          <PipeSubNav items={navItems} active={section} onSelect={setSection} />
          {!buildsErr && <BuildsPanel builds={builds} onOpen={(b) => openRun(b.number)} />}
        </div>

        {/* Right: content */}
        <div style={{ minWidth: 0 }}>
          {section === "status" && (
            buildsErr ? (isJenkinsDown(buildsErr)
              ? <JenkinsDownCard onRetry={loadBuilds} />
              : <Card style={{ padding: 36, textAlign: "center", color: "var(--red)", fontSize: 13.5 }}>{buildsErr.message || "Không tải được dữ liệu build."}</Card>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 8 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 640, letterSpacing: "-.03em" }}>{pipeline.name}</h2>
                  {pipeline.status !== "pending" && <StatusBadge status={pipeline.status === "error" ? "failed" : pipeline.status} />}
                </div>
                <div style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 26 }}>
                  <span className="mono">{repo?.fullName} · {pipeline.file_path}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 26 }}>
                  <MiniStat label="Tỉ lệ thành công" value={stats?.success_rate != null ? Math.round(stats.success_rate * 100) + "%" : "—"} />
                  <MiniStat label="Thời lượng TB" value={stats?.avg_duration_ms != null ? fmtMs(stats.avg_duration_ms) : "—"} />
                  <MiniStat label="Tổng số build" value={stats?.total_builds ?? 0} />
                </div>

                <SectionLabel style={{ marginBottom: 10 }}>Permalinks</SectionLabel>
                <Card pad={6} style={{ marginBottom: 26 }}>
                  <PermalinkRow icon="clock" label="Build gần nhất" buildRef={stats?.latest} onOpen={openRun} />
                  <PermalinkRow icon="checkCircle" label="Build thành công gần nhất" buildRef={stats?.latest_success} onOpen={openRun} />
                  <PermalinkRow icon="check" label="Build hoàn tất gần nhất" buildRef={stats?.latest_completed} onOpen={openRun} />
                </Card>

                <SectionLabel style={{ marginBottom: 10 }}>Lịch sử build</SectionLabel>
                {buildsLoading ? (
                  <Card style={{ padding: 30, textAlign: "center" }}>
                    <Icon name="sync" size={18} style={{ color: "var(--text-3)", animation: "spin .7s linear infinite", margin: "0 auto", display: "block" }} />
                  </Card>
                ) : builds.length === 0 ? (
                  <Card style={{ padding: 36, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>
                    Chưa có build nào — bấm <b>Build</b> để chạy lần đầu.
                  </Card>
                ) : (
                  <Card pad={0} style={{ overflow: "hidden" }}>
                    {builds.map((b, i) => (
                      <div key={b.number} onClick={() => openRun(b.number)}
                        style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 18px", cursor: "pointer",
                          borderBottom: i < builds.length - 1 ? "1px solid var(--border)" : "none", transition: "background .12s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <StatusDot status={mapBuildStatus(b.status)} size={9} />
                        <span className="mono tnum" style={{ fontSize: 13, fontWeight: 600, width: 52 }}>#{b.number}</span>
                        <StatusBadge status={mapBuildStatus(b.status)} size="sm" />
                        <div style={{ flex: 1 }} />
                        <span className="mono tnum" style={{ fontSize: 12.5, color: "var(--text-2)", width: 80, textAlign: "right" }}>
                          {b.status === "running" || b.status === "queued" ? "…" : fmtMs(b.duration_ms)}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-3)", width: 140, textAlign: "right" }}>{fmtTime(b.started_at)}</span>
                        <Icon name="chevronRight" size={15} style={{ color: "var(--text-3)" }} />
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            )
          )}

        </div>
      </div>

      <TriggerModal
        open={triggerOpen}
        onClose={() => setTriggerOpen(false)}
        pipeline={pipeline}
        defaultRef={repo?.syncBranch || repo?.defaultBranch || "main"}
        onTriggered={(build) => {
          loadBuilds();
          if (build?.build_number > 0) openRun(build.build_number);
        }}
        toast={toast}
      />
    </Page>
  );
}

/* ============================================================
   Build detail — trạng thái, console log, stages, timings (real-time từ Jenkins)
   ============================================================ */
function RunDetail({ pipelineId, runId, repos, onNav, toast }) {
  const number = Number(runId);
  const [pipeline, setPipeline] = useState(null);
  const [build, setBuild] = useState(null);
  const [stages, setStages] = useState([]);
  const [logs, setLogs] = useState(null);
  const [stageLogs, setStageLogs] = useState({});      // stageId -> text
  const [selStage, setSelStage] = useState(null);      // stage id
  const [section, setSection] = useState("status");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, tick] = useState(0);                        // re-render mỗi giây khi build đang chạy (elapsed)
  const logRef = useRef(null);
  const sectionRef = useRef(section);
  sectionRef.current = section;

  useEffect(() => {
    fetchAllPipelines(repos).then((all) => setPipeline(all.find((p) => p.id === pipelineId) || null));
  }, [pipelineId, repos]);

  const isLive = build && (build.status === "running" || build.status === "queued");

  const load = useCallback(async () => {
    try {
      const [b, st] = await Promise.all([
        getBuild(pipelineId, number),
        getBuildStages(pipelineId, number).catch(() => []),
      ]);
      setBuild(b);
      setStages(st ?? []);
      setErr(null);
      // console đang mở → cập nhật log cùng nhịp
      if (sectionRef.current === "console") {
        getBuildLogs(pipelineId, number).then(setLogs).catch(() => {});
      }
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [pipelineId, number]);

  useEffect(() => { setLoading(true); setLogs(null); setStageLogs({}); setSelStage(null); load(); }, [load]);

  // poll khi build đang chạy + tick cho elapsed
  useEffect(() => {
    if (!isLive) return;
    const poll = setInterval(load, 3000);
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => { clearInterval(poll); clearInterval(t); };
  }, [isLive, load]);

  // load console lần đầu khi mở section
  useEffect(() => {
    if (section === "console" && logs == null && build) {
      getBuildLogs(pipelineId, number).then(setLogs).catch((e) => setLogs(`(không tải được log: ${e.message})`));
    }
  }, [section, logs, build, pipelineId, number]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  async function openStage(id) {
    setSelStage(id);
    if (stageLogs[id] == null) {
      try {
        const text = await getStageLog(pipelineId, number, id);
        setStageLogs((m) => ({ ...m, [id]: text }));
      } catch (e) {
        setStageLogs((m) => ({ ...m, [id]: `(không tải được log stage: ${e.message})` }));
      }
    }
  }

  async function doRerun() {
    try {
      const b = await rerunBuild(pipelineId, number);
      toast?.(b?.build_number > 0 ? `Đã bắt đầu build #${b.build_number}` : "Build đã vào hàng đợi Jenkins", "success");
      if (b?.build_number > 0) onNav({ view: "run", pipelineId, runId: b.build_number });
    } catch (e) {
      toast?.(e.message || "Rerun thất bại", "error");
    }
  }

  async function doDelete() {
    try {
      await deleteBuild(pipelineId, number);
      toast?.(`Đã xoá build #${number} khỏi Jenkins`, "info");
      onNav({ view: "pipeline", pipelineId });
    } catch (e) {
      toast?.(e.message || "Xoá thất bại", "error");
    }
  }

  if (loading) {
    return <Page><Card style={{ padding: 44, textAlign: "center" }}>
      <Icon name="sync" size={22} style={{ color: "var(--text-3)", animation: "spin .7s linear infinite", margin: "0 auto 10px", display: "block" }} />
      <span style={{ fontSize: 13.5, color: "var(--text-3)" }}>Đang tải build #{number}…</span>
    </Card></Page>;
  }
  if (err) {
    return <Page>
      <div style={{ marginBottom: 16 }}>
        <Breadcrumb items={[{ label: "Pipeline", to: { view: "pipelines" } }, { label: pipeline?.name || "…", to: { view: "pipeline", pipelineId } }, { label: "#" + number, mono: true }]} onNav={onNav} />
      </div>
      {isJenkinsDown(err)
        ? <JenkinsDownCard onRetry={() => { setLoading(true); load(); }} />
        : <Card style={{ padding: 36, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>{err.message || "Không tìm thấy build."}</Card>}
    </Page>;
  }

  const status = mapBuildStatus(build.status);
  const elapsedMs = isLive && build.started_at ? Date.now() - Date.parse(build.started_at) : null;
  const durationMs = isLive ? elapsedMs : build.duration_ms;
  const t = build.timings;
  const selStageObj = stages.find((s) => s.id === selStage);

  const navItems = [
    { id: "status", label: "Trạng thái", icon: "activity" },
    { id: "console", label: "Console Output", icon: "terminal" },
    { id: "overview", label: "Các bước (Stages)", icon: "pipeline" },
    { id: "timings", label: "Timings", icon: "clock" },
    { divider: true, id: "d1" },
    { id: "rerun", label: "Chạy lại (Rerun)", icon: "refresh", onClick: doRerun },
    { id: "del", label: "Xoá build #" + number, icon: "trash", danger: true, onClick: () => setConfirmDelete(true) },
  ];

  return (
    <Page full>
      <div style={{ marginBottom: 12 }}>
        <Breadcrumb items={[{ label: "Pipeline", to: { view: "pipelines" } }, { label: pipeline?.name || "pipeline", to: { view: "pipeline", pipelineId } }, { label: "#" + number, mono: true }]} onNav={onNav} />
      </div>

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <StatusDot status={status} size={20} />
        <h1 className="mono" style={{ fontSize: 23, fontWeight: 680, letterSpacing: "-.02em" }}>#{number}</h1>
        <StatusBadge status={status} />
        <span style={{ fontSize: 13.5, color: "var(--text-3)" }}>{fmtTime(build.started_at)}</span>
        <div style={{ flex: 1 }} />
        <Button variant="primary" icon="refresh" onClick={doRerun}>Rerun</Button>
      </div>

      {/* confirm delete strip */}
      {confirmDelete && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", marginBottom: 18,
          background: "var(--red-dim)", border: "1px solid color-mix(in oklab, var(--red) 35%, transparent)",
          borderRadius: "var(--r-md)", fontSize: 13.5 }}>
          <Icon name="xCircle" size={18} style={{ color: "var(--red)", flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Xoá build #{number} khỏi Jenkins — <b>không khôi phục được</b>.</span>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Huỷ</Button>
          <Button variant="danger" onClick={doDelete}>Xác nhận xoá</Button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "212px 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ position: "sticky", top: 16 }}><PipeSubNav items={navItems} active={section} onSelect={setSection} /></div>

        <div style={{ minWidth: 0 }}>
          {/* STATUS */}
          {section === "status" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <StatusDot status={status} size={18} />
                <h2 className="mono" style={{ fontSize: 21, fontWeight: 640, letterSpacing: "-.02em" }}>#{number}</h2>
                <StatusBadge status={status} />
                <div style={{ flex: 1 }} />
                <div style={{ textAlign: "right", fontSize: 12.5, color: "var(--text-3)" }}>
                  <div>Bắt đầu {fmtTime(build.started_at)}</div>
                  <div>{isLive ? "Đang chạy" : "Mất"} <span className="mono" style={{ color: "var(--text-2)" }}>{fmtMs(durationMs)}</span>{isLive && build.estimated_ms > 0 && <> / ước lượng <span className="mono">{fmtMs(build.estimated_ms)}</span></>}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 14 }}>
                <Icon name="clock" size={20} style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 14 }}>
                  {build.trigger_type
                    ? <>Kích hoạt <span className="mono">{build.trigger_type}</span>{build.branch && <> · nhánh <span className="mono">{build.branch}</span></>}</>
                    : "Build được tạo ngoài platform (trực tiếp trên Jenkins)."}
                </div>
              </div>

              <div style={{ display: "flex", gap: 14 }}>
                <Icon name="commit" size={20} style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13.5, lineHeight: 1.7, minWidth: 0 }}>
                  <div><b>Revision:</b> <span className="mono" style={{ color: "var(--text-2)", wordBreak: "break-all" }}>{build.commit?.sha || "—"}</span></div>
                  {build.repo_url && <div><b>Repository:</b> <a href={build.repo_url.replace(/\.git$/, "")} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{build.repo_url}</a></div>}
                  {(build.commit?.message || build.commit?.author) && (
                    <div style={{ color: "var(--text-2)" }}>
                      {build.commit.message}{build.commit.author && <span style={{ color: "var(--text-3)" }}> — {build.commit.author}</span>}
                    </div>
                  )}
                </div>
              </div>

              {stages.length > 0 && (
                <div>
                  <SectionLabel style={{ marginBottom: 12 }}>Sơ đồ các bước</SectionLabel>
                  <Card><StageFlow stages={stages.map((s) => ({ name: s.name, status: mapStageStatus(s.status), duration: Math.round((s.duration_ms || 0) / 1000) }))} /></Card>
                </div>
              )}
            </div>
          )}

          {/* CONSOLE */}
          {section === "console" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <Icon name="terminal" size={20} style={{ color: "var(--accent)" }} />
                <h2 style={{ fontSize: 20, fontWeight: 620, letterSpacing: "-.02em" }}>Console Output</h2>
                {isLive && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--amber)" }}><span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--amber)", animation: "pulse-dot 1.1s infinite" }} />trực tiếp</span>}
                <div style={{ flex: 1 }} />
                <Button variant="ghost" size="sm" icon="download" onClick={() => window.open(buildLogsDownloadUrl(pipelineId, number), "_blank")}>Tải xuống</Button>
                <Button variant="ghost" size="sm" icon="copy" onClick={() => { navigator.clipboard?.writeText(logs || ""); toast?.("Đã sao chép logs", "success"); }}>Copy</Button>
              </div>
              <div ref={logRef} className="mono" style={{ background: "var(--code-bg)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)",
                padding: "14px 16px", fontSize: 12.5, lineHeight: 1.7, maxHeight: 560, overflowY: "auto", scrollBehavior: "smooth" }}>
                {logs == null
                  ? <div style={{ color: "var(--text-3)" }}>Đang tải log…</div>
                  : <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text-2)", fontFamily: "inherit" }}>{logs || "(log trống)"}</pre>}
                {isLive && <div style={{ color: "var(--amber)" }}><span style={{ display: "inline-block", width: 8, height: 14, background: "var(--amber)", animation: "pulse-dot 1s steps(1) infinite", verticalAlign: "middle" }} /></div>}
              </div>
            </div>
          )}

          {/* STAGES / OVERVIEW */}
          {section === "overview" && (
            <div>
              <Card style={{ marginBottom: 16 }}>
                <SectionLabel style={{ marginBottom: 16 }}>Graph</SectionLabel>
                {stages.length
                  ? <StageFlow stages={stages.map((s) => ({ name: s.name, status: mapStageStatus(s.status), duration: Math.round((s.duration_ms || 0) / 1000) }))} />
                  : <span style={{ fontSize: 13, color: "var(--text-3)" }}>Chưa có dữ liệu stage (build có thể đang khởi động).</span>}
              </Card>
              {stages.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "248px 1fr", gap: 16, alignItems: "start" }}>
                  <Card pad={6} style={{ overflow: "hidden" }}>
                    {stages.map((s) => {
                      const on = selStage === s.id;
                      const st = mapStageStatus(s.status);
                      return (
                        <button key={s.id} onClick={() => openStage(s.id)}
                          style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "11px 12px", borderRadius: "var(--r-sm)", textAlign: "left",
                            background: on ? "var(--accent-dim)" : "transparent", transition: "background .12s" }}
                          onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--panel-2)"; }}
                          onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                          <StatusDot status={st} size={10} />
                          <span style={{ flex: 1, fontSize: 13.5, fontWeight: on ? 600 : 500, color: on ? "var(--text)" : "var(--text-2)" }}>{s.name}</span>
                          <span className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>{st === "running" ? "…" : s.duration_ms ? fmtMs(s.duration_ms) : ""}</span>
                        </button>
                      );
                    })}
                  </Card>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "var(--r-md) var(--r-md) 0 0", borderBottom: "none", background: "var(--panel)" }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{selStageObj?.name || "Chọn một stage"}</span>
                      <div style={{ flex: 1 }} />
                      {selStageObj && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-3)" }}><Icon name="clock" size={13} />{fmtMs(selStageObj.duration_ms)}</span>}
                    </div>
                    <div className="mono" style={{ background: "var(--code-bg)", border: "1px solid var(--border)", borderRadius: "0 0 var(--r-md) var(--r-md)",
                      padding: "12px 16px", fontSize: 12.5, lineHeight: 1.7, maxHeight: 460, overflowY: "auto" }}>
                      {selStage == null
                        ? <span style={{ color: "var(--text-3)" }}>Bấm một stage bên trái để xem log.</span>
                        : stageLogs[selStage] == null
                          ? <span style={{ color: "var(--text-3)" }}>Đang tải log…</span>
                          : <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text-2)", fontFamily: "inherit" }}>{stageLogs[selStage] || "(log trống)"}</pre>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TIMINGS */}
          {section === "timings" && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 620, letterSpacing: "-.02em", marginBottom: 18 }}>Timings</h2>
              {t ? (
                <Card pad={0} style={{ overflow: "hidden" }}>
                  {[
                    ["Chờ trong hàng đợi (queue)", fmtMs(t.queue_ms)],
                    ["· Waiting", fmtMs(t.waiting_ms)],
                    ["· Blocked", fmtMs(t.blocked_ms)],
                    ["· Buildable", fmtMs(t.buildable_ms)],
                    ["Thời lượng build", fmtMs(t.build_ms)],
                    ["Tổng (lên lịch → hoàn tất)", fmtMs(t.total_ms)],
                    ["Số subtask", t.subtasks ?? "—"],
                    ["Executor utilization", t.executor_utilization ?? "—"],
                  ].map(([label, v], i, arr) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", padding: "12px 18px", alignItems: "center",
                      borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
                      <span style={{ color: "var(--text-2)" }}>{label}</span>
                      <span className="mono tnum" style={{ textAlign: "right", color: "var(--text)" }}>{v}</span>
                    </div>
                  ))}
                </Card>
              ) : (
                <Card style={{ padding: 36, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>
                  Không có dữ liệu timings (Jenkins thiếu plugin metrics, hoặc build chưa hoàn tất).
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

/* ---------------- Stage flow graph (dùng chung) ---------------- */
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
                  : s.status === "aborted" ? <Icon name="stop" size={13} />
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

export {
  PipelinesList, PipelineDetail, RunDetail, StageFlow, MiniStat,
  fetchAllPipelines, fetchBuildsForPipelines, JenkinsDownCard, mapBuildStatus, fmtMs, fmtTime, isJenkinsDown,
};
