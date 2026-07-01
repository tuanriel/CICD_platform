# Pipeline YAML Format

Mỗi file `.workflow/*.yaml` trong repository định nghĩa một pipeline. Platform đọc các file này khi sync, parse thành **Canonical Model** (lưu dưới dạng JSONB trong `pipeline_versions`), sau đó dùng Canonical Model để generate Jenkinsfile khi build.

---

## Schema

```yaml
version: "1.0"        # bắt buộc — hiện chỉ hỗ trợ "1.0"

stages:               # bắt buộc — ít nhất 1 stage
  - name: string      # bắt buộc — tên stage (phải khác rỗng)
    steps:            # bắt buộc — ít nhất 1 step
      - name: string  # tùy chọn — nhãn hiển thị trong log
        image: string # bắt buộc — Docker image chạy step này
        command:      # tùy chọn — command chạy trong container
          - string
        env:          # tùy chọn — biến môi trường (key-value)
          KEY: value
```

---

## Validation rules

| Rule | Lỗi khi vi phạm |
|------|----------------|
| `version` phải có giá trị khác rỗng | `parser: missing required field "version"` |
| `stages` phải có ít nhất 1 phần tử | `parser: pipeline must have at least one stage` |
| Mỗi stage phải có `name` khác rỗng | `parser: stage[N] must have a name` |
| Mỗi stage phải có ít nhất 1 step | `parser: stage "X" must have at least one step` |
| Mỗi step phải có `image` khác rỗng | `parser: stage "X" step[N] must specify an image` |

Nếu vi phạm bất kỳ rule nào, pipeline được tạo với `status: "error"` và `parse_status: "failed"` — không thể trigger.

---

## Ví dụ

### Go backend: build + test

```yaml
version: "1.0"

stages:
  - name: build
    steps:
      - name: compile
        image: golang:1.22-alpine
        command: ["go", "build", "-o", "server", "./cmd/server"]
        env:
          CGO_ENABLED: "0"
          GOOS: "linux"

  - name: test
    steps:
      - name: unit-test
        image: golang:1.22-alpine
        command: ["go", "test", "./...", "-race", "-count=1"]
      - name: lint
        image: golangci/golangci-lint:v1.57
        command: ["golangci-lint", "run", "./..."]
```

Jenkinsfile tương ứng được generate:

```groovy
pipeline {
    agent none
    stages {
        stage('build') {
            steps {
                script {
                    docker.image('golang:1.22-alpine').inside {
                        withEnv(['CGO_ENABLED=0', 'GOOS=linux']) {
                            sh 'go build -o server ./cmd/server'
                        }
                    }
                }
            }
        }
        stage('test') {
            steps {
                script {
                    docker.image('golang:1.22-alpine').inside {
                        sh 'go test ./... -race -count=1'
                    }
                }
                script {
                    docker.image('golangci/golangci-lint:v1.57').inside {
                        sh 'golangci-lint run ./...'
                    }
                }
            }
        }
    }
}
```

---

### Node.js frontend: install → lint → test → build

```yaml
version: "1.0"

stages:
  - name: install
    steps:
      - name: npm-ci
        image: node:20-alpine
        command: ["npm", "ci"]

  - name: quality
    steps:
      - name: lint
        image: node:20-alpine
        command: ["npm", "run", "lint"]
      - name: type-check
        image: node:20-alpine
        command: ["npm", "run", "type-check"]

  - name: test
    steps:
      - name: unit
        image: node:20-alpine
        command: ["npm", "test", "--", "--coverage"]
        env:
          CI: "true"
          NODE_ENV: "test"

  - name: build
    steps:
      - name: bundle
        image: node:20-alpine
        command: ["npm", "run", "build"]
        env:
          NODE_ENV: "production"
```

---

### Python API: pytest + lint + docker build

```yaml
version: "1.0"

stages:
  - name: test
    steps:
      - name: pytest
        image: python:3.12-slim
        command: ["pytest", "tests/", "-v", "--tb=short"]
        env:
          PYTHONPATH: "src"

  - name: lint
    steps:
      - name: ruff
        image: python:3.12-slim
        command: ["ruff", "check", "."]
      - name: mypy
        image: python:3.12-slim
        command: ["mypy", "src/"]

  - name: build
    steps:
      - name: docker-build
        image: docker:24-cli
        command: ["docker", "build", "-t", "my-api:latest", "."]
```

---

## Đặt tên file

Tên pipeline được lấy từ tên file, bỏ extension:

| File | Pipeline name |
|------|--------------|
| `.workflow/build.yaml` | `build` |
| `.workflow/deploy-prod.yaml` | `deploy-prod` |
| `.workflow/ci.yml` | `ci` |

Mỗi repository có thể có nhiều pipeline — mỗi file `.yaml` / `.yml` trong `.workflow/` là một pipeline độc lập.

---

## Canonical Model

Sau khi parse thành công, YAML được chuyển thành Canonical Pipeline Model và lưu dưới dạng JSONB trong cột `parsed_canonical` của bảng `pipeline_versions`. Đây là dạng trung gian engine-agnostic — dùng để generate Jenkinsfile khi Jenkins integration được kích hoạt.

```json
{
  "version": "1.0",
  "stages": [
    {
      "name": "build",
      "steps": [
        {
          "name": "compile",
          "image": "golang:1.22-alpine",
          "command": ["go", "build", "-o", "server", "./cmd/server"],
          "env": { "CGO_ENABLED": "0", "GOOS": "linux" }
        }
      ]
    }
  ]
}
```
