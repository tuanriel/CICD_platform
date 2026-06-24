import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LANG_COLORS } from './data.jsx';

/* ============================================================
   Primitives — icons + shared UI
   ============================================================ */
/* ---------------- Icons (simple stroke set) ---------------- */
const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  repo: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20v5H6.5A2.5 2.5 0 0 1 4 19.5z"/>',
  pipeline: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5v3a3 3 0 0 0 3 3h6.5"/>',
  jenkins: '<path d="M13 2 4.5 13H11l-1 9 8.5-11H12z"/>',
  webhook: '<circle cx="12" cy="7.5" r="3"/><path d="M9.5 9.8 6 16m12-6.2L20.5 16"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 18h7"/>',
  github: '<path d="M9 19c-4 1.5-4-2-5.5-2.5M15 22v-3.2a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.1 1.3 5.1 1.6 5.1 1.6a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.7 8c0 4.6 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V22"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6h.1A1.6 1.6 0 0 0 8.7 1.1V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 15 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  play: '<path d="M7 4.5v15l13-7.5z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H11"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M5 16a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2"/>',
  branch: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M18 10.5A6 6 0 0 1 12 16.5a6 6 0 0 0-6 1M6 8.5v7"/>',
  commit: '<circle cx="12" cy="12" r="3.5"/><path d="M2 12h6.5M15.5 12H22"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  lock: '<rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.2-8.2M16 7l2.5 2.5M14 9l2.5 2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  link: '<path d="M9 15 15 9M10.5 6.5 13 4a4.2 4.2 0 0 1 6 6l-2.5 2.5M13.5 17.5 11 20a4.2 4.2 0 0 1-6-6l2.5-2.5"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  code: '<path d="m8 6-6 6 6 6M16 6l6 6-6 6"/>',
  zap: '<path d="M13 2 4.5 13H11l-1 9 8.5-11H12z"/>',
  activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z"/>',
  sync: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5M3 18l9 5 9-5" opacity=".5"/>',
  doc: '<path d="M7 3h7l5 5v12a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V4.5A1.5 1.5 0 0 1 7 3z"/><path d="M14 3v5h5"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5 3.5 3.5M20.5 20.5 19 19M19 5l1.5-1.5M3.5 20.5 5 19"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  trash: '<path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 20L18 7"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2.5"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M5 21h14"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 1.5v3M15 1.5v3M9 19.5v3M15 19.5v3M1.5 9h3M1.5 15h3M19.5 9h3M19.5 15h3"/><rect x="10" y="10" width="4" height="4" rx="1"/>',
  box: '<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
  chevronUp: '<path d="m6 15 6-6 6 6"/>',
  gitlab: '<path d="m12 21-3.3-10.2H15.3z"/><path d="M12 21 3.3 14.6l1-3.2.8-2.7L8.7 10.8zM12 21l8.7-6.4-1-3.2-.8-2.7L15.3 10.8z" opacity=".55"/>',
  bitbucket: '<path d="M3.5 4h17l-2.6 16h-11.8z"/><path d="M9.5 14.5h5l.9-5.5H8.6z" opacity=".5"/>',
  rocket: '<path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2M9 13l-2 4M14.5 6.5 17 9M12 15s4.5-1 7-3.5C22 8.5 22 2 22 2s-6.5 0-9.5 3C10 7.5 9 12 9 12z"/><circle cx="15.5" cy="8.5" r="1.5"/>',
};

function Icon({ name, size = 18, className = "", style = {}, strokeWidth = 1.6 }) {
  const filled = name === "play" || name === "dot" || name === "jenkins" || name === "zap";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={{ flexShrink: 0, display: "block", ...style }}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || "" }} />
  );
}

/* ---------------- Status meta ---------------- */
const STATUS_META = {
  success:  { color: "var(--green)", dim: "var(--green-dim)", label: "Thành công", icon: "checkCircle" },
  failed:   { color: "var(--red)",   dim: "var(--red-dim)",   label: "Thất bại",   icon: "xCircle" },
  running:  { color: "var(--amber)", dim: "var(--amber-dim)", label: "Đang chạy",  icon: "dot" },
  queued:   { color: "var(--text-3)",dim: "var(--panel-3)",   label: "Hàng đợi",   icon: "clock" },
  skipped:  { color: "var(--text-3)",dim: "var(--panel-3)",   label: "Bỏ qua",     icon: "dot" },
  active:   { color: "var(--green)", dim: "var(--green-dim)", label: "Hoạt động",  icon: "dot" },
};

