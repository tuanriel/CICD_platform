import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GH_AVAILABLE_REPOS } from './data.jsx';
import { BUILD_IMAGES, BUILD_PROJECTS, COMPUTE_TYPES, SAMPLE_BUILDSPEC, projectLatestStatus } from './data-build.jsx';
import { Button, Card, Icon, Input, SectionLabel, StatusBadge } from './primitives.jsx';
import { Page, PageHeader } from './layout.jsx';
import { EmptyConnectState } from './views-dashboard.jsx';

/* ============================================================
   Views — Build service (CodeBuild-style)
   Build projects list · Create build project · Project detail
   ============================================================ */

/* ---------------- Shared form primitives ---------------- */
function FormSection({ title, desc, children, defaultOpen = true, optional }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card pad={0} style={{ marginBottom: 16, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "16px 20px", textAlign: "left" }}>
        <Icon name={open ? "chevronDown" : "chevronRight"} size={17} style={{ color: "var(--text-3)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.02em" }}>{title}{optional && <span style={{ color: "var(--text-3)", fontWeight: 400, fontStyle: "italic", marginLeft: 8, fontSize: 13 }}>tuỳ chọn</span>}</div>
          {desc && <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 3 }}>{desc}</div>}
        </div>
      </button>
      {open && <div style={{ padding: "4px 20px 22px", borderTop: "1px solid var(--border)" }}>{children}</div>}
    </Card>
  );
}

function FormField({ label, hint, children, optional, span }) {
  return (
    <div style={{ marginTop: 18, gridColumn: span ? "1 / -1" : "auto" }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 560, marginBottom: 3 }}>{label}{optional && <span style={{ color: "var(--text-3)", fontWeight: 400, fontStyle: "italic", marginLeft: 6, fontSize: 12 }}>tuỳ chọn</span>}</label>
      {hint && <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8 }}>{hint}</div>}
      {children}
    </div>
  );
}

function Select({ value, onChange, options, full }) {
  return (
    <div style={{ position: "relative", width: full ? "100%" : "auto" }}>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ appearance: "none", width: "100%", height: 38, padding: "0 36px 0 11px", background: "var(--panel-2)",
          border: "1px solid var(--border)", borderRadius: "var(--r-sm)", color: "var(--text)", fontSize: 13.5, cursor: "pointer" }}>
        {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
      <Icon name="chevronDown" size={15} style={{ position: "absolute", right: 11, top: 11, color: "var(--text-3)", pointerEvents: "none" }} />
    </div>
  );
}

function RadioCards({ value, onChange, options }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 10 }}>
      {options.map((o) => {
        const sel = value === o.id;
        return (
          <button key={o.id} onClick={() => !o.disabled && onChange(o.id)} disabled={o.disabled}
            style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 14px", textAlign: "left",
              border: `1px solid ${sel ? "var(--accent-border)" : "var(--border)"}`, borderRadius: "var(--r-md)",
              background: sel ? "var(--accent-dim)" : "var(--panel-2)", opacity: o.disabled ? 0.45 : 1, cursor: o.disabled ? "not-allowed" : "pointer", transition: "all .12s" }}>
            <span style={{ width: 17, height: 17, borderRadius: 99, marginTop: 1, flexShrink: 0, border: `1.5px solid ${sel ? "var(--accent)" : "var(--border-strong)"}`, display: "grid", placeItems: "center" }}>
              {sel && <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--accent)" }} />}
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 540 }}>{o.label}</div>
              {o.desc && <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{o.desc}</div>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CheckRow({ checked, onChange, label, desc }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "4px 0" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: "var(--accent)", marginTop: 2, width: 15, height: 15 }} />
      <div><div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>{desc && <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>{desc}</div>}</div>
    </label>
  );
}

