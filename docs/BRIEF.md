# Brief de traspaso: plugin `sdd-beto`

> **Para la sesión de Claude Code que abra este repo.** Este documento resume una sesión anterior que se trabajó en el repo `fitnerd`, donde se diseñó, se construyó y se probó de punta a punta un harness de Spec-Driven Development (SDD). Aquí no hay otro contexto: **léelo completo antes de hacer nada**.
>
> - Fecha del traspaso: 2026-09-25.
> - Código fuente del harness original: `C:\Users\alber\source\repos\fitnerd`. Para poder leerlo, abre la sesión con `claude --add-dir C:\Users\alber\source\repos\fitnerd`.

---

## 0. Neutralidad: este documento es temporal

`sdd-beto` es un plugin **genérico**. fitnerd es solo el origen del que se porta el código y, al final, **un proyecto consumidor más**. Este brief nombra fitnerd únicamente porque hace falta para el portado. Reglas:

1. **Nada específico de fitnerd dentro del plugin.** Las rutas (`backend/`, `frontend/`), los comandos (`pytest`, `npm test`, ruff), las convenciones (capas de Flask, `apiFetch`, fakes, `@require_auth`) y los ejemplos (`000-example`, `001-health-endpoint`) no se copian tal cual:
   - lo que depende del proyecto va a `.sdd/config.json` o a la parte específica de la constitución, que genera `init` **en cada proyecto**;
   - si hacen falta ejemplos o fixtures de prueba, se crean neutrales.
2. **`--add-dir fitnerd` es temporal.** Solo se usa mientras se porta el código (Fases 0–4). Después se trabaja en `sdd-beto` sin acceso a fitnerd.
3. **Las ADRs se redactan de forma genérica.** Las decisiones de §7 se reescriben como ADRs propias de `sdd-beto` en la Fase 1, sin decir "como en fitnerd". Las lecciones de §8 se incorporan a los agentes y al protocolo, y al changelog si procede, como reglas del plugin, no como problemas de un proyecto.
4. **Este archivo se borra.** Cuando su contenido ya viva en las ADRs, en el `CLAUDE.md` propio de `sdd-beto` y en la documentación del plugin, `docs/BRIEF.md` se elimina con un commit. **Es un criterio de "hecho" del proyecto**, que se revisa al cerrar la Fase 8. Queda en el historial de git, pero ningún agente lo carga como contexto.
5. **fitnerd es un consumidor, no una referencia.** En la Fase 7, fitnerd adopta el plugin con su propio `.sdd/config.json` y su constitución específica, igual que cualquier otro proyecto. El plugin no sabe nada de él.
6. **Primer paso concreto:** en la Fase 0 crea el `CLAUDE.md` de `sdd-beto`, con las reglas de trabajo de §2 y esta sección de neutralidad. Así las sesiones futuras no dependen de este brief.

## 1. Objetivo

Convertir el harness SDD de fitnerd en un **plugin de Claude Code portable, instalable en cualquier proyecto**. Así el usuario tiene lista la "línea de producción" (spec → plan → tasks → tests → implement → verify → review → docs → close) y solo se dedica a desarrollar soluciones.

- **Nombre del plugin y namespace: `sdd-beto`.** Es una decisión del usuario. Los comandos quedarían como `/sdd-beto:init`, `/sdd-beto:new`, `/sdd-beto:run`, `/sdd-beto:status`, `/sdd-beto:spec`…
- **Primer proyecto que lo usará: fitnerd.** Cuando el plugin funcione, fitnerd debería poder reemplazar su copia local del harness por el plugin sin perder funcionalidad.

## 2. Reglas de trabajo con el usuario (obligatorias)

- **Idioma:** español, con el tono de un mentor. El usuario supervisa y decide junto contigo, así que explica con detalle.
- **Entorno:** Windows 11, con Git Bash y PowerShell.
- **Aprobación por fase:** trabaja por fases. Al final de cada una, detente y muestra qué se hizo (con las rutas), las decisiones que tomaste tú y por qué, qué viene después y las preguntas pendientes. **Espera un "aprobado" o "sí" explícito.**
- **Antes de cada `git commit`:** muestra los archivos (`git status` y `git diff --stat`), un resumen claro y el mensaje propuesto. **Espera aprobación.**
- **Antes de cada `git push`:** muestra la rama de origen y de destino y la lista de commits. **Espera aprobación.**
- **Nunca** des algo por aprobado si el usuario no responde, y **nunca** agrupes varias fases en una sola aprobación.
- **Cuando haya una decisión con compromisos reales**, pregúntale. Cuando no, decide tú y documéntalo. Si una petición suya contradice las buenas prácticas, díselo **antes** de ejecutarla.
- **Antes de crear agentes, skills, hooks o la estructura del plugin**, consulta la **documentación actual** de Claude Code. No te fíes de lo que recuerdes. En la sesión anterior, un agente de documentación dio dos datos falsos, que están en §6.
- **Commits:** en inglés e imperativo, terminados con la línea `Co-Authored-By` que indique el entorno.

