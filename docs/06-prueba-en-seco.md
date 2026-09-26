# Fase 6 — Prueba en seco

- **Fecha:** 2026-09-25/26
- **Claude Code:** v2.1.282 (init) y v2.1.283 (resto), modelo por defecto de la cuenta; subagentes con los modelos de la ADR-0006.
- **Plugin:** árbol de trabajo de `sdd-beto` tras el commit `9d47691`, cargado con `--plugin-dir` (no instalado).
- **Modo:** headless (`claude -p … --resume`), con Claude haciendo de usuario en cada gate. Decisión del usuario para esta fase.

## 1. Cómo se reproduce

```
node tests/fixtures/dryrun/make-dryrun.mjs ../sdd-dryrun
```

El script copia `tests/fixtures/dryrun/project/`, hace `git init` y el commit inicial. Además crea `../sdd-dryrun-harness/` con un `settings.json` cuyo hook `PermissionRequest` (`tests/fixtures/dryrun/approve.mjs`) hace de usuario: aprueba cada aviso de permiso y lo registra en `permission-requests.jsonl`. Los `deny` de otros hooks no pasan por él.

Después se prepara el entorno del proyecto de prueba (`python -m venv .venv`, `pip install -r core/requirements-dev.txt`, `npm install` en `cli/`, y un commit del `package-lock.json`). Cada turno se lanza así:

```
claude -p "<mensaje>" [--resume <sesión>] --plugin-dir <sdd-beto>/plugins/sdd-beto \
  --settings ../sdd-dryrun-harness/settings.json --permission-mode default --output-format json
```

**El proyecto de prueba** ("units") es neutral e inventado. Tiene dos ámbitos:
- `core/`: Python con pytest y ruff;
- `cli/`: JavaScript con `node:test` y eslint.

Lleva deuda de lint a propósito (un `import` sin usar y un `let` que debería ser `const`), para comprobar que el ratchet la tolera.

**La feature** es la conversión de temperatura (C/F/K) con rechazo por debajo del cero absoluto.

## 2. Resultado

| Paso | Resultado | Notas |
|---|---|---|
| `init`, paso 1: análisis | ✅ | Detectó los 2 ámbitos, los comandos con evidencia `archivo:línea` y la deuda de lint sin ejecutar nada. |
| `init`, paso 2: config | ✅ | Pasó por `preview`, pidió permiso para las comprobaciones y ejecutó el ratchet a través de `cmd.exe`. No escribió nada antes del gate. |
| `init`, paso 3: constitución | ✅ | Cada regla con evidencia; preguntas en lugar de reglas inventadas. |
| `init`, paso 4: integración | ✅ | Ensayo (`--dry-run`) antes de escribir y las dos preguntas de `settings.json` con su recomendación. |
| `init`, paso 5: commit | ⚠️ | La rama y el `git add` se hicieron, pero el commit lo bloqueó el git-guard (H5) y lo hizo el usuario a mano. |
| `init` reejecutado | ✅ | Entró en modo actualización, no produjo diff y no intentó commitear. |
| Stage-guard (hook real) | ✅ | Bloqueó la edición de `core/` en `chore/sdd-init` con un mensaje claro. |
| Role-guard (hook real) | ✅ | Bloqueó al `sdd-beto:reviewer` cuando intentó escribir `core/units/probe.py`. El motivo fue la rama (`main`); la restricción por ruta en una rama de feature la cubren los tests unitarios. |
| `new` | ✅ | Propuesta, gate, rama, `sdd-state init` e idea copiada literalmente, sin commit. |
| `spec` | ✅ | 9 preguntas bien planteadas; las respuestas se copiaron literalmente. |
| `plan` | ✅ | Se desvió de un DEBERÍA de la Parte II, con justificación, y detectó que un test que solo comprobara `__all__` pasaría en rojo. |
| `tasks` | ✅ | 31 tareas con la matriz de cobertura completa (27/27 AC). |
| `tests` | ✅ | Esqueletos → tests → red check **PASS**: 26 tests fallan por `not implemented`. Cada rol escribió solo en lo suyo. |
| `implement` | ✅ | 30/30 en verde; el `implementer` ejecutó el ratchet real. |
| `verify` | ✅ | PASS, con trazabilidad completa. |
| `review` | ✅ | Encontró un hallazgo real (F1: un criterio sin cobertura propia) y se completó el ciclo de corrección: `rework` → `test-author` → snapshot → verify → review APPROVED. |
| `docs` | ✅ | Solo cambió la sección Proyecto de `CLAUDE.md`. El orquestador detectó una imprecisión del agente y se corrigió en una segunda vuelta. |
| `close` | ✅ | Checklist B7 con evidencia en cada punto y `validate --git` válido. Integración con merge local. |
| Ratchet de eslint | ✅ | Probado aparte: tolera la deuda previa y falla (código 1) solo por la violación nueva. |

**Coste:** unos 10,8 USD en total.
- init: 1,28 · reejecución de init: 0,53
- `new`: 0,23 · flujo completo: 8,39
- pruebas de los guards: 0,33

**Duración real:** unos 25 minutos, sin contar dos cortes del entorno (E1).

**Avisos de permiso:** 156, que en una sesión interactiva habría respondido el usuario (ver O1).

## 3. Hallazgos

Gravedad: **A** bloquea o rompe algo · **M** fricción o riesgo real · **B** detalle.

### Del plugin

