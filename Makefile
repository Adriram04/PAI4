.PHONY: install test run scan-sca scan-sast scan-sast-semgrep scan-sast-positive-control scan-iac scan-dast scan-positive-controls all-scans

install:
	python -m pip install -r requirements-dev.txt

test:
	pytest -q --junitxml=reports/pytest-results.xml --cov=app --cov-report=xml

run:
	python -m flask --app app.main run --host 0.0.0.0 --port 5000

scan-sca:
	pip-audit -r requirements.txt -f json -o reports/pip-audit.json

scan-sast:
	bandit -r app -f json -o reports/bandit.json

scan-sast-semgrep:
	docker run --rm -v "$$(pwd):/src" returntocorp/semgrep:latest semgrep scan --no-git-ignore --config /src/scripts/semgrep-rules.yml --json -o /src/reports/semgrep.json /src/app

scan-sast-positive-control:
	docker run --rm -v "$$(pwd):/src" returntocorp/semgrep:latest semgrep scan --no-git-ignore --config /src/scripts/semgrep-rules.yml --json -o /src/reports/semgrep-positive-control.json /src/scripts/positive_controls

scan-iac:
	trivy config . --format json --output reports/trivy-config.json

scan-dast:
	docker run --rm --network host -v "$$(pwd)/reports:/zap/wrk/:rw" -v "$$(pwd)/zap-rules.tsv:/zap/rules/zap-rules.tsv:ro" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://127.0.0.1:5000 -J zap.json -r zap.html -c /zap/rules/zap-rules.tsv -I

scan-positive-controls:
	python scripts/run_positive_controls.py

all-scans: scan-sca scan-sast scan-sast-semgrep scan-sast-positive-control scan-iac
