---
description: Set up or update the sdd-beto SDD workflow in the current repository - analyzes the repo read-only, proposes .sdd/config.json and the project constitution, integrates CLAUDE.md and .claude/settings.json, and commits on its own branch, with a human approval gate at every step. Idempotent. Manual use only.
argument-hint: "[notas para el análisis]"
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(git status *) Bash(git log *) Bash(git branch --show-current) Bash(git branch --list *) Bash(git ls-files *) Bash(git remote *) Bash(git symbolic-ref *) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-init.mjs scan)
---

# /sdd-beto:init · adoptar o actualizar el flujo SDD

Preparas **este repositorio** para el flujo SDD de `sdd-beto`: config, constitución del proyecto, `CLAUDE.md` y settings. Lo haces en 5 pasos, **cada uno con su gate** (ADR-0018). Trabajas en la sesión principal; no delegas en subagentes.

Notas del usuario para el análisis: `$ARGUMENTS`

## Rutas del plugin
- Ayudante de init (`sdd-init` en esta skill): `node ${CLAUDE_PLUGIN_ROOT}/scripts/sdd-init.mjs`
- Guía de análisis por ecosistema: [analysis.md](analysis.md). Léela en el paso 1.
- Esquema de la config: `${CLAUDE_PLUGIN_ROOT}/templates/config.schema.json` · ejemplo: `${CLAUDE_PLUGIN_ROOT}/templates/config.json`
- Constitución base: `${CLAUDE_PLUGIN_ROOT}/constitution/base.md` · plantilla de la Parte II: `${CLAUDE_PLUGIN_ROOT}/constitution/project-template.md`
- Rama actual: !`git branch --show-current`

Ejecuta `sdd-init` siempre como `node <ruta>/sdd-init.mjs <comando> …`, **sin comillas alrededor de la ruta**. Responde en JSON por stdout; si sale con 1 o 2, el motivo está en stderr. `preview`, `write-config` e `integrate --project-section -` leen de **stdin**: pásales el texto con un heredoc entre comillas simples en Bash (`node <ruta>/sdd-init.mjs preview <<'EOF'` … `EOF`) o con un here-string en PowerShell (`@'` … `'@ | node <ruta>/sdd-init.mjs preview`).

## Reglas permanentes (valen en todos los pasos y en todos los turnos)
1. **Nada se escribe antes de que el usuario apruebe el paso 2.** Los pasos 1 y 2 son de solo lectura: `scan`, `preview` y `write-config --dry-run` no escriben nada.
2. **Un gate por paso.** Al terminar cada paso, presenta el resultado, haz la pregunta del gate y **termina tu turno**. Solo "aprobado", "sí" o un equivalente claro cuentan como aprobación: el silencio, una pregunta o un "luego vemos" no. Nunca encadenes dos pasos con una sola aprobación. Si el usuario corrige algo, rehaz el paso y vuelve a presentar el gate.
3. **Los archivos que gestiona el script solo se escriben con el script:** `.sdd/config.json` con `write-config`; las carpetas, `CLAUDE.md` y `.claude/settings.json` con `integrate`. Nunca los edites con Write o Edit: el script garantiza que no se toca nada fuera de las marcas `<!-- sdd-beto:… -->` y que reejecutar init sin cambios no produce diff. La constitución (`.sdd/constitution.md`) sí la escribes tú, con Write, tras el gate 3.
4. **No modificas el entorno:** no instalas dependencias, no ejecutas builds, migraciones, servicios ni nada que escriba fuera de los archivos de init o que use la red. Solo ejecutas comandos de **comprobación** del paso 2 y con permiso.
5. **Git con escritura solo en el paso 5** (rama y commit), con su aprobación. El push, aparte y con otra aprobación. Nunca `git add -A` ni `git add .`: se añaden los archivos por su ruta.
6. **Nada inventado.** Cada comando y cada regla que propongas sale de una evidencia del repo (archivo y línea). Si no hay evidencia, el valor es `null` o la regla se marca como pregunta abierta.
7. **Idioma:** hablas con el usuario en el idioma de la conversación. Lo que redactas para el proyecto (sección Proyecto de `CLAUDE.md` y constitución) va en el `language` de la config que se apruebe.