/* ---------------- Build projects list ---------------- */
function BuildProjectsList({ account, onNav, onStartBuild, toast }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  if (!account.connected) {
    return <Page><PageHeader title="Build project" icon="box" subtitle="Quản lý các build project — định nghĩa nguồn, môi trường và buildspec." /><EmptyConnectState onNav={onNav} /></Page>;
  }
  const items = BUILD_PROJECTS.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.repo.toLowerCase().includes(q.toLowerCase()));
  const selProj = BUILD_PROJECTS.find((p) => p.id === sel);

  return (
    <Page wide>
      <PageHeader title="Build project" icon="box"
        subtitle="Mỗi build project định nghĩa nguồn mã, môi trường thực thi và buildspec để chạy build."
        actions={<>
          <Button variant="secondary" icon="play" disabled={!selProj} onClick={() => { const id = onStartBuild(selProj.id); onNav({ view: "build", buildId: id, live: true }); }}>Start build</Button>
          <Button variant="secondary" disabled={!selProj} onClick={() => onNav({ view: "build-project", projectId: sel })}>Chi tiết</Button>
          <Button variant="primary" icon="plus" onClick={() => onNav({ view: "create-build-project" })}>Tạo project</Button>
        </>} />

      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <Input value={q} onChange={setQ} placeholder="Tìm build project…" icon="search" full />
        <Button variant="secondary" icon="refresh" onClick={() => toast("Đã làm mới danh sách project", "info")} />
        <Button variant="secondary" iconRight="chevronDown">Project của bạn</Button>
      </div>

      <Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "34px 1.3fr .8fr 1.3fr 1fr 1.1fr .9fr", padding: "11px 18px",
          borderBottom: "1px solid var(--border)", fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-3)" }}>
          <span /><span>Tên</span><span>Nguồn</span><span>Repository</span><span>Build gần nhất</span><span>Mô tả</span><span style={{ textAlign: "right" }}>Sửa đổi</span>
        </div>
        {items.map((p, i) => {
          const st = projectLatestStatus(p);
          const isSel = sel === p.id;
          return (
            <div key={p.id} onClick={() => setSel(isSel ? null : p.id)}
              style={{ display: "grid", gridTemplateColumns: "34px 1.3fr .8fr 1.3fr 1fr 1.1fr .9fr", padding: "13px 18px", alignItems: "center",
                cursor: "pointer", borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
                background: isSel ? "var(--accent-dim)" : "transparent", transition: "background .12s" }}
              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--panel-2)"; }}
              onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
              <span style={{ width: 17, height: 17, borderRadius: 99, border: `1.5px solid ${isSel ? "var(--accent)" : "var(--border-strong)"}`, display: "grid", placeItems: "center" }}>
                {isSel && <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--accent)" }} />}
              </span>
              <button onClick={(e) => { e.stopPropagation(); onNav({ view: "build-project", projectId: p.id }); }}
                style={{ fontSize: 13.5, fontWeight: 560, color: "var(--accent)", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</button>
              <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}><Icon name="github" size={15} />GitHub</span>
              <a href={p.repoUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                className="mono" style={{ fontSize: 12.5, color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.repo}</span><Icon name="external" size={12} />
              </a>
              <span>{st ? <StatusBadge status={st} size="sm" /> : <span style={{ color: "var(--text-3)" }}>—</span>}</span>
              <span style={{ fontSize: 12.5, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</span>
              <span style={{ fontSize: 12.5, color: "var(--text-3)", textAlign: "right" }}>{p.lastModified}</span>
            </div>
          );
        })}
        {items.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>Không tìm thấy project nào.</div>}
      </Card>
    </Page>
  );
}

/* ---------------- Create build project ---------------- */
function CreateBuildProject({ account, onNav, onCreate, toast }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [kind, setKind] = useState("node");
  const [repoMode, setRepoMode] = useState("account");
  const [repo, setRepo] = useState("");
  const [sourceVersion, setSourceVersion] = useState("");
  const [webhook, setWebhook] = useState(true);
  const [events, setEvents] = useState(["PUSH"]);
  const [compute, setCompute] = useState("general1.small");
  const [image, setImage] = useState(BUILD_IMAGES[0]);
  const [privileged, setPrivileged] = useState(false);
  const [buildspecMode, setBuildspecMode] = useState("file");
  const [buildspecName, setBuildspecName] = useState("buildspec.yml");
  const [artifacts, setArtifacts] = useState("none");
  const [creating, setCreating] = useState(false);

  if (!account.connected) {
    return <Page><PageHeader title="Tạo build project" icon="box" /><EmptyConnectState onNav={onNav} /></Page>;
  }
  const valid = name.trim().length >= 2 && repo;

  function toggleEvent(ev) { setEvents((e) => e.includes(ev) ? e.filter((x) => x !== ev) : [...e, ev]); }

  function submit() {
    if (!valid) return;
    setCreating(true);
    setTimeout(() => {
      onCreate({
        name: name.trim(), description: desc.trim() || "—", kind, repo,
        repoUrl: "https://github.com/" + repo, sourceVersion: sourceVersion.trim(),
        webhook, events: webhook ? events : [],
        env: { image, computeType: compute, os: image.includes("standard:7") ? "Ubuntu" : "Amazon Linux", privileged, serviceRole: `codebuild-${name.trim()}-service-role` },
        buildspecMode, buildspecName, artifacts,
      });
      setCreating(false);
      toast(`Đã tạo build project ${name.trim()}`, "success");
      onNav({ view: "build-projects" });
    }, 1100);
  }

  const EVENT_OPTS = [
    { id: "PUSH", label: "PUSH", desc: "Khi có commit được push" },
    { id: "PULL_REQUEST_CREATED", label: "PULL_REQUEST_CREATED", desc: "Khi mở pull request" },
    { id: "PULL_REQUEST_UPDATED", label: "PULL_REQUEST_UPDATED", desc: "Khi cập nhật pull request" },
    { id: "PULL_REQUEST_MERGED", label: "PULL_REQUEST_MERGED", desc: "Khi merge pull request" },
  ];

  return (
    <Page>
      <PageHeader title="Tạo build project" icon="box"
        breadcrumb={[{ label: "Build project", to: { view: "build-projects" } }, { label: "Tạo project" }]} onNav={onNav}
        subtitle="Cấu hình nguồn mã, môi trường thực thi và buildspec cho project mới." />

      <FormSection title="Cấu hình project" desc="Tên và mô tả định danh build project.">
        <FormField label="Tên project" hint="Duy nhất trong tài khoản. Chỉ chứa chữ, số, dấu gạch.">
          <Input value={name} onChange={setName} placeholder="vd: payment-gateway-ci" full />
        </FormField>
        <FormField label="Mô tả" optional>
          <Input value={desc} onChange={setDesc} placeholder="Mô tả ngắn về build project" full />
        </FormField>
      </FormSection>

      <FormSection title="Source" desc="Nơi lấy mã nguồn để build.">
        <FormField label="Nhà cung cấp nguồn">
          <div style={{ display: "flex", alignItems: "center", gap: 9, height: 38, padding: "0 12px", background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", maxWidth: 280 }}>
            <Icon name="github" size={16} /><span style={{ fontSize: 13.5, fontWeight: 540 }}>GitHub</span>
          </div>
        </FormField>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, fontSize: 12.5, color: "var(--green)" }}>
          <Icon name="checkCircle" size={15} strokeWidth={2} />Tài khoản đã kết nối qua PAT — <button onClick={() => onNav({ view: "pat" })} style={{ color: "var(--accent)" }}>quản lý credential</button>.
        </div>
        <FormField label="Repository">
          <RadioCards value={repoMode} onChange={setRepoMode} options={[
            { id: "account", label: "Repo trong tài khoản GitHub" },
            { id: "public", label: "Public repository" },
            { id: "webhook", label: "GitHub scoped webhook" },
          ]} />
        </FormField>
        <FormField label="Chọn repository">
          <Select value={repo} onChange={setRepo} full options={[{ value: "", label: "— Chọn repository —" }, ...GH_AVAILABLE_REPOS.map((r) => ({ value: r.fullName, label: r.fullName }))]} />
        </FormField>
        <FormField label="Ngôn ngữ / runtime" hint="Dùng để sinh buildspec mẫu phù hợp.">
          <Select value={kind} onChange={setKind} full options={[{ value: "node", label: "Node.js" }, { value: "python", label: "Python" }, { value: "go", label: "Go" }]} />
        </FormField>
        <FormField label="Source version" hint="Nhập branch, tag, commit ID hoặc pull request." optional>
          <Input value={sourceVersion} onChange={setSourceVersion} placeholder="vd: main" mono full />
        </FormField>
      </FormSection>

      <FormSection title="Sự kiện webhook nguồn" desc="Tự động chạy build khi có thay đổi trên repository." optional>
        <CheckRow checked={webhook} onChange={setWebhook} label="Rebuild mỗi khi có thay đổi mã được push lên repository" desc="Đăng ký webhook trên GitHub để trigger build tự động." />
        {webhook && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
            <SectionLabel style={{ marginBottom: 8 }}>Loại sự kiện</SectionLabel>
            {EVENT_OPTS.map((ev) => <CheckRow key={ev.id} checked={events.includes(ev.id)} onChange={() => toggleEvent(ev.id)} label={<span className="mono" style={{ fontSize: 12.5 }}>{ev.id}</span>} desc={ev.desc} />)}
          </div>
        )}
      </FormSection>

      <FormSection title="Environment" desc="Máy ảo và image dùng để chạy build.">
        <FormField label="Image môi trường (managed image)">
          <Select value={image} onChange={setImage} full options={BUILD_IMAGES} />
        </FormField>
        <FormField label="Loại compute">
          <RadioCards value={compute} onChange={setCompute} options={COMPUTE_TYPES.map((c) => ({ id: c.id, label: c.label }))} />
        </FormField>
        <FormField label="Service role">
          <Input value={name.trim() ? `codebuild-${name.trim()}-service-role` : "codebuild-<project>-service-role"} onChange={() => {}} mono full />
        </FormField>
        <div style={{ marginTop: 16 }}>
          <CheckRow checked={privileged} onChange={setPrivileged} label="Bật chế độ privileged" desc="Cần thiết khi build Docker image trong build." />
        </div>
      </FormSection>

      <FormSection title="Buildspec" desc="Định nghĩa các lệnh build theo từng phase.">
        <RadioCards value={buildspecMode} onChange={setBuildspecMode} options={[
          { id: "file", label: "Dùng file buildspec", desc: "Đọc từ repository" },
          { id: "inline", label: "Nhập lệnh build", desc: "Soạn trực tiếp tại đây" },
        ]} />
        {buildspecMode === "file" ? (
          <FormField label="Tên file buildspec" hint="Mặc định buildspec.yml ở thư mục gốc.">
            <Input value={buildspecName} onChange={setBuildspecName} mono full placeholder="buildspec.yml" />
          </FormField>
        ) : (
          <FormField label="Buildspec (YAML)">
            <div style={{ background: "var(--code-bg)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 14, maxHeight: 240, overflow: "auto" }}>
              <pre className="mono" style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{SAMPLE_BUILDSPEC}</pre>
            </div>
          </FormField>
        )}
      </FormSection>

      <FormSection title="Artifacts" desc="Nơi lưu kết quả build." optional defaultOpen={false}>
        <RadioCards value={artifacts} onChange={setArtifacts} options={[
          { id: "none", label: "Không có artifact" },
          { id: "s3", label: "Amazon S3", desc: "Lưu output lên bucket" },
        ]} />
      </FormSection>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
        <Button variant="ghost" onClick={() => onNav({ view: "build-projects" })}>Huỷ</Button>
        <Button variant="primary" icon={creating ? null : "check"} loading={creating} disabled={!valid} onClick={submit}>{creating ? "Đang tạo project…" : "Tạo build project"}</Button>
      </div>
    </Page>
  );
}

export { BuildProjectsList, CreateBuildProject, FormSection, FormField, Select, RadioCards, CheckRow };
