

/* ============================================================
   GitHub Actions — sample workflows + parser
   Quét repo → parse file .github/workflows/*.yml → pipeline model
   ============================================================ */

/* ---------------- Sample workflow files per repo ---------------- */
const GH_WORKFLOWS = {
  "fpt-cloud/payment-gateway": [
    { file: "ci.yml", yaml:
`name: Continuous Integration
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
env:
  GO_VERSION: "1.22"
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: \${{ env.GO_VERSION }}
      - name: Lint
        run: golangci-lint run ./...
      - name: Unit Test
        run: go test -race -cover ./...
      - name: Build
        run: go build -o bin/app ./cmd/server
      - name: Docker Push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: registry/payment:\${{ github.sha }}
` },
    { file: "deploy.yml", yaml:
`name: Deploy Production
on:
  release:
    types: [published]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t registry/payment:release .
      - name: Push image
        run: docker push registry/payment:release
      - name: Deploy to k8s
        run: kubectl rollout restart deploy/payment -n prod
` },
    { file: "codeql.yml", yaml:
`name: Security Scan
on:
  push:
    branches: [main]
  schedule:
    - cron: "0 2 * * 1"
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Init CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: go
      - name: Autobuild
        uses: github/codeql-action/autobuild@v3
      - name: Analyze
        uses: github/codeql-action/analyze@v3
` },
  ],
  "fpt-cloud/identity-service": [
    { file: "ci.yml", yaml:
`name: Continuous Integration
on:
  push:
    branches: [main, develop]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: "1.22"
      - name: Vet
        run: go vet ./...
      - name: Test
        run: go test -cover ./...
      - name: Build
        run: go build ./...
` },
    { file: "release.yml", yaml:
`name: Release & Publish
on:
  push:
    tags: [v*]
env:
  REGISTRY: registry.fpt-cloud
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Go
        uses: actions/setup-go@v5
      - name: Build binary
        run: go build -o bin/identity ./cmd/server
      - name: Sign artifact
        run: cosign sign-blob bin/identity
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
      - name: Publish image
        run: docker push \${{ env.REGISTRY }}/identity:\${{ github.ref_name }}
` },
  ],
  "fpt-cloud/web-portal": [
    { file: "ci.yml", yaml:
`name: Build & Preview
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install Deps
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Type Check
        run: npm run typecheck
      - name: Test
        run: npm test -- --runInBand
      - name: Build
        run: npm run build
      - name: Deploy Preview
        run: npx vercel deploy --prebuilt
` },
    { file: "lighthouse.yml", yaml:
`name: Lighthouse Audit
on:
  pull_request:
    branches: [main]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
      - name: Build
        run: npm ci && npm run build
      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v11
        with:
          uploadArtifacts: true
` },
  ],
  "fpt-cloud/data-pipeline": [
    { file: "ci.yml", yaml:
`name: Test & Package
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install
        run: pip install -r requirements.txt
      - name: Lint
        run: ruff check .
      - name: Test
        run: pytest -q
      - name: Package
        run: python -m build
` },
    { file: "dbt-build.yml", yaml:
`name: dbt Build & Docs
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  dbt:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Python
        uses: actions/setup-python@v5
      - name: Install dbt
        run: pip install dbt-core dbt-postgres
      - name: dbt deps
        run: dbt deps
      - name: dbt build
        run: dbt build --target prod
      - name: Generate docs
        run: dbt docs generate
` },
  ],
};

/* ---------------- Helpers ---------------- */
function unquote(s) {
  if (!s) return "";
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}
function parseInline(v) {
  // [a, b, c] or single value
  v = v.trim();
  if (v.startsWith("[") && v.endsWith("]")) return v.slice(1, -1).split(",").map((x) => unquote(x)).filter(Boolean);
  return v ? [unquote(v)] : [];
}

