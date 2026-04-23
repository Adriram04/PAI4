# PAI4 - Pipeline DevSecOps sobre my-pass

Este repositorio implementa un pipeline DevSecOps para analizar `my-pass` como sistema objetivo.

## Restriccion sobre `my-pass`

- `my-pass` no se modifica directamente.
- El analisis se realiza sobre una copia de trabajo en `target/my-pass`.
- En local, la fuente puede ser el repo vecino `../my-pass` (solo lectura para clonacion/copia).

## Stack y alcance

- Objetivo de analisis: `my-pass` (TypeScript/Expo/Firebase).
- CI/CD: `GitHub Actions`.
- Herramientas de seguridad integradas:
  - `npm audit` (SCA)
  - `Semgrep` (SAST)
  - `Trivy config` (Security in IaC)
  - `OWASP ZAP baseline` (DAST)
- Gestion de vulnerabilidades: `DefectDojo` (opcional por secretos).

## Configuracion del objetivo

- `TARGET_CODE_PATH`: ruta del codigo objetivo (local por defecto `target/my-pass`).
- `TARGET_REPOSITORY_URL`: repositorio a clonar si la ruta no existe.
- `TARGET_DAST_URL`: URL a escanear con ZAP (por defecto `http://127.0.0.1:19006`).

En GitHub Actions se usa:

- `TARGET_CODE_PATH=target/my-pass`
- `TARGET_REPOSITORY_URL=https://github.com/josemgarciar/my-pass.git`

## Estructura relevante

- `.github/workflows/devsecops.yml`: pipeline DevSecOps completo.
- `scripts/semgrep-rules.yml`: reglas SAST para JavaScript/TypeScript.
- `scripts/run_positive_controls.py`: validacion positiva automatizada (Semgrep, npm audit, Trivy, ZAP).
- `scripts/positive_controls/`: casos vulnerables controlados para pruebas positivas.
- `scripts/import_to_defectdojo.py`: importacion de hallazgos por API.
- `scripts/export_defectdojo_summary.py`: resumen por engagement.
- `reports/`: evidencias y reportes.
- `docs/`: informe tecnico, manual y trazabilidad de entrega.

## Ejecucion local

1. Instalar dependencias de PAI4:

```bash
python -m pip install -r requirements-dev.txt
```

2. Preparar objetivo de analisis sin tocar `my-pass` original:

```bash
make install TARGET_CODE_PATH=target/my-pass TARGET_REPOSITORY_URL=../my-pass
```

3. Levantar `my-pass` en web (para DAST):

```bash
make run TARGET_CODE_PATH=target/my-pass
```

4. Ejecutar tests unitarios del objetivo:

```bash
make test TARGET_CODE_PATH=target/my-pass
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

## Pipeline en GitHub

El workflow `devsecops.yml` ejecuta:

1. `sast`: Semgrep sobre `my-pass` + control positivo de Semgrep.
2. `sca_iac`: npm audit + Trivy config sobre `my-pass`.
3. `dast`: build web de `my-pass` + ZAP baseline.
4. `positive_controls`: prueba positiva automatizada para Semgrep, npm audit, Trivy y ZAP.
5. `deploy_staging`: despliegue del build web en `nginx` y smoke test HTTP.
6. `defectdojo` (opcional): importacion y resumen de hallazgos.
7. `reports_bundle`: artefacto consolidado final.

## DefectDojo (opcional)

Definir secretos en GitHub:

- `DEFECTDOJO_URL`
- `DEFECTDOJO_API_KEY`
- `DEFECTDOJO_ENGAGEMENT_ID`

Con esos secretos, se importan reportes y se genera `reports/defectdojo-summary.json`.

## Evidencias verificadas

Evidencias principales regeneradas el `2026-04-22` sobre `target/my-pass`:

- `reports/semgrep.json`
- `reports/npm-audit.json`
- `reports/trivy-config.json`
- `reports/zap.json`
- `reports/zap.html`
- `reports/zap-baseline.log`
- `reports/deploy-health.html`
- `reports/deploy-staging.log`
- `reports/semgrep-positive-control.json`
- `reports/semgrep-positive-control-alltools.json`
- `reports/npm-audit-positive-control.json`
- `reports/trivy-positive-control.json`
- `reports/zap-positive-control.json`

## Empaquetado de entrega

```powershell
./scripts/package_pai4.ps1 -TeamNumber 1
```