## 3. Qué es el harness original (en fitnerd)

Está en `main` de fitnerd desde los PR #1 (`3ffe04e`) y #2 (`c8180a7`).

| Pieza | Ruta en fitnerd | Qué hace |
|---|---|---|
| Orquestador | `.claude/skills/sdd-run/SKILL.md` + `.claude/sdd/protocol.md` + `.claude/sdd/stages.md` | La sesión principal delega en los subagentes, aplica un gate humano en cada etapa, gestiona los commits y los ciclos de corrección (máximo 3) y mantiene `state.json` |
| 11 skills más | `.claude/skills/sdd-{new,status,spec,plan,tasks,test,implement,verify,review,docs,close}/` | Una por etapa, además de crear features y ver su estado. Todas con `disable-model-invocation: true` |
| 8 subagentes | `.claude/agents/*.md` | `spec-writer` (opus), `planner` (opus), `task-breaker` (sonnet), `test-author` (sonnet), `implementer` (sonnet, con modo scaffold), `verifier` (haiku, modos red y full), `reviewer` (opus), `doc-keeper` (sonnet) |
| Hooks | `.claude/hooks/sdd-guard.mjs` (+ `.test.mjs` con 15 tests) + `.claude/settings.json` | `role-guard`: cada agente escribe solo en sus rutas y en su etapa (usa `agent_type`). `stage-guard`: no se toca producción sin spec y plan aprobados. `git-guard`: pide confirmación (`ask`) en commit y push, y deja a los subagentes solo git de lectura |
| Script de ruff | `.claude/sdd/scripts/ruff-new.mjs` | Falla solo con violaciones de ruff **nuevas** en los archivos cambiados |
| Constitución | `specs/constitution.md` | Principios no negociables. Mezcla reglas genéricas del flujo con reglas propias de fitnerd |
| Plantillas | `specs/_templates/{spec,plan,tasks,review,verify-report}.md`, `state.json` | Artefactos por feature en `specs/NNN-slug/` |
| Documentación | `docs/sdd/{README,GUIA-DE-USO,hooks,00-discovery}.md`, `docs/sdd/decisions/ADR-0001..0013` | Visión general, guía de uso, hooks y decisiones |
| Ejemplos reales | `specs/000-example/` (frontend), `specs/001-health-endpoint/` (backend, modo sin pausas y un ciclo de corrección) | Recorridos completos, útiles como fixtures o documentación |

**Lee primero** estos archivos: `docs/sdd/README.md`, `docs/sdd/GUIA-DE-USO.md`, `.claude/sdd/protocol.md`, `.claude/sdd/stages.md`, `docs/sdd/decisions/README.md` y `.claude/hooks/sdd-guard.mjs`.

## 4. Qué es genérico y qué es de fitnerd

| Pieza | Genérica | Específica de fitnerd, a parametrizar |
|---|---|---|
| Flujo, gates, `protocol.md`, `stages.md`, `state.json`, plantillas, formato de ADR | ✅ | Referencias a `backend/` y `frontend/` en algunos textos |
| `spec-writer`, `planner`, `task-breaker`, `reviewer` | Casi | Mencionan las capas de Flask, `apiFetch`, `backend/tests/`, fakes en `tests/fakes.py` |
| `test-author`, `implementer`, `verifier` | Mecanismo ✅ | **Comandos escritos a mano:** `.venv/Scripts/python.exe -m pytest`, `npm test`, `npm run lint`, `npx tsc -b`, `npm run build` y el ratchet de ruff |
| `sdd-guard.mjs` | Mecanismo ✅ | **Rutas escritas a mano:** `isTest` (`backend/tests/`, `frontend/src/**/*.test.*`), `isProd` (`backend/`, `frontend/`) y `.env.example` |
| `ruff-new.mjs` | La idea del ratchet ✅ | Solo sirve para Python/ruff en `backend/`. Debería ser un mecanismo genérico: un comando de lint más la comparación con la base |
| `constitution.md` | Arts. 1–4, 8 y 9 (flujo, roles, aprobación, trazabilidad, git, "hecho") | Arts. 5–7 (convenciones de tests, arquitectura y seguridad de fitnerd) |
| `CLAUDE.md` | Secciones SDD, Aprobación y Convenciones | Sección Proyecto |

## 5. Diseño propuesto

Hay que validarlo con la documentación actual (§6) y con el usuario.

