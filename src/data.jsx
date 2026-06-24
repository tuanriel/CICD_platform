/* ============================================================
   Mock data — CICD Platform
   UI labels in Vietnamese; technical content stays in English.
   ============================================================ */

const GH_AVAILABLE_REPOS = [
  { fullName: "fpt-cloud/payment-gateway", name: "payment-gateway", private: true,  language: "Go",        desc: "Cổng thanh toán nội bộ — Gin + PostgreSQL", stars: 142, updated: "2 giờ trước",  hasWorkflow: true,  branches: ["main", "develop", "release/v2"] },
  { fullName: "fpt-cloud/identity-service", name: "identity-service", private: true, language: "Go",        desc: "Xác thực & phân quyền tập trung (OAuth2/OIDC)", stars: 88, updated: "hôm qua",     hasWorkflow: true,  branches: ["main", "develop"] },
  { fullName: "fpt-cloud/web-portal",       name: "web-portal",      private: false, language: "TypeScript", desc: "Portal quản trị khách hàng — Next.js", stars: 67,  updated: "3 ngày trước", hasWorkflow: true,  branches: ["main", "preview"] },
  { fullName: "fpt-cloud/notification-hub", name: "notification-hub",private: true,  language: "Go",        desc: "Dịch vụ gửi thông báo đa kênh", stars: 41,  updated: "5 ngày trước", hasWorkflow: false, branches: ["master", "dev"] },
  { fullName: "fpt-cloud/data-pipeline",    name: "data-pipeline",   private: true,  language: "Python",     desc: "ETL & batch jobs cho data lake", stars: 33,  updated: "1 tuần trước", hasWorkflow: true,  branches: ["main"] },
  { fullName: "fpt-cloud/mobile-api",       name: "mobile-api",      private: true,  language: "Go",        desc: "BFF cho ứng dụng mobile", stars: 29, updated: "2 tuần trước", hasWorkflow: false, branches: ["master", "develop"] },
];

const STAGE_PRESETS = {
  backend: ["Checkout", "Setup Go", "Lint", "Unit Test", "Build", "Security Scan", "Docker Push", "Deploy"],
  frontend: ["Checkout", "Install Deps", "Lint", "Type Check", "Test", "Build", "Deploy Preview"],
  data: ["Checkout", "Setup Python", "Lint", "Test", "Package", "Deploy"],
};

function mkRun(number, status, branch, stagePreset, opts = {}) {
  const stages = STAGE_PRESETS[stagePreset];
  let stageStates;
  if (status === "success") stageStates = stages.map((n) => ({ name: n, status: "success", duration: 8 + Math.floor(Math.random() * 90) }));
  else if (status === "failed") {
    const failAt = opts.failAt ?? stages.length - 2;
    stageStates = stages.map((n, i) => ({ name: n, status: i < failAt ? "success" : i === failAt ? "failed" : "skipped", duration: i <= failAt ? 8 + Math.floor(Math.random() * 70) : 0 }));
  } else if (status === "running") {
    const at = opts.at ?? 3;
    stageStates = stages.map((n, i) => ({ name: n, status: i < at ? "success" : i === at ? "running" : "queued", duration: i < at ? 8 + Math.floor(Math.random() * 70) : 0 }));
  } else stageStates = stages.map((n) => ({ name: n, status: "queued", duration: 0 }));

  return {
    id: "run_" + Math.random().toString(36).slice(2, 9),
    number, status, branch,
    commit: opts.commit || Math.random().toString(16).slice(2, 9),
    message: opts.message || "chore: update dependencies",
    author: opts.author || "trang.nguyen",
    avatar: opts.avatar || "TN",
    trigger: opts.trigger || "push",
    startedAt: opts.startedAt || "12 phút trước",
    duration: opts.duration || (status === "running" ? null : 60 + Math.floor(Math.random() * 240)),
    stages: stageStates,
  };
}

