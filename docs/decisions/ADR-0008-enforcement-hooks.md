# ADR-0008 — Enforcement con hooks del plugin: rol, etapa y git

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario (nivel) y Claude (mecanismo)
- **Sustituida en parte por:** ADR-0025 (el git-guard ya no pide confirmación a la sesión principal)
- **Documentación consultada:** `hooks`, `plugins-reference`, `sub-agents` (Claude Code v2.1.282)

## Contexto
- Los subagentes no admiten restricciones de escritura por ruta de forma nativa; solo una lista de herramientas.
- Los subagentes de plugin **ignoran** `hooks` y `permissionMode` en su frontmatter. Los hooks definidos en `hooks/hooks.json` del plugin **sí** se ejecutan dentro de los subagentes, y `PreToolUse` recibe `agent_type`.
- En los subagentes de un plugin, `agent_type` es el nombre **con ámbito**: `sdd-beto:implementer`, no `implementer`.
- El plugin puede estar instalado a nivel de usuario, y entonces sus hooks se ejecutan en **todos** los proyectos, también en los que no usan SDD.

## Decisión
Un solo script Node, `sdd-guard.mjs`, registrado en `hooks/hooks.json` en **forma exec** (`"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/…/sdd-guard.mjs", "<modo>"]`), con tres guardias:

1. **`role-guard`** (`Write|Edit|MultiEdit|NotebookEdit`): si `agent_type` es `sdd-beto:<rol>`, exige rama de feature, `state.json` existente, la etapa del rol y una ruta de su rol. Las rutas salen de `.sdd/config.json` (ADR-0016). Solo se reconoce el nombre **con el prefijo** `sdd-beto:`; un agente local llamado igual no hereda permisos.
2. **`stage-guard`** (mismas herramientas, resto de actores): no se escribe código de producción sin spec y plan aprobados. Se omite con `SDD_BYPASS=1`, que solo se lee del entorno del proceso de Claude Code.
3. **`git-guard`** (`Bash|PowerShell`): los subagentes solo usan git de lectura. ~~En la sesión principal, `git commit` y `git push` devuelven `ask`.~~ Sustituido por la ADR-0025: la sesión principal sigue el flujo normal de permisos.

**Añadido en la Fase 4:** en `<feature>/tasks.md`, el `test-author` y el `implementer` solo pueden marcar casillas (`- [ ]` → `- [x]`) con `Edit` o `MultiEdit`. El hook compara el texto antes y después ignorando las casillas, y bloquea cualquier otro cambio o un `Write` completo. Antes esa regla solo la sostenía el prompt.

Reglas comunes:
- **Sin `.sdd/config.json`, el guard no hace nada**, salvo bloquear a los agentes `sdd-beto:*` con un mensaje que pide ejecutar `/sdd-beto:init`. Así el plugin instalado a nivel de usuario no molesta en otros proyectos.
- **Fallo interno:** *fail-closed* para agentes `sdd-beto:*` y *fail-open* con aviso para el resto.
- **Ningún subagente edita un `.env` real.**
- Sin lint automático tras cada edición: lo ejecuta el `verifier`.

## Consecuencias
- (+) Las violaciones de rol se bloquean de forma determinista y no dependen solo del prompt.
- (+) El cambio de nombre con ámbito queda cubierto por tests explícitos (Fase 4) y por una prueba real (Fase 6).
- (−) Las escrituras desde la shell (`sed -i`, `>`, `Set-Content`) no pasan por `Write`/`Edit`. Mitigaciones: los prompts lo prohíben y `tests_snapshot` (ADR-0005) detecta cambios en los tests. Detectarlas en el hook queda fuera de la v1.
- (−) Un hook mal escrito puede bloquear trabajo legítimo; cada mensaje de bloqueo explica cómo proceder, y se pueden desactivar con `disableAllHooks` en `.claude/settings.local.json`.