## Paso 0 · Preparación
1. Ejecuta `sdd-init scan`. Si falla porque no es un repositorio git, explica que el flujo necesita git, propón `git init` (no lo ejecutes) y detente.
2. Del resultado:
   - `git.clean == false`: avisa de que hay cambios sin commitear. Init solo commiteará sus propios archivos, pero conviene empezar con el árbol limpio. Pregunta si se sigue.
   - `git.has_commits == false`: la rama del paso 5 saldrá del primer commit; avísalo.
   - **Modo actualización** si `sdd.config.exists`:
     - `schema_version` mayor que `supported_schema`: el plugin es más antiguo que la config. Detente y sugiere actualizar el plugin.
     - `schema_version` menor: habría que migrar la config. Esta versión del plugin no tiene migraciones: indícalo y detente.
     - config no válida: muestra `issues`; el paso 2 propondrá la corrección.
     - En este modo, cada paso propone **solo el diff** respecto a lo que existe y respeta lo que ya está bien.
     - Si `sdd.local_permissions` existe con `up_to_date: false` (el plugin se actualizó y cambió de ruta), el paso 4 propone de nuevo `--local-permissions`, que sustituye las reglas antiguas.
   - `sdd.claude_md.sections` con algún `broken`: `integrate` fallará hasta que se corrijan las marcas. Avísalo ya en el gate 1.

## Paso 1 · Análisis (solo lectura)
Lee [analysis.md](analysis.md) y sigue su lista. Parte del JSON de `scan` y **lee** los archivos que señala: manifiestos, workflows de CI (los comandos que ejecuta el CI son la mejor evidencia), configuración de test, lint y typecheck, README o CONTRIBUTING, `.env.example`, `docker-compose` y 2 o 3 tests existentes por área.

Presenta:
- **Resumen del repo:** qué es, lenguajes, gestores de paquetes y estructura (monorepo, un paquete…).
- **Ámbitos candidatos:** una fila por parte del repo con su raíz, qué contiene y cómo se testea.
- **Comandos detectados:** test, lint, typecheck y build de cada ámbito, **con su evidencia** (`archivo:línea`). Señala lo que no se ha encontrado.
- **Estado de los tests:** qué hace falta para ejecutarlos (servicios, variables, datos). No los ejecutes en este paso.
- **Riesgos:** los de `scan.risks` y los que veas (secretos versionados, tests que necesitan servicios externos, CI inexistente, marcas rotas en `CLAUDE.md`…).
- En modo actualización: qué cambió en el repo respecto a la config actual.

Gate 1: **"¿El análisis es correcto? Corrige lo que falte o sobre y paso a proponer la config."**

## Paso 2 · Propuesta de `.sdd/config.json`
1. Redacta la config según ADR-0016 y el esquema. Criterios:
   - **`scopes`:** uno por parte del repo que se testea y construye por separado. Nombres en kebab-case. Con un solo paquete basta un ámbito (`"prod": ["**"]` es válido: los archivos del flujo SDD nunca cuentan como producción, ADR-0023).
   - **Globs** `prod` y `tests` precisos (sintaxis: `**`, `*`, `?`, `{a,b}`; sin `!` ni `[...]`). Los tests se reconocen antes que la producción, así que un test dentro de `src/` basta con que lo cubra `tests`.
   - **Comandos:** solo los que tienen evidencia; si no, `null`. `root` es el directorio desde el que se ejecutan. `test_files` usa `{files}` (rutas relativas a `root`). `test_check` recolecta o compila los tests **sin ejecutarlos** (ver analysis.md). `lint_ratchet` solo si el linter es de un formato soportado (`ruff`, `eslint`); si hay lint pero no ratchet, `lint`.
   - **`env_hint`:** lo que el usuario debe hacer para que los tests funcionen (p. ej. levantar un servicio), sacado del README o del CI. Nunca se ejecuta.
   - **`base_branch`:** la rama principal real (`git symbolic-ref refs/remotes/origin/HEAD`, o la rama actual si no hay remoto).
   - **`language`, `commits`, `branches`, `paths`:** propón los valores por defecto salvo evidencia en contra (p. ej. ya existe una carpeta de ADRs con otro nombre, o el historial usa otro estilo de commits) y **pregunta el `language`** en el gate.
