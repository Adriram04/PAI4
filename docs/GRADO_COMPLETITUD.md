# Grado de Completitud y Trazabilidad

| Objetivo PAI4 | Estado | Evidencia |
|---|---|---|
| 1. Definir pipeline CI/CD en repositorio SCM | Cumplido | Workflow `.github/workflows/devsecops.yml` con jobs `sast`, `sca_iac`, `dast`, `positive_controls`, `deploy_staging`, `defectdojo`, `reports_bundle` |
| 2. Seleccionar al menos 3 herramientas de testeo de seguridad | Cumplido | `npm audit` (SCA), `Semgrep` (SAST), `Trivy` (IaC), `OWASP ZAP` (DAST) |
| 3. Integrar herramientas en el ciclo de vida del desarrollo | Cumplido | Ejecucion por etapas, artefactos por job y bundle consolidado `devsecops-reports` |
| 4. Desarrollar tests para detectar vulnerabilidades en cada etapa | Cumplido | `scripts/run_positive_controls.py` valida detecciones positivas en Semgrep, npm audit, Trivy y ZAP |
| 5. Integrar herramienta de gestion/priorizacion de vulnerabilidades | Cumplido | Integracion opcional DefectDojo con `scripts/import_to_defectdojo.py` y `scripts/export_defectdojo_summary.py` |

## Observaciones

- El analisis principal esta alineado a `my-pass` (clonado en CI como `target/my-pass`).
- En local, para no tocar `my-pass` original, se usa copia de trabajo en `target/my-pass` con fuente `../my-pass`.
- Evidencias sincronizadas y verificadas el `2026-04-22`.
- Evidencias de escaneo principal:
  - `reports/semgrep.json`
  - `reports/npm-audit.json`
  - `reports/trivy-config.json`
  - `reports/zap.json`
- Evidencias de controles positivos:
  - `reports/semgrep-positive-control-alltools.json`
  - `reports/npm-audit-positive-control.json`
  - `reports/trivy-positive-control.json`
  - `reports/zap-positive-control.json`
- Evidencias de despliegue:
  - `reports/deploy-health.html`
  - `reports/deploy-staging.log`
- Nota IaC: `my-pass` no incluye manifiestos IaC clasicos, por lo que `trivy-config.json` puede reflejar ejecucion sin misconfigs detectadas en IaC objetivo.