- **El plugin `sdd-beto`** lleva los agentes, las skills, los hooks, los scripts (guard, ratchet de lint y, en el futuro, `sdd-state.mjs`), las plantillas y la constitución base.
- **La configuración vive en cada proyecto**, en `.sdd/config.json`. Es un esquema a definir; este es un borrador:
  ```jsonc
  {
    "language": "es",
    "base_branch": "main",
    "scopes": {
      "backend":  { "prod": ["backend/**"],  "tests": ["backend/tests/**"],
                    "test": "…pytest -q", "lint_ratchet": "ruff", "typecheck": null, "build": null },
      "frontend": { "prod": ["frontend/**"], "tests": ["frontend/src/**/*.test.ts?(x)", "frontend/src/test/**"],
                    "test": "npm test", "lint": "npm run lint", "typecheck": "npx tsc -b", "build": "npm run build" }
    },
    "env_examples": [".env.example", "backend/.env.example", "frontend/.env.example"],
    "models": { "spec-writer": "opus", "verifier": "haiku", "…": "…" }
  }
  ```
  El guard, el verifier, el implementer y el test-author leen esta configuración en lugar de tener rutas y comandos escritos a mano.
- **Skill `/sdd-beto:init`:** automatiza las Fases 0 a 2 que en fitnerd se hicieron a mano:
  1. Analiza el repo (stack, comandos, tests, CI, riesgos).
  2. Propone `.sdd/config.json` y una constitución, es decir, la base genérica más una parte específica del proyecto.
  3. Crea `specs/` y añade las secciones SDD a `CLAUDE.md`.
  4. Todo con gates de aprobación.
- **Artefactos por proyecto:** siguen en el repo del proyecto (`specs/`, `docs/sdd/decisions/`), no en el plugin.
- **Distribución:** este repo de GitHub hace también de marketplace. Hay que confirmar el mecanismo exacto en la documentación.

## 6. Qué verificar primero en la documentación oficial

Consulta https://code.claude.com/docs, en concreto las páginas de plugins, plugin marketplaces, sub-agents, skills y hooks.

1. **Estructura de un plugin:** manifiesto (`.claude-plugin/plugin.json`), carpetas de agentes, skills y hooks, y la variable `${CLAUDE_PLUGIN_ROOT}`.
2. **Hooks del plugin:** ¿un hook definido en el plugin recibe `agent_type` en `PreToolUse` igual que un hook de proyecto? **Esto es crítico para `role-guard`.** Un informe de la sesión anterior decía que los *subagentes* de un plugin no admiten `hooks` ni `permissionMode` en su frontmatter. Confirma qué alternativa existe, por ejemplo hooks a nivel de plugin.
3. **Namespacing:** cómo se llaman los comandos (`/sdd-beto:run`) y los agentes de un plugin (¿`subagent_type: "sdd-beto:planner"`?).
4. **Variables de entorno de settings:** si `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` se puede fijar desde un plugin o hay que ponerlo en el `settings.json` del proyecto, por ejemplo desde `init`.
5. **Instalación y actualización** desde un marketplace de GitHub.

**Dos datos que ya se comprobaron como falsos en la sesión anterior:**
- Los subagentes **sí pueden lanzar otros subagentes** por defecto, hasta 3 niveles. La solución fue `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` y quitar `Agent` de sus `tools`.
- Un directorio anidado `.claude/skills/sdd/run/` **no** genera `/sdd:run`. En un proyecto, el nombre del comando es el nombre del directorio. El `:` solo existe en plugins y en `.claude/commands/<subdir>/`.

## 7. Decisiones heredadas (las ADR de fitnerd)

| ADR | Decisión |
|---|---|
| 0001 | Orquestador = sesión principal, sin anidamiento de subagentes. Los agentes se comunican solo por disco |
| 0002 | Requisitos híbridos: historia de usuario, REQ en EARS y AC en Given/When/Then (IDs `REQ-NNN`, `AC-NNN.M`, `NFR-NNN`, `AC-NNNN.M`) |
| 0003 | `specs/NNN-slug/` con idea, spec, plan, tasks, verify-report, review, docs-report y `state.json` (única fuente de verdad) |
| 0004 | Gate humano en **cada** etapa (elección del usuario); máximo 3 iteraciones de corrección antes de escalar |
| 0005 | TDD estricto con red check |
| 0006 | Modelos: opus para spec, plan y review; sonnet para tasks, tests, implement y docs; haiku para verify |
| 0007 | Rama `feat/NNN-slug`; un commit por etapa, que hace solo el orquestador |
| 0008 | Hooks en Node, portables en Windows; bypass de etapa con `SDD_BYPASS=1` |
| 0009 | Ratchet de lint: solo cuentan las violaciones nuevas |
| 0010 | Harness propio, inspirado en Spec Kit y Kiro |
| 0011 | `doc-keeper` y etapa `docs` |
| 0012 | Paso de andamiaje (el implementer en modo scaffold) antes del red check |
| 0013 | `CLAUDE.md` con sección Proyecto, mantenida por el doc-keeper |

