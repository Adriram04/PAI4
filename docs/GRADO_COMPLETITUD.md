# Grado de Completitud y Trazabilidad

| Objetivo PAI4 | Estado | Evidencia |
|---|---|---|
| 1. Definir pipeline CI/CD en repositorio SCM | Cumplido | Jobs `sast`, `sca_iac`, `dast`, `positive_controls`, `deploy_staging` en `.github/workflows/devsecops.yml` |
| 2. Seleccionar al menos 3 herramientas de seguridad | Cumplido | `pip-audit`, `Bandit`, `Semgrep`, `Trivy`, `OWASP ZAP` |
| 3. Integrar herramientas en ciclo de vida | Cumplido | Jobs `sast`, `sca_iac`, `dast`, `positive_controls`, `deploy_staging` + artefactos por etapa |
| 4. Desarrollar tests para detectar vulnerabilidades | Cumplido | `scripts/run_positive_controls.py` valida deteccion positiva en Bandit, Semgrep, pip-audit, Trivy y ZAP |
| 5. Integrar gestion de vulnerabilidades | Cumplido | `scripts/import_to_defectdojo.py`, `scripts/export_defectdojo_summary.py`, pasos DefectDojo del workflow y salidas `reports/defectdojo-*.json` |

## Observaciones

- Evidencias locales actualizadas: `pytest`, `coverage`, `pip-audit`, `bandit`, `semgrep`, `trivy-config`, `zap.json`, `zap.html`, `deploy-health`.
- Evidencia de controles positivos multi-herramienta: `reports/bandit-positive-control.json`, `reports/semgrep-positive-control-alltools.json`, `reports/pip-audit-positive-control.json`, `reports/trivy-positive-control.json`, `reports/zap-positive-control.json`.
- DAST queda sin `WARN` abiertos (`WARN-NEW: 0`) y con una regla de cache aceptada de forma explicita en `zap-rules.tsv` (regla `10049`).
- La evidencia E2E de Objetivo 5 se materializa automaticamente al ejecutar el workflow con secretos DefectDojo.
