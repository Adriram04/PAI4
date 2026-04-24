# PAI4 - Pipeline DevSecOps sobre my-pass

Este repositorio implementa un pipeline DevSecOps sobre `my-pass` y conserva evidencias reproducibles del analisis.

## Documentacion recomendada

- Vision global del proyecto: `README.md`
- Memoria base de entrega: `docs/MEMORIA_ENTREGA_PAI4.md`
- Informe tecnico detallado: `docs/INFORME_TECNICO_PAI4.md`
- Manual de despliegue y uso: `docs/MANUAL_DESPLIEGUE_USO.md`
- Trazabilidad de objetivos: `docs/GRADO_COMPLETITUD.md`
- Checklist final de empaquetado: `docs/ENTREGA_CHECKLIST.md`

## Alcance real del repositorio

- `my-pass` no se modifica directamente.
- El workflow y el `Makefile` operan sobre `TARGET_CODE_PATH`, cuyo valor por defecto es `target/my-pass`.
- Tanto GitHub Actions como `make prepare-target` clonan desde `TARGET_REPOSITORY_URL` solo si la ruta objetivo no contiene `package.json`. Si ya existe una copia, se reutiliza tal cual.
- La snapshot actualmente versionada en `target/my-pass` es parcial: contiene `src/`, `tests/`, `scripts/`, `dist/` y ficheros de configuracion, pero no incluye `app/` ni `assets/`.
- El script `scripts/package_pai4.ps1` no incluye `target/my-pass` en el ZIP final. La reproduccion completa del analisis requiere acceso separado al repositorio objetivo.

## Stack y herramientas integradas

- Objetivo de analisis: `my-pass` (TypeScript, Expo y Firebase).
- CI/CD: `GitHub Actions`.
- SCA: `npm audit`.
- SAST: `Semgrep`.
- Security in IaC: `Trivy config`.
- DAST: `OWASP ZAP baseline`.
- Gestion de vulnerabilidades: `DefectDojo` por API REST cuando existen secretos.

## Configuracion del objetivo

- `TARGET_CODE_PATH`: ruta del codigo objetivo.
- `TARGET_REPOSITORY_URL`: repositorio o ruta local a clonar cuando `TARGET_CODE_PATH` no existe.
- `TARGET_DAST_URL`: URL que ZAP debe escanear.
- `TARGET_WEB_PORT`: puerto usado por el workflow para servir el export web.

Valores fijados en GitHub Actions:

- `TARGET_CODE_PATH=target/my-pass`
- `TARGET_REPOSITORY_URL=https://github.com/josemgarciar/my-pass.git`
- `TARGET_DAST_URL=http://127.0.0.1:19006`

## Estructura relevante

- `.github/workflows/devsecops.yml`: pipeline CI/CD y DevSecOps.
- `Makefile`: comandos locales de instalacion, pruebas y escaneos.
- `scripts/semgrep-rules.yml`: reglas SAST usadas en Semgrep.
- `scripts/run_positive_controls.py`: controles positivos automatizados para las cuatro herramientas.
- `scripts/import_to_defectdojo.py`: importacion de reportes en DefectDojo.
- `scripts/export_defectdojo_summary.py`: resumen por engagement en DefectDojo.
- `reports/`: evidencias generadas.
- `docs/`: documentacion tecnica, manual, trazabilidad y memoria de entrega.

## Resultados verificados sobre el estado actual del proyecto

Evidencias principales con fecha `2026-04-23` en `reports/`:

- `Semgrep` sobre `target/my-pass`: `0` hallazgos en `reports/semgrep.json`.
- Control positivo de `Semgrep`: `1` hallazgo en `reports/semgrep-positive-control-alltools.json`.
- `npm audit` sobre `target/my-pass`: `18` vulnerabilidades (`1` critical, `3` high, `14` moderate) en `reports/npm-audit.json`.
- `Trivy config` sobre `target/my-pass`: `0` hallazgos en `reports/trivy-config.json`.
- Control positivo de `Trivy`: `36` hallazgos en `reports/trivy-positive-control.json`.
- `OWASP ZAP baseline` sobre el export web actual: `WARN-NEW: 9` en `reports/zap-baseline.log` y `12` alertas serializadas en `reports/zap.json`.
- `deploy_staging`: smoke test HTTP correcto en `reports/deploy-health.html`.

Observaciones importantes:

