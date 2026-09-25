# Fase 2 · Verificación del esqueleto

> **Fecha:** 2026-09-25 · **Claude Code:** v2.1.282 · **Node:** 20.19.4 · **SO:** Windows 11 (Git Bash y PowerShell)

Comprobaciones pendientes del §8 de [`00-discovery.md`](00-discovery.md), hechas con **sondas temporales** dentro de `plugins/sdd-beto/`: una skill, un agente, un hook que registraba su entrada y un ejecutable en `bin/`. Se ejecutaron sobre un proyecto de prueba vacío con `claude -p` y después se borraron; no forman parte del commit.

## Cómo se probó
- **Proyecto de prueba:** repo git vacío en una rama `probe-branch`, fuera de este repositorio.
- **Carga del plugin:** `claude -p "/sdd-beto:probe" --plugin-dir ./plugins/sdd-beto`.
- **Registro:** un script Node que, llamado como hook (forma exec) o desde Bash, añade a `.probe/log.jsonl` los argumentos, la entrada del hook y las variables de entorno del plugin.
- **Permisos:** la prueba de `allowed-tools` se repitió con `--setting-sources project`, para excluir un `Bash(node:*)` que había en los ajustes locales del usuario, y con una orden de control fuera de la skill.

## Resultados

| # | Comprobación | Resultado | Evidencia |
|---|---|---|---|
| 1 | Un hook de `hooks/hooks.json` recibe `agent_type` con el nombre de ámbito cuando escribe un subagente del plugin | ✅ | `PreToolUse` · `Write` · `agent_type: "sdd-beto:probe"` · `agent_id` presente |
| 1b | En la sesión principal, `agent_type` no llega | ✅ | `agent_type: null` en los `PreToolUse` de Bash y PowerShell de la sesión principal |
| 1c | `SubagentStop` recibe el informe final del agente | ✅ | `last_assistant_message` empieza por `STATUS: DONE` |
| 2a | `${CLAUDE_PLUGIN_ROOT}` se sustituye en el cuerpo de una skill | ✅ | La skill mostró `C:/Users/…/plugins/sdd-beto` (con `/`) |
| 2b | … en el cuerpo de un agente | ✅ | El agente escribió `PLUGIN_ROOT_IN_AGENT_BODY=C:/Users/…/plugins/sdd-beto` |
| 2c | … en `allowed-tools` de una skill | ✅ | Con la skill, `node ${CLAUDE_PLUGIN_ROOT}/scripts/…` se ejecutó sin pedir permiso; la misma orden sin la skill devolvió `This command requires approval` |
| 2d | Hooks en forma exec (`"command": "node", "args": [...]`) en Windows | ✅ | Se ejecutaron y recibieron `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PROJECT_DIR` y `CLAUDE_PLUGIN_DATA` |
| 2e | Las variables del plugin **no** están en el entorno de Bash | ✅ (como dice la doc) | `env` nulo en los scripts lanzados desde Bash |
| 2f | Inyección `` !`git branch --show-current` `` en una skill de plugin | ✅ | Mostró `probe-branch` |
| 3a | `bin/` desde la herramienta Bash | ✅ | `sdd-beto-probe bin-bash` → `probe ok` |
| 3b | `bin/` desde la herramienta PowerShell | ❌ | `The term 'sdd-beto-probe' is not recognized…` |
| 4a | `claude plugin validate` del plugin y del marketplace | ✅ | `✔ Validation passed` en ambos |
| 4b | Instalación desde el marketplace como directorio local, con `--scope local` | ✅ | `sdd-beto@sdd-beto` · versión 0.1.0 · habilitado; escribe `extraKnownMarketplaces` y `enabledPlugins` en `.claude/settings.local.json` del proyecto |
| 4c | El plugin instalado funciona sin `--plugin-dir` | ✅ | La skill se ejecutó; `CLAUDE_PLUGIN_ROOT` apunta al repo (carga en sitio, sin copia) |
| 4d | Desinstalación limpia | ✅ | `claude plugin marketplace remove sdd-beto` quitó el marketplace y el plugin |
| 4e | Instalación desde GitHub | ⏳ | Pendiente: requiere que el esqueleto esté publicado. Se prueba justo después del push de esta fase |

## Consecuencias para el diseño
- **ADR-0008 queda confirmada en la práctica:** el guard puede identificar cada rol por `agent_type = "sdd-beto:<rol>"`, y la sesión principal se reconoce por la ausencia de `agent_type`.
- **ADR-0020 queda confirmada:** los scripts se llaman con `node ${CLAUDE_PLUGIN_ROOT}/scripts/<script>.mjs`, **no** desde `bin/`, porque PowerShell no los encuentra.
- **La CLI `sdd-state` (ADR-0021)** se puede preautorizar en el `allowed-tools` de las skills del orquestador con `Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-state.mjs *)`, así que no pedirá permiso en cada cambio de estado.
- **La validación del informe final con `SubagentStop`** (mejora 1.x) es viable: el hook recibe el texto completo.
- Con `--plugin-dir`, `CLAUDE_PLUGIN_DATA` es `~/.claude/plugins/data/sdd-beto-inline`; instalado, cambia de identificador. No guardaremos estado ahí (todo el estado vive en el proyecto).

## Notas
- `claude plugin details` muestra la descripción de la **entrada del marketplace**, que tiene prioridad sobre la de `plugin.json`.
- Con `--scope local`, el marketplace se declara en `.claude/settings.local.json` del proyecto. Claude Code además lo registra internamente en `~/.claude/plugins/`; `marketplace remove` lo limpia.
