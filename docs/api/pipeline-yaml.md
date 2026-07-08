# Pipeline YAML Format & API

Mỗi file `.viettelcloud/workflows/*.yaml` trong repository định nghĩa một pipeline. Đây là quy ước riêng của Viettel Cloud, **không phải** `.github/workflows` của GitHub Actions. Platform đọc các file này khi gọi `POST /repositories/:id/sync` (xem [repositories.md](repositories.md)), parse thành **Canonical Model** (lưu JSONB trong `pipeline_versions`), rồi generate **scripted Jenkinsfile** từ Canonical Model.

Khác với trước, giờ đã có endpoint nhận trực tiếp YAML từ frontend (validate/generate — xem mục **API** cuối trang), phục vụ editor xem trước lỗi parse và Jenkinsfile mà không cần commit file lên GitHub.

---

## Schema

```yaml
runner: string          # bắt buộc — Jenkins node/agent label chạy pipeline.
                        # ⚠️ Label phải TỒN TẠI trên Jenkins đích, nếu không build
                        # sẽ treo queued vô hạn. Jenkins local (docker-compose)
                        # hiện gắn các label: jenkins-jenkins-agent, docker,
                        # default, kubernetes (built-in node). Khuyến nghị dùng
                        # `jenkins-jenkins-agent` — label này cũng là pod template
                        # trên các Jenkins-on-k8s (server chung + kind).

inputs:                 # tùy chọn — tham số build (thành Jenkins job parameters)
  <tên-param>:          # tên tự đặt; "initialVar" và "webhookBody" bị CẤM (reserved)
    description: string # bắt buộc
    required: bool
    type: string        # string | boolean | choice | number (viết thường)
    default: <giá trị>  # tùy chọn — phải đúng kiểu với type
    options: [a, b]     # bắt buộc khi type: choice

trigger:                # tùy chọn — metadata điều kiện trigger từ webhook.
  push:                 # KHÔNG được đưa vào Jenkinsfile; platform sẽ dùng khi
    branches: [glob]    # xử lý webhook (UC-07, chưa implement).
    tags: [glob]
  merge_request:
    target_branches: [glob]
    actions:            # mỗi phần tử: string ("open") HOẶC map 1 key
      - open            #   comment: [recheck, ...]
      - update: [commit, title]
    labels: [string]
  release:
    actions: [create, update, delete]
  issue:
    actions: [open, close, reopen, update]
    labels: [string]

stages:                 # bắt buộc — ít nhất 1 stage, tên không trùng nhau
  - name: string        # bắt buộc
    runner: string      # tùy chọn — cấp node MỚI riêng cho stage này
    container:          # tùy chọn — chạy steps trong Docker container
      image: string     # bắt buộc khi có container
      options: string   # tùy chọn — flags docker run (vd "--rm -e X=1")
    steps: [Step]       # bắt buộc (trừ khi parallel)
  - name: string
    parallel: true      # stage chạy song song — dùng blocks thay steps
    blocks:             # bắt buộc khi parallel; tên block không trùng trong stage
      - name: string
        runner: string  # tùy chọn — mỗi block có thể cấp node riêng
        container: {..} # tùy chọn — mỗi block có thể có container riêng
        steps: [Step]

finally: [Step]         # tùy chọn — luôn chạy sau cùng (kể cả khi fail/abort)
```

### Step — đúng 1 key mỗi step

| Step | Dạng | Ghi chú |
|------|------|---------|
| `sh: <lệnh>` | string 1 dòng hoặc block `\|` nhiều dòng | Nội dung giữ nguyên byte (heredoc, `$(...)`, backslash… đều sống sót). Dùng cú pháp shell thuần: `$VAR`, `${VAR}` |
| `gitCheckout:` | map, có thể rỗng | `branch:` hoặc `ref:` (2 cách viết tương đương) — ref cần checkout, vd `$env.gitRef`. **Bỏ trống → checkout đúng commit đã trigger** (ưu tiên SHA, fallback branch). URL clone luôn là repo đã map (platform truyền tự động); **repo private cũng checkout được** — backend đính kèm credential Jenkins (`JENKINS_GIT_CREDENTIALS_ID`) vào mỗi build, frontend không phải làm gì |
| `buildPushImage:` | map | `imageName` (bắt buộc), `tag`, `registry`, `credentials` (Jenkins credential ID), `username`/`password`, `buildArgs` (map), `extraTags` (list), `push`/`cache` (bool) |
| `setEnv:` | map `KEY: value` | Set biến env cho các step/stage sau (đọc bằng `$KEY` trong `sh:`) |
| `commentPipelineResult:` | map | `netchatGroupID`, `onSuccess`, `onFail`, `onAbort` |