// Pretty stage name from a `uses:` action ref
const ACTION_LABELS = {
  "actions/checkout": "Checkout",
  "actions/setup-go": "Setup Go",
  "actions/setup-node": "Setup Node",
  "actions/setup-python": "Setup Python",
  "docker/build-push-action": "Docker Build & Push",
  "github/codeql-action/init": "Init CodeQL",
  "github/codeql-action/autobuild": "Autobuild",
  "github/codeql-action/analyze": "Analyze",
  "softprops/action-gh-release": "Create GitHub Release",
  "treosh/lighthouse-ci-action": "Run Lighthouse",
};
function labelFromUses(uses) {
  const ref = uses.split("@")[0];
  if (ACTION_LABELS[ref]) return ACTION_LABELS[ref];
  const last = ref.split("/").pop().replace(/-action$/, "").replace(/^action-/, "");
  return last.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/* ---------------- The parser ---------------- */
function parseGitHubActions(yaml) {
  const lines = yaml.replace(/\t/g, "  ").split("\n");
  const indentOf = (l) => l.match(/^ */)[0].length;
  const result = { name: "", triggers: [], branches: [], env: {}, jobs: [] };
  let section = null;     // 'on' | 'env' | 'jobs'
  let curJob = null;
  let inSteps = false;
  let curStep = null;
  let runBlock = null;    // { step, baseIndent }

  for (let raw of lines) {
    // close a multiline run block on dedent
    if (runBlock) {
      if (raw.trim() === "" ) { continue; }
      if (indentOf(raw) >= runBlock.baseIndent) { runBlock.lines.push(raw.trim()); continue; }
      runBlock.step.run = runBlock.lines.join(" && ");
      runBlock = null;
    }
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const ind = indentOf(line);
    const text = line.trim();

    if (ind === 0) {
      if (text.startsWith("name:")) result.name = unquote(text.slice(5));
      else if (text.startsWith("on:")) { section = "on"; const r = text.slice(3).trim(); if (r) result.triggers.push(...parseInline(r)); }
      else if (text.startsWith("env:")) section = "env";
      else if (text.startsWith("jobs:")) section = "jobs";
      else section = null;
      continue;
    }

    if (section === "on") {
      if (text.startsWith("-")) { const item = text.replace(/^-\s*/, ""); if (!item.includes(":")) result.branches.push(unquote(item)); continue; }
      const key = text.split(":")[0].trim();
      const val = text.slice(text.indexOf(":") + 1).trim();
      if (key === "branches" || key === "tags") result.branches.push(...parseInline(val));
      else if (["push", "pull_request", "release", "workflow_dispatch", "schedule"].includes(key)) {
        if (!result.triggers.includes(key)) result.triggers.push(key);
      }
    } else if (section === "env") {
      const m = text.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if (m) result.env[m[1]] = unquote(m[2]);
    } else if (section === "jobs") {
      if (ind === 2 && /^[A-Za-z0-9_-]+:\s*$/.test(text)) {
        curJob = { id: text.replace(/:\s*$/, ""), runsOn: "", steps: [] };
        result.jobs.push(curJob);
        inSteps = false; curStep = null;
      } else if (curJob && text.startsWith("runs-on:")) {
        curJob.runsOn = unquote(text.slice(8).trim());
      } else if (curJob && text.startsWith("steps:")) {
        inSteps = true;
      } else if (curJob && inSteps) {
        if (text.startsWith("- ")) {
          curStep = {};
          curJob.steps.push(curStep);
          applyStepField(curStep, text.slice(2).trim(), ind, () => (runBlock = { step: curStep, baseIndent: ind + 4, lines: [] }));
        } else if (curStep) {
          applyStepField(curStep, text, ind, () => (runBlock = { step: curStep, baseIndent: ind + 2, lines: [] }));
        }
      }
    }
  }
  if (runBlock) runBlock.step.run = runBlock.lines.join(" && ");
  result.branches = [...new Set(result.branches)];
  return result;
}

function applyStepField(step, text, ind, openRunBlock) {
  if (text.startsWith("uses:")) step.uses = unquote(text.slice(5).trim());
  else if (text.startsWith("name:")) step.name = unquote(text.slice(5).trim());
  else if (text.startsWith("run:")) {
    const v = text.slice(4).trim();
    if (v === "|" || v === ">") openRunBlock();
    else step.run = v;
  }
}

// Convert a parsed workflow into stage names for the pipeline model
function workflowToStages(parsed) {
  const stages = [];
  parsed.jobs.forEach((job) => {
    job.steps.forEach((s) => {
      let name = s.name || (s.uses ? labelFromUses(s.uses) : (s.run ? s.run.split(/\s+/).slice(0, 2).join(" ") : "Step"));
      stages.push(name);
    });
  });
  return stages;
}

function presetFromLanguage(lang) {
  if (lang === "Python") return "data";
  if (lang === "TypeScript" || lang === "JavaScript") return "frontend";
  return "backend";
}

export { GH_WORKFLOWS, parseGitHubActions, workflowToStages, labelFromUses, presetFromLanguage };