function StatusBadge({ status, size = "md", showLabel = true }) {
  const m = STATUS_META[status] || STATUS_META.queued;
  const pad = size === "sm" ? "2px 8px 2px 6px" : "3px 10px 3px 7px";
  const fs = size === "sm" ? 11.5 : 12.5;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: pad, borderRadius: 99,
      background: m.dim, color: m.color, fontSize: fs, fontWeight: 540, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>
      {status === "running"
        ? <span style={{ width: 7, height: 7, borderRadius: 99, background: m.color, animation: "pulse-dot 1.1s ease-in-out infinite" }} />
        : <Icon name={m.icon} size={size === "sm" ? 12 : 13} strokeWidth={2} />}
      {showLabel && m.label}
    </span>
  );
}

function StatusDot({ status, size = 8 }) {
  const m = STATUS_META[status] || STATUS_META.queued;
  return <span style={{ width: size, height: size, borderRadius: 99, background: m.color, flexShrink: 0,
    animation: status === "running" ? "pulse-dot 1.1s ease-in-out infinite" : "none" }} />;
}

/* ---------------- Button ---------------- */
function Button({ children, variant = "secondary", size = "md", icon, iconRight, onClick, disabled, loading, full, style = {}, title }) {
  const [hover, setHover] = useState(false);
  const sizes = {
    sm: { padding: icon && !children ? "0" : "0 10px", height: 30, fs: 13, gap: 6, sq: 30 },
    md: { padding: icon && !children ? "0" : "0 13px", height: 36, fs: 13.5, gap: 7, sq: 36 },
    lg: { padding: "0 18px", height: 42, fs: 14.5, gap: 8, sq: 42 },
  }[size];
  const variants = {
    primary:   { background: hover ? "var(--accent-hover)" : "var(--accent)", color: "var(--accent-fg)", border: "1px solid transparent", fontWeight: 600 },
    secondary: { background: hover ? "var(--panel-3)" : "var(--panel-2)", color: "var(--text)", border: "1px solid var(--border)", fontWeight: 540 },
    ghost:     { background: hover ? "var(--panel-2)" : "transparent", color: "var(--text-2)", border: "1px solid transparent", fontWeight: 540 },
    danger:    { background: hover ? "var(--red-dim)" : "transparent", color: "var(--red)", border: "1px solid var(--border)", fontWeight: 540 },
    outline:   { background: hover ? "var(--accent-dim)" : "transparent", color: "var(--accent)", border: "1px solid var(--accent-border)", fontWeight: 560 },
  }[variant];
  return (
    <button onClick={disabled || loading ? undefined : onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: sizes.gap,
        height: sizes.height, width: icon && !children ? sizes.sq : (full ? "100%" : "auto"),
        padding: sizes.padding, borderRadius: var_r(size), fontSize: sizes.fs, letterSpacing: "-.01em",
        transition: "background .14s, border-color .14s, opacity .14s, transform .08s",
        opacity: disabled ? 0.45 : 1, cursor: disabled || loading ? "default" : "pointer",
        whiteSpace: "nowrap", ...variants, ...style }}>
      {loading ? <Icon name="refresh" size={size === "lg" ? 17 : 15} style={{ animation: "spin .7s linear infinite" }} />
        : icon ? <Icon name={icon} size={size === "lg" ? 18 : size === "sm" ? 15 : 16} /> : null}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={size === "sm" ? 14 : 15} />}
    </button>
  );
}
function var_r(size) { return size === "lg" ? "var(--r-md)" : "var(--r-sm)"; }

/* ---------------- Card ---------------- */
function Card({ children, style = {}, pad = 20, hover = false, onClick, className = "" }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} className={className}
      onMouseEnter={() => hover && setH(true)} onMouseLeave={() => hover && setH(false)}
      style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)",
        padding: pad, transition: "border-color .15s, background .15s, transform .12s",
        cursor: onClick ? "pointer" : "default",
        borderColor: h ? "var(--border-strong)" : "var(--border)",
        ...style }}>
      {children}
    </div>
  );
}

