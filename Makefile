TARGET_CODE_PATH ?= target/my-pass
TARGET_REPOSITORY_URL ?= ../my-pass
TARGET_DAST_URL ?= http://127.0.0.1:19006

.PHONY: prepare-target install test run scan-sca scan-sast scan-sast-semgrep scan-sast-positive-control scan-iac scan-dast scan-positive-controls all-scans

prepare-target:
	@mkdir -p "$$(dirname "$(TARGET_CODE_PATH)")"; \
	if [ ! -f "$(TARGET_CODE_PATH)/package.json" ]; then \
		echo "Target not found in $(TARGET_CODE_PATH). Cloning $(TARGET_REPOSITORY_URL)"; \
		git clone --depth 1 "$(TARGET_REPOSITORY_URL)" "$(TARGET_CODE_PATH)"; \
	fi

install: prepare-target
	python -m pip install -r requirements-dev.txt
	cd "$(TARGET_CODE_PATH)" && npm ci

test: prepare-target
	cd "$(TARGET_CODE_PATH)" && npm run test:unit -- --runInBand

run: prepare-target
	cd "$(TARGET_CODE_PATH)" && npm run web -- --port 19006 --non-interactive

scan-sca: prepare-target
	cd "$(TARGET_CODE_PATH)" && npm audit --json > "$(CURDIR)/reports/npm-audit.json" || true

scan-sast: scan-sast-semgrep

scan-sast-semgrep: prepare-target
	docker run --rm -v "$$(pwd):/src" -v "$$(pwd)/$(TARGET_CODE_PATH):/target:ro" returntocorp/semgrep:latest semgrep scan --no-git-ignore --config /src/scripts/semgrep-rules.yml --json -o /src/reports/semgrep.json /target || true

scan-sast-positive-control:
	docker run --rm -v "$$(pwd):/src" returntocorp/semgrep:latest semgrep scan --no-git-ignore --config /src/scripts/semgrep-rules.yml --json -o /src/reports/semgrep-positive-control.json /src/scripts/positive_controls

scan-iac: prepare-target
	docker run --rm -v "$$(pwd):/src" aquasec/trivy:0.69.3 config /src/$(TARGET_CODE_PATH) --skip-dirs /src/$(TARGET_CODE_PATH)/node_modules --skip-dirs /src/$(TARGET_CODE_PATH)/.git --skip-files /src/$(TARGET_CODE_PATH)/package-lock.json --misconfig-scanners azure-arm,cloudformation,dockerfile,kubernetes,terraform,terraformplan-json,terraformplan-snapshot,ansible --timeout 20m --format json --output /src/reports/trivy-config.json || true

scan-dast:
	docker run --rm --network host -v "$$(pwd)/reports:/zap/wrk/:rw" -v "$$(pwd)/zap-rules.tsv:/zap/rules/zap-rules.tsv:ro" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t "$(TARGET_DAST_URL)" -J zap.json -r zap.html -c /zap/rules/zap-rules.tsv -I

scan-positive-controls:
	python scripts/run_positive_controls.py

all-scans: scan-sca scan-sast scan-sast-positive-control scan-iac
