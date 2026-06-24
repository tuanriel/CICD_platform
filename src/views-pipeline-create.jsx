import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PIPELINES } from './data.jsx';
import { GH_WORKFLOWS, parseGitHubActions, presetFromLanguage, workflowToStages } from './data-pipeline.jsx';
import { Button, Card, Icon, SectionLabel, Tag } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { EmptyConnectState } from './views-dashboard.jsx';
import { Select } from './views-build.jsx';
import { Meta } from './views-build-history.jsx';

/* ============================================================
   Views — Tạo pipeline từ GitHub Actions
   Quét repo → phát hiện .github/workflows/*.yml → parse → tạo
   ============================================================ */

function StepHead({ n, title, desc, done, active }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
      <div style={{ width: 26, height: 26, borderRadius: 99, flexShrink: 0, display: "grid", placeItems: "center",
        fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-mono)",
        background: done ? "var(--green-dim)" : active ? "var(--accent-dim)" : "var(--panel-2)",
        color: done ? "var(--green)" : active ? "var(--accent)" : "var(--text-3)",
        border: `1px solid ${done ? "var(--green)" : active ? "var(--accent-border)" : "var(--border)"}` }}>
        {done ? <Icon name="check" size={14} strokeWidth={3} /> : n}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.02em", color: active || done ? "var(--text)" : "var(--text-3)" }}>{title}</div>
        {desc && <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 2 }}>{desc}</div>}
      </div>
    </div>
  );
}