const PIPELINES = [
  {
    id: "pl_api_ci", repoId: "r1", name: "ci.yml", path: ".workflow/ci.yml", title: "Continuous Integration",
    preset: "backend", status: "success", triggers: ["push", "pull_request"], branchFilter: "main, develop, feature/*",
    lastRun: "12 phút trước", successRate: 96, avgDuration: 184,
    runs: [
      mkRun(248, "success", "main", "backend", { message: "feat: thêm endpoint refund", author: "trang.nguyen", avatar: "TN", commit: "a3f91c2", startedAt: "12 phút trước", duration: 176 }),
      mkRun(247, "failed", "feature/webhook-retry", "backend", { message: "fix: retry policy cho webhook", author: "long.pham", avatar: "LP", commit: "7d20be4", startedAt: "1 giờ trước", duration: 92, failAt: 5, trigger: "pull_request" }),
      mkRun(246, "success", "develop", "backend", { message: "refactor: tách service layer", author: "minh.le", avatar: "ML", commit: "c81a09f", startedAt: "3 giờ trước", duration: 201 }),
      mkRun(245, "success", "main", "backend", { message: "chore: bump go 1.22", author: "trang.nguyen", avatar: "TN", commit: "2e4471d", startedAt: "hôm qua", duration: 168 }),
      mkRun(244, "success", "main", "backend", { message: "docs: cập nhật README triển khai", author: "long.pham", avatar: "LP", commit: "9af0c13", startedAt: "hôm qua", duration: 159 }),
    ],
  },
  {
    id: "pl_api_cd", repoId: "r1", name: "deploy.yml", path: ".workflow/deploy.yml", title: "Deploy Production",
    preset: "backend", status: "success", triggers: ["release"], branchFilter: "main",
    lastRun: "hôm qua", successRate: 100, avgDuration: 312,
    runs: [
      mkRun(57, "success", "main", "backend", { message: "release: v2.4.0", author: "trang.nguyen", avatar: "TN", commit: "v2.4.0", startedAt: "hôm qua", duration: 305, trigger: "release" }),
      mkRun(56, "success", "main", "backend", { message: "release: v2.3.1", author: "minh.le", avatar: "ML", commit: "v2.3.1", startedAt: "4 ngày trước", duration: 298, trigger: "release" }),
    ],
  },
  {
    id: "pl_id_ci", repoId: "r2", name: "ci.yml", path: ".workflow/ci.yml", title: "Continuous Integration",
    preset: "backend", status: "running", triggers: ["push", "pull_request"], branchFilter: "main, develop",
    lastRun: "đang chạy", successRate: 91, avgDuration: 142,
    runs: [
      mkRun(132, "running", "develop", "backend", { message: "feat: rotate signing key", author: "minh.le", avatar: "ML", commit: "b1c9e0a", startedAt: "vừa xong", at: 3 }),
      mkRun(131, "success", "main", "backend", { message: "fix: token expiry edge case", author: "long.pham", avatar: "LP", commit: "55ad81f", startedAt: "2 giờ trước", duration: 138 }),
    ],
  },
  {
    id: "pl_web_ci", repoId: "r3", name: "ci.yml", path: ".workflow/ci.yml", title: "Build & Preview",
    preset: "frontend", status: "failed", triggers: ["push", "pull_request"], branchFilter: "main, *",
    lastRun: "40 phút trước", successRate: 84, avgDuration: 96,
    runs: [
      mkRun(311, "failed", "feature/new-dashboard", "frontend", { message: "wip: redesign dashboard", author: "ha.vu", avatar: "HV", commit: "e0d7a91", startedAt: "40 phút trước", duration: 54, failAt: 4, trigger: "pull_request" }),
      mkRun(310, "success", "main", "frontend", { message: "feat: dark mode toggle", author: "ha.vu", avatar: "HV", commit: "1f8c0b2", startedAt: "5 giờ trước", duration: 91 }),
    ],
  },
  {
    id: "pl_data_ci", repoId: "r5", name: "ci.yml", path: ".workflow/ci.yml", title: "Test & Package",
    preset: "data", status: "success", triggers: ["push"], branchFilter: "main",
    lastRun: "2 giờ trước", successRate: 93, avgDuration: 121,
    runs: [
      mkRun(78, "success", "main", "data", { message: "feat: thêm dim_customer", author: "khoa.tran", avatar: "KT", commit: "aa12f09", startedAt: "2 giờ trước", duration: 118 }),
    ],
  },
];

const INITIAL_REPOS = [
  { id: "r1", fullName: "fpt-cloud/payment-gateway", name: "payment-gateway", private: true,  language: "Go",         defaultBranch: "main",    lastSync: "5 phút trước",  pipelineCount: 2, status: "active" },
  { id: "r2", fullName: "fpt-cloud/identity-service", name: "identity-service", private: true, language: "Go",         defaultBranch: "main",    lastSync: "vừa xong",      pipelineCount: 1, status: "active" },
  { id: "r3", fullName: "fpt-cloud/web-portal",       name: "web-portal",       private: false, language: "TypeScript", defaultBranch: "main",    lastSync: "12 phút trước", pipelineCount: 1, status: "active" },
  { id: "r5", fullName: "fpt-cloud/data-pipeline",    name: "data-pipeline",    private: true,  language: "Python",     defaultBranch: "main",    lastSync: "1 giờ trước",   pipelineCount: 1, status: "active" },
];

const LANG_COLORS = {
  Go: "#00ADD8", TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Rust: "#dea584", Java: "#b07219",
};

const WEBHOOK_EVENTS = [
  { id: "push", label: "Push", desc: "Khi có commit được push lên nhánh bất kỳ", enabled: true },
  { id: "pull_request", label: "Pull Request", desc: "Mở, cập nhật hoặc merge pull request", enabled: true },
  { id: "release", label: "Release", desc: "Khi publish một release/tag mới", enabled: true },
  { id: "delete", label: "Branch / Tag Delete", desc: "Khi xoá nhánh hoặc tag", enabled: false },
  { id: "issues", label: "Issues", desc: "Tạo, đóng, gán nhãn issue", enabled: false },
];