2. Pasa el borrador por `sdd-init preview`. Si `valid` es `false`, corrígelo y repite. Revisa cada aviso de `warnings`, `suspicious` y `overlaps`: corrige los globs o explica en el gate por qué el aviso es aceptable.
3. **Comprobación de comandos**, solo si es seguro: los `test_check` de cada ámbito que no necesiten servicios, red ni instalar nada. Enumera antes los comandos exactos y su `root` y pide permiso en el mismo mensaje; ejecútalos solo si el usuario acepta. Nunca ejecutes `test` completo, `build` ni nada que escriba.
4. En modo actualización, `sdd-init write-config --dry-run` (config por stdin) muestra el diff campo a campo: preséntalo en lugar de la config entera.

Presenta: la config completa (o el diff), la tabla de clasificación de `preview` (por ámbito: archivos de producción y de test, con 2 o 3 ejemplos), los avisos y el resultado de las comprobaciones.

Gate 2: **"¿Apruebas esta config? Al aprobarla la escribo en `.sdd/config.json`."** Con la aprobación: `sdd-init write-config` con la config por stdin. Informa de la acción (`create`, `update` o `unchanged`).

A partir de aquí los hooks del plugin ya están activos en este repo (la config existe). No afectan a los archivos de init.

## Paso 3 · Propuesta de `.sdd/constitution.md` (Parte II)
1. Lee la constitución base y la plantilla de la Parte II. Redacta la Parte II siguiendo la plantilla (P1 a P4) y el `language` de la config.
2. Cada regla sale de **lo que el código ya hace**: cita la evidencia en tu mensaje (no en el archivo). Prioriza lo que un agente necesita para no romper las convenciones:
   - **P1, por ámbito:** dónde van los tests y cómo se nombran, cómo se aíslan las dependencias, qué servicios necesitan y la **forma exacta de los esqueletos** (Art. B5.6) en ese lenguaje (ver analysis.md). Si el linter del ámbito marca los parámetros no usados sin ignorar el prefijo `_` (p. ej. `no-unused-vars` de eslint por defecto), los esqueletos generarán violaciones: dilo en el gate y ofrece las dos salidas de analysis.md §6.
   - **P2:** capas o módulos y sus dependencias permitidas, dónde vive cada tipo de lógica, cómo se expresan los errores, utilidades que se deben reutilizar.
   - **P3:** autenticación, validación de entradas, secretos y acceso a datos, según lo que exista.
   - **P4:** solo si el proyecto necesita algo más que el Art. B7; si no, "Ninguno".
3. Solo puede **endurecer** la base, nunca relajarla. Lo que no esté claro va como **DEBERÍA** o como pregunta en el gate, no como regla inventada. Breve: mejor 5 reglas ciertas que 20 genéricas.
4. Modo actualización: si `.sdd/constitution.md` existe, no la reescribas. Cambiar la Parte II requiere un ADR del proyecto (ADR-0017): si el usuario quiere cambios, propón el diff y el ADR en `paths.adr`, y escríbelos juntos tras el gate.

Gate 3: muestra el texto completo (o el diff) y pregunta **"¿Apruebas la constitución del proyecto? Al aprobarla la escribo en `.sdd/constitution.md`."** Con la aprobación, escríbela con Write.

