# PAI4 - Plantilla DevSecOps

Este repositorio contiene una implementacion base para cubrir los objetivos del PAI4 (DevSecOps).

## Stack y alcance

- App de prueba: `Flask`
- CI/CD: `GitHub Actions`
- Herramientas de seguridad integradas:
  - `pip-audit` (SCA)
  - `Bandit` (SAST)
  - `OWASP ZAP` (DAST)
  - `Trivy` (Security in IaC)
- Gestion de vulnerabilidades: `DefectDojo` (opcional, por secretos)

## Estructura

- `app/`: aplicacion web de prueba
- `tests/`: pruebas funcionales y de seguridad
- `.github/workflows/devsecops.yml`: pipeline CI/CD + DevSecOps
- `k8s/`: manifiestos Kubernetes para analisis IaC
- `scripts/import_to_defectdojo.py`: importacion de hallazgos por API
- `scripts/export_defectdojo_summary.py`: resumen de priorizacion/clasificacion por engagement
- `zap-rules.tsv`: politica ZAP (aceptacion explicita de regla 10049)
- `docs/`: contenido para el informe final
- `reports/`: evidencias (logs/reportes)

## Ejecucion local

1. Instalar dependencias:

```bash
python -m pip install -r requirements-dev.txt
```

2. Lanzar app:

```bash
python -m flask --app app.main run --host 0.0.0.0 --port 5000
```

3. Ejecutar tests:

```bash
pytest -q --junitxml=reports/pytest-results.xml --cov=app --cov-report=xml:reports/coverage.xml
```

4. Ejecutar escaneos de seguridad:

```bash
pip-audit -r requirements.txt -f json -o reports/pip-audit.json
bandit -r app -f json -o reports/bandit.json
trivy config . --format json --output reports/trivy-config.json
```

5. DAST con ZAP (con la app en `http://127.0.0.1:5000`):

```bash
docker run --rm --network host -v "$(pwd)/reports:/zap/wrk/:rw" -v "$(pwd)/zap-rules.tsv:/zap/rules/zap-rules.tsv:ro" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://127.0.0.1:5000 -J zap.json -r zap.html -c /zap/rules/zap-rules.tsv -I
```

## Pipeline en GitHub

1. El workflow `devsecops.yml` se ejecuta en `push`, `pull_request` y manual.
2. DAST en CI se ejecuta levantando la app con `gunicorn`.
3. Los reportes se publican como artefacto `devsecops-reports`.

## DefectDojo (opcional)

Define estos secretos en GitHub:

- `DEFECTDOJO_URL`
- `DEFECTDOJO_API_KEY`
- `DEFECTDOJO_ENGAGEMENT_ID`

Si existen, el workflow:

- importa hallazgos por tipo de escaneo (`reports/defectdojo-import-*.json`)
- genera resumen de priorizacion/clasificacion (`reports/defectdojo-summary.json`)

## Entregable PAI4

En `docs/` tienes base para:

- Informe tecnico
- Manual de despliegue/uso
- Grado de completitud y trazabilidad
- Checklist de entrega

## Empaquetado de entrega

Genera el ZIP con formato oficial:

```powershell
./scripts/package_pai4.ps1 -TeamNumber 1
```
