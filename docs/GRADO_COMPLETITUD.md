# Grado de Completitud y Trazabilidad

| Objetivo PAI4 | Estado | Evidencia real del proyecto |
|---|---|---|
| 1. Definir pipeline CI/CD en repositorio SCM | Cumplido | Workflow `.github/workflows/devsecops.yml` con jobs `sast`, `sca_iac`, `dast`, `positive_controls`, `deploy_staging`, `defectdojo` y `reports_bundle` |
| 2. Seleccionar al menos 3 herramientas de testeo de seguridad | Cumplido | `npm audit` (SCA), `Semgrep` (SAST), `Trivy config` (IaC) y `OWASP ZAP baseline` (DAST) |
| 3. Integrar herramientas en el ciclo de vida del desarrollo | Cumplido con observaciones | Las herramientas estan integradas por etapas y generan artefactos, pero el objetivo usado por defecto es la snapshot actual de `target/my-pass`, reutilizada mientras exista `package.json` |
| 4. Desarrollar tests para detectar vulnerabilidades en cada etapa | Cumplido | `scripts/run_positive_controls.py` valida detecciones positivas en Semgrep, npm audit, Trivy y ZAP |
| 5. Integrar herramienta de gestion y priorizacion de vulnerabilidades | Cumplido con observaciones | DefectDojo se integra por API con `scripts/import_to_defectdojo.py` y `scripts/export_defectdojo_summary.py`; el resumen generado es acumulado por engagement |

## Sintesis ejecutiva

El proyecto cumple todos los objetivos funcionales de la practica. Las observaciones existentes no cuestionan la integracion del pipeline, pero si condicionan la interpretacion final de resultados y la reproducibilidad de la entrega.

## Observaciones trazables

- El analisis principal se ejecuta sobre `TARGET_CODE_PATH`, que por defecto es `target/my-pass`.
- La clonacion desde `TARGET_REPOSITORY_URL` no es forzada: si existe `package.json`, la snapshot local se reutiliza.
- La snapshot actual de `target/my-pass` es parcial y no incluye `app/` ni `assets/`.
- El ZIP generado por `scripts/package_pai4.ps1` no incluye `target/my-pass`.

## Estado actual de resultados

- `Semgrep` sobre el objetivo actual: `0` hallazgos en `reports/semgrep.json`
- `npm audit` sobre el objetivo actual: `18` vulnerabilidades en `reports/npm-audit.json`
- `Trivy config` sobre el objetivo actual: `0` hallazgos en `reports/trivy-config.json`
- `ZAP baseline` sobre el export actual: `WARN-NEW: 9` en `reports/zap-baseline.log`
- `deploy_staging`: smoke test correcto en `reports/deploy-health.html`

## Controles positivos

- `reports/semgrep-positive-control-alltools.json`
- `reports/npm-audit-positive-control.json`
- `reports/trivy-positive-control.json`
- `reports/zap-positive-control.json`

Estos controles demuestran que la ausencia de hallazgos en `Semgrep` y `Trivy` sobre el objetivo actual no se debe a una integracion rota, sino al estado concreto del codigo analizado.

## DefectDojo

- `reports/defectdojo-import-npm-audit.json`: import correcto con `18` hallazgos
- `reports/defectdojo-import-semgrep.json`: import correcto con `0` hallazgos
- `reports/defectdojo-import-trivy.json`: import correcto con `0` hallazgos
- `reports/defectdojo-import-zap.json`: import correcto con `12` hallazgos
- `reports/defectdojo-summary.json`: `60` hallazgos acumulados en el engagement consultado

## Valor de cumplimiento

Desde el punto de vista de aseguramiento, el nivel de completitud es alto porque la practica no solo selecciona herramientas, sino que demuestra:

- ejecucion automatizada por etapa
- generacion de artefactos verificables
- prueba positiva de deteccion
- consolidacion opcional en una plataforma de gestion

La principal cautela documental consiste en no presentar la snapshot actual de `target/my-pass` como si fuese necesariamente el repositorio fuente completo.
