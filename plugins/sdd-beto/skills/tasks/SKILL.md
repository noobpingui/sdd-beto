---
description: SDD stage "tasks" of sdd-beto - delegates to the task-breaker subagent, then presents the human approval gate and the proposed commit. Manual use only.
argument-hint: "[NNN-slug]"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch --show-current) Bash(git rev-parse *) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-state.mjs *)
---

# /sdd-beto:tasks · etapa `tasks` (task-breaker)

Ejecuta **una sola etapa** del flujo SDD para la feature `$ARGUMENTS` (si está vacío, se deduce de la rama; si no, pásalo a la CLI con `--feature`).

## Rutas del plugin
- CLI de estado (`sdd-state` en el protocolo): `node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-state.mjs`
- Protocolo: `${CLAUDE_PLUGIN_ROOT}/sdd/protocol.md` · Etapas: `${CLAUDE_PLUGIN_ROOT}/sdd/stages.md`
- Constitución base: `${CLAUDE_PLUGIN_ROOT}/constitution/base.md` · del proyecto: `.sdd/constitution.md`
- Rama actual: !`git branch --show-current`

## Pasos
1. Lee **completos** el protocolo y la tabla de etapas, y síguelos al pie de la letra. Lee también `.sdd/config.json`.
2. Resuelve la feature (protocolo §1) con `sdd-state show`.
   - Si su etapa no es `tasks`, avisa y detente: las etapas se ejecutan en orden.
   - Si hay un gate pendiente de esta etapa, preséntalo de nuevo en lugar de repetir el trabajo.
   - Repetir una etapa ya aprobada exige reabrirla con `sdd-state rework tasks`, lo que anula las aprobaciones posteriores (protocolo §5). Pide confirmación antes.
3. **Etapa `tasks`:** aplica su nota en "Notas por etapa" de `stages.md`.
4. Presenta el gate (protocolo §3) y **termina tu turno**.
5. Cuando el usuario apruebe, registra la aprobación, haz el commit solo si también lo aprobó e indica el siguiente comando (`/sdd-beto:test NNN-slug`) o `/sdd-beto:run NNN-slug`. **No** ejecutes la siguiente etapa desde este comando.
