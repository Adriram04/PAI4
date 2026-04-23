# Checklist de Entrega PAI4

## Contenido tecnico a incluir en el ZIP

- Codigo fuente y configuracion:
  - `.github/workflows/devsecops.yml`
  - `scripts/import_to_defectdojo.py`
  - `scripts/export_defectdojo_summary.py`
  - `scripts/run_positive_controls.py`
  - `scripts/semgrep-rules.yml`
  - `scripts/positive_controls/`
  - `scripts/package_pai4.ps1`
  - `k8s/`
  - `docs/`
  - `tests/`
  - `app/` (solo soporte local)
  - `Makefile`
  - `README.md`
  - `zap-rules.tsv`

- Evidencias de pipeline/ejecucion:
  - `reports/semgrep.json`
  - `reports/npm-audit.json`
  - `reports/trivy-config.json`
  - `reports/zap.json`
  - `reports/zap.html`
  - `reports/zap-baseline.log`
  - `reports/semgrep-positive-control.json`
  - `reports/semgrep-positive-control-alltools.json`
  - `reports/npm-audit-positive-control.json`
  - `reports/trivy-positive-control.json`
  - `reports/zap-positive-control.json`
  - `reports/zap-positive-control.html`
  - `reports/zap-positive-control.log`
  - `reports/deploy-health.html`
  - `reports/deploy-staging.log`
  - `reports/defectdojo-import-*.json` (si se ejecuta con secretos)
  - `reports/defectdojo-summary.json` (si se ejecuta con secretos)

Estado actual (2026-04-22): todas las evidencias obligatorias anteriores estan presentes en `reports/`.

## Documento PDF (max 10 paginas)

Base propuesta en `docs/`:

- `INFORME_TECNICO_PAI4.md`
- `MANUAL_DESPLIEGUE_USO.md`
- `GRADO_COMPLETITUD.md`

## Nombre recomendado del ZIP

`PAI4-ST<Num>.zip`

## Generacion automatica del ZIP

```powershell
./scripts/package_pai4.ps1 -TeamNumber <Num>
```

## Nota de alcance

- El objetivo es `my-pass`, sin modificar su repositorio original.
- La ejecucion local debe usar copia en `target/my-pass` (por ejemplo, con `TARGET_REPOSITORY_URL=../my-pass`).
