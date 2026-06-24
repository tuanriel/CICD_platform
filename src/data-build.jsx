

/* ============================================================
   Mock data — Build service (AWS CodeBuild-style)
   UI labels in Vietnamese; technical content stays in English.
   ============================================================ */

/* ---------------- Compute & environment options ---------------- */
const COMPUTE_TYPES = [
  { id: "general1.small",  label: "3 GB bộ nhớ, 2 vCPU",   mem: "3 GB",  vcpu: 2 },
  { id: "general1.medium", label: "7 GB bộ nhớ, 4 vCPU",   mem: "7 GB",  vcpu: 4 },
  { id: "general1.large",  label: "15 GB bộ nhớ, 8 vCPU",  mem: "15 GB", vcpu: 8 },
];

const BUILD_IMAGES = [
  "aws/codebuild/amazonlinux-x86_64-standard:5.0",
  "aws/codebuild/amazonlinux-aarch64-standard:3.0",
  "aws/codebuild/standard:7.0",
];

const RUNTIME_PRESETS = {
  python: { runtime: "python: 3.12", install: ["pip install -r requirements.txt"], pre: ["pytest -q --maxfail=1"], build: ["python -m build", "python scripts/package.py"], post: ["echo Done · artifact in dist/"] },
  node:   { runtime: "nodejs: 20",   install: ["npm ci"],                          pre: ["npm run lint", "npm test -- --runInBand"], build: ["npm run build"], post: ["echo Build size $(du -sh dist | cut -f1)"] },
  go:     { runtime: "golang: 1.22", install: ["go mod download"],                 pre: ["go vet ./...", "go test -race -cover ./..."], build: ["go build -o bin/app ./cmd/server"], post: ["docker build -t $IMAGE_REPO:$IMAGE_TAG .", "docker push $IMAGE_REPO:$IMAGE_TAG"] },
};

/* ---------------- Build phases (CodeBuild model) ---------------- */
const BUILD_PHASES = [
  "SUBMITTED", "QUEUED", "PROVISIONING", "DOWNLOAD_SOURCE",
  "INSTALL", "PRE_BUILD", "BUILD", "POST_BUILD",
  "UPLOAD_ARTIFACTS", "FINALIZING", "COMPLETED",
];
// phases that actually run user buildspec commands
const COMMAND_PHASES = ["INSTALL", "PRE_BUILD", "BUILD", "POST_BUILD"];

const PHASE_BASE = {
  SUBMITTED: 0, QUEUED: 1, PROVISIONING: 16, DOWNLOAD_SOURCE: 3,
  INSTALL: 14, PRE_BUILD: 8, BUILD: 38, POST_BUILD: 6,
  UPLOAD_ARTIFACTS: 4, FINALIZING: 2, COMPLETED: 0,
};

function uuid() {
  const h = () => Math.random().toString(16).slice(2, 6);
  return `${h()}${h()}-${h()}-4${h().slice(1)}-${h()}-${h()}${h()}${h()}`;
}

function mkBuild(projectName, number, status, opts = {}) {
  const failPhase = opts.failAt || "PRE_BUILD";
  let reached = true;
  const phases = BUILD_PHASES.map((name) => {
    let st = "success";
    let dur = PHASE_BASE[name] + Math.floor(Math.random() * (PHASE_BASE[name] ? 6 : 0));
    if (name === "COMPLETED") { dur = 0; }
    if (status === "failed") {
      if (!reached) { st = "skipped"; dur = 0; }
      else if (name === failPhase) { st = "failed"; reached = false; }
    } else if (status === "running") {
      const at = opts.at || "BUILD";
      if (name === at) { st = "running"; dur = 0; reached = false; }
      else if (!reached) { st = "queued"; dur = 0; }
    }
    return { name, status: st, duration: dur };
  });
  const total = phases.reduce((a, p) => a + (p.status === "success" || p.status === "failed" ? p.duration : 0), 0);
  return {
    id: `${projectName}:${uuid()}`,
    number, status,
    sourceVersion: opts.sourceVersion || "-",
    submitter: opts.submitter || "tuanbess",
    trigger: opts.trigger || "webhook",
    branch: opts.branch || "main",
    commit: opts.commit || Math.random().toString(16).slice(2, 9),
    message: opts.message || "chore: update dependencies",
    startedAt: opts.startedAt || "3 ngày trước",
    duration: status === "running" ? null : (opts.duration != null ? opts.duration : total),
    phases,
  };
}