/* ---------------- Input ---------------- */
function Input({ value, onChange, placeholder, type = "text", icon, mono, full, style = {}, onKeyDown, autoFocus, prefix, suffix }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: full ? "100%" : "auto",
      background: "var(--panel-2)", border: `1px solid ${focus ? "var(--accent-border)" : "var(--border)"}`,
      borderRadius: "var(--r-sm)", padding: "0 11px", height: 38, transition: "border-color .14s",
      boxShadow: focus ? "0 0 0 3px var(--accent-dim)" : "none", ...style }}>
      {icon && <Icon name={icon} size={16} style={{ color: "var(--text-3)" }} />}
      {prefix && <span style={{ color: "var(--text-3)", fontSize: 13.5 }} className={mono ? "mono" : ""}>{prefix}</span>}
      <input value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} type={type}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onKeyDown={onKeyDown} autoFocus={autoFocus}
        className={mono ? "mono" : ""}
        style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text)",
          fontSize: 13.5, minWidth: 0, letterSpacing: mono ? "0" : "-.01em" }} />
      {suffix}
    </div>
  );
}

/* ---------------- Avatar ---------------- */
function Avatar({ initials, size = 28, color }) {
  const palette = ["#14b8a6", "#60a5fa", "#a78bfa", "#fbbf24", "#f472b6", "#34d399"];
  const c = color || palette[(initials?.charCodeAt(0) || 0) % palette.length];
  return (
    <span style={{ width: size, height: size, borderRadius: 99, flexShrink: 0,
      background: `color-mix(in oklab, ${c} 20%, var(--panel))`, color: c,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 600, letterSpacing: "-.02em",
      border: `1px solid color-mix(in oklab, ${c} 30%, transparent)` }}>
      {initials}
    </span>
  );
}

/* ---------------- Lang dot ---------------- */
function LangDot({ language }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-2)", fontSize: 12.5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 99, background: LANG_COLORS[language] || "var(--text-3)" }} />
      {language}
    </span>
  );
}

/* ---------------- Modal ---------------- */
function Modal({ open, onClose, children, width = 540, title, subtitle }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "var(--overlay)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: "12vh", animation: "fade-in .16s ease" }}>
      <div onClick={(e) => e.stopPropagation()} className="" style={{ width, maxWidth: "92vw", background: "var(--panel)",
        border: "1px solid var(--border-strong)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)",
        animation: "scale-in .2s cubic-bezier(.2,.7,.3,1)", overflow: "hidden" }}>
        {title && (
          <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.02em" }}>{title}</div>
              {subtitle && <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>{subtitle}</div>}
            </div>
            <button onClick={onClose} style={{ color: "var(--text-3)", padding: 4, marginTop: -2, borderRadius: 6 }}><Icon name="x" size={18} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ---------------- Toast ---------------- */
function Toast({ toast }) {
  if (!toast) return null;
  const m = { success: { c: "var(--green)", i: "checkCircle" }, error: { c: "var(--red)", i: "xCircle" }, info: { c: "var(--accent)", i: "dot" } }[toast.type] || { c: "var(--accent)", i: "dot" };
  return (
    <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 200,
      background: "var(--panel)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)",
      padding: "11px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "var(--shadow-lg)",
      animation: "fade-up .25s cubic-bezier(.2,.7,.3,1)", fontSize: 13.5, fontWeight: 500 }}>
      <Icon name={m.i} size={17} style={{ color: m.c }} strokeWidth={2} />
      {toast.message}
    </div>
  );
}

/* ---------------- Misc helpers ---------------- */
function Tag({ children, color = "var(--text-2)", bg = "var(--panel-2)", mono, icon }) {
  return (
    <span className={mono ? "mono" : ""} style={{ display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: "var(--r-sm)", background: bg, color, fontSize: 12, fontWeight: 500,
      border: "1px solid var(--border)" }}>
      {icon && <Icon name={icon} size={12} />}{children}
    </span>
  );
}

function SectionLabel({ children, style = {} }) {
  return <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-3)", ...style }}>{children}</div>;
}

function fmtDur(s) {
  if (s == null) return "—";
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}m ${r}s`;
}

function Breadcrumb({ items, onNav }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--text-3)", flexWrap: "wrap" }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Icon name="chevronRight" size={14} style={{ color: "var(--text-3)" }} />}
          <span onClick={it.to ? () => onNav(it.to) : undefined}
            className={it.mono ? "mono" : ""}
            style={{ cursor: it.to ? "pointer" : "default", color: i === items.length - 1 ? "var(--text)" : "var(--text-2)",
              fontWeight: i === items.length - 1 ? 540 : 500, transition: "color .12s" }}
            onMouseEnter={(e) => it.to && (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => it.to && (e.currentTarget.style.color = i === items.length - 1 ? "var(--text)" : "var(--text-2)")}>
            {it.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

export { Icon, StatusBadge, StatusDot, STATUS_META, Button, Card, Input, Avatar, LangDot, Modal, Toast, Tag, SectionLabel, fmtDur, Breadcrumb };
