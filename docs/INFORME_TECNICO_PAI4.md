# Informe Tecnico PAI4

## 1. Resumen

Se implementa un pipeline DevSecOps en GitHub Actions para analizar `my-pass` en todas las etapas de seguridad solicitadas por el PAI4.

## 1.1 Restriccion sobre `my-pass`

- El repositorio `my-pass` no se modifica directamente.
- El pipeline analiza una copia de trabajo en `target/my-pass`.
- En ejecucion local se usa `TARGET_REPOSITORY_URL=../my-pass` para evitar cambios en el origen.

## 2. Pipeline CI/CD seleccionado

- Plataforma: GitHub Actions.
- Workflow: `.github/workflows/devsecops.yml`.
- Objetivo de analisis: `my-pass` (clonado en `target/my-pass` en CI).
- Variables principales del pipeline:
  - `TARGET_CODE_PATH`
  - `TARGET_REPOSITORY_URL`
  - `TARGET_DAST_URL`
  - `TARGET_WEB_PORT`

## 3. Flujo DevSecOps implementado

1. `sast`
- Semgrep sobre el codigo de `my-pass`.
- Control positivo de Semgrep.
- Evidencias: `reports/semgrep.json`, `reports/semgrep-positive-control.json`.

2. `sca_iac`
- SCA con `npm audit`.
- Security in IaC con `trivy config`.
- Evidencias: `reports/npm-audit.json`, `reports/trivy-config.json`.

3. `dast`
- Build web de `my-pass` con Expo.
- Servido local temporal en CI.
- Escaneo `OWASP ZAP baseline`.
- Evidencias: `reports/zap.json`, `reports/zap.html`, `reports/zap-baseline.log`, `reports/dast-readiness.html`.

4. `positive_controls`
- Ejecucion automatizada de controles positivos para confirmar deteccion real en:
  - Semgrep
  - npm audit
  - Trivy
  - ZAP
- Evidencias:
  - `reports/semgrep-positive-control-alltools.json`
  - `reports/npm-audit-positive-control.json`
  - `reports/trivy-positive-control.json`
  - `reports/zap-positive-control.json`

5. `deploy_staging`
- Publicacion del build web de `my-pass` en contenedor `nginx`.
- Verificacion de disponibilidad HTTP.
- Evidencias: `reports/deploy-health.html`, `reports/deploy-staging.log`.

6. `defectdojo` (opcional)
- Importacion automatizada de resultados y resumen de priorizacion.
- Evidencias:
  - `reports/defectdojo-import-*.json`
  - `reports/defectdojo-summary.json`

7. `reports_bundle`
- Consolidacion de todos los reportes en `devsecops-reports`.

## 4. Herramientas de seguridad seleccionadas

- SCA: `npm audit`.
- SAST: `Semgrep`.
- DAST: `OWASP ZAP baseline`.
- Security in IaC: `Trivy config`.
- Gestion de vulnerabilidades: `DefectDojo` (opcional).

## 5. Integracion con DefectDojo

Automatizada mediante API REST:

- Importacion: `scripts/import_to_defectdojo.py`.
- Resumen por engagement: `scripts/export_defectdojo_summary.py`.
- Secretos requeridos:
  - `DEFECTDOJO_URL`
  - `DEFECTDOJO_API_KEY`
  - `DEFECTDOJO_ENGAGEMENT_ID`

## 6. Conclusiones

El repositorio queda alineado para que el analisis principal del PAI4 se ejecute sobre `my-pass`, con evidencias por etapa, controles positivos automatizados y opcion de gestion centralizada de vulnerabilidades.

## 7. Estado actual de evidencias

Evidencias regeneradas el `2026-04-22` sobre `target/my-pass`:

- Principal: `reports/semgrep.json`, `reports/npm-audit.json`, `reports/trivy-config.json`, `reports/zap.json`
- DAST: `reports/zap.html`, `reports/zap-baseline.log`
- Positivos: `reports/semgrep-positive-control.json`, `reports/semgrep-positive-control-alltools.json`, `reports/npm-audit-positive-control.json`, `reports/trivy-positive-control.json`, `reports/zap-positive-control.json`
- Despliegue: `reports/deploy-health.html`, `reports/deploy-staging.log`

Nota: `my-pass` no incorpora manifiestos IaC clasicos (Dockerfile/Kubernetes/Terraform), por lo que `Trivy config` puede finalizar sin hallazgos en IaC objetivo.
