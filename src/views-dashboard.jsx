import React, { useState, useEffect } from 'react';
import { WEBHOOK_EVENTS } from './data.jsx';
import { Avatar, Button, Card, Icon, Input, SectionLabel, StatusBadge, StatusDot, Tag } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { fetchAllPipelines, fetchBuildsForPipelines, mapBuildStatus, fmtTime } from './views-pipeline.jsx';
import { createSourceProvider } from './api/source-providers.js';

const API_ERROR_MESSAGES = {
  INVALID_TOKEN:      "Token không hợp lệ hoặc đã hết hạn",
  INSUFFICIENT_SCOPE: "Token thiếu quyền repo",
  MAPPING_EXISTS:     "Tài khoản này đã được liên kết",
  UPSTREAM_ERROR:     "Không kết nối được GitHub",
  NETWORK_ERROR:      "Không thể kết nối tới server",
};

/* ============================================================
   Views — Dashboard + GitHub connect
   ============================================================ */

function StatCard({ label, value, sub, icon, accent, delay = 0 }) {
  return (
    <Card pad={18}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <SectionLabel>{label}</SectionLabel>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: accent ? "var(--accent-dim)" : "var(--panel-2)",
          display: "grid", placeItems: "center", color: accent ? "var(--accent)" : "var(--text-2)" }}>
          <Icon name={icon} size={16} />
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 660, letterSpacing: "-.03em", lineHeight: 1 }} className="tnum">{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 7 }}>{sub}</div>}
    </Card>
  );
}

function Dashboard({ repos, account, onNav }) {
  const [pipelines, setPipelines] = useState([]);
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jenkinsDown, setJenkinsDown] = useState(false);

  useEffect(() => {
    if (!account.connected || repos.length === 0) { setPipelines([]); setBuilds([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchAllPipelines(repos).then(async (pls) => {
      if (cancelled) return;
      setPipelines(pls);
      const { builds, jenkinsDown } = await fetchBuildsForPipelines(pls);
      if (!cancelled) { setBuilds(builds); setJenkinsDown(jenkinsDown); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [repos, account.connected]);

  if (!account.connected) {
    return (
      <Page>
        <PageHeader title="Tổng quan" subtitle="Bảng điều khiển trung tâm cho toàn bộ luồng CI/CD của bạn." icon="dashboard" />
        <EmptyConnectState onNav={onNav} />
      </Page>
    );
  }

  const recent = builds.slice(0, 7);
  const running = builds.filter((b) => b.status === "running" || b.status === "queued").length;
  const success = builds.filter((b) => b.status === "success").length;
  const failed = builds.filter((b) => b.status === "failure" || b.status === "error").length;
  const rate = success + failed ? Math.round((success / (success + failed)) * 100) : 100;

  // build gần nhất theo từng pipeline (builds đã sắp mới nhất trước)
  const latestByPipeline = {};
  for (const b of builds) { if (!latestByPipeline[b.pipeline.id]) latestByPipeline[b.pipeline.id] = b; }

  return (
    <Page wide>
      <PageHeader title="Tổng quan" icon="dashboard"
        subtitle={<>Xin chào <b style={{ color: "var(--text)" }}>{account.username}</b>, đây là tình hình pipeline hôm nay.</>}
        actions={<><Button variant="secondary" icon="clock" onClick={() => onNav({ view: "build-history" })}>Lịch sử build</Button><Button variant="primary" icon="plus" onClick={() => onNav({ view: "create-pipeline" })}>Tạo pipeline</Button></>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
        <StatCard label="Pipeline" value={loading ? "…" : pipelines.length} sub={`${repos.length} repository được ánh xạ`} icon="pipeline" />
        <StatCard label="Đang chạy" value={loading ? "…" : jenkinsDown ? "—" : running} sub={jenkinsDown ? "Jenkins không phản hồi" : running ? "Pipeline đang thực thi" : "Không có lần chạy nào"} icon="activity" accent />
        <StatCard label="Tỉ lệ thành công" value={loading ? "…" : jenkinsDown ? "—" : rate + "%"} sub="Toàn bộ lần chạy gần đây" icon="checkCircle" />
        <StatCard label="Thất bại" value={loading ? "…" : jenkinsDown ? "—" : failed} sub="Cần chú ý" icon="xCircle" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Recent runs */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: "-.02em" }}>Lần chạy gần đây</div>
            <button onClick={() => onNav({ view: "build-history" })} style={{ fontSize: 12.5, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4, fontWeight: 540 }}>Tất cả <Icon name="arrowRight" size={13} /></button>
          </div>
          <div>
            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                <Icon name="sync" size={18} style={{ animation: "spin .7s linear infinite", margin: "0 auto 8px", display: "block" }} />Đang tải…
              </div>
            ) : jenkinsDown ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--amber)", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Icon name="jenkins" size={20} />Không kết nối được Jenkins
              </div>
            ) : recent.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Chưa có lần build nào.</div>
            ) : recent.map((b) => {
              const st = mapBuildStatus(b.status);
              const isLive = b.status === "running" || b.status === "queued";
              return (
                <div key={b.pipeline.id + ":" + b.number} onClick={() => onNav({ view: "run", pipelineId: b.pipeline.id, runId: b.number })}
                  style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 18px", cursor: "pointer",
                    borderBottom: "1px solid var(--border)", transition: "background .12s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <StatusDot status={st} size={9} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 540, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.pipeline.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 3, fontSize: 12, color: "var(--text-3)" }}>
                      <span className="mono">{b.repo.name}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 500 }}>#{b.number}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{isLive ? "đang chạy" : fmtTime(b.started_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: "-.02em" }}>Pipeline</div>
              <button onClick={() => onNav({ view: "pipelines" })} style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 540 }}>Quản lý</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {loading ? (
                <div style={{ padding: "10px 8px", color: "var(--text-3)", fontSize: 13 }}>Đang tải…</div>
              ) : pipelines.length === 0 ? (
                <div style={{ padding: "10px 8px", color: "var(--text-3)", fontSize: 13 }}>Chưa có pipeline nào.</div>
              ) : pipelines.slice(0, 5).map((p) => {
                const lastBuild = latestByPipeline[p.id];
                return (
                  <div key={p.id} onClick={() => onNav({ view: "pipeline", pipelineId: p.id })}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", margin: "0 -8px", borderRadius: "var(--r-sm)", cursor: "pointer", transition: "background .12s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <Icon name="pipeline" size={15} style={{ color: "var(--text-3)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 540, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{p.repo.name}</div>
                    </div>
                    {lastBuild ? <StatusDot status={mapBuildStatus(lastBuild.status)} size={8} /> : <span style={{ fontSize: 11, color: "var(--text-3)" }}>—</span>}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: "-.02em", marginBottom: 14 }}>Tích hợp</div>
            <IntegrationRow icon="github" name="GitHub (PAT)" detail={account.username} status="connected" onNav={() => onNav({ view: "pat" })} />
            <IntegrationRow icon="webhook" name="Webhook" detail={`${WEBHOOK_EVENTS.filter(e=>e.enabled).length} sự kiện bật`} status="connected" onNav={() => onNav({ view: "webhooks" })} last />
          </Card>
        </div>
      </div>
    </Page>
  );
}

function IntegrationRow({ icon, name, detail, status, onNav, last }) {
  return (
    <div onClick={onNav} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 0",
      borderBottom: last ? "none" : "1px solid var(--border)", cursor: "pointer" }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--text)" }}>
        <Icon name={icon} size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 540 }}>{name}</div>
        <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</div>
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--green)" }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--green)" }} />Hoạt động
      </span>
    </div>
  );
}

