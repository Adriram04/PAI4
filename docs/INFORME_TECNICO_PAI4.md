# Informe Tecnico PAI4

## 1. Resumen ejecutivo

Se implementa un pipeline DevSecOps para una aplicacion web de prueba, incorporando controles de seguridad automatizados en CI para reducir riesgo de despliegue.

## 2. Pipeline CI/CD seleccionado

- Plataforma: GitHub Actions.
- Fichero de pipeline: `.github/workflows/devsecops.yml`.
- Flujo:
  1. Checkout + entorno Python.
  2. Tests funcionales y de seguridad.
  3. SCA (`pip-audit`).
  4. SAST (`bandit`).
  5. Security IaC (`trivy config`).
  6. DAST (`OWASP ZAP baseline`) sobre app viva.
  7. Integracion con DefectDojo (import + resumen de priorizacion) cuando existen secretos.

## 3. Herramientas de seguridad seleccionadas

- SCA: `pip-audit`.
  - Evidencia: `reports/pip-audit.json`.

- SAST: `Bandit`.
  - Evidencia: `reports/bandit.json`.

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
- Endurecimiento de cabeceras HTTP en la app (`app/main.py`) y tests de validacion (`tests/test_security.py`).
- Evidencias centralizadas en `reports/` y artefacto `devsecops-reports`.

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

## 7. Resultado de ejecucion local (15-04-2026)

- Tests: 4/4 correctos (`reports/pytest-results.xml`).
- Cobertura: 100% (`reports/coverage.xml`).
- SAST Bandit: 0 hallazgos (`reports/bandit.json`).
- SCA pip-audit: 0 vulnerabilidades (`reports/pip-audit.json`).
- Security IaC Trivy: 0 hallazgos (`reports/trivy-config.json`).
- DAST ZAP baseline:
  - `WARN-NEW: 0`
  - `FAIL-NEW: 0`
  - 1 regla en `IGNORE` por politica (`10049`, `zap-rules.tsv`).
  - Evidencia de ejecucion: `reports/zap-baseline.log`.

