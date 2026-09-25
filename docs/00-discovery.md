# Fase 0 · Descubrimiento

> **Fecha:** 2026-09-25 · **Claude Code instalado:** v2.1.282
> **Fuentes:** documentación oficial en markdown crudo (`https://code.claude.com/docs/en/<página>.md`): `plugins`, `plugins-reference`, `plugins/components`, `plugins/loading`, `plugins/host-marketplace`, `plugin-marketplaces`, `discover-plugins`, `sub-agents`, `skills`, `hooks`, `settings`, `settings-reference` y `env-vars`. Se leyeron directamente, sin resúmenes de otro agente.
> **Harness de origen:** leído completo (orquestador, protocolo, 8 agentes, 12 skills, guard y sus tests, ratchet, constitución, plantillas y documentación).

## 1. Resumen

- **El diseño propuesto es viable.** Los hooks de un plugin se ejecutan también dentro de los subagentes y reciben `agent_type`, así que la `role-guard` puede vivir en el plugin.
- **Hay un cambio obligatorio en el guard:** los subagentes de un plugin se identifican como **`sdd-beto:planner`**, no como `planner`. Todas las comparaciones por nombre de agente tienen que usar el nombre con ámbito.
- **El plugin no puede fijar variables de entorno.** El `settings.json` de un plugin solo admite `agent` y `subagentStatusLine`. `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` tendrá que escribirlo `init` en el `.claude/settings.json` del proyecto, o nos apoyamos solo en que los agentes no tienen la herramienta `Agent`.
- **Los scripts del plugin se pueden referenciar sin trucos:** `${CLAUDE_PLUGIN_ROOT}` se sustituye dentro del cuerpo de skills y agentes, y en los hooks.
- **Estructura recomendada:** el repo es el marketplace, y el plugin vive en un subdirectorio `plugins/sdd-beto/`. Así el `CLAUDE.md` y los `docs/` de desarrollo no forman parte del plugin (un `CLAUDE.md` en la raíz de un plugin no se carga y `claude plugin validate` lo marca como warning).

## 2. Respuestas a las preguntas del brief (§6)

### 2.1 Estructura de un plugin ✅

| Pieza | Ubicación por defecto | Notas |
|---|---|---|
| Manifiesto | `.claude-plugin/plugin.json` | **Opcional**; solo `name` es obligatorio (kebab-case, sin `:`). Todo lo demás va en la raíz del plugin, no dentro de `.claude-plugin/`. |
| Skills | `skills/<nombre>/SKILL.md` | Comando `/sdd-beto:<nombre>`. |
| Agentes | `agents/*.md` | Nombre `sdd-beto:<name>`. Las subcarpetas **sí** entran en el nombre (`agents/x/y.md` → `sdd-beto:x:y`), así que conviene dejarlos planos. |
| Hooks | `hooks/hooks.json` | Mismo formato que `hooks` en `settings.json`; se fusionan con los del usuario y del proyecto. |
| Ejecutables | `bin/` | Se añaden al `PATH` de la herramienta Bash mientras el plugin está activo. |
| Ajustes | `settings.json` | Solo `agent` y `subagentStatusLine`; el resto se descarta al cargar. |
| Scripts propios | cualquier carpeta, p. ej. `scripts/` | Se referencian con `${CLAUDE_PLUGIN_ROOT}`. |

**Variables de ruta** (`plugins-reference` → *Environment variables*):

| Variable | Qué es | Dónde se sustituye |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | Directorio de la versión instalada del plugin. **Cambia al actualizar**: no se escribe estado ahí. | En `command`/`args` de hooks (y exportada al proceso) y **en el cuerpo Markdown de skills, comandos y agentes**. |
| `${CLAUDE_PLUGIN_DATA}` | `~/.claude/plugins/data/<id>/`, persiste entre actualizaciones. | Igual que la anterior. |
| `${CLAUDE_PROJECT_DIR}` | Raíz del proyecto. | Exportada a los hooks. |

- Las variables **no** están en el entorno de los comandos que Claude lanza con Bash. Por eso las rutas a scripts se escriben con `${CLAUDE_PLUGIN_ROOT}` dentro del texto de la skill o del agente, y Claude Code las sustituye al cargarlo.
- En Windows las rutas sustituidas usan `/`.
- Para hooks en Windows, la doc recomienda la **forma exec**: `"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/sdd-guard.mjs", "write"]`. No pasa por ninguna shell y cada ruta es un argumento, aunque tenga espacios.