function EmptyConnectState({ onNav }) {
  return (
    <Card pad={0} style={{ overflow: "hidden", marginTop: 8 }}>
      <div style={{ padding: "48px 40px", textAlign: "center", background: "radial-gradient(120% 100% at 50% 0%, var(--panel-2), var(--panel))" }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: "var(--panel)", border: "1px solid var(--border-strong)",
          display: "grid", placeItems: "center", margin: "0 auto 20px", color: "var(--text)" }}>
          <Icon name="github" size={30} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 640, letterSpacing: "-.02em", marginBottom: 8 }}>Bắt đầu với CICD Platform</h2>
        <p style={{ fontSize: 14, color: "var(--text-2)", maxWidth: 440, margin: "0 auto 24px", lineHeight: 1.55 }}>
          Kết nối tài khoản GitHub qua Personal Access Token để đồng bộ Pipeline từ thư mục <span className="mono" style={{ color: "var(--text)" }}>.viettelcloud/workflows</span> và bắt đầu tự động hóa.
        </p>
        <Button variant="primary" size="lg" icon="link" onClick={() => onNav({ view: "github" })}>Kết nối GitHub</Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: "1px solid var(--border)" }}>
        {[
          { i: "key", t: "1 · Liên kết token", d: "Dán Personal Access Token để uỷ quyền truy cập." },
          { i: "repo", t: "2 · Ánh xạ repository", d: "Chọn repo và nhánh để đồng bộ." },
          { i: "pipeline", t: "3 · Đồng bộ & chạy pipeline", d: "Parse GitHub Actions thành pipeline và chạy tự động." },
        ].map((s, i) => (
          <div key={i} style={{ padding: "20px 22px", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
            <Icon name={s.i} size={18} style={{ color: "var(--accent)", marginBottom: 10 }} />
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{s.t}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.45 }}>{s.d}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- GitHub connect flow ---------------- */
function GitHubConnect({ account, onConnect, onDisconnect, onNav, toast }) {
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const valid = token.trim().startsWith("ghp_") && token.trim().length >= 20;

  async function doConnect() {
    if (!valid) return;
    setConnecting(true);
    try {
      const data = await createSourceProvider({ provider_type: "github", access_token: token.trim() });
      onConnect(data);
    } catch (err) {
      toast?.(API_ERROR_MESSAGES[err.code] || err.message || "Kết nối thất bại", "error");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Page>
      <PageHeader title="Kết nối GitHub" icon="github"
        subtitle="Liên kết tài khoản GitHub với nền tảng thông qua Personal Access Token (PAT)."
        breadcrumb={[{ label: "Tổng quan", to: { view: "dashboard" } }, { label: "Kết nối GitHub" }]} onNav={onNav} />

      {account.connected ? (
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 18, borderBottom: "1px solid var(--border)", marginBottom: 18 }}>
              <Avatar initials={account.avatar} size={52} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16.5, fontWeight: 620, letterSpacing: "-.02em" }}>{account.name || account.username}</div>
                <div style={{ fontSize: 13, color: "var(--text-2)" }}>@{account.username}{account.email ? ` · ${account.email}` : ""}</div>
              </div>
              <StatusBadge status="active" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Token" value={account.tokenName} mono />
              <Field label="Hết hạn" value="90 ngày (còn 71 ngày)" />
              <Field label="Phạm vi (scopes)" value={<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{account.scopes.map((s) => <Tag key={s} mono icon="check">{s}</Tag>)}</div>} span />
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
              <Button variant="secondary" icon="refresh">Làm mới token</Button>
              <Button variant="danger" icon="logout" onClick={onDisconnect}>Ngắt kết nối</Button>
            </div>
          </Card>
          <Card>
            <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 14, letterSpacing: "-.02em" }}>Quyền truy cập</div>
            {[["repo", "Đọc/ghi repository", true], ["admin:repo_hook", "Quản lý webhook", true], ["read:org", "Đọc thông tin tổ chức", true], ["workflow", "Cập nhật workflow", false]].map(([s, d, on], i) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
                <Icon name={on ? "checkCircle" : "xCircle"} size={17} style={{ color: on ? "var(--green)" : "var(--text-3)" }} strokeWidth={2} />
                <div style={{ flex: 1 }}>
                  <div className="mono" style={{ fontSize: 12.5, color: "var(--text)" }}>{s}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{d}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, alignItems: "start" }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
              <Icon name="key" size={18} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.02em" }}>Personal Access Token</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 18, lineHeight: 1.5 }}>
              Dán token được tạo từ GitHub. Nền tảng cần các quyền <span className="mono" style={{ color: "var(--text)" }}>repo</span>, <span className="mono" style={{ color: "var(--text)" }}>admin:repo_hook</span> để đồng bộ pipeline và đăng ký webhook.
            </p>
            <label style={{ fontSize: 12.5, fontWeight: 540, color: "var(--text-2)", display: "block", marginBottom: 7 }}>Access Token</label>
            <Input value={showToken ? token : token.replace(/./g, (c, i) => i < 4 || i > token.length - 4 ? c : "•")}
              onChange={(v) => { if (showToken) setToken(v); else setToken(v.replace(/•/g, "")); }} mono full
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" icon="lock"
              onKeyDown={(e) => e.key === "Enter" && doConnect()}
              suffix={<button onClick={() => { setToken("ghp_R7t2KmZ9aQ4eXc1nB8vL"); }} style={{ fontSize: 11.5, color: "var(--accent)", whiteSpace: "nowrap", fontWeight: 540 }}>Dùng mẫu</button>} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 22 }}>
              <input type="checkbox" id="showtok" checked={showToken} onChange={(e) => setShowToken(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
              <label htmlFor="showtok" style={{ fontSize: 12.5, color: "var(--text-3)" }}>Hiện token</label>
              <div style={{ flex: 1 }} />
              <a style={{ fontSize: 12.5, color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>Tạo token trên GitHub <Icon name="external" size={12} /></a>
            </div>
            <Button variant="primary" size="lg" full icon={connecting ? null : "link"} loading={connecting} disabled={!valid} onClick={doConnect}>
              {connecting ? "Đang xác thực token…" : "Kết nối tài khoản"}
            </Button>
            {token && !valid && <div style={{ fontSize: 12, color: "var(--red)", marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}><Icon name="xCircle" size={13} />Token không hợp lệ — phải bắt đầu bằng <span className="mono">ghp_</span></div>}
          </Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <SectionLabel style={{ marginBottom: 12 }}>Vì sao dùng PAT?</SectionLabel>
              {[["shield", "Kiến trúc độc lập", "Không khoá cứng vào một nhà cung cấp — tránh Vendor Lock-in."], ["lock", "Bảo mật", "Token được mã hoá và chỉ dùng để gọi GitHub API."], ["layers", "Mở rộng", "Chuẩn kết nối nền tảng cho GitLab, Bitbucket sau này."]].map(([i, t, d]) => (
                <div key={t} style={{ display: "flex", gap: 11, marginBottom: 14 }}>
                  <Icon name={i} size={17} style={{ color: "var(--accent)", marginTop: 1 }} />
                  <div><div style={{ fontSize: 13, fontWeight: 560 }}>{t}</div><div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.45, marginTop: 2 }}>{d}</div></div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}
    </Page>
  );
}

function Field({ label, value, mono, span }) {
  return (
    <div style={{ gridColumn: span ? "1 / -1" : "auto" }}>
      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 5, fontWeight: 500 }}>{label}</div>
      <div className={mono ? "mono" : ""} style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

export { Dashboard, GitHubConnect, EmptyConnectState };