## 8. Lecciones de las pruebas en seco (F1–F17), ya incorporadas en fitnerd

- **F1:** no fijar `main` en el código; usar `base_branch`.
- **F5 (esqueletos):** en TypeScript los imports son estáticos, así que hace falta un esqueleto que lance `not implemented`. Por eso existe el modo scaffold.
- **F7, F8 y F13 (forma de los esqueletos):**
  - mensaje exacto `not implemented`;
  - en TypeScript, parámetros con prefijo `_`;
  - en Python, `__init__` guarda las dependencias sin lanzar nada.
- **F9 y F10 (verifier con haiku):** tendía a ignorar el formato del informe y a inventarse las fechas. Ahora el formato se exige en el prompt de delegación y las fechas se generan con `node -e "…toISOString()"`.
- **F11 y F14 (datos que copia el orquestador):**
  - el orquestador copia el veredicto de `review.md` a `state.json`;
  - al aprobar la etapa tests, guarda los SHA-256 de los tests (`tests_snapshot`) y el reviewer los compara.
- **F16:** si hay que corregir un test después de implementar, no se repite el red check; se actualiza el snapshot.
- **F15 y F17:** el ratchet silencia `fatal:` y toma la base de `state.json`.
- **F0 (comandos solo manuales):** Claude no puede invocar skills con `disable-model-invocation`, así que el usuario escribe los comandos.
- **F4 (sha con retraso):** el sha de cada commit se guarda en `state.json` en el commit siguiente.
- **Git en Windows:** los archivos se convierten a CRLF al hacer checkout; los reemplazos automáticos de texto deben tolerar CRLF.
- **Varias ventanas a la vez:** una ventana externa, como el IDE, puede cambiar de rama a mitad del trabajo. Hay que verificar la rama justo antes de cada commit.

## 9. Mejoras pendientes (segunda iteración, candidatas para el plugin)

1. **Modo `refactor`:** red check invertido, con tests de caracterización que ya pasan.
2. **CLI `sdd-state.mjs`** para mutar `state.json` (`approve`, `advance`, `snapshot`, `commit`, `gate_mode`) en lugar de usar `node -e` improvisados.
3. **Detectar en los hooks las escrituras hechas desde la shell** (`sed -i`, `>`, `Set-Content`).
4. **Hook `SubagentStop`** que valide el formato del informe final de cada agente.
5. **Modo "sin pausas" (`gate_mode`)** como opción documentada.
6. **Hook que proteja secciones de `CLAUDE.md`**, dado que el doc-keeper solo debe tocar la sección Proyecto.
7. **Evaluar el modelo del verifier:** sonnet en lugar de haiku.
8. **Plantilla de CI genérica:** tests, lint, typecheck y build en `feat/*` y `fix/*`.

## 10. Plan de trabajo sugerido

Cada fase tiene su gate, commit y push con aprobación.

0. **Descubrimiento:** documentación actual de plugins (§6) y lectura del harness de fitnerd. Entregable: `docs/00-discovery.md`, con los hallazgos y las preguntas para el usuario.
1. **Decisiones de diseño:** esquema de `.sdd/config.json`, estructura del plugin, qué va en `init`, cómo se separa la constitución y estrategia de versiones. Se guardan como ADRs en este repo.
2. **Esqueleto del plugin:** manifiesto, marketplace e instalación local de prueba.
3. **Portar y parametrizar:** agentes, skills, protocolo y plantillas.
4. **Portar y parametrizar los hooks** con sus tests. El ratchet de lint pasa a ser genérico.
5. **`/sdd-beto:init`.**
6. **Prueba en seco:** instalar en un proyecto de prueba y ejecutar `init` y una feature trivial de punta a punta.
7. **Migrar fitnerd:** en una rama de fitnerd, sustituir la copia local por el plugin.
8. **Documentación:** README e instalación, guía de uso y changelog. **Al cerrar esta fase, borra `docs/BRIEF.md`** (§0.4) y comprueba con `grep -ri fitnerd` que el plugin no contiene referencias a fitnerd. Solo se permiten en el changelog, como nota histórica sobre su origen.

**Para arrancar:** el usuario abrirá la sesión con
```
cd C:\Users\alber\source\repos\sdd-beto
claude --add-dir C:\Users\alber\source\repos\fitnerd
```
y te pedirá leer este brief. Empieza por la Fase 0, que es de solo lectura, y detente con su resumen para aprobación.