/* ---------------- Build projects ---------------- */
const BUILD_PROJECTS = [
  {
    id: "bp_cicd_demo", name: "CICD_demo", kind: "python",
    sourceProvider: "GitHub", repo: "tuanriel/pdf_ocr", repoUrl: "https://github.com/tuanriel/pdf_ocr",
    description: "—", lastModified: "29 phút trước", region: "us-east-1",
    sourceVersion: "", webhook: true, events: ["PUSH", "PULL_REQUEST_CREATED", "PULL_REQUEST_UPDATED"],
    env: { image: "aws/codebuild/amazonlinux-x86_64-standard:5.0", computeType: "general1.small", os: "Amazon Linux", privileged: false, serviceRole: "codebuild-CICD_demo-service-role" },
    buildspecMode: "file", buildspecName: "buildspec.yml",
    artifacts: "none", cache: "local",
    builds: [],
  },
  {
    id: "bp_cicd", name: "CICD", kind: "node",
    sourceProvider: "GitHub", repo: "tuanriel/pttkht", repoUrl: "https://github.com/tuanriel/pttkht",
    description: "—", lastModified: "3 ngày trước", region: "us-east-1",
    sourceVersion: "", webhook: true, events: ["PUSH"],
    env: { image: "aws/codebuild/amazonlinux-x86_64-standard:5.0", computeType: "general1.small", os: "Amazon Linux", privileged: false, serviceRole: "codebuild-CICD-service-role" },
    buildspecMode: "file", buildspecName: "buildspec.yml",
    artifacts: "s3", cache: "none",
    builds: [
      mkBuild("CICD", 1, "success", { submitter: "root", duration: 10, startedAt: "3 ngày trước", trigger: "manual", sourceVersion: "-", commit: "f4a91c0", message: "init: add buildspec.yml" }),
    ],
  },
  {
    id: "bp_payment", name: "payment-gateway-ci", kind: "go",
    sourceProvider: "GitHub", repo: "fpt-cloud/payment-gateway", repoUrl: "https://github.com/fpt-cloud/payment-gateway",
    description: "Build & test Go service, push image lên ECR", lastModified: "12 phút trước", region: "us-east-1",
    sourceVersion: "main", webhook: true, events: ["PUSH", "PULL_REQUEST_CREATED"],
    env: { image: "aws/codebuild/amazonlinux-x86_64-standard:5.0", computeType: "general1.medium", os: "Amazon Linux", privileged: true, serviceRole: "codebuild-payment-service-role" },
    buildspecMode: "file", buildspecName: "buildspec.yml",
    artifacts: "s3", cache: "local",
    builds: [
      mkBuild("payment-gateway-ci", 248, "success", { duration: 184, startedAt: "12 phút trước", branch: "main", commit: "a3f91c2", message: "feat: thêm endpoint refund", submitter: "trang.nguyen" }),
      mkBuild("payment-gateway-ci", 247, "failed", { duration: 92, startedAt: "1 giờ trước", branch: "feature/webhook-retry", commit: "7d20be4", message: "fix: retry policy cho webhook", submitter: "long.pham", trigger: "webhook", failAt: "PRE_BUILD" }),
      mkBuild("payment-gateway-ci", 246, "success", { duration: 201, startedAt: "3 giờ trước", branch: "develop", commit: "c81a09f", message: "refactor: tách service layer", submitter: "minh.le" }),
      mkBuild("payment-gateway-ci", 245, "success", { duration: 168, startedAt: "hôm qua", branch: "main", commit: "2e4471d", message: "chore: bump go 1.22", submitter: "trang.nguyen" }),
    ],
  },
  {
    id: "bp_webportal", name: "web-portal-build", kind: "node",
    sourceProvider: "GitHub", repo: "fpt-cloud/web-portal", repoUrl: "https://github.com/fpt-cloud/web-portal",
    description: "Next.js portal — build & deploy preview", lastModified: "40 phút trước", region: "us-east-1",
    sourceVersion: "main", webhook: true, events: ["PUSH", "PULL_REQUEST_CREATED"],
    env: { image: "aws/codebuild/standard:7.0", computeType: "general1.small", os: "Ubuntu", privileged: false, serviceRole: "codebuild-web-portal-service-role" },
    buildspecMode: "file", buildspecName: "buildspec.yml",
    artifacts: "s3", cache: "local",
    builds: [
      mkBuild("web-portal-build", 311, "failed", { duration: 54, startedAt: "40 phút trước", branch: "feature/new-dashboard", commit: "e0d7a91", message: "wip: redesign dashboard", submitter: "ha.vu", trigger: "webhook", failAt: "BUILD" }),
      mkBuild("web-portal-build", 310, "success", { duration: 91, startedAt: "5 giờ trước", branch: "main", commit: "1f8c0b2", message: "feat: dark mode toggle", submitter: "ha.vu" }),
    ],
  },
  {
    id: "bp_data", name: "data-pipeline-test", kind: "python",
    sourceProvider: "GitHub", repo: "fpt-cloud/data-pipeline", repoUrl: "https://github.com/fpt-cloud/data-pipeline",
    description: "ETL — test & package", lastModified: "2 giờ trước", region: "us-east-1",
    sourceVersion: "main", webhook: false, events: [],
    env: { image: "aws/codebuild/amazonlinux-x86_64-standard:5.0", computeType: "general1.small", os: "Amazon Linux", privileged: false, serviceRole: "codebuild-data-service-role" },
    buildspecMode: "file", buildspecName: "buildspec.yml",
    artifacts: "none", cache: "local",
    builds: [
      mkBuild("data-pipeline-test", 78, "running", { startedAt: "vừa xong", branch: "main", commit: "aa12f09", message: "feat: thêm dim_customer", submitter: "khoa.tran", at: "BUILD", trigger: "webhook" }),
      mkBuild("data-pipeline-test", 77, "success", { duration: 118, startedAt: "2 giờ trước", branch: "main", commit: "bb0912a", message: "fix: null handling", submitter: "khoa.tran" }),
    ],
  },
];