## Paso 4 · Integración
1. **Sección Proyecto de `CLAUDE.md`** (ADR-0013). Si `scan` la marcó como `ok`, **se conserva**: la mantiene el `doc-keeper` y no se propone de nuevo, salvo que el usuario pida rehacerla (`--replace-project-section`). Si no existe, redacta un borrador en el `language` de la config, de 10 a 25 líneas, empezando por `## Proyecto`: qué es, áreas, arquitectura, despliegue y puntos delicados. Para los comandos, remite a la tabla de ámbitos de la sección Convenciones; no la repitas.
2. **Tres decisiones para el usuario:**
   - **Límite de profundidad de subagentes** (ADR-0001), en `.claude/settings.json`: `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` impide que un subagente lance otros y se salte la separación de roles. Afecta a **toda** sesión en este proyecto, también fuera del flujo SDD. **Recomendado: sí.** Si lo rechaza, usa `--no-depth-limit`.
   - **Marketplace del plugin**, en `.claude/settings.json`: `extraKnownMarketplaces` y `enabledPlugins` dejan escrito en el repo de dónde se obtiene `sdd-beto`. Solo sirve a quien abra el repo en otra máquina sin el plugin instalado: no instala nada solo y exige confiar en la carpeta. **Recomendado: no**, salvo que el usuario lo pida. Si lo acepta, usa `--marketplace`.
   - **Permisos locales del plugin** (ADR-0026), en `.claude/settings.local.json`, que es personal y no se versiona: reglas `allow` para leer los archivos del plugin y ejecutar `sdd-state` y `lint-ratchet` sin un aviso de permiso cada vez. Llevan la ruta del plugin en esta máquina, así que al actualizar el plugin hay que reejecutar init (`scan` lo detecta: `sdd.local_permissions.up_to_date`). Si `.gitignore` no ignora ese archivo, el script lo añade. **Recomendado: sí** si se va a usar el flujo en una sesión interactiva. Si lo acepta, usa `--local-permissions`.
3. Ejecuta `sdd-init integrate --dry-run` con las opciones que correspondan (y `--project-section -` con el borrador por stdin). Presenta:
   - las carpetas que se crean (`paths.specs`, `paths.adr`);
   - `CLAUDE.md`: qué pasa con cada sección (`create`, `update`, `unchanged`, `kept`), el borrador de Proyecto y, si el archivo es nuevo y existe `AGENTS.md`, que se importa con `@AGENTS.md`;
   - `.claude/settings.json`, `.claude/settings.local.json` y `.gitignore`: las `notes` del script, que listan cada cambio;
   - las tres preguntas del punto 2, con su recomendación.

Gate 4: **"¿Apruebas la integración, con estas respuestas a las tres preguntas?"** Con la aprobación, ejecuta el mismo `integrate` sin `--dry-run` y comprueba que las acciones coinciden con las del ensayo.

## Paso 5 · Commit
1. **Rama:** `chore/sdd-init`, u otra si el usuario la prefiere. Si ya estás en una rama que no es la base, pregunta si se commitea ahí.
2. **Archivos**, añadidos por su ruta y solo los que cambiaron: `.sdd/config.json`, `.sdd/constitution.md`, `CLAUDE.md`, `.claude/settings.json` (si se tocó), `.gitignore` (si el script le añadió `.claude/settings.local.json`), los `.gitkeep` de `paths.specs` y `paths.adr` y el ADR del proyecto si lo hubo. **Nunca** `.claude/settings.local.json` ni archivos ajenos a init.
3. **Mensaje:** según `commits` de la config (idioma y estilo), p. ej. en inglés e imperativo: `Set up the sdd-beto spec-driven workflow`, terminado con la línea `Co-Authored-By` que indique el entorno.
4. Muestra `git status --short`, la lista de archivos que vas a añadir, un resumen y el mensaje.

Gate 5: **"¿Apruebas crear la rama y hacer el commit?"** Con la aprobación: `git checkout -b <rama>` (los cambios sin commitear viajan con ella), `git add <rutas>` y `git commit`. Muestra el hash.

Después, **propón el push** (rama de origen y de destino, y commits) y espera otra aprobación. Si el repo no tiene remoto, omítelo.

## Cierre
Resume lo creado y los siguientes pasos:
- revisa la clasificación cuando quieras con `/sdd-beto:status`;
- si la sesión ya estaba abierta, reiníciala para asegurar que el `env` nuevo de `.claude/settings.json` se aplica;
- integra la rama `chore/sdd-init` en la base (PR o merge, con aprobación);
- empieza la primera feature con `/sdd-beto:new <slug> <idea>`.

Reejecutar `/sdd-beto:init` es seguro: entra en modo actualización y, si nada cambió, no produce diff.
