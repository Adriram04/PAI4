# Manual de Despliegue y Uso

## 1. Prerrequisitos

- Python 3.12+ (recomendado 3.13)
- Docker (DAST con ZAP y alternativa de SCA/IaC)

## 2. Instalacion

```bash
python -m pip install -r requirements-dev.txt
```

## 3. Ejecucion de la aplicacion

```bash
python -m flask --app app.main run --host 0.0.0.0 --port 5000
```

Endpoint de verificacion:

- `GET /health` -> `{"status":"healthy"}`

## 4. Ejecucion de pruebas

```bash
pytest -q --junitxml=reports/pytest-results.xml --cov=app --cov-report=xml:reports/coverage.xml
```

## 5. Ejecucion de analisis de seguridad

SCA:

```bash
pip-audit -r requirements.txt -f json -o reports/pip-audit.json
```

SAST:

```bash
bandit -r app -f json -o reports/bandit.json
```

IaC:

```bash
trivy config . --format json --output reports/trivy-config.json
```

Alternativa SCA con Docker (util en Windows con rutas Unicode):

```bash
docker run --rm -v "$(pwd):/src" -w /src python:3.13-slim sh -lc "pip install --no-cache-dir pip-audit && pip-audit -r requirements.txt -f json -o reports/pip-audit.json"
```

Alternativa IaC con Docker:

```bash
docker run --rm -v "$(pwd):/src" aquasec/trivy:0.69.3 config /src --format json --output /src/reports/trivy-config.json
```

DAST (con app levantada en puerto 5000 y politica ZAP):

```bash
docker run --rm --network host -v "$(pwd)/reports:/zap/wrk/:rw" -v "$(pwd)/zap-rules.tsv:/zap/rules/zap-rules.tsv:ro" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://127.0.0.1:5000 -J zap.json -r zap.html -c /zap/rules/zap-rules.tsv -I
```

En Windows con Docker Desktop, usar `host.docker.internal`:

```bash
docker run --rm -v "$(pwd)/reports:/zap/wrk/:rw" -v "$(pwd)/zap-rules.tsv:/zap/rules/zap-rules.tsv:ro" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://host.docker.internal:5000 -J zap.json -r zap.html -c /zap/rules/zap-rules.tsv -I
```

## 6. Pipeline en GitHub Actions

- Workflow: `.github/workflows/devsecops.yml`.
- Disparadores: `push`, `pull_request`, `workflow_dispatch`.
- DAST en CI: arranque con `gunicorn` (entorno Linux del runner).
- Artefactos: `devsecops-reports`.

## 7. Integracion con DefectDojo

Configurar secretos del repositorio:

- `DEFECTDOJO_URL`
- `DEFECTDOJO_API_KEY`
- `DEFECTDOJO_ENGAGEMENT_ID`

Si existen, el workflow ejecuta:

1. Importacion de hallazgos (`scripts/import_to_defectdojo.py`) y generacion de:
- `reports/defectdojo-import-bandit.json`
- `reports/defectdojo-import-pip-audit.json`
- `reports/defectdojo-import-trivy.json`
- `reports/defectdojo-import-zap.json`

2. Resumen de priorizacion/clasificacion (`scripts/export_defectdojo_summary.py`):
- `reports/defectdojo-summary.json`

## 8. Empaquetado final

```powershell
./scripts/package_pai4.ps1 -TeamNumber <Num>
```