**Quy tắc biến**: trong `sh:` dùng cú pháp shell (`$VAR`, `$(cmd)`); trong tham số các step khác dùng Groovy GString (`$env.VAR`, `$params.VAR`) — được Jenkins evaluate trước khi gọi hàm.

> ⚠️ **`$config.*` KHÔNG tồn tại** — đừng dùng trong bất kỳ tham số step nào.
> Validate/parse vẫn pass (parser không kiểm tra tham chiếu biến), nhưng build
> sẽ **fail lúc chạy trên Jenkins** với lỗi khó hiểu
> `groovy.lang.MissingPropertyException: No such property: config`.
> Thay bằng `$env.X` (biến từ webhook/trigger context) hoặc `$params.X`
> (khai báo qua `inputs:`).

---

## Validation rules

Mức validate: **structural + type**. Không kiểm tra tham chiếu `$inputs.X`/`$config.lib.X` có tồn tại hay không.

| Rule | Lỗi khi vi phạm |
|------|----------------|
| `runner` khác rỗng | `parser: missing required field "runner"` |
| `stages` ≥ 1 phần tử | `parser: pipeline must have at least one stage` |
| Stage có `name`, không trùng | `parser: stage[N] must have a name` / `parser: duplicate stage name "X"` |
| Stage thường phải có ≥ 1 step | `parser: stage "X" must have at least one step` |
| `parallel: true` phải có `blocks`, không kèm `steps` | `parser: stage "X" has "parallel: true" but no blocks` / `... cannot have both "parallel" and "steps"` |
| Có `blocks` thì phải `parallel: true` | `parser: stage "X" has "blocks" but "parallel" is not true` |
| Block có `name` (không trùng trong stage), ≥ 1 step | `parser: stage "X" has duplicate block name "Y"` |
| `container` phải có `image` | `parser: stage "X" container must specify an image` |
| Step phải là 1 trong 5 loại, đúng 1 key | `step: unknown step type "X"` / `step must be a mapping with exactly one key` |
| `buildPushImage` phải có `imageName` | `step "buildPushImage" must specify "imageName"` |
| `input.type` ∈ string/boolean/choice/number | `parser: input "X" has invalid type "Y"` |
| `type: choice` phải có `options` | `parser: input "X" of type "choice" must specify "options"` |
| Không đặt tên input `initialVar`/`webhookBody` | `parser: input "X" is a reserved name` |
| `push`/`cache` phải là boolean | lỗi unmarshal (`cannot unmarshal !!str ... into bool`) |

Vi phạm rule khi sync + trigger → pipeline `status: "error"`, version `parse_status: "failed"`. Với endpoint validate/generate, thông báo lỗi chính xác được trả trực tiếp trong `message` (xem dưới).

---

## API

### `POST /api/v1/pipeline-yaml/validate`

Parse + validate YAML, **không lưu gì**. Dùng cho editor phía frontend.

Request:
```json
{ "yaml": "runner: docker\nstages:\n  - name: build\n    steps:\n      - sh: go build ./...\n" }
```

`200 OK`:
```json
{
  "data": {
    "valid": true,
    "canonical": {
      "runner": "docker",
      "stages": [
        { "name": "build", "steps": [ { "sh": "go build ./..." } ] }
      ]
    }
  }
}
```

`422 PIPELINE_PARSE_ERROR` (YAML sai — message chứa đúng thông báo ở bảng validation):
```json
{
  "code": "PIPELINE_PARSE_ERROR",
  "message": "invalid pipeline YAML definition: parser: missing required field \"runner\"",
  "request_id": "..."
}
```

`400 INVALID_PAYLOAD` khi body thiếu field `yaml`.

### `POST /api/v1/pipeline-yaml/generate`

Parse YAML rồi trả về scripted Jenkinsfile platform sẽ chạy — **không lưu gì**. Dùng để preview.

Request: giống validate. `200 OK`:
```json
{ "data": { "jenkinsfile": "// Generated by CI/CD Platform — do not edit manually.\nnode('docker') {\n..." } }
```

Lỗi: giống validate (`422` / `400`).

### `GET /api/v1/pipelines/:id/jenkinsfile`

Sinh Jenkinsfile từ **version hiện tại** của một pipeline đã sync. Nếu version còn `parse_status: "pending"`, nó được parse ngay lúc này (lazy-parse, cùng side effect với trigger: cập nhật `status`/`parse_status`). Cho phép cả pipeline `disabled` (xem script không gây hại).

`200 OK`:
```json
{
  "data": {
    "pipeline_id": "…uuid…",
    "pipeline_version_id": "…uuid…",
    "jenkinsfile": "// Generated by CI/CD Platform — do not edit manually.\n..."
  }
}
```

