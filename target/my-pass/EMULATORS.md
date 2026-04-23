# Emuladores de Firebase vs Producción

## Resumen

MyPass puede ejecutarse en **dos modos**:

1. **Emuladores locales** - Para desarrollo/testing sin afectar datos reales
2. **Producción** - Conecta a Firebase real (datos vivos)

## Cómo cambiar de modo

### Modo Emuladores (Desarrollo)
Descomenta la línea en `.env`:
```bash
EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1
```

Luego ejecuta:
```bash
npm run emulators  # En terminal 1
npm start          # En terminal 2
```

### Modo Producción
Comenta la línea en `.env`:
```bash
# EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1
```

Luego ejecuta:
```bash
npm start
```

## Diferencias principales

| Característica | Emuladores | Producción |
|---|---|---|
| **Base de datos** | Local, volatile | Firebase real |
| **Autenticación** | Email/Password | Email/Password + Google/GitHub |
| **Verificación de email** | No se envía | Se envía (si está configurado) |
| **Reset de contraseña** | No se envía | Se envía (si está configurado) |
| **Archivos adjuntos** | Local | Firebase Storage real |
| **Cuota de uso** | Ilimitada | Limitada por plan |
| **Costo** | $0 | Según uso |
| **UI del emulador** | Disponible en `http://localhost:4000` | N/A |

## Casos de uso

### Usar Emuladores cuando:
- Desarrollas nuevas funciones
- Ejecutas tests (`npm test` y `npm run test:e2e`)
- Necesitas datos aislados sin afectar producción
- Trabajas sin conexión a Internet
- Quieres testing rápido sin límites

### Usar Producción cuando:
- Necesitas probar OAuth (Google, GitHub)
- Necesitas validar emails reales
- Necesitas probar el reset de contraseña
- Haces demo con datos reales
- Necesitas acceso compartido con otros

## Notas importantes

- El `.env` **no se sube a git** (está en `.gitignore`)
- Cada desarrollador puede tener su propia configuración
- Los datos en emuladores se pierden al reiniciar
- Los datos en producción persisten siempre
- OAuth (Google, GitHub) solo funciona en producción

## Comando rápido para cambiar

```bash
# Cambiar a emuladores
echo "EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1" > .env

# Cambiar a producción
echo "# EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1" > .env
```
