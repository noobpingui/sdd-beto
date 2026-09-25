---
description: Start a new sdd-beto SDD feature - allocates NNN, proposes the <prefix>/NNN-slug branch, creates <specs>/NNN-slug/ with idea.md and state.json. Manual use only.
argument-hint: "<slug> <idea de la feature en lenguaje natural>"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git branch --show-current) Bash(git log *) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-state.mjs *)
---

# /sdd-beto:new · crear una feature SDD

Argumentos: `$ARGUMENTS`. El **primer token** es el slug (kebab-case, corto; p. ej. `weekly-plan-notes`); el **resto** es la idea.

## Rutas del plugin
- CLI de estado (`sdd-state` en el protocolo): `node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-state.mjs`
- Protocolo: `${CLAUDE_PLUGIN_ROOT}/sdd/protocol.md`
- Rama actual: !`git branch --show-current`

Lee primero el protocolo (§0 y §4) y `.sdd/config.json`. Si la config no existe, sugiere `/sdd-beto:init` y detente.

## Pasos
1. **Validar la entrada.**
   - Si falta el slug o la idea, pídelos y detente.
   - Si el slug no está en kebab-case, propón uno.
2. **Comprobar el entorno** (git de solo lectura):
   - El árbol de trabajo está limpio (`git status --porcelain` vacío). Si no, muestra lo pendiente y detente.
   - La rama actual es `base_branch` de la config. Si no, avisa y pregunta si se parte de ella o de la rama actual. La rama de partida será la base de la feature: todos los agentes comparan contra ella.
3. **Proponer**, sin ejecutar nada todavía:
   - **Tipo:** `feature`, `fix` o `refactor`, según la idea.
   - **Ámbitos:** los de `scopes` de la config que tocará, según la idea.
   - **Número, carpeta y rama:** `sdd-state next <slug> --type <tipo>` (falla si el slug ya existe).
   - **Título:** una línea que resuma la idea.

   Muestra ese resumen y la idea literal, y pregunta: **"¿Apruebas crear la rama y la carpeta?"**. Después termina tu turno.
4. **Con la aprobación explícita del usuario:**
   1. Anota la rama de partida y crea la nueva: `git checkout -b <rama>`.
   2. `sdd-state init <slug> --type <tipo> --title "<título>" --scope <a,b> --base <rama de partida>`.
   3. Crea `<specs>/NNN-slug/idea.md` con la idea **literal** del usuario, precedida de un encabezado `# Idea original · NNN-slug` y la fecha (`sdd-state now`). Normaliza solo los saltos de línea y sangrías que introduce el prompt; no cambies ninguna palabra.
   4. **No hagas commit.** Estos archivos entran en el commit de la etapa `spec`.
5. **Cierre:** muestra lo creado e indica los siguientes pasos:
   - `/sdd-beto:run NNN-slug`, que recorre todo el flujo con un gate en cada etapa;
   - o `/sdd-beto:spec NNN-slug`, que ejecuta solo la etapa spec.
