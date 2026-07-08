import React, { useState } from 'react';
import { Button, Card, Icon, Tag } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { EmptyConnectState } from './views-dashboard.jsx';
import { Select } from './views-build.jsx';
import { syncRepository } from './api/repositories.js';

/* ============================================================
   Views — Đồng bộ pipeline từ .viettelcloud/workflows/
   POST /repositories/:id/sync → parse *.yaml → Pipeline[]
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
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.02em",
          color: active || done ? "var(--text)" : "var(--text-3)" }}>{title}</div>
        {desc && <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 2 }}>{desc}</div>}
      </div>
    </div>
  );
}

function CreatePipeline({ repos, account, onNav, toast }) {
  const [repoId, setRepoId]       = useState("");
  const [scanning, setScanning]   = useState(false);
  const [scanned, setScanned]     = useState(false);
  const [pipelines, setPipelines] = useState([]);
  const [scanError, setScanError] = useState(null);

  const repo = repos.find((r) => r.id === repoId);

  if (!account.connected) {
    return <Page><PageHeader title="Đồng bộ pipeline" icon="pipeline" /><EmptyConnectState onNav={onNav} /></Page>;
  }

  function pickRepo(id) {
    setRepoId(id);
    setScanned(false);
    setPipelines([]);
    setScanError(null);
  }

  async function scan() {
    if (!repo) return;
    setScanning(true);
    setScanned(false);
    setScanError(null);
    setPipelines([]);
    try {
      const data = await syncRepository(repo.id);
      setPipelines(data ?? []);
      setScanned(true);
      // Sync KHÔNG parse YAML — pipeline luôn về "pending" ngay sau sync (kể cả từng active/error
      // trước đó), nên chỉ có thể báo tổng số file tìm thấy ở bước này.
      const total = (data ?? []).length;
      if (total === 0) {
        toast("Không tìm thấy file .viettelcloud/workflows/*.yaml nào", "info");
      } else {
        toast(`Đã đồng bộ ${total} pipeline`, "success");
      }
    } catch (e) {
      const msgs = {
        RESOURCE_NOT_FOUND: "Repository không tồn tại trong platform.",
        UPSTREAM_ERROR:     "Không kết nối được GitHub hoặc không lấy được file.",
      };
      setScanError(msgs[e.code] || e.message || "Quét thất bại");
    } finally {
      setScanning(false);
    }
  }

  return (
    <Page>
      <PageHeader title="Đồng bộ pipeline" icon="pipeline"
        breadcrumb={[{ label: "Pipeline", to: { view: "pipelines" } }, { label: "Đồng bộ pipeline" }]} onNav={onNav}
        subtitle="Quét thư mục .viettelcloud/workflows/ trong repository, parse file YAML và đồng bộ pipeline vào platform." />

      {/* Step 1 — chọn repo */}
      <Card style={{ marginBottom: 16 }}>
        <StepHead n="1" title="Chọn repository" desc="Repository đã ánh xạ vào platform." done={!!repo} active />
        <div style={{ display: "flex", gap: 10, alignItems: "center", paddingLeft: 38 }}>
          <div style={{ flex: 1, maxWidth: 420 }}>
            <Select value={repoId} onChange={pickRepo} full
              options={[
                { value: "", label: "— Chọn repository —" },
                ...repos.map((r) => ({ value: r.id, label: r.fullName })),
              ]} />
          </div>
          <Button variant="primary" icon={scanning ? null : "search"} loading={scanning}
            disabled={!repo} onClick={scan}>
            {scanning ? "Đang quét…" : "Quét repository"}
          </Button>
        </div>

        {scanError && (
          <div style={{ marginTop: 12, marginLeft: 38, display: "flex", alignItems: "center", gap: 8,
            padding: "10px 13px", background: "var(--red-dim)",
            border: "1px solid color-mix(in oklab, var(--red) 40%, transparent)",
            borderRadius: "var(--r-sm)", fontSize: 13, color: "var(--red)" }}>
            <Icon name="xCircle" size={14} />{scanError}
          </div>
        )}

        {repo && (
          <div style={{ marginTop: 12, marginLeft: 38, display: "flex", alignItems: "center", gap: 8,
            padding: "9px 12px", background: "var(--panel-2)", border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)", fontSize: 12.5, color: "var(--text-3)" }}>
            <Icon name="info" size={13} />
            Platform sẽ gọi <span className="mono" style={{ margin: "0 4px", color: "var(--text-2)" }}>
              POST /repositories/{repo.id.slice(0, 8)}…/sync
            </span> để quét và parse file trong <span className="mono" style={{ margin: "0 4px" }}>.viettelcloud/workflows/</span>.
          </div>
        )}
      </Card>

      {/* Step 2 — kết quả quét */}
      {(scanning || scanned) && (
        <Card style={{ marginBottom: 16 }}>
          <StepHead n="2" title="Pipeline phát hiện được"
            desc={repo ? `Quét .viettelcloud/workflows/*.yaml trong ${repo.fullName}` : ""}
            done={scanned && pipelines.length > 0}
            active={scanning || (scanned && pipelines.length === 0)} />
          <div style={{ paddingLeft: 38 }}>
            {scanning ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[0, 1].map((i) => (
                  <div key={i} style={{ height: 58, borderRadius: "var(--r-md)",
                    background: "var(--panel-2)", border: "1px solid var(--border)",
                    animation: "pulse-dot 1.2s ease-in-out infinite",
                    animationDelay: i * 0.15 + "s" }} />
                ))}
              </div>
            ) : pipelines.length === 0 ? (
              <div style={{ padding: "20px 0", display: "flex", alignItems: "center", gap: 10,
                color: "var(--text-3)", fontSize: 13.5 }}>
                <Icon name="info" size={16} />
                Không tìm thấy file nào trong{" "}
                <span className="mono" style={{ margin: "0 4px" }}>.viettelcloud/workflows/</span>.
                Thêm file <span className="mono" style={{ margin: "0 4px" }}>*.yaml</span>
                vào thư mục đó để platform nhận diện pipeline.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {pipelines.map((p) => {
                  // Ngay sau sync, mọi pipeline đều "pending" (chưa parse) — active/error chỉ xuất
                  // hiện nếu danh sách này được load lại sau khi ai đó đã trigger pipeline.
                  const cfg = {
                    error:  { icon: "xCircle",     color: "var(--red)",   iconBg: "color-mix(in oklab, var(--red) 15%, transparent)",  border: "color-mix(in oklab, var(--red) 30%, transparent)",  cardBg: "var(--red-dim)", text: "Lỗi cú pháp YAML — không thể build", tag: <Tag mono color="var(--red)" bg="color-mix(in oklab,var(--red) 18%,transparent)" icon="xCircle">error</Tag> },
                    active: { icon: "checkCircle", color: "var(--green)", iconBg: "var(--green-dim)",                                    border: "var(--border)",                                      cardBg: "var(--panel-2)", text: "YAML hợp lệ", tag: <Tag mono color="var(--green)" bg="var(--green-dim)" icon="check">active</Tag> },
                  }[p.status] ?? { icon: "doc", color: "var(--text-3)", iconBg: "var(--panel-3)", border: "var(--border)", cardBg: "var(--panel-2)", text: "Đã đồng bộ", tag: <Tag mono color="var(--text-3)" bg="var(--panel-3)" icon="doc">đã đồng bộ</Tag> };
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 13,
                      padding: "12px 14px",
                      border: `1px solid ${cfg.border}`,
                      borderRadius: "var(--r-md)",
                      background: cfg.cardBg }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                        background: cfg.iconBg,
                        display: "grid", placeItems: "center" }}>
                        <Icon name={cfg.icon} size={17} style={{ color: cfg.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13.5, fontWeight: 560 }}>{p.name}</span>
                          <span className="mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                            {p.file_path}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, marginTop: 3, color: cfg.color }}>
                          {cfg.text}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>{cfg.tag}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Step 3 — kết quả & điều hướng */}
      {scanned && pipelines.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <StepHead n="3" title="Hoàn tất"
            desc="Pipeline đã được tạo (raw YAML) và lưu vào platform."
            done active={false} />
          <div style={{ paddingLeft: 38 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, marginBottom: 18, color: "var(--text-2)" }}>
              <Icon name="doc" size={16} strokeWidth={2} />
              {pipelines.length} pipeline đã đồng bộ — vào trang repository hoặc trang Pipeline và bấm Build để chạy
            </div>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              <Button variant="secondary" icon="repo"
                onClick={() => onNav({ view: "repo", repoId: repo.id })}>
                Xem trong Repository
              </Button>
              <Button variant="primary" icon="pipeline"
                onClick={() => onNav({ view: "pipelines" })}>
                Đến danh sách Pipeline
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!scanned && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={() => onNav({ view: "pipelines" })}>Huỷ</Button>
        </div>
      )}
    </Page>
  );
}

export { CreatePipeline };
