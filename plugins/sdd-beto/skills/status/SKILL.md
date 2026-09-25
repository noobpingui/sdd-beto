---
description: Read-only status of sdd-beto SDD features - stage, approvals, iterations, branch - plus consistency checks of state.json, how the config classifies the repository, and the next suggested command. Manual use only.
argument-hint: "[NNN-slug]"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git branch --show-current) Bash(git branch --list *) Bash(git log *) Bash(git rev-parse *) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-state.mjs *)
---

# /sdd-beto:status · estado del flujo SDD

Este comando es **de solo lectura**: no modifiques ningún archivo ni ejecutes git con escritura. De la CLI usa solo `show`, `check`, `validate`, `classify` y `snapshot --check`.

Feature: `$ARGUMENTS` (si está vacío, se muestran todas).

## Rutas del plugin
- CLI de estado (`sdd-state`): `node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-state.mjs`
- Protocolo: `${CLAUDE_PLUGIN_ROOT}/sdd/protocol.md`
- Rama actual: !`git branch --show-current`

## Pasos
1. Lee `.sdd/config.json`. Si no existe, indícalo y sugiere `/sdd-beto:init`. Los campos que omite toman su valor por defecto (p. ej. `paths.specs` = `specs`); no es un problema y no hace falta mencionarlo.
2. Busca con Glob `<specs>/[0-9][0-9][0-9]-*/state.json`. Si no hay ninguno, indícalo y sugiere `/sdd-beto:new`.
3. Muestra una tabla con una fila por feature (datos de `sdd-state show --feature <NNN> --json`):
   `Feature | Tipo | Rama | Etapa | Estado | Aprobadas (n/9) | Iteraciones (tests/impl/review) | Último evento`
4. Para la feature indicada, o la de la rama actual, añade el detalle:
   - las aprobaciones con fecha y los commits por etapa;
   - el resultado del red check, de verify y de review;
   - los últimos 5 eventos del historial;
   - si hay `tests_snapshot` y la etapa es posterior a `tests`, el resultado de `sdd-state snapshot --check`.
5. **Consistencia:** `sdd-state validate --git --feature <NNN>`. Reporta cada problema con la corrección que propones, pero **no la apliques**. Indica también si hay cambios sin commitear (`git status --short`).
6. **Clasificación del repo** (solo si se pide o si hay algún problema con la config): `sdd-state classify` muestra cuántos archivos cuenta como producción y como test cada ámbito. Sirve para detectar globs mal escritos.
7. **Siguiente paso sugerido:**
   - si `status == "awaiting_approval"`: "responde al gate pendiente o ejecuta `/sdd-beto:run` para verlo de nuevo";
   - si `status == "blocked"`: qué lo desbloquea;
   - en otro caso: `/sdd-beto:run NNN-slug` o `/sdd-beto:<etapa> NNN-slug`.

Si hay inconsistencias, la reparación la hace la sesión principal **solo con la aprobación del usuario** y siempre mediante `sdd-state`.