| ID | Grav. | Hallazgo | Propuesta |
|---|---|---|---|
| H1 | A | `skills/init/analysis.md` salió dañado en `9d47691`: un `String.replace` con `'^$'` interpretó `` $' `` como patrón especial y duplicó medio archivo. | **Corregido en esta fase**, porque afectaba a la prueba. Lección: en ediciones por script, no pasar texto con `$` como reemplazo de `String.replace`. |
| H5 | A | El "ask" del git-guard para `commit` y `push` en la sesión principal: en `-p` y en cualquier contexto sin interfaz equivale a **denegar**, y el hook `PermissionRequest` ni siquiera se ejecuta. En una sesión interactiva supone una **doble aprobación** (chat + aviso). | Decisión del usuario, con una ADR que sustituya esa parte de la ADR-0008. Opciones: (a) quitar el "ask" de la sesión principal y dejar el git-guard solo para subagentes, porque el gate del chat ya es la aprobación; (b) hacerlo configurable en `.sdd/config.json`; (c) mantenerlo y documentar que el flujo exige una sesión interactiva. |
| H7 | M | El git-guard pide confirmación para `commit` y `push`, pero no para `merge`, que también crea un commit y además en la rama base. | Resolver junto con H5: o se cubren `merge`/`rebase`/`reset`, o desaparece la asimetría con la opción (a). |
| H2 | M | `lint-ratchet` ejecuta los comandos con `shell: true` (en Windows, `cmd.exe`) y los agentes con Bash o PowerShell. Un comando de la config tiene que funcionar en ambas shells, y no está documentado. | Documentarlo en la ADR-0016 y en `analysis.md` (rutas entre comillas; nada de sintaxis exclusiva de una shell). |
| H3 | M | La regla del prefijo `_` en los parámetros de los esqueletos (Art. B5.6) choca con `no-unused-vars` de eslint, que por defecto no ignora `_`. | `analysis.md` y el paso 3 de init: detectarlo y proponer `argsIgnorePattern: '^_'` como cambio del proyecto, o anotarlo en P1. |
| H4 | B | La columna Lint de la tabla de ámbitos de `CLAUDE.md` muestra el comando del ratchet (con `{file}` y stdin), que no sirve para ejecutarlo a mano. | `scopesTable`: mostrar `lint` si existe o "ratchet (ruff/eslint)". |

### Del comportamiento de los agentes

| ID | Grav. | Hallazgo | Propuesta |
|---|---|---|---|
| O1 | M | 156 avisos de permiso en toda la prueba. Muchos son lecturas de archivos del plugin (constitución, plantillas), las invocaciones de `sdd-state` y los comandos compuestos (`cd … && …`). En interactivo son interrupciones constantes. | Valorar que `init` proponga reglas `allow` en `.claude/settings.local.json`, porque la ruta del plugin depende de la máquina: lectura de `${CLAUDE_PLUGIN_ROOT}` y `node <plugin>/scripts/sdd-state.mjs *`. Además, pedir en el protocolo comandos simples en lugar de cadenas `&&`. |
| O6 | M | Los agentes anotan los bloques de comentarios del usuario: el reviewer les añade "(Iteración 1)" y el `doc-keeper` mete una nota suya dentro de la cita. El texto del usuario se conserva, pero ya no está solo. | Añadir a los agentes que escriben informes: "las secciones de comentarios del usuario no se editan; tus notas van fuera". |
| O4 | B | Tras un corte del entorno, el orquestador atribuyó al usuario un "[Request interrupted by user]" generado por el sistema. | Protocolo: ante una interrupción, preguntar en lugar de suponer que la pidió el usuario. |
| O3 | B | Para una feature pequeña: 27 criterios, 31 tareas y 26 tests. Es coherente con la trazabilidad, pero pesado. | Para después de la v1: valorar un modo ligero para cambios triviales, dentro de las excepciones del Art. B1.2. |
| O5 | B | Tras corregir solo tests, el protocolo obliga a pasar de nuevo por el gate de `implement` sin cambios de código. | Protocolo: si el `rework` no toca producción, `implement` se cierra en el mismo gate que la corrección. |
| O2 | B | La skill da a entender que el plugin siempre está "instalado a nivel de usuario", y con `--plugin-dir` no es así. | Redacción de la pregunta del marketplace en `skills/init/SKILL.md`. |

### Del entorno

| ID | Hallazgo |
|---|---|
| E1 | Dos veces, un subagente en `-p` se quedó horas esperando tras un corte del stream (spec: 22:11 → 02:32; planner: 02:34 → 05:28, con un "[Request interrupted by user]" sintético a las 05:50). Al relanzarlo terminó en menos de 2 minutos. No depende del plugin. |

## 4. Qué funcionó especialmente bien
- **Los gates detectan errores de los agentes:**
  - el orquestador contrastó "26 criterios" frente a los 27 del archivo;
  - comprobó con código la imprecisión del `doc-keeper`;
  - la review encontró un criterio sin cobertura real, algo que la trazabilidad del `verifier` no vio.
- **Separación de roles:** el registro de permisos muestra que cada agente escribió solo en sus rutas, y los guards bloquean con mensajes que explican qué hacer.
- **`state.json` solo se tocó con `sdd-state`**, y `validate --git` dio válido al cerrar.
- **`init` es idempotente** a nivel de script y de modelo.

## 5. Qué no se probó
- La restricción por ruta del role-guard **dentro** de una rama de feature con un subagente real (la cubren los tests unitarios de `sdd-guard`).
- Una sesión interactiva real: los avisos de permiso y la experiencia del usuario solo se deducen del registro del arnés.
- El push y el PR (`gh`): el repo de prueba no tiene remoto.
- Features que toquen dos ámbitos a la vez, y el límite de iteraciones (`max_iterations`).
