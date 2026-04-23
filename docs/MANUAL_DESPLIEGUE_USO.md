# Manual de Despliegue y Uso

## 1. Prerrequisitos

- Python 3.12+
- Node.js 20+
- Docker
- Acceso a internet para clonado de `my-pass` y feeds de seguridad

## 2. Restriccion operativa sobre `my-pass`

- No se modifica el repositorio `my-pass` original.
- Se trabaja sobre una copia en `target/my-pass`.
- Para entorno local, se recomienda usar `TARGET_REPOSITORY_URL=../my-pass`.
## 3. Instalacion

Instalar dependencias del repositorio PAI4:

```bash
python -m pip install -r requirements-dev.txt
```

Preparar el objetivo de analisis:

```bash
make install TARGET_CODE_PATH=target/my-pass TARGET_REPOSITORY_URL=../my-pass
```

Si `target/my-pass` no existe, `make install` lo clona desde `TARGET_REPOSITORY_URL`.

## 4. Ejecucion del objetivo para DAST

```bash
make run TARGET_CODE_PATH=target/my-pass
```

Por defecto queda accesible en `http://127.0.0.1:19006`.

## 5. Ejecucion de pruebas unitarias del objetivo

```bash
make test TARGET_CODE_PATH=target/my-pass
```

## 6. Ejecucion de analisis de seguridad

SCA (npm audit):

```bash
make scan-sca TARGET_CODE_PATH=target/my-pass
```

SAST (Semgrep):

```bash
make scan-sast TARGET_CODE_PATH=target/my-pass
```

Security in IaC (Trivy):

```bash
make scan-iac TARGET_CODE_PATH=target/my-pass
```

DAST (ZAP baseline):

```bash
make scan-dast TARGET_DAST_URL=http://127.0.0.1:19006
```

## 7. Controles positivos automatizados

```bash
make scan-positive-controls
```

Genera como minimo:

- `reports/semgrep-positive-control-alltools.json`
- `reports/npm-audit-positive-control.json`
- `reports/trivy-positive-control.json`
- `reports/zap-positive-control.json`
- `reports/zap-positive-control.log`

## 8. Pipeline en GitHub Actions

Workflow: `.github/workflows/devsecops.yml`.

Jobs:

- `sast`: Semgrep + control positivo de Semgrep.
- `sca_iac`: npm audit + Trivy config.
- `dast`: build web de `my-pass` + ZAP baseline.
- `positive_controls`: validacion positiva de Semgrep, npm audit, Trivy y ZAP.
- `deploy_staging`: despliegue web en `nginx` + smoke test.
- `defectdojo` (opcional): importacion y resumen.
- `reports_bundle`: consolidacion final de artefactos.

## 9. Integracion con DefectDojo

Configurar secretos del repositorio:

- `DEFECTDOJO_URL`
- `DEFECTDOJO_API_KEY`
- `DEFECTDOJO_ENGAGEMENT_ID`

Con secretos presentes, se generan:

- `reports/defectdojo-import-npm-audit.json`
- `reports/defectdojo-import-semgrep.json`
- `reports/defectdojo-import-trivy.json`
- `reports/defectdojo-import-zap.json`
- `reports/defectdojo-summary.json`

## 10. Estado de evidencias (actual)

Evidencias verificadas en `reports/` el `2026-04-22`:

- `semgrep.json`, `npm-audit.json`, `trivy-config.json`, `zap.json`, `zap.html`, `zap-baseline.log`
- `semgrep-positive-control.json`, `semgrep-positive-control-alltools.json`
- `npm-audit-positive-control.json`, `trivy-positive-control.json`
- `zap-positive-control.json`, `zap-positive-control.html`, `zap-positive-control.log`
- `deploy-health.html`, `deploy-staging.log`

Nota: en `my-pass` no hay manifiestos IaC clasicos (Dockerfile/Kubernetes/Terraform), por lo que `trivy-config.json` puede reflejar ejecucion sin hallazgos de misconfig en IaC.

## 11. Empaquetado final

```powershell
./scripts/package_pai4.ps1 -TeamNumber <Num>
```
