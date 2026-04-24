# Informe Tecnico PAI4

## 1. Objetivo

Este documento describe la implantacion de un pipeline DevSecOps sobre `my-pass`, las herramientas seleccionadas, la integracion realizada y la interpretacion de resultados obtenidos a fecha `2026-04-23`.

## 2. Alcance del analisis

El objetivo funcional de la practica es demostrar la integracion continua de controles de seguridad en un pipeline CI/CD.

Alcance tecnico real del proyecto:

- el analisis se ejecuta sobre `TARGET_CODE_PATH`
- el valor por defecto es `target/my-pass`
- la clonacion desde `TARGET_REPOSITORY_URL` solo ocurre cuando no existe `package.json` en la ruta destino
- la snapshot actualmente versionada en `target/my-pass` es parcial y no incluye `app/` ni `assets/`

Por tanto, la interpretacion de resultados se apoya en la evidencia real generada por workflow, scripts y reportes, no en funcionalidades descritas fuera de la snapshot efectivamente analizada.

## 3. Pipeline seleccionado

Plataforma:

- GitHub Actions

Workflow:

- `.github/workflows/devsecops.yml`

Variables operativas:

- `TARGET_CODE_PATH`
- `TARGET_REPOSITORY_URL`
- `TARGET_DAST_URL`
- `TARGET_WEB_PORT`

Flujo de jobs:

1. `sast`
2. `sca_iac`
3. `dast`
4. `positive_controls`
5. `deploy_staging`
6. `defectdojo`
7. `reports_bundle`

Esta segmentacion permite aislar la evidencia de cada etapa y publicar artefactos independientes.

## 4. Herramientas seleccionadas

### 4.1 SCA - `npm audit`

Se selecciona por integrarse de forma nativa con el ecosistema Node.js del objetivo y por aportar visibilidad inmediata sobre vulnerabilidades conocidas en dependencias directas y transitivas.

### 4.2 SAST - `Semgrep`

Se utiliza como analizador estatico ligero y automatizable. En este proyecto la politica implementada se centra en deteccion de ejecucion dinamica de codigo (`eval` y `new Function`) en JavaScript y TypeScript.

### 4.3 Analisis IaC - `Trivy config`

Se usa para identificar errores de configuracion e infraestructura como codigo. En el estado actual del objetivo, esta etapa se mantiene por cobertura metodologica y se valida adicionalmente con control positivo.

### 4.4 DAST - `OWASP ZAP baseline`

Se utiliza para auditar la superficie HTTP del export web servido localmente durante el pipeline.

### 4.5 Gestion centralizada - `DefectDojo`

Se incorpora para unificar resultados heterogeneos en una misma plataforma y facilitar priorizacion y seguimiento.

## 5. Integracion realizada

### 5.1 SAST

- Semgrep escanea `TARGET_CODE_PATH`
- el workflow genera `reports/semgrep.json`
- se ejecuta un control positivo adicional sobre `scripts/positive_controls/`

### 5.2 SCA e IaC

- `npm audit` genera `reports/npm-audit.json`
- `trivy config` genera `reports/trivy-config.json`

### 5.3 DAST

- `expo export --platform web` genera `dist/`
- `python -m http.server` publica el contenido de `dist/`
- `zap-baseline.py` genera `reports/zap.json`, `reports/zap.xml`, `reports/zap.html` y `reports/zap-baseline.log`

### 5.4 Controles positivos

`scripts/run_positive_controls.py` valida que las cuatro herramientas detectan casos vulnerables preparados especificamente para prueba.

### 5.5 Despliegue y smoke test

`deploy_staging` sirve el export en `nginx` y conserva evidencia de disponibilidad en `reports/deploy-health.html`.

### 5.6 DefectDojo

La importacion y el resumen se realizan con:

- `scripts/import_to_defectdojo.py`
- `scripts/export_defectdojo_summary.py`

## 6. Resultados obtenidos

### 6.1 Semgrep