### 2.2 Hooks del plugin y `agent_type` ✅ (con un cambio crítico)

- **Sí funcionan dentro de subagentes.** Cita de `hooks.md`: *"Hooks from settings files, managed policy settings, and plugins also run inside subagents. When a subagent calls a tool, tool events such as `PreToolUse` and `PostToolUse` fire the same configured hooks as in the main conversation, and the input carries the `agent_id` and `agent_type`."*
- **El valor de `agent_type` cambia.** Cita: *"For subagents shipped by a plugin, the agent type is the plugin-scoped identifier such as `my-plugin:reviewer`, not the bare frontmatter name."*
  - **Impacto:** el guard de origen compara `SDD_AGENTS.includes(agent)` con nombres cortos. Con el plugin, eso **nunca coincidiría**: todos los agentes SDD se tratarían como "otros subagentes" y la `role-guard` quedaría desactivada en silencio.
  - **Solución:** reconocer solo `sdd-beto:<rol>`. Un `planner` local (sin prefijo) de otro origen **no** debe heredar los permisos del rol.
  - **Test obligatorio** en la Fase 4 para este caso.
- **Confirmado:** los subagentes de plugin **ignoran** `hooks`, `mcpServers` y `permissionMode` en su frontmatter (*"For security reasons…"*). La alternativa es la que ya usa el diseño: **hooks a nivel de plugin** (`hooks/hooks.json`), que sí se aplican a todos los subagentes. No se pierde nada, porque el harness de origen tampoco usaba hooks en el frontmatter.
- **Frontmatter admitido en agentes de plugin:** `name`, `description`, `model`, `effort`, `maxTurns`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, `omitClaudeMd`, `isolation`, `color`. Cubre todo lo que usan los 8 agentes actuales (`name`, `description`, `tools`, `model`, `color`).
- **`name` no puede contener `:`** (reservado para el ámbito de plugin).
- **Confirmación `ask`:** cuando un hook de plugin devuelve `ask`, el diálogo muestra la etiqueta `[plugin:sdd-beto]`. La `git-guard` sigue funcionando igual.

### 2.3 Namespacing ✅

| Qué | Nombre |
|---|---|
| Skill `skills/run/SKILL.md` | `/sdd-beto:run` |
| Agente `agents/planner.md` (`name: planner`) | `sdd-beto:planner` → en la herramienta Agent, `subagent_type: "sdd-beto:planner"`; mención manual `@agent-sdd-beto:planner` |
| Matcher de hook por agente | `^sdd-beto:planner$` (con anclas: el `:` hace que se trate como regex) |

**Detalle no previsto:** la doc dice que el nombre corto de una skill de plugin (`/run`) **también** la invoca, *salvo que otro comando ya use ese nombre*. `init` y `status` chocan con comandos integrados de Claude Code (`/init`, `/status`), así que ahí el usuario tendrá que escribir siempre `/sdd-beto:init` y `/sdd-beto:status`. La documentación del plugin debe usar siempre el nombre completo.

**`disable-model-invocation: true`** funciona igual en skills de plugin. La lección F0 sigue vigente: esos comandos solo los escribe el usuario. La inyección `` !`git branch --show-current` `` también funciona en skills de plugin (la restricción que menciona la doc es solo para skills sincronizadas desde claude.ai).

### 2.4 Variables de entorno de settings ⚠️ el plugin no puede fijarlas

- `settings.json` del plugin: *"Only `agent` and `subagentStatusLine` take effect; other keys are dropped at load."* → **no** se puede fijar `env`.
- `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`: confirmado en `env-vars`. Por defecto **3**; `1` desactiva el anidamiento. Solo acepta enteros positivos.
- **Opciones** (pregunta P3):
  1. `init` lo añade a `env` en el `.claude/settings.json` del proyecto.
  2. Confiar en que ningún agente SDD lista `Agent` en `tools`, que ya impide que lance subagentes. La variable era una segunda barrera.

### 2.5 Instalación y actualización ✅

- **Marketplace:** un repo con `.claude-plugin/marketplace.json` (`name`, `owner`, `plugins[]`). Cada entrada tiene `name` y `source`; con el plugin en el mismo repo, `"source": "./plugins/sdd-beto"`.
  - La doc insiste en **usar el mismo `name`** en la entrada del marketplace y en `plugin.json`.
