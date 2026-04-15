.PHONY: install test run scan-sca scan-sast scan-iac scan-dast all-scans

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

scan-iac:
	trivy config . --format json --output reports/trivy-config.json

scan-dast:
	docker run --rm --network host -v "$$(pwd)/reports:/zap/wrk/:rw" -v "$$(pwd)/zap-rules.tsv:/zap/rules/zap-rules.tsv:ro" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://127.0.0.1:5000 -J zap.json -r zap.html -c /zap/rules/zap-rules.tsv -I

all-scans: scan-sca scan-sast scan-iac
