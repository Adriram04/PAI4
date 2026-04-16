# Checklist de Entrega PAI4

## Contenido tecnico a incluir en el ZIP

- Codigo fuente y configuracion:
  - `app/`
  - `tests/`
  - `k8s/`
  - `.github/workflows/devsecops.yml`
  - `scripts/import_to_defectdojo.py`
  - `scripts/export_defectdojo_summary.py`
  - `scripts/run_positive_controls.py`
  - `scripts/semgrep-rules.yml`
  - `scripts/positive_controls/`
  - `scripts/package_pai4.ps1`
  - `zap-rules.tsv`
  - `Dockerfile`, `docker-compose.yml`, `requirements*.txt`

- Evidencias:
  - `reports/pytest-results.xml`
  - `reports/coverage.xml`
  - `reports/pip-audit.json`
  - `reports/bandit.json`
  - `reports/semgrep.json`
  - `reports/semgrep-positive-control.json`
  - `reports/semgrep-positive-control-alltools.json`
  - `reports/bandit-positive-control.json`
  - `reports/pip-audit-positive-control.json`
  - `reports/trivy-positive-control.json`
  - `reports/zap-positive-control.json`
  - `reports/zap-positive-control.html`
  - `reports/zap-positive-control.log`
  - `reports/trivy-config.json`
  - `reports/zap.json`
  - `reports/zap.html`
  - `reports/zap-baseline.log`
  - `reports/deploy-health.json`
  - `reports/deploy-staging.log`
  - `reports/defectdojo-import-*.json` (si se ejecuta con secretos DefectDojo)
  - `reports/defectdojo-summary.json` (si se ejecuta con secretos DefectDojo)

## Documento PDF (max 10 paginas)

Base propuesta en `docs/`:

- `INFORME_TECNICO_PAI4.md`
- `MANUAL_DESPLIEGUE_USO.md`
- `GRADO_COMPLETITUD.md`
- `PAI4-ST1-Informe.pdf` (generado)

## Nombre recomendado del zip

`PAI4-ST<Num>.zip`

## Generacion automatica del ZIP

```powershell
./scripts/package_pai4.ps1 -TeamNumber <Num>
```

