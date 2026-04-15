# Grado de Completitud y Trazabilidad

| Objetivo PAI4 | Estado | Evidencia |
|---|---|---|
| 1. Definir pipeline CI/CD en repositorio SCM | Cumplido | `.github/workflows/devsecops.yml` |
| 2. Seleccionar al menos 3 herramientas de seguridad | Cumplido | `pip-audit`, `Bandit`, `Trivy`, `OWASP ZAP` |
| 3. Integrar herramientas en ciclo de vida | Cumplido | Etapas del workflow + `reports/` |
| 4. Desarrollar tests para detectar vulnerabilidades | Cumplido | `tests/test_app.py`, `tests/test_security.py`, `reports/pytest-results.xml` |
| 5. Integrar gestion de vulnerabilidades | Cumplido | `scripts/import_to_defectdojo.py`, `scripts/export_defectdojo_summary.py`, pasos DefectDojo del workflow y salidas `reports/defectdojo-*.json` |

## Observaciones

- Evidencias locales actualizadas: `pytest`, `coverage`, `pip-audit`, `bandit`, `trivy-config`, `zap.json`, `zap.html`.
- DAST queda sin `WARN` abiertos (`WARN-NEW: 0`) y con una regla de cache aceptada de forma explicita en `zap-rules.tsv` (regla `10049`).
- La evidencia E2E de Objetivo 5 se materializa automaticamente al ejecutar el workflow con secretos DefectDojo.
