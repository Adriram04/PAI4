# Manual de Despliegue y Uso

## 1. Prerrequisitos

- Python 3.12+
- Node.js 20+
- Docker
- Acceso al repositorio objetivo `my-pass` si se desea reproducir el analisis fuera de la snapshot incluida

## 2. Objetivo del manual

Este manual describe como preparar el entorno, ejecutar el pipeline localmente, interpretar los modos de trabajo disponibles y empaquetar la entrega.

## 3. Consideraciones operativas

- `my-pass` no se modifica directamente.
- El repositorio trabaja sobre una copia en `TARGET_CODE_PATH`.
- El valor por defecto es `target/my-pass`.
- La clonacion desde `TARGET_REPOSITORY_URL` solo ocurre si la ruta destino no contiene `package.json`.
- La snapshot actualmente guardada en `target/my-pass` es parcial y no incluye `app/` ni `assets/`.

## 4. Modos de trabajo recomendados

### Modo A - Reproducir exactamente las evidencias incluidas

Usa la snapshot ya presente en `target/my-pass`.

Ventaja:

- coincide con los reportes guardados actualmente en `reports/`

Limitacion:

- esa snapshot no representa el repo fuente completo

### Modo B - Analizar una copia fresca del objetivo

Usa una ruta nueva para evitar reutilizar la snapshot actual.

Ejemplo recomendado:

```bash
make install TARGET_CODE_PATH=target/my-pass-fresh TARGET_REPOSITORY_URL=../my-pass
```

Ventaja:

- evita depender de la snapshot parcial versionada en `target/my-pass`

## 5. Instalacion base

Instalar dependencias de PAI4:

```bash
python -m pip install -r requirements-dev.txt
```

Preparar el objetivo:

```bash
make install TARGET_CODE_PATH=target/my-pass TARGET_REPOSITORY_URL=../my-pass
```

Si `TARGET_CODE_PATH` ya contiene `package.json`, la automatizacion reutiliza esa ruta y no clona de nuevo.

## 6. Verificacion funcional minima

Ejecutar pruebas unitarias del objetivo:

```bash
make test TARGET_CODE_PATH=target/my-pass
```

Estado verificado en esta copia de trabajo:

- `npm run test:unit -- --runInBand` completa `12` suites y `90` tests correctos

## 7. Ejecucion local para DAST

Levantar la aplicacion web:

```bash
make run TARGET_CODE_PATH=target/my-pass
```

Por defecto queda accesible en `http://127.0.0.1:19006`.

Nota:

- En local, `make scan-dast` solo ejecuta ZAP contra `TARGET_DAST_URL`.
- A diferencia del workflow, el `Makefile` no exporta y sirve automaticamente `dist/`.

## 8. Ejecucion de analisis de seguridad

SCA:

```bash
make scan-sca TARGET_CODE_PATH=target/my-pass
```

SAST:

```bash
make scan-sast TARGET_CODE_PATH=target/my-pass
```

IaC:

```bash
make scan-iac TARGET_CODE_PATH=target/my-pass
```

DAST:

```bash
make scan-dast TARGET_DAST_URL=http://127.0.0.1:19006
```

Resultados observados en la snapshot actual:

- `Semgrep`: `0` hallazgos en `reports/semgrep.json`
- `npm audit`: `18` vulnerabilidades en `reports/npm-audit.json`
- `Trivy config`: `0` hallazgos en `reports/trivy-config.json`
- `ZAP baseline`: `WARN-NEW: 9` en `reports/zap-baseline.log`

## 9. Controles positivos automatizados

Ejecutar:

```bash
make scan-positive-controls
```

Genera como minimo:

- `reports/semgrep-positive-control-alltools.json`
- `reports/npm-audit-positive-control.json`
- `reports/trivy-positive-control.json`
- `reports/zap-positive-control.json`
- `reports/zap-positive-control.html`
- `reports/zap-positive-control.log`

Estado verificado:

- `Semgrep` detecta `1` hallazgo
- `Trivy` detecta `36` hallazgos en el control positivo
- `ZAP` detecta `9` alertas en el control positivo

## 10. Pipeline en GitHub Actions

Workflow: `.github/workflows/devsecops.yml`

Jobs:

- `sast`: Semgrep sobre `TARGET_CODE_PATH` y control positivo de Semgrep
- `sca_iac`: `npm audit` y `Trivy config`
- `dast`: `expo export --platform web`, servidor temporal y ZAP baseline
- `positive_controls`: validacion positiva de las cuatro herramientas
- `deploy_staging`: publicacion del export web en `nginx`
- `defectdojo`: importacion y resumen opcionales
- `reports_bundle`: consolidacion de artefactos

## 11. DefectDojo

Secretos requeridos:

- `DEFECTDOJO_URL`
- `DEFECTDOJO_API_KEY`
- `DEFECTDOJO_ENGAGEMENT_ID`

Salidas estandar del workflow:

- `reports/defectdojo-import-npm-audit.json`
- `reports/defectdojo-import-semgrep.json`
- `reports/defectdojo-import-trivy.json`
- `reports/defectdojo-import-zap.json`
- `reports/defectdojo-summary.json`

Interpretacion correcta:

- los cuatro imports pueden completarse correctamente aunque un reporte tenga `0` hallazgos
- `defectdojo-summary.json` es acumulado por engagement y no equivale al ultimo run aislado

## 12. Estado actual de evidencias

Evidencias presentes en `reports/` con timestamps entre `2026-04-22` y `2026-04-23`:

- principales: `semgrep.json`, `npm-audit.json`, `trivy-config.json`, `zap.json`, `zap.xml`, `zap.html`, `zap-baseline.log`
- positivos: `semgrep-positive-control.json`, `semgrep-positive-control-alltools.json`, `npm-audit-positive-control.json`, `trivy-positive-control.json`, `zap-positive-control.json`, `zap-positive-control.html`, `zap-positive-control.log`
- despliegue: `deploy-health.html`, `deploy-staging.log`
- DefectDojo: `defectdojo-import-*.json`, `defectdojo-summary.json`

## 13. Empaquetado final

Generar ZIP:

```powershell
./scripts/package_pai4.ps1 -TeamNumber <Num>
```

Importante:

- el ZIP automatico no incluye `target/my-pass`
- para reproducir el analisis desde el ZIP, hace falta acceso adicional al repositorio objetivo por URL o por copia local

## 14. Recomendaciones operativas

- Para una entrega centrada en evidencia, usa la snapshot actual y conserva `reports/` tal como estan.
- Para una entrega centrada en reproducibilidad, trabaja sobre un `TARGET_CODE_PATH` nuevo y vuelve a generar las evidencias.
- Si vas a explicar resultados a un evaluador, separa siempre:
  - hallazgos reales del objetivo actual
  - demostracion de capacidad de deteccion mediante controles positivos