function CreatePipeline({ repos, account, onNav, onCreate, toast }) {
  const [repoId, setRepoId] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [files, setFiles] = useState([]);
  const [selFile, setSelFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);

  const repo = repos.find((r) => r.id === repoId);

  if (!account.connected) {
    return <Page><PageHeader title="Tạo pipeline" icon="pipeline" /><EmptyConnectState onNav={onNav} /></Page>;
  }

  function pickRepo(id) {
    setRepoId(id); setScanned(false); setFiles([]); setSelFile(null); setParsed(null);
  }

  function scan() {
    if (!repo) return;
    setScanning(true); setScanned(false); setSelFile(null); setParsed(null);
    setTimeout(() => {
      const wf = GH_WORKFLOWS[repo.fullName] || [];
      const enriched = wf.map((f) => {
        const p = parseGitHubActions(f.yaml);
        const imported = PIPELINES.some((pl) => pl.repoId === repo.id && pl.name === f.file);
        return { ...f, parsed: p, steps: workflowToStages(p).length, jobs: p.jobs.length, imported };
      });
      setFiles(enriched);
      setScanning(false); setScanned(true);
    }, 1100);
  }

  function pickFile(f) {
    if (f.imported) return;
    setSelFile(f); setParsed(null); setParsing(true);
    setTimeout(() => { setParsed(f.parsed); setParsing(false); }, 850);
  }

  function create() {
    if (!parsed || !repo || !selFile) return;
    setCreating(true);
    const stages = workflowToStages(parsed);
    setTimeout(() => {
      onCreate({
        repoId: repo.id, file: selFile.file, path: ".github/workflows/" + selFile.file,
        title: parsed.name || selFile.file, name: selFile.file,
        triggers: parsed.triggers, branchFilter: parsed.branches.join(", ") || "—",
        stages, preset: presetFromLanguage(repo.language), env: parsed.env, jobs: parsed.jobs.length,
      });
      setCreating(false);
      toast(`Đã tạo pipeline “${parsed.name || selFile.file}”`, "success");
      onNav({ view: "pipelines" });
    }, 1100);
  }

  const stages = parsed ? workflowToStages(parsed) : [];

  return (
    <Page>
      <PageHeader title="Tạo pipeline" icon="pipeline"
        breadcrumb={[{ label: "Pipeline", to: { view: "pipelines" } }, { label: "Tạo pipeline" }]} onNav={onNav}
        subtitle="Nền tảng quét repository, phát hiện file GitHub Actions trong .github/workflows và phân tích (parse) thành pipeline được quản lý tập trung." />

      {/* Step 1 — chọn repo */}
      <Card style={{ marginBottom: 16 }}>
        <StepHead n="1" title="Chọn repository" desc="Repo đã liên kết qua PAT GitHub." done={!!repo} active />
        <div style={{ display: "flex", gap: 10, alignItems: "center", paddingLeft: 38 }}>
          <div style={{ flex: 1, maxWidth: 420 }}>
            <Select value={repoId} onChange={pickRepo} full options={[{ value: "", label: "— Chọn repository —" },
              ...repos.map((r) => ({ value: r.id, label: r.fullName }))]} />
          </div>
          <Button variant="primary" icon={scanning ? null : "search"} loading={scanning} disabled={!repo} onClick={scan}>
            {scanning ? "Đang quét…" : "Quét repository"}
          </Button>
        </div>
      </Card>

      {/* Step 2 — kết quả quét */}
      {(scanning || scanned) && (
        <Card style={{ marginBottom: 16 }}>
          <StepHead n="2" title="File workflow phát hiện được" desc={repo ? `Quét .github/workflows trong ${repo.fullName}` : ""} done={!!selFile} active={!selFile} />
          <div style={{ paddingLeft: 38 }}>
            {scanning ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[0, 1].map((i) => <div key={i} style={{ height: 58, borderRadius: "var(--r-md)", background: "var(--panel-2)", border: "1px solid var(--border)", animation: "pulse-dot 1.2s ease-in-out infinite", animationDelay: i * 0.15 + "s" }} />)}
              </div>
            ) : files.length === 0 ? (
              <div style={{ padding: "20px 0", display: "flex", alignItems: "center", gap: 10, color: "var(--text-3)", fontSize: 13.5 }}>
                <Icon name="info" size={16} />Không tìm thấy file nào trong .github/workflows. Repository này chưa có GitHub Actions.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {files.map((f) => {
                  const sel = selFile?.file === f.file;
                  return (
                    <button key={f.file} onClick={() => pickFile(f)} disabled={f.imported}
                      style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 14px", textAlign: "left",
                        border: `1px solid ${sel ? "var(--accent-border)" : "var(--border)"}`, borderRadius: "var(--r-md)",
                        background: sel ? "var(--accent-dim)" : "var(--panel-2)", opacity: f.imported ? 0.55 : 1,
                        cursor: f.imported ? "not-allowed" : "pointer", transition: "all .12s" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--panel-3)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <Icon name="code" size={17} style={{ color: f.imported ? "var(--text-3)" : "var(--accent)" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span className="mono" style={{ fontSize: 13, fontWeight: 560 }}>.github/workflows/{f.file}</span>
                          {f.imported && <Tag>đã đồng bộ</Tag>}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                          <span>{f.parsed.name}</span>
                          <span>·</span>
                          <span>{f.jobs} job · {f.steps} step</span>
                          <span style={{ display: "inline-flex", gap: 5 }}>{f.parsed.triggers.slice(0, 3).map((t) => <span key={t} className="mono" style={{ color: "var(--text-2)" }}>{t}</span>)}</span>
                        </div>
                      </div>
                      {!f.imported && <Icon name={sel ? "checkCircle" : "chevronRight"} size={17} style={{ color: sel ? "var(--accent)" : "var(--text-3)" }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Step 3 — parse preview */}
      {selFile && (
        <Card style={{ marginBottom: 16 }}>
          <StepHead n="3" title="Phân tích & ánh xạ" desc={`Parse ${selFile.file} → stage của pipeline`} done={!!parsed && !creating} active />
          <div style={{ paddingLeft: 38 }}>
            {parsing ? (
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "24px 0", color: "var(--accent)", fontSize: 13.5 }}>
                <Icon name="refresh" size={17} style={{ animation: "spin .8s linear infinite" }} />Đang phân tích cú pháp YAML…
              </div>
            ) : parsed ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
                {/* raw yaml */}
                <div>
                  <SectionLabel style={{ marginBottom: 8 }}>Nguồn · GitHub Actions</SectionLabel>
                  <div style={{ background: "var(--code-bg)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 14, maxHeight: 340, overflow: "auto" }}>
                    <pre className="mono" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.6, color: "var(--text-2)", whiteSpace: "pre" }}>{selFile.yaml}</pre>
                  </div>
                </div>
                {/* parsed result */}
                <div>
                  <SectionLabel style={{ marginBottom: 8 }}>Kết quả parse</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Meta label="Tên pipeline" value={parsed.name || "—"} />
                      <Meta label="Số job" value={parsed.jobs.length} />
                      <Meta label="Trigger" value={<div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{parsed.triggers.map((t) => <Tag key={t} mono>{t}</Tag>)}</div>} />
                      <Meta label="Nhánh" value={<span className="mono" style={{ fontSize: 12 }}>{parsed.branches.join(", ") || "—"}</span>} />
                    </div>
                    {Object.keys(parsed.env).length > 0 && (
                      <div>
                        <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 6, fontWeight: 500 }}>Biến môi trường</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {Object.entries(parsed.env).map(([k, v]) => <Tag key={k} mono>{k}={v}</Tag>)}
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 8, fontWeight: 500 }}>Stage được ánh xạ ({stages.length})</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {stages.map((s, i) => (
                          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 10px", borderRadius: 99, background: "var(--panel-2)", border: "1px solid var(--border)" }}>
                            <span className="mono" style={{ color: "var(--text-3)", fontSize: 11 }}>{i + 1}</span>{s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      )}

      {/* actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Button variant="ghost" onClick={() => onNav({ view: "pipelines" })}>Huỷ</Button>
        <Button variant="primary" icon={creating ? null : "plus"} loading={creating} disabled={!parsed || parsing} onClick={create}>
          {creating ? "Đang tạo pipeline…" : "Tạo pipeline"}
        </Button>
      </div>
    </Page>
  );
}

export { CreatePipeline };
