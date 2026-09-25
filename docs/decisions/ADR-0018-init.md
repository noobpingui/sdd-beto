# ADR-0018 — `/sdd-beto:init`: adopción guiada y con gates

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** Claude, sobre el diseño del brief
- **Detallada por:** ADR-0024 (implementación: la IA decide, `sdd-init.mjs` escribe)

## Contexto
Adoptar el flujo exige analizar el repo, decidir rutas y comandos, escribir una constitución y preparar `CLAUDE.md` y los settings. Hacerlo a mano es lento y propenso a errores. Hacerlo sin revisión sería peligroso: la config decide qué protege el guard.

## Decisión
Skill `/sdd-beto:init` (`disable-model-invocation: true`), ejecutada por la sesión principal, con **un gate por paso**:

1. **Análisis, solo lectura.** Stack, lenguajes, gestores de paquetes, estructura de carpetas, comandos de test, lint, typecheck y build (de `package.json`, `pyproject.toml`, `Makefile`, CI…), estado de los tests, CI existente, `.env.example` y riesgos (secretos versionados, tests que requieren servicios). Si ya hay `.sdd/config.json`, pasa a **modo actualización**: propone solo el diff y las migraciones de `schema_version`.
2. **Propuesta de `.sdd/config.json`.** Muestra la config, cómo clasifica los archivos del repo (número de archivos de producción y de test por ámbito, con ejemplos) y ejecuta los comandos de test en modo "solo comprobar" cuando es seguro. El usuario aprueba o corrige.
3. **Propuesta de `.sdd/constitution.md`** (Parte II, ADR-0017) a partir de las convenciones observadas en el código.
4. **Integración:**
   - crea `paths.specs` y `paths.adr` si no existen;
   - añade o actualiza las secciones delimitadas de `CLAUDE.md` (ADR-0013), con un borrador de la sección Proyecto;
   - propone el `env` `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` en `.claude/settings.json` (ADR-0001) y, opcionalmente, `extraKnownMarketplaces` + `enabledPlugins` para que el equipo reciba el plugin.
5. **Commit** en una rama `chore/sdd-init` (o la que elija el usuario), con el resumen, la lista de archivos y el mensaje, y su propia aprobación. El push, aparte.

Reglas:
- `init` **no** escribe nada antes del paso 2 aprobado y nunca sobrescribe contenido del usuario fuera de sus marcas.
- Es **idempotente**: reejecutarlo sin cambios no produce diff.
- No instala dependencias ni ejecuta comandos que modifiquen el entorno.

## Consecuencias
- (+) Adoptar el plugin en un proyecto nuevo lleva minutos, con el usuario revisando cada decisión.
- (+) El modo actualización es la vía para aplicar migraciones de esquema tras actualizar el plugin.
- (−) Es la skill más compleja; se construye en su propia fase (Fase 5) y se prueba en la prueba en seco (Fase 6).
