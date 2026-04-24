# Checklist de Entrega PAI4

## 1. Contenido que genera realmente `scripts/package_pai4.ps1`

El ZIP automatico incluye:

- `.github/`
- `app/`
- `docs/`
- `k8s/`
- `reports/`
- `scripts/`
- `tests/`
- `Dockerfile`
- `docker-compose.yml`
- `requirements.txt`
- `requirements-dev.txt`
- `README.md`
- `Makefile`
- `zap-rules.tsv`

## 2. Contenido que NO incluye el ZIP automatico

- `target/my-pass`
- el repo vecino `../my-pass`
- secretos de GitHub
- la instancia de DefectDojo

Consecuencia:

- la reproduccion completa del analisis desde el ZIP requiere acceso adicional al repositorio objetivo

## 3. Evidencias presentes hoy en `reports/`

Escaneos principales:

- `reports/semgrep.json`
- `reports/npm-audit.json`
- `reports/trivy-config.json`
- `reports/zap.json`
- `reports/zap.xml`
- `reports/zap.html`
- `reports/zap-baseline.log`

Controles positivos:

- `reports/semgrep-positive-control.json`
- `reports/semgrep-positive-control-alltools.json`
- `reports/npm-audit-positive-control.json`
- `reports/trivy-positive-control.json`
- `reports/zap-positive-control.json`
- `reports/zap-positive-control.html`
- `reports/zap-positive-control.log`

Despliegue:

- `reports/deploy-health.html`
- `reports/deploy-staging.log`

DefectDojo:

- `reports/defectdojo-import-npm-audit.json`
- `reports/defectdojo-import-semgrep.json`
- `reports/defectdojo-import-trivy.json`
- `reports/defectdojo-import-zap.json`
- `reports/defectdojo-summary.json`

Estado actual verificado:

- hay evidencias con fechas entre `2026-04-22` y `2026-04-23`
- los reportes principales y los imports de DefectDojo estan presentes

## 4. Lectura correcta de las evidencias

- `reports/semgrep.json` y `reports/trivy-config.json` no contienen hallazgos en la snapshot actual del objetivo
- la deteccion funcional de las herramientas queda demostrada por los controles positivos
- `reports/defectdojo-summary.json` es acumulado por engagement y no representa solo el ultimo run

## 5. Documento PDF

Base documental recomendada:

- `docs/MEMORIA_ENTREGA_PAI4.md`
- `docs/INFORME_TECNICO_PAI4.md`
- `docs/MANUAL_DESPLIEGUE_USO.md`
- `docs/GRADO_COMPLETITUD.md`

Uso recomendado:

- `MEMORIA_ENTREGA_PAI4.md` como base principal de narrativa
- `INFORME_TECNICO_PAI4.md` para ampliar detalles si se necesita justificar elecciones o hallazgos

## 6. Nombre recomendado del ZIP

`PAI4-ST<Num>.zip`

## 7. Generacion automatica del ZIP

```powershell
./scripts/package_pai4.ps1 -TeamNumber <Num>
```

## 8. Nota final de alcance

- El objetivo del analisis es `my-pass`.
- El proyecto no modifica directamente el repositorio original.
- La snapshot actualmente usada por defecto es `target/my-pass`, pero la entrega automatica no la empaqueta.