- **Instalación del usuario:**
  ```
  /plugin marketplace add <owner>/sdd-beto        (acepta #ref para fijar rama o tag)
  /plugin install sdd-beto@<nombre-del-marketplace>
  ```
- **Validación:** `claude plugin validate <dir>` (plugin o marketplace).
- **Desarrollo local:** `claude --plugin-dir ./plugins/sdd-beto`, o añadir el marketplace como directorio local. En ese caso el plugin se carga **en sitio**: los cambios se ven con `/reload-plugins` o al reiniciar, sin subir versión.
- **Versiones** (`plugins/loading` → *Versions and updates*):
  - Con `version` en `plugin.json`, los usuarios se quedan en su copia hasta que cambie esa cadena, aunque haya commits nuevos.
  - Sin `version`, la versión es el SHA del commit y cada commit es una actualización.
  - No se debe poner `version` a la vez en `plugin.json` y en la entrada del marketplace.
  - El auto-update está **desactivado por defecto** para marketplaces de terceros; el usuario lo activa en `/plugin` → Marketplaces, o ejecuta `claude plugin update`.
- **Adopción por un equipo:** el `.claude/settings.json` del proyecto puede declarar el marketplace (`extraKnownMarketplaces`) y activar el plugin (`enabledPlugins`). Cada persona sigue teniendo que instalarlo en su máquina, salvo en algunos casos con fuente relativa; se comprobará en la Fase 2.

### 2.6 Los dos datos falsos de la sesión anterior

Ambos quedan confirmados como falsos con la doc actual: los subagentes **sí** pueden anidar (límite por defecto 3), y el `:` en los nombres de comando **solo** existe en plugins (y en `.claude/commands/<subdir>/`).

## 3. Hallazgos adicionales

1. **`${CLAUDE_PLUGIN_ROOT}` en el cuerpo de skills y agentes.** Resuelve cómo leen el protocolo, las plantillas y la constitución base: `Lee ${CLAUDE_PLUGIN_ROOT}/sdd/protocol.md`.
2. **`allowed-tools` también sustituye `${CLAUDE_PLUGIN_ROOT}`.** Una skill puede preautorizar `Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-state.mjs *)` sin pedir permiso cada vez. Útil para la CLI `sdd-state.mjs` (mejora §9.2 del brief).
3. **Carpeta `bin/`.** Pondría `sdd-state` y el ratchet como comandos sueltos en el `PATH` de Bash. En Windows no está claro que un script Node con shebang funcione desde la herramienta PowerShell. **Recomendación:** usar `node "${CLAUDE_PLUGIN_ROOT}/scripts/…"` y probar `bin/` en la Fase 2 como mejora opcional.
4. **Hook `SubagentStop`** recibe `last_assistant_message` (el informe final del agente) y `agent_type`. Hace sencilla la mejora §9.4: validar el bloque `STATUS / ARTIFACTS / …` sin leer el transcript.
5. **`omitClaudeMd`** (nuevo campo de agentes): lanza el subagente sin cargar `CLAUDE.md`. No lo recomiendo para los agentes SDD, porque necesitan la sección Proyecto del `CLAUDE.md` del consumidor.
6. **Dependencias Node:** Claude Code instala automáticamente dependencias npm del plugin al cachearlo. El guard y el ratchet actuales solo usan módulos de Node, así que **no** hace falta `package.json` con dependencias. Conviene mantenerlo así.
7. **Nombre del agente con prefijo en los prompts de delegación.** El protocolo de origen dice `subagent_type: <agente>`; pasa a `sdd-beto:<agente>`. Si se olvida, Claude buscaría un agente local inexistente.

## 4. Inventario del harness de origen

### 4.1 Piezas y destino en el plugin