- Las reglas Semgrep incluidas verifican patrones de ejecucion dinamica de codigo (`eval` y `new Function`). Un resultado `0` implica ausencia de coincidencias con esa politica concreta, no ausencia total de vulnerabilidades.
- El export web actual de `target/my-pass` se genera, pero lanza aviso por `./assets/favicon.png` ausente.
- ZAP registra respuestas `404` para `/robots.txt` y `/sitemap.xml` en el estado actual del bundle exportado.
- El analisis DAST recae sobre el export web servido en `dist/`, no sobre una aplicacion movil nativa ni sobre servicios backend dedicados.
- `reports/defectdojo-summary.json` es un resumen acumulado del engagement, no una foto aislada del ultimo run.

## Ejecucion local

1. Instalar dependencias de PAI4:

```bash
python -m pip install -r requirements-dev.txt
```

2. Preparar el objetivo de analisis:

```bash
make install TARGET_CODE_PATH=target/my-pass TARGET_REPOSITORY_URL=../my-pass
```

Notas:

- Si `target/my-pass` ya contiene `package.json`, el proyecto reutiliza esa snapshot y no fuerza una clonacion nueva.
- Si quieres una copia fresca sin tocar la snapshot actual, usa otra ruta, por ejemplo `TARGET_CODE_PATH=target/my-pass-fresh`.

3. Ejecutar pruebas unitarias del objetivo:

```bash
make test TARGET_CODE_PATH=target/my-pass
```

4. Levantar el objetivo para escaneo DAST local:

```bash
make run TARGET_CODE_PATH=target/my-pass
```

5. Ejecutar escaneos de seguridad:

```bash
make scan-sca TARGET_CODE_PATH=target/my-pass
make scan-sast TARGET_CODE_PATH=target/my-pass
make scan-iac TARGET_CODE_PATH=target/my-pass
make scan-dast TARGET_DAST_URL=http://127.0.0.1:19006
```

6. Ejecutar controles positivos:

```bash
make scan-positive-controls
```

## Pipeline en GitHub Actions

El workflow `devsecops.yml` ejecuta:

1. `sast`: Semgrep sobre `TARGET_CODE_PATH` y control positivo de Semgrep.
2. `sca_iac`: `npm audit` y `Trivy config`.
3. `dast`: `expo export --platform web`, servido local temporal y escaneo con ZAP.
4. `positive_controls`: validacion positiva de Semgrep, npm audit, Trivy y ZAP.
5. `deploy_staging`: despliegue del export web en `nginx` y smoke test HTTP.
6. `defectdojo`: importacion opcional y export de resumen.
7. `reports_bundle`: consolidacion de artefactos.

Enfoque de seguridad aplicado:

- desplazamiento a la izquierda con SAST y SCA
- validacion de configuracion con `Trivy config`
- validacion de superficie expuesta con DAST
- normalizacion de hallazgos en DefectDojo
- controles positivos para demostrar que la integracion detecta casos conocidos y no solo “ejecuta sin fallar”

## DefectDojo

Secretos requeridos:

- `DEFECTDOJO_URL`
- `DEFECTDOJO_API_KEY`
- `DEFECTDOJO_ENGAGEMENT_ID`

Compatibilidad usada por el workflow:

- `reports/npm-audit.json` con `scan-type` `NPM Audit v7+ Scan`.
- `reports/semgrep.json` con `scan-type` `Semgrep JSON Report`.
- `reports/trivy-config.json` con `scan-type` `Trivy Scan`.
- `reports/zap.xml` con `scan-type` `ZAP Scan`.

Estado verificado:

- Import de `npm audit`: correcto, con `18` hallazgos en la importacion actual.
- Import de `Semgrep`: correcto, con `0` hallazgos en la importacion actual.
- Import de `Trivy`: correcto, con `0` hallazgos en la importacion actual.
- Import de `ZAP`: correcto, con `12` hallazgos en la importacion actual.
- `defectdojo-summary.json`: acumulado del engagement, actualmente `60` hallazgos totales.

## Empaquetado de entrega

El ZIP se genera con:

```powershell
./scripts/package_pai4.ps1 -TeamNumber <Num>
```

El ZIP automatico incluye pipeline, scripts, `reports/`, `docs/` y ficheros base del repositorio, pero no incluye `target/my-pass`.

## Recomendacion de lectura

Si vas a preparar la entrega final, empieza por `docs/MEMORIA_ENTREGA_PAI4.md`. Ese documento resume el proyecto con estructura de memoria tecnica y puede servir como base directa para el PDF.