- `reports/semgrep.json`: `0` hallazgos
- `reports/semgrep-positive-control-alltools.json`: `1` hallazgo

Lectura tecnica:

- la ausencia de findings en el objetivo actual significa que las reglas activas no encontraron patrones de ejecucion dinamica de codigo
- no debe interpretarse como ausencia total de problemas de seguridad

### 6.2 npm audit

- `reports/npm-audit.json`: `18` vulnerabilidades
- severidades observadas: `1` critical, `3` high, `14` moderate

Hallazgos relevantes:

- `protobufjs`: ejecucion arbitraria de codigo
- `@xmldom/xmldom`: inyeccion XML
- `node-forge`: bypass de validacion de certificados
- `picomatch`: method injection

### 6.3 Trivy config

- `reports/trivy-config.json`: `0` hallazgos
- `reports/trivy-positive-control.json`: `36` hallazgos

Lectura tecnica:

- la etapa funciona correctamente
- el objetivo actual aporta poco material IaC analizable dentro de la snapshot incluida

### 6.4 ZAP baseline

- `reports/zap-baseline.log`: `WARN-NEW: 9`
- `reports/zap.json`: `12` alertas

Hallazgos representativos:

- ausencia de `Content-Security-Policy`
- ausencia de cabecera anti-clickjacking
- ausencia de `X-Content-Type-Options`
- ausencia de `Permissions-Policy`
- fuga de version del servidor
- deteccion de funciones JavaScript peligrosas

Observaciones adicionales:

- el export web actual se genera con aviso por `./assets/favicon.png` ausente
- ZAP observa `404` en `/robots.txt` y `/sitemap.xml`

### 6.5 Despliegue

- `reports/deploy-health.html`: servicio accesible
- `reports/deploy-staging.log`: evidencia del despliegue en contenedor

## 7. Integracion con DefectDojo

Parsers utilizados:

- `NPM Audit v7+ Scan`
- `Semgrep JSON Report`
- `Trivy Scan`
- `ZAP Scan`

Resultado de imports verificados:

- `npm audit`: `18` hallazgos
- `Semgrep`: `0` hallazgos
- `Trivy`: `0` hallazgos
- `ZAP`: `12` hallazgos

Advertencia metodologica:

- `reports/defectdojo-summary.json` resume el engagement completo consultado
- en el estado actual devuelve `60` hallazgos acumulados
- no debe emplearse como si fuese el resultado exclusivo del ultimo pipeline

## 8. Evidencias disponibles

Evidencias principales:

- `reports/semgrep.json`
- `reports/npm-audit.json`
- `reports/trivy-config.json`
- `reports/zap.json`
- `reports/zap.xml`
- `reports/zap.html`
- `reports/zap-baseline.log`
- `reports/deploy-health.html`
- `reports/deploy-staging.log`

Evidencias de controles positivos:

- `reports/semgrep-positive-control.json`
- `reports/semgrep-positive-control-alltools.json`
- `reports/npm-audit-positive-control.json`
- `reports/trivy-positive-control.json`
- `reports/zap-positive-control.json`
- `reports/zap-positive-control.html`
- `reports/zap-positive-control.log`

Evidencias DefectDojo:

- `reports/defectdojo-import-npm-audit.json`
- `reports/defectdojo-import-semgrep.json`
- `reports/defectdojo-import-trivy.json`
- `reports/defectdojo-import-zap.json`
- `reports/defectdojo-summary.json`

## 9. Conclusiones

La solucion implantada cumple la finalidad de la practica:

- integra controles de seguridad en pipeline CI/CD
- conserva evidencia por etapa
- valida capacidad de deteccion mediante controles positivos
- centraliza hallazgos en DefectDojo

Desde una perspectiva de riesgo, la exposicion mas clara del estado actual se concentra en:

- dependencias vulnerables del ecosistema Node.js
- hardening insuficiente de cabeceras HTTP del export web analizado

La documentacion final debe dejar constancia de que el objetivo por defecto es una snapshot parcial y de que la lectura de resultados debe hacerse con ese contexto.