function allBuilds() {
  return BUILD_PROJECTS.flatMap((p) => p.builds.map((b) => ({ ...b, project: p })));
}

function projectLatestStatus(p) {
  return p.builds[0]?.status || null;
}

/* ---------------- Sample buildspec ---------------- */
const SAMPLE_BUILDSPEC = `version: 0.2

env:
  variables:
    GO_VERSION: "1.22"
    IMAGE_REPO: "registry.fpt-cloud/payment-gateway"
  parameter-store:
    DOCKER_TOKEN: /cicd/docker/token

phases:
  install:
    runtime-versions:
      golang: 1.22
    commands:
      - echo Cài đặt dependencies...
      - go mod download
  pre_build:
    commands:
      - go vet ./...
      - go test -race -cover ./...
  build:
    commands:
      - echo Build bắt đầu lúc \`date\`
      - go build -o bin/app ./cmd/server
  post_build:
    commands:
      - docker build -t $IMAGE_REPO:$CODEBUILD_RESOLVED_SOURCE_VERSION .
      - docker push $IMAGE_REPO:$CODEBUILD_RESOLVED_SOURCE_VERSION

artifacts:
  files:
    - bin/app
    - appspec.yml
  name: payment-gateway-$(date +%Y%m%d)

cache:
  paths:
    - '/go/pkg/mod/**/*'
`;

