# CICD Pipeline Platform — React + Vite + Tailwind CSS

Một SPA quản lý & chạy CI/CD pipeline (đồng bộ từ GitHub Actions, webhook, quản lý PAT đa nhà cung cấp). Giao diện tiếng Việt, nội dung kỹ thuật giữ tiếng Anh. Phong cách Vercel/Linear — dark-first, accent teal, font Geist.

## Chạy dự án

```bash
npm install
npm run dev      # mở http://localhost:5173
npm run build    # build production vào dist/
npm run preview  # xem thử bản build
```

Yêu cầu Node.js ≥ 18.

## Cấu trúc

```
react-tailwind/
├── index.html              # entry HTML (nạp /src/main.jsx, font Geist)
├── vite.config.js          # Vite + @vitejs/plugin-react
├── tailwind.config.js      # design tokens → Tailwind utilities
├── postcss.config.js       # tailwindcss + autoprefixer
└── src/
    ├── main.jsx            # App: router (state-based), command palette, tweaks
    ├── index.css           # @tailwind + design tokens (CSS variables)
    ├── primitives.jsx      # Icon, Button, Card, Input, Modal, StatusBadge, Tag…
    ├── layout.jsx          # Sidebar, Topbar, Page, PageHeader
    ├── tweaks-panel.jsx    # panel đổi theme / accent / radius
    ├── data.jsx            # mock data: repos, pipelines, runs, webhook, jenkins
    ├── data-build.jsx      # mock data: PAT tokens, providers
    ├── data-pipeline.jsx   # GitHub Actions workflows mẫu + parser YAML→pipeline
    └── views-*.jsx         # các màn hình: dashboard, repos, pipeline, pat…
```

Mỗi file là một ES module: export các component/dữ liệu và import lẫn nhau (chuyển từ mô hình script-tag/`window` của bản gốc).

## Hệ thiết kế (design tokens)

Toàn bộ token màu/bo góc/font/shadow là **CSS custom properties** trong `src/index.css`, với 2 theme dark/light điều khiển qua thuộc tính `[data-theme]` trên `<html>`. Đây là nguồn chân lý duy nhất của theme — đổi token ở một nơi, cả app đổi theo, và việc chuyển sáng/tối chỉ là đổi một thuộc tính.

`tailwind.config.js` ánh xạ các token này thành utility class, nên bạn dùng được trực tiếp:

| Token (CSS var) | Tailwind utility |
|---|---|
| `var(--panel)`, `var(--panel-2)` | `bg-panel`, `bg-panel-2` |
| `var(--text)`, `var(--text-2)`, `var(--text-3)` | `text-text`, `text-text-2`, `text-text-3` |
| `var(--accent)`, `var(--accent-dim)` | `text-accent` / `bg-accent`, `bg-accent-dim` |
| `var(--border)`, `var(--border-strong)` | `border-border`, `border-border-strong` |
| `var(--green/red/amber)` + `-dim` | `text-green`, `bg-red-dim`… |
| `var(--r-md)`, `var(--r-lg)` | `rounded-md`, `rounded-lg` |
| `var(--font-mono)` | `font-mono` |

## Trạng thái style hiện tại & cách migrate sang Tailwind

Các component được port **nguyên vẹn** từ bản đang chạy nên ổn định và giống hệt về giao diện. Phần lớn vẫn dùng **inline style** trỏ tới cùng bộ CSS variables ở trên. Tailwind đã được wire đầy đủ (theme + tokens) để bạn chuyển dần inline style → utility class mà không phải đụng vào hệ màu.

Ví dụ mẫu chuyển đổi:

```jsx
// trước — inline style
<div style={{ display: "flex", alignItems: "center", gap: 10,
  padding: "12px 16px", background: "var(--panel)",
  border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>

// sau — Tailwind
<div className="flex items-center gap-2.5 px-4 py-3 bg-panel border border-border rounded-md">
```

Những giá trị **động** (màu theo trạng thái, chiều cao bar, %… tính trong JS) nên giữ ở inline style — đó cũng là cách dùng Tailwind đúng chuẩn. Có thể migrate từng màn hình một, bắt đầu từ `primitives.jsx` (Button/Card/Input/Tag/Badge) để hưởng hiệu ứng lan toả khắp app.

## Ghi chú

- Dữ liệu là **mock** (không gọi API thật). Token PAT, build log, webhook delivery… đều mô phỏng.
- Router dựa trên state (không dùng URL). Có thể thay bằng React Router nếu cần deep-link.
- Panel "Tweaks" là tiện ích đổi nhanh theme/accent/radius khi xem thử.
# CICD_platform
