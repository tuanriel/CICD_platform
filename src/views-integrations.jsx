import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { JENKINS, SAMPLE_JENKINS, SAMPLE_YAML, WEBHOOK_DELIVERIES, WEBHOOK_EVENTS } from './data.jsx';
import { Button, Card, Icon, Input, SectionLabel, StatusBadge, Tag } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { EmptyConnectState } from './views-dashboard.jsx';
import { MiniStat } from './views-pipeline.jsx';

/* ============================================================
   Views — Jenkins integration (parser) + Webhook config
   ============================================================ */

function JenkinsView({ account, repos, onNav, toast, pipelineId }) {
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState("parser");
  if (!account.connected) {
    return <Page><PageHeader title="Jenkins" icon="jenkins" subtitle="Tích hợp Jenkins: parser YAML → Jenkins Script." /><EmptyConnectState onNav={onNav} /></Page>;
  }

  function generate() {
    setGenerating(true); setGenerated(false);
    setTimeout(() => { setGenerating(false); setGenerated(true); toast("Đã sinh Jenkins Script thành công", "success"); }, 1400);
  }

  return (
    <Page wide>
      <PageHeader title="Tích hợp Jenkins" icon="jenkins"
        subtitle="Chuyển đổi YAML Pipeline thành Jenkins Script và tự động tạo Job trên Jenkins."
        actions={<Button variant="secondary" icon="external">Mở Jenkins</Button>} />

      {/* status strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <Card pad={15} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--green-dim)", display: "grid", placeItems: "center" }}><Icon name="jenkins" size={18} style={{ color: "var(--green)" }} /></div>
          <div><div style={{ fontSize: 13, fontWeight: 560 }}>Đã kết nối</div><div className="mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>{JENKINS.version}</div></div>
        </Card>
        <MiniStat label="Jenkins Jobs" value={JENKINS.jobs} />
        <MiniStat label="Executors" value={`${JENKINS.executors.busy}/${JENKINS.executors.total}`} />
        <Card pad={15}><div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 8 }}>Endpoint</div><div className="mono" style={{ fontSize: 12, fontWeight: 540, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>jenkins.fpt-cloud.internal</div></Card>
      </div>

      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {[["parser", "Parser YAML → Script", "code"], ["jobs", "Jenkins Jobs", "layers"]].map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", fontSize: 13.5, fontWeight: 540, color: tab === id ? "var(--text)" : "var(--text-3)", borderBottom: `2px solid ${tab === id ? "var(--accent)" : "transparent"}`, marginBottom: -1 }}>
            <Icon name={icon} size={15} />{label}
          </button>
        ))}
      </div>

      {tab === "parser" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--text-2)" }}>
              <Icon name="doc" size={16} style={{ color: "var(--text-3)" }} /><span className="mono" style={{ color: "var(--text)" }}>payment-gateway/.workflow/ci.yml</span>
            </div>
            <Button variant="primary" icon={generating ? null : "zap"} loading={generating} onClick={generate}>{generating ? "Đang biến đổi…" : "Sinh Jenkins Script"}</Button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 1fr", gap: 0, alignItems: "stretch" }}>
            <CodePanel title="YAML Pipeline (nguồn)" lang="yaml" code={SAMPLE_YAML} icon="doc" tone="neutral" />
            <div style={{ display: "grid", placeItems: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: 99, background: generated ? "var(--accent)" : "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: generated ? "var(--accent-fg)" : "var(--text-3)", transition: "all .3s" }}>
                <Icon name={generating ? "refresh" : "arrowRight"} size={17} style={{ animation: generating ? "spin .8s linear infinite" : "none" }} />
              </div>
            </div>
            <div style={{ position: "relative" }}>
              {!generated && !generating && (
                <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "var(--code-bg)", border: "1px dashed var(--border-strong)", borderRadius: "var(--r-lg)", display: "grid", placeItems: "center" }}>
                  <div style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>
                    <Icon name="code" size={26} style={{ margin: "0 auto 12px", opacity: .6 }} />
                    <div style={{ fontSize: 13, fontWeight: 540, color: "var(--text-2)" }}>Chưa có script</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Bấm “Sinh Jenkins Script” để biến đổi cấu hình.</div>
                  </div>
                </div>
              )}
              {generating && (
                <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "var(--code-bg)", border: "1px solid var(--accent-border)", borderRadius: "var(--r-lg)", display: "grid", placeItems: "center" }}>
                  <div style={{ textAlign: "center", color: "var(--accent)" }}><Icon name="refresh" size={24} style={{ margin: "0 auto 10px", animation: "spin .8s linear infinite" }} /><div style={{ fontSize: 13 }}>Đang parse & ánh xạ stages…</div></div>
                </div>
              )}
              <CodePanel title="Jenkinsfile (kết quả)" lang="groovy" code={SAMPLE_JENKINS} icon="jenkins" tone="accent"
                actions={generated && <Button variant="outline" size="sm" icon="zap" onClick={() => toast("Đã tạo Job trên Jenkins · ci-payment-gateway", "success")}>Tạo Job</Button>} />
            </div>
          </div>

          {generated && (
            <Card style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 13 }}>
              <Icon name="checkCircle" size={20} style={{ color: "var(--green)" }} strokeWidth={2} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 560 }}>Biến đổi thành công · 6 stages được ánh xạ</div>
                <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Sẵn sàng tạo Job <span className="mono" style={{ color: "var(--text-2)" }}>ci-payment-gateway</span> trên Jenkins và trigger build tự động qua webhook.</div>
              </div>
              <Button variant="primary" icon="zap" onClick={() => toast("Đã tạo & trigger Job trên Jenkins", "success")}>Tạo & Trigger</Button>
            </Card>
          )}
        </div>
      )}

      {tab === "jobs" && (
        <Card pad={0} style={{ overflow: "hidden" }}>
          {[
            { name: "ci-payment-gateway", repo: "payment-gateway", status: "success", builds: 248, last: "12 phút trước" },
            { name: "cd-payment-gateway", repo: "payment-gateway", status: "success", builds: 57, last: "hôm qua" },
            { name: "ci-identity-service", repo: "identity-service", status: "running", builds: 132, last: "đang chạy" },
            { name: "ci-web-portal", repo: "web-portal", status: "failed", builds: 311, last: "40 phút trước" },
            { name: "ci-data-pipeline", repo: "data-pipeline", status: "success", builds: 78, last: "2 giờ trước" },
          ].map((j, i, arr) => (
            <div key={j.name} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 18px", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center" }}><Icon name="jenkins" size={16} style={{ color: "var(--text-2)" }} /></div>
              <div style={{ flex: 1 }}>
                <div className="mono" style={{ fontSize: 13.5, fontWeight: 540 }}>{j.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{j.repo} · {j.builds} builds</div>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>{j.last}</span>
              <StatusBadge status={j.status} size="sm" />
            </div>
          ))}
        </Card>
      )}
    </Page>
  );
}

function CodePanel({ title, lang, code, icon, tone, actions }) {
  return (
    <div style={{ background: "var(--code-bg)", border: `1px solid ${tone === "accent" ? "var(--accent-border)" : "var(--border)"}`, borderRadius: "var(--r-lg)", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 420 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--panel)" }}>
        <Icon name={icon} size={15} style={{ color: tone === "accent" ? "var(--accent)" : "var(--text-3)" }} />
        <span style={{ fontSize: 12.5, fontWeight: 560 }}>{title}</span>
        <Tag mono>{lang}</Tag>
        <div style={{ flex: 1 }} />
        {actions}
      </div>
      <pre className="mono" style={{ margin: 0, padding: "14px 16px", fontSize: 12.5, lineHeight: 1.7, overflowX: "auto", color: "var(--text-2)", flex: 1 }}>
        <CodeHighlight code={code} lang={lang} />
      </pre>
    </div>
  );
}

function CodeHighlight({ code, lang }) {
  // lightweight token coloring
  const lines = code.split("\n");
  return lines.map((line, i) => {
    let el;
    if (line.trim().startsWith("#") || line.trim().startsWith("//")) {
      el = <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>{line}</span>;
    } else if (lang === "yaml") {
      const m = line.match(/^(\s*-?\s*)([\w$]+)(:)(.*)$/);
      if (m) el = <span>{m[1]}<span style={{ color: "var(--blue)" }}>{m[2]}</span><span style={{ color: "var(--text-3)" }}>{m[3]}</span><span style={{ color: "var(--green)" }}>{m[4]}</span></span>;
      else el = <span>{line}</span>;
    } else {
      const kw = /\b(pipeline|agent|stages|stage|steps|environment|post|always|sh|checkout|scm|any)\b/g;
      const parts = [];
      let last = 0, mm;
      while ((mm = kw.exec(line))) {
        parts.push(line.slice(last, mm.index));
        parts.push(<span key={mm.index} style={{ color: "var(--violet)" }}>{mm[0]}</span>);
        last = mm.index + mm[0].length;
      }
      parts.push(line.slice(last));
      el = <span>{parts}</span>;
    }
    return <div key={i}>{el || "\u00a0"}</div>;
  });
}

/* ---------------- Webhook config ---------------- */
function WebhooksView({ account, onNav, toast }) {
  const [events, setEvents] = useState(WEBHOOK_EVENTS);
  const [copied, setCopied] = useState(false);
  if (!account.connected) {
    return <Page><PageHeader title="Webhook" icon="webhook" subtitle="Cấu hình xử lý sự kiện từ GitHub Repository." /><EmptyConnectState onNav={onNav} /></Page>;
  }
  const url = "https://cicd.fpt-cloud.internal/api/v1/hooks/github";

  function toggle(id) { setEvents((e) => e.map((x) => x.id === id ? { ...x, enabled: !x.enabled } : x)); }

  return (
    <Page wide>
      <PageHeader title="Cấu hình Webhook" icon="webhook"
        subtitle="Xử lý sự kiện từ GitHub (Push, Pull Request, …) để tự động trigger pipeline tương ứng." />

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start", marginBottom: 16 }}>
        <Card>
          <SectionLabel style={{ marginBottom: 12 }}>Payload URL</SectionLabel>
          <div style={{ display: "flex", gap: 9 }}>
            <Input value={url} onChange={() => {}} mono full icon="link" />
            <Button variant="secondary" icon={copied ? "check" : "copy"} onClick={() => { setCopied(true); toast("Đã sao chép Payload URL", "success"); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Đã chép" : "Chép"}</Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 18 }}>
            <Field label="Content type" value="application/json" mono />
            <Field label="SSL verification" value={<span style={{ color: "var(--green)" }}>Đã bật</span>} />
            <Field label="Secret (HMAC SHA-256)" value="••••••••••••••••" mono span />
          </div>
        </Card>
        <Card>
          <SectionLabel style={{ marginBottom: 12 }}>Trạng thái</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--green-dim)", display: "grid", placeItems: "center" }}><Icon name="webhook" size={19} style={{ color: "var(--green)" }} /></div>
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>Đang hoạt động</div><div style={{ fontSize: 12, color: "var(--text-3)" }}>Đăng ký trên 4 repository</div></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "8px 0", borderTop: "1px solid var(--border)" }}><span style={{ color: "var(--text-3)" }}>Tỉ lệ thành công</span><span style={{ fontWeight: 600, color: "var(--green)" }}>98.6%</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "8px 0", borderTop: "1px solid var(--border)" }}><span style={{ color: "var(--text-3)" }}>Độ trễ trung bình</span><span className="mono" style={{ fontWeight: 600 }}>142ms</span></div>
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <SectionLabel style={{ marginBottom: 4 }}>Sự kiện được lắng nghe</SectionLabel>
        <div style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 14 }}>Chọn các sự kiện GitHub sẽ kích hoạt pipeline.</div>
        {events.map((ev, i) => (
          <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 0", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 540 }}><span className="mono" style={{ fontSize: 12.5, color: ev.enabled ? "var(--accent)" : "var(--text-3)" }}>{ev.id}</span><span>{ev.label}</span></div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{ev.desc}</div>
            </div>
            <Toggle on={ev.enabled} onClick={() => toggle(ev.id)} />
          </div>
        ))}
      </Card>

      <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: "-.02em", marginBottom: 12 }}>Lịch sử gửi (Recent Deliveries)</div>
      <Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1.2fr 1fr 1fr 90px", padding: "11px 18px", borderBottom: "1px solid var(--border)", fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-3)" }}>
          <span>Status</span><span>Event</span><span>Repository</span><span>Nhánh</span><span>Trigger</span><span style={{ textAlign: "right" }}>Thời gian</span>
        </div>
        {WEBHOOK_DELIVERIES.map((d, i) => (
          <div key={d.id} style={{ display: "grid", gridTemplateColumns: "70px 1fr 1.2fr 1fr 1fr 90px", padding: "12px 18px", alignItems: "center", borderBottom: i < WEBHOOK_DELIVERIES.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
            <span><Tag mono color={d.status < 400 ? "var(--green)" : "var(--red)"} bg={d.status < 400 ? "var(--green-dim)" : "var(--red-dim)"}>{d.status}</Tag></span>
            <span className="mono" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{d.event}</span>
            <span className="mono" style={{ fontSize: 12.5 }}>{d.repo}</span>
            <span style={{ fontSize: 12.5, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}><Icon name="branch" size={11} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.branch}</span></span>
            <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>{d.triggered}</span>
            <span style={{ fontSize: 12, color: "var(--text-3)", textAlign: "right" }}>{d.at}</span>
          </div>
        ))}
      </Card>
    </Page>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 38, height: 22, borderRadius: 99, background: on ? "var(--accent)" : "var(--panel-3)", border: "1px solid var(--border)", position: "relative", transition: "background .18s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 2, left: on ? 17 : 2, width: 16, height: 16, borderRadius: 99, background: on ? "var(--accent-fg)" : "var(--text-3)", transition: "left .18s" }} />
    </button>
  );
}

export { JenkinsView, WebhooksView, CodePanel, Toggle };