/* ---------------- CloudWatch-style log generator ---------------- */
function ts(offset) {
  const base = new Date("2026-06-17T03:14:20Z").getTime() + offset * 137;
  const d = new Date(base);
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(d.getUTCMilliseconds(), 3)}`;
}

// Returns array of { level, phase, text } for a whole build (used for finished builds)
function buildPhaseLogScript(project, opts = {}) {
  const rp = RUNTIME_PRESETS[project.kind] || RUNTIME_PRESETS.go;
  const lines = [];
  let i = 0;
  const add = (level, text, phase) => lines.push({ level, phase, text: `[Container] ${ts(i++)} ${text}` });
  const raw = (level, text, phase) => lines.push({ level, phase, text });

  raw("phase", "PROVISIONING", "PROVISIONING");
  add("meta", "Waiting for agent ping", "PROVISIONING");
  add("meta", "Running on CodeBuild fleet · " + project.env.image.split("/").pop(), "PROVISIONING");
  add("info", "Phase context status code:  Message:", "PROVISIONING");

  raw("phase", "DOWNLOAD_SOURCE", "DOWNLOAD_SOURCE");
  add("cmd", `$ git clone ${project.repoUrl}`, "DOWNLOAD_SOURCE");
  add("info", `Cloning into '${project.repo.split("/").pop()}'...`, "DOWNLOAD_SOURCE");
  add("info", `CODEBUILD_SRC_DIR=/codebuild/output/src${Math.floor(Math.random()*1e6)}/src`, "DOWNLOAD_SOURCE");
  add("info", `YAML location is /codebuild/readonly/buildspec.yml`, "DOWNLOAD_SOURCE");
  add("info", `Checked out ${opts.commit || "a3f91c2"} (${opts.branch || "main"})`, "DOWNLOAD_SOURCE");

  const cmdPhase = (phase, label, cmds) => {
    raw("phase", phase, phase);
    add("info", `Entering phase ${phase}`, phase);
    cmds.forEach((c) => {
      add("cmd", `Running command ${c}`, phase);
      if (c.includes("test")) { add("info", "ok    coverage: 88.2% of statements", phase); }
      else if (c.includes("download") || c.includes("ci") || c.includes("install")) { add("info", "Resolved dependencies in 4.2s", phase); }
      else if (c.includes("build")) { add("info", "Build succeeded → output artifacts ready", phase); }
      else if (c.includes("docker push")) { add("info", "Pushed digest sha256:" + Math.random().toString(16).slice(2,14), phase); }
    });
    add("ok", `Phase complete: ${phase} State: SUCCEEDED`, phase);
  };
  cmdPhase("INSTALL", "install", [`echo Cài đặt runtime ${rp.runtime}`, ...rp.install]);

  if (opts.failAt === "PRE_BUILD") {
    raw("phase", "PRE_BUILD", "PRE_BUILD");
    add("info", "Entering phase PRE_BUILD", "PRE_BUILD");
    add("cmd", `Running command ${rp.pre[0]}`, "PRE_BUILD");
    add("error", "FAIL  tests failed: 2 assertions", "PRE_BUILD");
    add("error", "Phase complete: PRE_BUILD State: FAILED", "PRE_BUILD");
    add("error", "Phase context status code: COMMAND_EXECUTION_ERROR Message: Error while executing command. Reason: exit status 1", "PRE_BUILD");
    return lines;
  }
  cmdPhase("PRE_BUILD", "pre_build", rp.pre);

  if (opts.failAt === "BUILD") {
    raw("phase", "BUILD", "BUILD");
    add("info", "Entering phase BUILD", "BUILD");
    add("cmd", `Running command ${rp.build[0]}`, "BUILD");
    add("error", "error: compilation failed (1 error)", "BUILD");
    add("error", "Phase complete: BUILD State: FAILED", "BUILD");
    add("error", "Phase context status code: COMMAND_EXECUTION_ERROR Message: exit status 2", "BUILD");
    return lines;
  }
  cmdPhase("BUILD", "build", rp.build);
  cmdPhase("POST_BUILD", "post_build", rp.post);

  raw("phase", "UPLOAD_ARTIFACTS", "UPLOAD_ARTIFACTS");
  if (project.artifacts === "s3") {
    add("info", "Uploading artifacts to S3 bucket codebuild-artifacts-us-east-1", "UPLOAD_ARTIFACTS");
    add("ok", "Phase complete: UPLOAD_ARTIFACTS State: SUCCEEDED", "UPLOAD_ARTIFACTS");
  } else {
    add("info", "No artifacts to upload, skipping", "UPLOAD_ARTIFACTS");
  }
  raw("phase", "FINALIZING", "FINALIZING");
  add("ok", "Phase complete: FINALIZING State: SUCCEEDED", "FINALIZING");
  add("ok", "Build completed · status SUCCEEDED", "COMPLETED");
  return lines;
}

// command list for one command-phase during live streaming
function phaseCommandLines(project, phase) {
  const rp = RUNTIME_PRESETS[project.kind] || RUNTIME_PRESETS.go;
  let n = 0;
  const ln = (level, text) => ({ level, text: `[Container] ${ts(n++)} ${text}` });
  if (phase === "DOWNLOAD_SOURCE") {
    return [ln("cmd", `$ git clone ${project.repoUrl}`), ln("info", `Checked out main`)];
  }
  const map = { INSTALL: rp.install, PRE_BUILD: rp.pre, BUILD: rp.build, POST_BUILD: rp.post };
  const cmds = map[phase] || [];
  const out = [ln("info", `Entering phase ${phase}`)];
  cmds.forEach((c) => out.push(ln("cmd", `Running command ${c}`)));
  out.push(ln("ok", `Phase complete: ${phase} State: SUCCEEDED`));
  return out;
}

/* ---------------- PAT key management ---------------- */
const PAT_PROVIDERS = [
  { id: "github",    name: "GitHub",    icon: "github", available: true,  hint: "github.com / GitHub Enterprise" },
  { id: "gitlab",    name: "GitLab",    icon: "gitlab", available: false, hint: "Sắp ra mắt" },
  { id: "bitbucket", name: "Bitbucket", icon: "bitbucket", available: false, hint: "Sắp ra mắt" },
];

const PAT_TOKENS = [
  {
    id: "pat1", provider: "github", name: "ci-platform-token", token: "ghp_••••••••••••aQ4e",
    account: "trang.nguyen", scopes: ["repo", "admin:repo_hook", "read:org"],
    status: "active", expiry: "Còn 71 ngày", created: "19/03/2026", lastUsed: "5 phút trước",
  },
  {
    id: "pat2", provider: "github", name: "build-runner-token", token: "ghp_••••••••••••7Km2",
    account: "tuanbess", scopes: ["repo", "workflow"],
    status: "active", expiry: "Còn 23 ngày", created: "02/04/2026", lastUsed: "1 giờ trước",
  },
  {
    id: "pat3", provider: "github", name: "legacy-readonly", token: "ghp_••••••••••••pX9c",
    account: "trang.nguyen", scopes: ["repo:status", "read:org"],
    status: "expired", expiry: "Đã hết hạn 12/06/2026", created: "12/03/2026", lastUsed: "8 ngày trước",
  },
];

export { COMPUTE_TYPES, BUILD_IMAGES, RUNTIME_PRESETS, BUILD_PHASES, COMMAND_PHASES, PHASE_BASE, uuid, mkBuild, BUILD_PROJECTS, allBuilds, projectLatestStatus, SAMPLE_BUILDSPEC, buildPhaseLogScript, phaseCommandLines, PAT_PROVIDERS, PAT_TOKENS };
