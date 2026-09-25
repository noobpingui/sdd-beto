# ADR-0024 — Implementación de `/sdd-beto:init`: la IA decide, un script escribe

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** Claude, con el usuario (opciones de `settings.json`)
- **Detalla:** ADR-0018 (init), ADR-0013 (`CLAUDE.md`) y ADR-0001 (límite de profundidad)
- **Documentación consultada:** `skills`, `settings`, `settings-reference`, `env-vars` y `memory` (Claude Code v2.1.282)

## Contexto
La ADR-0018 exige que init sea idempotente, que no escriba nada antes de aprobar la config y que no toque nada del usuario fuera de sus marcas. Si la IA editara `CLAUDE.md`, `settings.json` y la config con Write y Edit, estas garantías dependerían de cómo se redacte cada edición y no se podrían testear.

La documentación oficial añade restricciones:
- El `allowed-tools` de una skill solo vale **durante el turno en que se invoca**, y el contenido de la skill no se relee en los turnos siguientes.
- Los comentarios HTML de bloque de `CLAUDE.md` se eliminan antes de pasar el archivo al contexto.
- Si un repo tiene `AGENTS.md` y no `CLAUDE.md`, Claude lee `AGENTS.md`. En cuanto existe un `CLAUDE.md`, **deja de leerlo**, salvo que `CLAUDE.md` lo importe.
- `extraKnownMarketplaces` y `enabledPlugins` no instalan el plugin a nadie: registran el marketplace, y solo después de que cada persona confíe en la carpeta.

## Decisión
### Reparto
- **La IA decide el contenido:** analiza el repo, propone los ámbitos, los globs y los comandos con su evidencia, redacta la constitución y la sección Proyecto, y presenta cada gate.
- **`scripts/sdd-init.mjs` escribe** los archivos estructurados:

  | Comando | Uso |
  |---|---|
  | `scan` | Hechos del repo en JSON (manifiestos, CI, carpetas de test, `.env`, estado de los archivos SDD). Solo lectura |
  | `preview` | Valida una config borrador recibida **por stdin** y la clasifica con el mismo código que `sdd-state classify`. Solo lectura |
  | `write-config [--dry-run]` | Escribe `.sdd/config.json`. Si el contenido no cambia, no lo reescribe aunque cambie el formato. `--dry-run` da el diff campo a campo |
  | `integrate [--dry-run] …` | Crea `paths.specs` y `paths.adr` (con `.gitkeep`), fusiona las secciones de `CLAUDE.md` y fusiona `.claude/settings.json` |

- La constitución (`.sdd/constitution.md`) es prosa: la escribe la IA con Write, tras su gate.
- Los borradores se pasan por stdin: así nada toca el disco antes del gate 2.

### `CLAUDE.md`
- Las secciones vienen de `templates/claude-md.md`, que se puede sobrescribir en `.sdd/templates/` (ADR-0017), con variables que se rellenan desde la config.
- Las secciones SDD, Aprobación humana y Convenciones se regeneran en cada ejecución. La sección **Proyecto se conserva** si ya existe, porque la mantiene el `doc-keeper`; solo se reemplaza con `--replace-project-section`.
- Las secciones que faltan se añaden al final. Lo que hay fuera de las marcas no se toca, y se conservan los finales de línea (CRLF o LF).
- Si alguna marca está rota o repetida, `integrate` no escribe **ningún** archivo y pide corregirla a mano.
- Si no existe `CLAUDE.md` pero sí `AGENTS.md`, el archivo nuevo empieza con `@AGENTS.md`.
- **Idioma:** las secciones fijas son instrucciones para Claude y van en español (ADR-0019). La sección Proyecto es documentación del proyecto y va en el `language` de la config.

### `.claude/settings.json`
- **Límite de profundidad** (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`): se propone con respuesta recomendada **sí**. Si se rechaza, `--no-depth-limit`.
- **Marketplace** (`extraKnownMarketplaces` + `enabledPlugins`): se pregunta con respuesta recomendada **no** (`--marketplace` para añadirlo). Con el plugin instalado a nivel de usuario (ADR-0022) no aporta nada. La URL sale del `repository` de `plugin.json`, en forma HTTPS con `.git`, y el nombre del marketplace es el del plugin (ADR-0014).
- Se conservan las claves existentes y la sangría. Un `enabledPlugins: false` puesto a mano se respeta. Un archivo que no es JSON válido detiene la integración.

### La skill
- `disable-model-invocation: true`. Su `allowed-tools` solo preautoriza el paso 1 (lectura y `scan`), porque es el único que ocurre en el turno de la invocación. Todo lo que escribe pasa por los permisos normales.
- Las reglas que valen en todos los turnos están en una sección de "reglas permanentes" al principio.
- La guía de análisis por ecosistema vive en `skills/init/analysis.md` y solo se carga en el paso 1.

### Versiones de la config
`scan` informa de `schema_version` frente a la versión que soporta el plugin. Mientras solo exista la 1, init se detiene ante cualquier otra versión. Las migraciones se añadirán con la versión 2.

## Consecuencias
- (+) La idempotencia y el respeto de lo que ha escrito el usuario están cubiertos por tests (`scripts/test/sdd-init.test.mjs`).
- (+) La IA dedica su criterio a lo que requiere juicio (ámbitos, globs, convenciones), no a editar JSON con cuidado.
- (−) Pasar texto por stdin exige un heredoc (Bash) o un here-string (PowerShell); la skill da las dos formas.
- (−) Las secciones fijas en español en un proyecto con `language` distinto quedan en dos idiomas dentro del mismo `CLAUDE.md`. Se puede resolver sobrescribiendo la plantilla en `.sdd/templates/claude-md.md`.