| Pieza de origen | Destino propuesto | Parametrización |
|---|---|---|
| `.claude/sdd/protocol.md`, `stages.md` | `plugins/sdd-beto/sdd/` | Baja: `subagent_type` con prefijo, `base_branch`, rutas de ámbitos y comandos de entorno (p. ej. "levantar la base de datos") desde la config. |
| 12 skills `sdd-*` | `plugins/sdd-beto/skills/{run,new,status,spec,plan,tasks,test,implement,verify,review,docs,close}/` + `init` | Baja. Las 9 de etapa son la **misma plantilla** con 3 líneas distintas (verificado con `diff`). |
| 8 agentes | `plugins/sdd-beto/agents/` | **Alta** en `implementer`, `verifier` y `test-author` (comandos de test, lint, typecheck y build escritos a mano); media en `planner`, `reviewer` y `doc-keeper` (capas y convenciones del proyecto). |
| `sdd-guard.mjs` + 15 tests | `plugins/sdd-beto/hooks/` + `hooks.json` | **Alta:** `isTest`, `isProd`, `isEnvExample` y las rutas del `doc-keeper` salen de la config; nombres de agente con prefijo. |
| `ruff-new.mjs` | `plugins/sdd-beto/scripts/lint-ratchet.mjs` | **Reescritura:** hoy solo sabe de ruff y de una carpeta. Pasa a ser un mecanismo genérico (comando de lint + comparación con la base). Ver P5. |
| `constitution.md` | base genérica en el plugin + parte específica generada por `init` | Arts. 1–4, 8 y 9 genéricos; 5–7 son del proyecto. El Art. 9 ("hecho") nombra comandos concretos y se genera a partir de la config. |
| Plantillas `specs/_templates/*` | `plugins/sdd-beto/templates/` | Baja en `spec`, `state.json`; media en `plan`, `tasks`, `review`, `verify-report` (secciones "Backend/Frontend" fijas). `state.json.scope` pasa de `{backend, frontend}` a los ámbitos de la config. |
| `docs/sdd/*` y ADRs | ADRs genéricas de este repo (Fase 1) y documentación del plugin (Fase 8) | Reescritura neutral. |
| Ejemplos `000`, `001` | **No** se portan | Si hacen falta fixtures, se inventan neutrales (Fase 6). |

**Menciones específicas por archivo** (grep de rutas, comandos y convenciones del proyecto): constitución 15, `implementer` 11, `verifier` 9, `test-author` 9, `planner` 7, `verify-report.md` 6, guard 6, `reviewer` 5, `doc-keeper` 5; el resto, entre 0 y 4. Las skills tienen 1 cada una (el nombre del proyecto en `description`).

### 4.2 Rutas escritas a mano en el guard

| Función | Hoy | Con el plugin |
|---|---|---|
| `isTest` | `backend/tests/`, `frontend/src/test/`, `frontend/src/**/*.test.*` | unión de `scopes.*.tests` (globs) |
| `isProd` | `backend/**`, `frontend/**` menos tests, README y `.env.example` | unión de `scopes.*.prod` menos lo anterior |
| `isEnvExample` | tres rutas fijas | `env_examples` |
| `doc-keeper` | `README.md`, `frontend/README.md`, `CLAUDE.md`, `docs/**` | configurable (`docs_paths`), con valor por defecto razonable |
| `planner` → ADRs | `docs/sdd/decisions/` | `adr_dir` configurable |
| `featureDirFromBranch` | `specs/NNN-slug` con ramas `feat/` o `fix/` | `specs_dir` y prefijos de rama configurables, con esos valores por defecto |

**Requisito técnico nuevo:** el guard tiene que evaluar **globs** sin dependencias externas. `path.matchesGlob` existe en la Node 20.19.4 instalada, pero es **experimental** y emite un `ExperimentalWarning` por stderr (comprobado). La alternativa es un conversor glob → regex propio de pocas líneas y con tests. Se decide en la Fase 1 junto con la versión mínima de Node.

## 5. Estructura preliminar del repo

```
sdd-beto/                         ← raíz del repo = marketplace
├── .claude-plugin/
│   └── marketplace.json          ← { name, owner, plugins: [{ name: "sdd-beto", source: "./plugins/sdd-beto" }] }
├── plugins/
│   └── sdd-beto/                 ← raíz del plugin (${CLAUDE_PLUGIN_ROOT})
│       ├── .claude-plugin/plugin.json
│       ├── skills/               ← init, new, run, status y una por etapa
│       ├── agents/               ← 8 agentes (planos, sin subcarpetas)
│       ├── hooks/hooks.json      ← PreToolUse (+ SubagentStop más adelante)
│       ├── scripts/              ← sdd-guard.mjs, lint-ratchet.mjs, sdd-state.mjs, tests
│       ├── sdd/                  ← protocol.md, stages.md
│       ├── templates/            ← spec, plan, tasks, review, verify-report, state.json, config.json
│       └── constitution/         ← base genérica + plantilla de la parte específica
├── docs/                         ← desarrollo del plugin (no se instala)
│   ├── 00-discovery.md
│   └── decisions/                ← ADRs de sdd-beto
├── CLAUDE.md                     ← reglas para trabajar en este repo (no se instala)
└── README.md, CHANGELOG.md       ← Fase 8
```