const WEBHOOK_DELIVERIES = [
  { id: "d1", event: "push",         status: 200, branch: "main",                    repo: "payment-gateway",  at: "12 phút trước", triggered: "ci.yml" },
  { id: "d2", event: "pull_request", status: 200, branch: "feature/webhook-retry",   repo: "payment-gateway",  at: "1 giờ trước",   triggered: "ci.yml" },
  { id: "d3", event: "push",         status: 200, branch: "develop",                 repo: "identity-service", at: "1 giờ trước",   triggered: "ci.yml" },
  { id: "d4", event: "pull_request", status: 500, branch: "feature/new-dashboard",   repo: "web-portal",       at: "40 phút trước", triggered: "ci.yml" },
  { id: "d5", event: "release",      status: 200, branch: "main",                    repo: "payment-gateway",  at: "hôm qua",       triggered: "deploy.yml" },
  { id: "d6", event: "push",         status: 200, branch: "main",                    repo: "data-pipeline",    at: "2 giờ trước",   triggered: "ci.yml" },
];

const JENKINS = {
  url: "https://jenkins.fpt-cloud.internal",
  status: "connected",
  version: "2.452.1 LTS",
  jobs: 7,
  executors: { total: 8, busy: 2 },
};

const SAMPLE_YAML = `# .workflow/ci.yml
name: Continuous Integration
on:
  push:
    branches: [main, develop]
  pull_request:

env:
  GO_VERSION: "1.22"

stages:
  - name: Checkout
    uses: actions/checkout

  - name: Setup Go
    uses: setup-go
    with:
      version: \${GO_VERSION}

  - name: Lint
    run: golangci-lint run ./...

  - name: Unit Test
    run: go test -race -cover ./...

  - name: Build
    run: go build -o bin/app ./cmd/server

  - name: Docker Push
    run: |
      docker build -t registry/app:\${SHA} .
      docker push registry/app:\${SHA}
`;

const SAMPLE_JENKINS = `// Generated by CICD Platform — parser v1.4
pipeline {
  agent any
  environment {
    GO_VERSION = '1.22'
  }
  stages {
    stage('Checkout') {
      steps { checkout scm }
    }
    stage('Setup Go') {
      steps { sh 'gvm use go\${GO_VERSION}' }
    }
    stage('Lint') {
      steps { sh 'golangci-lint run ./...' }
    }
    stage('Unit Test') {
      steps { sh 'go test -race -cover ./...' }
    }
    stage('Build') {
      steps { sh 'go build -o bin/app ./cmd/server' }
    }
    stage('Docker Push') {
      steps {
        sh '''
          docker build -t registry/app:\${SHA} .
          docker push registry/app:\${SHA}
        '''
      }
    }
  }
  post {
    always { cleanWs() }
  }
}`;

// Log line generator for streaming build logs
function buildLogScript(stageNames) {
  const lines = [];
  const push = (level, text) => lines.push({ level, text });
  push("meta", "Khởi tạo runner · ubuntu-22.04 · 4 vCPU / 8GB");
  push("meta", "Nhận webhook từ GitHub → trigger pipeline ci.yml");
  stageNames.forEach((st) => {
    push("group", st);
    if (st === "Checkout") {
      push("cmd", "$ git clone https://github.com/fpt-cloud/payment-gateway");
      push("info", "Cloning into 'payment-gateway'...");
      push("info", "Checked out a3f91c2 (main)");
    } else if (st.startsWith("Setup")) {
      push("cmd", "$ setup-go --version 1.22");
      push("info", "go version go1.22.3 linux/amd64");
    } else if (st === "Lint") {
      push("cmd", "$ golangci-lint run ./...");
      push("info", "0 issues found across 184 files");
    } else if (st.includes("Test")) {
      push("cmd", "$ go test -race -cover ./...");
      push("info", "ok  internal/payment   1.204s  coverage: 88.2%");
      push("info", "ok  internal/webhook   0.642s  coverage: 91.0%");
    } else if (st === "Build") {
      push("cmd", "$ go build -o bin/app ./cmd/server");
      push("info", "Build succeeded → bin/app (24.1 MB)");
    } else if (st.includes("Security")) {
      push("cmd", "$ trivy fs --severity HIGH,CRITICAL .");
      push("warn", "1 MEDIUM vulnerability ignored by policy");
      push("info", "No HIGH/CRITICAL findings");
    } else if (st.includes("Docker")) {
      push("cmd", "$ docker build -t registry/app:a3f91c2 .");
      push("info", "Successfully pushed registry/app:a3f91c2");
    } else if (st.includes("Deploy")) {
      push("cmd", "$ kubectl rollout restart deploy/app -n prod");
      push("info", "deployment.apps/app restarted");
    } else {
      push("cmd", "$ run " + st.toLowerCase());
      push("info", "done");
    }
    push("ok", "✓ " + st + " hoàn tất");
  });
  return lines;
}

export { GH_AVAILABLE_REPOS, PIPELINES, INITIAL_REPOS, LANG_COLORS, WEBHOOK_EVENTS, WEBHOOK_DELIVERIES, JENKINS, SAMPLE_YAML, SAMPLE_JENKINS, STAGE_PRESETS, mkRun, buildLogScript };