| Lỗi | Khi nào |
|-----|--------|
| `404 RESOURCE_NOT_FOUND` | Pipeline không tồn tại |
| `409 PIPELINE_NOT_RUNNABLE` | Pipeline chưa có version nào (chưa sync xong) |
| `422 PIPELINE_PARSE_ERROR` | YAML của version hiện tại không hợp lệ — message chứa lỗi cụ thể |

> Lưu ý: khác với ghi chú cũ, lỗi parse giờ **được trả qua API** (message của `422`) ở cả trigger, validate, generate và jenkinsfile.

---

## Ví dụ đầy đủ

```yaml
runner: docker

inputs:
  environment:
    description: Target environment
    required: false
    type: choice
    default: staging
    options: [staging, production]

trigger:
  push:
    branches: [main, "feature/*"]

stages:
  - name: Checkout
    steps:
      - gitCheckout:
          ref: $env.gitRef

  - name: Build
    steps:
      - setEnv:
          APP_NAME: my-app
      - sh: |
          echo "building $APP_NAME"
          go build ./...

  - name: Test Suite
    parallel: true
    blocks:
      - name: Unit
        steps:
          - sh: go test ./...
      - name: Lint
        container:
          image: golangci/golangci-lint:v1.57
        steps:
          - sh: golangci-lint run ./...

  - name: Push Image
    steps:
      - buildPushImage:
          imageName: my-app
          tag: $env.gitCheckoutSHA
          registry: registry.example.com
          credentials: docker-push-cred

finally:
  - sh: echo "done — build $BUILD_NUMBER"
```

Jenkinsfile tương ứng (scripted pipeline):

```groovy
// Generated by CI/CD Platform — do not edit manually.
properties([
    parameters([
        choice(name: 'environment', choices: ['staging', 'production'], description: 'Target environment')
    ])
])

node('docker') {
    parseJsonToEnv(params.initialVar)

    try {
        stage('Checkout') {
            checkout([$class: 'GitSCM', branches: [[name: "$env.gitRef"]], userRemoteConfigs: [[url: env.gitHttpUrl, credentialsId: env.gitCredentialsId ?: null]]])
        }
        stage('Build') {
            env.APP_NAME = "my-app"
            sh '''echo "building $APP_NAME"
go build ./...
'''
        }
        stage('Test Suite') {
            parallel(
                'Unit': {
                    sh '''go test ./...'''
                },
                'Lint': {
                    docker.image('golangci/golangci-lint:v1.57').inside('') {
                        sh '''golangci-lint run ./...'''
                    }
                }
            )
        }
        stage('Push Image') {
            buildPushImage(imageName: "my-app", tag: "$env.gitCheckoutSHA", registry: "registry.example.com", credentials: "docker-push-cred")
        }
    } finally {
        sh '''echo "done — build $BUILD_NUMBER"'''
    }
}
```

⚠️ `parseJsonToEnv`, `buildPushImage`, `commentPipelineResult` là hàm thuộc **Jenkins shared library** (cicd-platform-library) phải có sẵn trên Jenkins đích — platform chỉ emit lời gọi, không tự triển khai các hàm này.

---

## Đặt tên file

Tên pipeline lấy từ tên file, bỏ extension:

| File | Pipeline name |
|------|--------------|
| `.viettelcloud/workflows/build.yaml` | `build` |
| `.viettelcloud/workflows/deploy-prod.yaml` | `deploy-prod` |
| `.viettelcloud/workflows/ci.yml` | `ci` |

Mỗi repository có thể có nhiều pipeline — mỗi file `.yaml` / `.yml` trong `.viettelcloud/workflows/` là một pipeline độc lập.

---

## Canonical Model

Sau khi parse thành công, YAML được lưu JSONB vào cột `parsed_canonical` của `pipeline_versions` (cùng shape với field `canonical` trả về từ endpoint validate). Step giữ dạng union 1-key giống YAML gốc:

```json
{
  "runner": "docker",
  "inputs": {
    "environment": { "description": "Target environment", "required": false, "type": "choice", "default": "staging", "options": ["staging", "production"] }
  },
  "trigger": { "push": { "branches": ["main", "feature/*"] } },
  "stages": [
    { "name": "Checkout", "steps": [ { "gitCheckout": { "ref": "$env.gitRef" } } ] },
    {
      "name": "Test Suite",
      "parallel": true,
      "blocks": [
        { "name": "Unit", "steps": [ { "sh": "go test ./..." } ] }
      ]
    }
  ],
  "finally": [ { "sh": "echo done" } ]
}
```