Es preliminar: se fija con ADRs en la Fase 1.

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| El guard no reconoce los agentes del plugin por el prefijo y la `role-guard` queda desactivada **en silencio** | Tests específicos con `agent_type: "sdd-beto:<rol>"` y prueba real en la Fase 6 (intentar que el `implementer` escriba un test y comprobar que se bloquea). |
| Un proyecto sin `.sdd/config.json` (plugin activo antes de `init`) | El guard no bloquea nada si no hay config y el `stage-guard` avisa de que falta `init`; no debe romper proyectos donde el plugin está instalado a nivel de usuario. **Importante:** si se instala a nivel de usuario, los hooks se ejecutan en **todos** los proyectos. |
| `${CLAUDE_PLUGIN_ROOT}` cambia al actualizar | Nunca se escribe estado en el plugin; todo el estado vive en el proyecto (`specs/`, `.sdd/`). |
| Comandos de verificación arbitrarios desde la config | Los ejecuta el `verifier` con Bash, sujeto a los permisos normales. La config es del propio repo, igual que un `package.json`. |
| La doc cambia rápido (hay campos que exigen v2.1.2xx) | Declarar una versión mínima de Claude Code en el README y registrar en cada ADR la versión de la doc consultada. |

## 7. Preguntas para el usuario

**P1 · Estructura del repo.** Recomiendo **plugin en `plugins/sdd-beto/`** y el marketplace en la raíz. Mantiene fuera del plugin el `CLAUDE.md`, los `docs/` y los tests de desarrollo, y deja sitio para otros plugins en el futuro. La alternativa (plugin en la raíz) es más simple, pero instalaría la documentación de desarrollo en cada proyecto y `validate` avisaría por el `CLAUDE.md`.

**P2 · Versiones.**
- (a) **`version` semver en `plugin.json`, subida a mano en cada release, con tags** (recomendado): el proyecto consumidor solo cambia cuando tú publicas, y el changelog tiene sentido.
- (b) Sin `version`: cada commit a `main` es una actualización. Es más ágil, pero más frágil para un flujo con gates.

**P3 · Límite de anidamiento.** ¿`init` escribe `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` en el `.claude/settings.json` del proyecto (recomendado, defensa en profundidad), o basta con que ningún agente tenga `Agent` en `tools`? Ojo: con la opción 1, la variable afecta a **todo** el trabajo en ese proyecto, no solo al flujo SDD.

**P4 · Idioma.** Los prompts de agentes y skills están en español. Opciones:
- (a) **Prompts en español y `language` en la config solo para los artefactos generados** (recomendado para la v1);
- (b) prompts bilingües;
- (c) prompts en inglés (lo habitual en plugins públicos) y artefactos en el idioma de la config.

**P5 · Ratchet de lint genérico.** El de origen compara violaciones de ruff por código entre la base y el disco, usando la salida JSON de ruff. Un mecanismo genérico necesita saber leer la salida de cada linter. Opciones:
- (a) **v1 con dos modos** (recomendado): `"lint": "<cmd>"` (pasa o falla, sin ratchet) y `"lint_ratchet": { "cmd": "<cmd que imprime JSON>", "format": "ruff" | "eslint" }` con un adaptador por formato;
- (b) ratchet genérico por conteo de líneas de salida, más simple pero menos fiable.

**P6 · Plantillas y constitución.** ¿Puede un proyecto **sobrescribir** las plantillas del plugin (por ejemplo, `.sdd/templates/plan.md` tiene prioridad sobre la del plugin)? Recomiendo que sí, con resolución "proyecto → plugin", porque la plantilla de `plan.md` depende mucho del stack.

## 8. Pendiente de comprobar en la práctica (Fase 2)

1. Que un hook de `hooks/hooks.json` en forma exec recibe `agent_type = "sdd-beto:<rol>"` al ejecutar un subagente del plugin (prueba con un hook que registre la entrada en un archivo).
2. Que `${CLAUDE_PLUGIN_ROOT}` se sustituye en el cuerpo de un agente y en `allowed-tools` de una skill en Windows.
3. Si `bin/` funciona en Windows desde Bash y desde PowerShell.
4. Instalación desde el marketplace local y desde GitHub, y comportamiento de `extraKnownMarketplaces` + `enabledPlugins` en el `settings.json` de un proyecto.
