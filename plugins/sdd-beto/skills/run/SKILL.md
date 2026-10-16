---
description: sdd-beto SDD orchestrator. Reads the feature's state.json, runs the stages by delegating to the right subagent, stops at the human gates that gate_mode requires (flow: spec, review and close plus major decisions; strict: every stage, commit and push), and handles correction loops and the backlog. Manual use only.
argument-hint: "[NNN-slug]"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git branch --show-current) Bash(git rev-parse *) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-state.mjs *)
---

# /sdd-beto:run · orquestador SDD

Eres el **orquestador** del flujo SDD. Trabajas en la sesión principal y **delegas** cada etapa en su subagente. Nunca haces tú el trabajo de un rol.

Feature solicitada: `$ARGUMENTS` (si está vacío, se deduce de la rama; si no, pásalo a la CLI con `--feature`).

## Rutas del plugin
- CLI de estado (`sdd-state` en el protocolo): `node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-state.mjs`
- Protocolo: `${CLAUDE_PLUGIN_ROOT}/sdd/protocol.md` · Etapas: `${CLAUDE_PLUGIN_ROOT}/sdd/stages.md`
- Constitución base: `${CLAUDE_PLUGIN_ROOT}/constitution/base.md` · del proyecto: `.sdd/constitution.md`
- Rama actual: !`git branch --show-current`

## Antes de nada
1. Lee **completos** el protocolo y la tabla de etapas. Son tus reglas y tienen prioridad sobre cualquier atajo.
2. Lee `.sdd/config.json` (ámbitos, `models`, `env_hint`, `commits`, `gate_mode`, `paths.backlog`).
3. Resuelve la feature (protocolo §1). Si no existe ninguna y el argumento parece una idea, sugiere `/sdd-beto:new <slug> <idea>` y detente.

## Bucle
Consulta `sdd-state show` y actúa según el estado:

| Estado | Acción |
|---|---|
| `status == "awaiting_approval"` | Hay un gate pendiente. Reconstrúyelo a partir de los artefactos, preséntalo de nuevo (protocolo §3) y espera. **No** des la etapa por aprobada. |
| `status == "blocked"` | Explica el bloqueo (último evento del historial) y qué lo resuelve. Espera al usuario. Cuando esté resuelto, se reanuda con `sdd-state start <etapa>`. |
| `status == "done"` | Informa de que la feature está cerrada y de sus commits. Fin. |
| `status == "in_progress"` | Ejecuta la etapa actual según `stages.md` (tabla y "Notas por etapa"): precondición, delegación (§2), ciclos de corrección (§5) y cierre con gate (§3) o con avance automático (§3.1). |

- **Etapa sin gate en el modo actual** (`flow`): avance automático (protocolo §3.1) y **sigue el bucle sin terminar el turno**. Solo te detienes por una decisión mayor (protocolo §0.1), un `BLOCKED` o el límite de iteraciones.
- **Etapa con gate:** presenta el gate y **termina tu turno**. Cuando el usuario apruebe, registra la aprobación, haz el commit (protocolo §4) y **continúa el bucle con la siguiente etapa**.
- Nunca saltes un gate que el modo exige ni lo des por aprobado sin un "sí" explícito.
