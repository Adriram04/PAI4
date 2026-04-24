# Memoria de Entrega PAI4

## 1. Resumen ejecutivo

El proyecto implementa un pipeline DevSecOps sobre `my-pass` con cuatro capacidades principales de seguridad:

- SCA con `npm audit`
- SAST con `Semgrep`
- analisis de configuracion con `Trivy config`
- DAST con `OWASP ZAP baseline`

El pipeline se ejecuta en GitHub Actions y puede integrar los resultados en DefectDojo para centralizar y priorizar hallazgos.

La evidencia actual demuestra que:

- el pipeline esta operativo y genera artefactos por etapa
- los controles positivos prueban que las herramientas detectan vulnerabilidades conocidas
- el estado actual del objetivo analizado presenta exposicion clara en dependencias y cabeceras HTTP del export web

## 2. Objetivo y alcance

El objetivo de la practica es introducir controles DevSecOps en un proceso CI/CD y demostrar que el analisis de seguridad puede automatizarse a lo largo del ciclo de vida del software.

El sistema objetivo es `my-pass`, una aplicacion basada en Expo, TypeScript y Firebase. En este repositorio no se modifica el origen de `my-pass`; el analisis se realiza sobre una copia de trabajo referenciada por `TARGET_CODE_PATH`.

Alcance efectivo del estado actual:

- el target por defecto es `target/my-pass`
- la snapshot actualmente versionada es parcial y no incluye `app/` ni `assets/`
- DAST se ejecuta sobre el export web disponible en `dist/`
- no se analiza un backend dedicado ni una build movil nativa

## 3. Arquitectura del pipeline

El workflow `.github/workflows/devsecops.yml` estructura el analisis en siete jobs:

1. `sast`
Realiza el analisis Semgrep sobre `TARGET_CODE_PATH` y valida el motor con un control positivo.

2. `sca_iac`
Ejecuta `npm audit` para dependencias y `trivy config` para configuracion e IaC.

3. `dast`
Genera un export web con Expo, lo sirve localmente y lanza `OWASP ZAP baseline`.

4. `positive_controls`
Ejecuta `scripts/run_positive_controls.py` para comprobar deteccion positiva real en las cuatro herramientas.

5. `deploy_staging`
Publica el export web en `nginx` y realiza un smoke test de disponibilidad HTTP.

6. `defectdojo`
Importa resultados por API y exporta un resumen del engagement cuando existen secretos.

7. `reports_bundle`
Consolida los artefactos generados por el resto del pipeline.

## 4. Criterio de seleccion de herramientas

### `npm audit`

Se selecciona como control SCA por su integracion directa con el ecosistema Node.js del objetivo y por su capacidad para detectar vulnerabilidades conocidas en dependencias transitivas y directas.

### `Semgrep`

Se utiliza como SAST ligero y automatizable. En este proyecto las reglas implementadas se orientan a deteccion de ejecucion dinamica de codigo, concretamente `eval` y `new Function`, por ser patrones con alto valor de riesgo cuando aparecen en codigo JavaScript o TypeScript.

### `Trivy config`

Se usa para detectar errores de configuracion e IaC. Aunque el objetivo actual no contiene manifiestos IaC clasicos dentro de la snapshot analizada, se mantiene la etapa para cubrir el requisito metodologico y se valida con control positivo.

### `OWASP ZAP baseline`

Se adopta como DAST para evaluar de forma automatizada la superficie HTTP realmente expuesta por el artefacto web exportado.

### `DefectDojo`

Se integra como plataforma de normalizacion y gestion de vulnerabilidades, permitiendo importar resultados heterogeneos y trabajar con una vista unificada.

## 5. Metodologia de validacion

La documentacion y la interpretacion de resultados se basan en tres principios:

- evidencias del workflow y del `Makefile`
- resultados presentes en `reports/`
- confirmacion funcional mediante controles positivos

Este enfoque evita confundir “la herramienta ha corrido” con “la herramienta ha demostrado capacidad de deteccion”.

## 6. Resultados del analisis

### 6.1 SAST

Resultado principal:

- `reports/semgrep.json`: `0` hallazgos

Interpretacion:

- el resultado indica que no se han encontrado coincidencias con las reglas activas de ejecucion dinamica de codigo
- no significa ausencia total de vulnerabilidades en el proyecto

Control positivo:

- `reports/semgrep-positive-control-alltools.json`: `1` hallazgo
- patron detectado: `eval()` en `scripts/positive_controls/positive_semgrep.js`

### 6.2 SCA

Resultado principal:

