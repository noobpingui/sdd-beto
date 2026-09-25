# ADR-0001 — Orquestación en la sesión principal, sin anidamiento de subagentes

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario (P3 de `docs/00-discovery.md`) y Claude
- **Documentación consultada:** `sub-agents`, `env-vars`, `plugins-reference` (Claude Code v2.1.282)

## Contexto
- El flujo necesita un orquestador que delegue en agentes especializados, aplique gates humanos y mantenga el estado.
- Un subagente no puede detenerse a pedir aprobación al usuario a mitad de su ejecución; solo la sesión principal puede.
- Por defecto, un subagente **sí** puede lanzar otros subagentes, hasta 3 niveles (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`, por defecto 3). Si un rol delegara su trabajo en otro agente, se saltaría la separación de roles.
- Un plugin **no** puede fijar variables de entorno: su `settings.json` solo admite `agent` y `subagentStatusLine`.

## Decisión
- **Orquestador = sesión principal**, guiada por las skills del plugin (`/sdd-beto:run` y una por etapa). No es un subagente.
- **Sin anidamiento**, con dos barreras:
  1. Ningún agente del plugin incluye `Agent` en `tools`.
  2. `/sdd-beto:init` propone añadir `"CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "1"` al `env` del `.claude/settings.json` del proyecto. El usuario lo aprueba en el gate de `init`, que avisa de que el límite afecta a toda sesión en ese proyecto.
- **Comunicación entre agentes solo por disco** (`<specs>/NNN-slug/`). El prompt de delegación contiene rutas, etapa, modo e iteración; nunca un resumen de la conversación.
- **Delegación con el nombre de ámbito del plugin:** `subagent_type: "sdd-beto:<agente>"`.

## Consecuencias
- (+) Los gates viven donde el usuario puede responder y ningún rol puede delegar su trabajo.
- (+) La segunda barrera es opcional: un proyecto que no la quiera sigue protegido por la primera.
- (−) La sesión principal acumula los informes de cada etapa. Se mitiga con informes finales breves y el detalle en disco.
- (−) Si Claude Code cambia la semántica de profundidad o de `tools`, hay que revisar esta ADR.
