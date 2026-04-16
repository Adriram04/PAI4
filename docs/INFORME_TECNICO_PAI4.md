# Informe Tecnico PAI4

## 1. Resumen ejecutivo

Se implementa un pipeline DevSecOps para una aplicacion web de prueba, incorporando controles de seguridad automatizados en CI para reducir riesgo de despliegue.

## 2. Pipeline CI/CD seleccionado

- Plataforma: GitHub Actions.
- Fichero de pipeline: `.github/workflows/devsecops.yml`.
- Flujo:
  1. Job `sast`: tests funcionales + `Bandit` + `Semgrep` + control positivo de deteccion.
  2. Job `sca_iac`: `pip-audit` + `trivy config`.
  3. Job `dast`: `OWASP ZAP baseline` sobre app viva (`gunicorn`).
  4. Job `positive_controls`: validacion positiva automatizada para todas las herramientas.
  5. Job `deploy_staging`: despliegue minimo en entorno de prueba y smoke test de salud.
  6. Job `defectdojo` (opcional): importacion por API + resumen de priorizacion.
  7. Job `reports_bundle`: consolidacion final de artefactos.

## 3. Herramientas de seguridad seleccionadas

- SCA: `pip-audit`.
  - Evidencia: `reports/pip-audit.json`.

- SAST: `Bandit`.
  - Evidencia: `reports/bandit.json`.

- SAST: `Semgrep`.
  - Evidencia: `reports/semgrep.json`.
  - Configuracion local de reglas: `scripts/semgrep-rules.yml`.

- Security in IaC: `Trivy (config)`.
  - Evidencia: `reports/trivy-config.json`.

- DAST: `OWASP ZAP (baseline)`.
  - Evidencia: `reports/zap.json` y `reports/zap.html`.
  - Politica ZAP: `zap-rules.tsv` (aceptacion explicita de regla 10049 por diseno de cache `no-store`).

## 4. Integracion de herramientas en el ciclo de vida

- Shift-left:
  - SCA y SAST en cada cambio.
  - IaC antes de despliegue.
  - DAST en instancia activa.
- Validacion positiva de deteccion (todas las herramientas):
  - Script: `scripts/run_positive_controls.py`.
  - Casos vulnerables controlados: `scripts/positive_controls/`.
  - Evidencias: `reports/bandit-positive-control.json`, `reports/semgrep-positive-control-alltools.json`, `reports/pip-audit-positive-control.json`, `reports/trivy-positive-control.json`, `reports/zap-positive-control.json`.
- Despliegue continuo minimo:
  - Job `deploy_staging` con despliegue del contenedor y verificacion de `GET /health`.
  - Evidencias: `reports/deploy-health.json`, `reports/deploy-staging.log`.
- Endurecimiento de cabeceras HTTP en la app (`app/main.py`) y tests de validacion (`tests/test_security.py`).
- Evidencias por etapa: `sast-reports`, `sca-iac-reports`, `dast-reports`, `positive-controls-reports`, `deploy-reports`.
- Evidencia consolidada: artefacto `devsecops-reports`.

## 5. Gestion de vulnerabilidades (Objetivo 5)

Integracion DefectDojo mediante API REST con evidencia trazable:

- Importacion de resultados: `scripts/import_to_defectdojo.py`.
  - Cada import puede generar evidencia JSON: `reports/defectdojo-import-*.json`.
- Priorizacion y clasificacion posterior por engagement: `scripts/export_defectdojo_summary.py`.
  - Evidencia: `reports/defectdojo-summary.json` con:
    - `severity_breakdown`
    - `status_breakdown`
    - `top_cwe`
    - `priority_queue`
- Activacion automatica en workflow con secretos:
  - `DEFECTDOJO_URL`
  - `DEFECTDOJO_API_KEY`
  - `DEFECTDOJO_ENGAGEMENT_ID`

## 6. Conclusiones

El pipeline pasa de CI/CD basico a DevSecOps con controles de seguridad automatizados, reporte continuo y mecanismo objetivo de gestion/priorizacion en DefectDojo.

## 7. Resultado de ejecucion local (16-04-2026)

- Tests: 4/4 correctos (`reports/pytest-results.xml`).
- Cobertura: 100% (`reports/coverage.xml`).
- SAST Bandit: 0 hallazgos (`reports/bandit.json`).
- SAST Semgrep: incluido en pipeline (`reports/semgrep.json`).
- Control positivo multi-herramienta (`python scripts/run_positive_controls.py`):
  - Bandit: >= 1 hallazgo (`reports/bandit-positive-control.json`).
  - Semgrep: >= 1 hallazgo (`reports/semgrep-positive-control-alltools.json`).
  - pip-audit: >= 1 vulnerabilidad (`reports/pip-audit-positive-control.json`).
  - Trivy: >= 1 misconfiguration (`reports/trivy-positive-control.json`).
  - ZAP: >= 1 alerta (`reports/zap-positive-control.json`).
- SCA pip-audit: 0 vulnerabilidades (`reports/pip-audit.json`).
- Security IaC Trivy: 0 hallazgos (`reports/trivy-config.json`).
- DAST ZAP baseline:
  - `WARN-NEW: 0`
  - `FAIL-NEW: 0`
  - 1 regla en `IGNORE` por politica (`10049`, `zap-rules.tsv`).
  - Evidencia de ejecucion: `reports/zap-baseline.log`.
- Deploy staging: verificacion positiva de salud (`reports/deploy-health.json`).