- `reports/npm-audit.json`: `18` vulnerabilidades
- distribucion: `1` critical, `3` high, `14` moderate

Hallazgos representativos:

- `protobufjs`: ejecucion arbitraria de codigo
- `@xmldom/xmldom`: inyeccion XML
- `node-forge`: bypass en verificacion de cadena de certificados
- `picomatch`: inyeccion de metodos en clases POSIX

Interpretacion:

- el principal vector de riesgo actual esta en la cadena de suministro de dependencias
- el resultado es consistente con el resumen de prioridad generado en DefectDojo

### 6.3 Analisis de configuracion e IaC

Resultado principal:

- `reports/trivy-config.json`: `0` hallazgos

Interpretacion:

- la snapshot analizada no incluye manifiestos IaC relevantes para esta etapa
- el valor de la integracion queda demostrado por el control positivo

Control positivo:

- `reports/trivy-positive-control.json`: `36` hallazgos
- ejemplos detectados: contenedor privilegiado, ejecucion como root, uso de `latest`, ausencia de limites y requests

### 6.4 DAST

Resultado principal:

- `reports/zap-baseline.log`: `WARN-NEW: 9`
- `reports/zap.json`: `12` alertas serializadas

Hallazgos representativos:

- `Content Security Policy (CSP) Header Not Set`
- `Missing Anti-clickjacking Header`
- `X-Content-Type-Options Header Missing`
- `Permissions Policy Header Not Set`
- `Server Leaks Version Information via "Server" HTTP Response Header`
- `Dangerous JS Functions`

Observaciones de contexto:

- ZAP devuelve `404` para `/robots.txt` y `/sitemap.xml`
- el bundle actual se exporta con aviso por falta de `./assets/favicon.png`

Interpretacion:

- la superficie HTTP del export web presenta margen de mejora en hardening de cabeceras
- el resultado debe leerse sobre el artefacto realmente servido, no sobre una interfaz movil completa

### 6.5 Despliegue de staging

Resultado principal:

- `reports/deploy-health.html`: respuesta HTTP valida
- `reports/deploy-staging.log`: evidencia del contenedor `nginx` y del smoke test

Interpretacion:

- el pipeline no solo analiza, sino que es capaz de producir y publicar un artefacto utilizable para verificaciones de disponibilidad

## 7. Integracion con DefectDojo

La integracion se implementa con:

- `scripts/import_to_defectdojo.py`
- `scripts/export_defectdojo_summary.py`

Estado actual observado:

- import de `npm audit`: correcto con `18` hallazgos
- import de `Semgrep`: correcto con `0` hallazgos
- import de `Trivy`: correcto con `0` hallazgos
- import de `ZAP`: correcto con `12` hallazgos

Punto importante de interpretacion:

- `reports/defectdojo-summary.json` devuelve un total acumulado de `60` hallazgos porque resume el engagement completo consultado
- no debe utilizarse como si fuese la fotografia aislada del ultimo pipeline

## 8. Limitaciones y riesgos residuales

El proyecto presenta varias limitaciones que deben declararse explicitamente:

- el target por defecto es una snapshot parcial de `my-pass`
- el ZIP automatico de entrega no incluye `target/my-pass`
- Semgrep cubre una politica muy concreta y no un catalogo amplio de patrones inseguros
- Trivy config no tiene material IaC significativo que analizar dentro del target actual
- DAST evalua el export web presente, no un backend independiente ni una app nativa completa

Estas limitaciones no invalidan la practica, pero si condicionan la interpretacion de los resultados.

## 9. Valor de la solucion implantada

Desde una perspectiva de ciberseguridad aplicada, el valor principal del proyecto no esta solo en encontrar vulnerabilidades, sino en haber establecido una cadena automatizada de control:

- deteccion temprana de riesgo en dependencias
- comprobacion de patrones inseguros de codigo
- validacion de hardening expuesto por HTTP
- concentracion de resultados en una herramienta de gestion
- evidencias persistentes para auditoria y entrega

## 10. Conclusion

El proyecto cumple el objetivo de implantar un pipeline DevSecOps funcional, trazable y demostrable sobre `my-pass`. La evidencia disponible muestra una integracion correcta de SCA, SAST, DAST, analisis de configuracion y gestion centralizada en DefectDojo.

La principal conclusion operativa es que el riesgo actual mas visible se encuentra en dependencias y hardening HTTP del export web, mientras que la ausencia de hallazgos en otras etapas debe interpretarse a la luz del alcance real de reglas, configuraciones y snapshot analizada.
