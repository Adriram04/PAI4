# Checklist de Entrega PAI4

## Contenido tecnico a incluir en el ZIP

- Codigo fuente y configuracion:
  - `app/`
  - `tests/`
  - `k8s/`
  - `.github/workflows/devsecops.yml`
  - `scripts/import_to_defectdojo.py`
  - `scripts/export_defectdojo_summary.py`
  - `scripts/package_pai4.ps1`
  - `zap-rules.tsv`
  - `Dockerfile`, `docker-compose.yml`, `requirements*.txt`

- Evidencias:
  - `reports/pytest-results.xml`
  - `reports/coverage.xml`
  - `reports/pip-audit.json`
  - `reports/bandit.json`
  - `reports/trivy-config.json`
  - `reports/zap.json`
  - `reports/zap.html`
  - `reports/zap-baseline.log`
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

