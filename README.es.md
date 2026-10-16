# sdd-beto

[English](README.md) · **Español**

Plugin de Claude Code que instala en cualquier repositorio una línea de producción de **Spec-Driven Development (SDD)**:

```
spec → plan → tasks → tests (rojo) → implement → verify → review → docs → close
```

Cada etapa la hace un subagente especializado con permisos separados. La sesión principal orquesta y **tú apruebas en tres gates: la spec, la review y el cierre** (que cubre de una vez el push, el PR y el merge). Entre medias, el flujo solo se detiene por decisiones mayores; las menores quedan en un backlog. El modo `strict` mantiene un gate en cada etapa, commit y push. Unos hooks impiden que un agente escriba fuera de su rol o que se toque código de producción sin una spec y un plan aprobados.

## Qué obtienes
- **Specs trazables:** historia de usuario, requisitos en formato EARS y criterios de aceptación Given/When/Then. Cada criterio acaba en un test con el marcador `SDD:`.
- **TDD de verdad:** los tests se escriben antes que el código y un `verifier` comprueba que fallan por el motivo correcto (red check) antes de implementar.
- **Revisión independiente:** un `reviewer` con la constitución del proyecto como checklist y un ciclo de corrección con límite de iteraciones.
- **Documentación al día:** un `doc-keeper` actualiza la documentación afectada y la sección Proyecto de `CLAUDE.md`.
- **Un flujo que no se atasca:** tres gates humanos por defecto, commits locales automáticos entre medias y un backlog donde se anotan las decisiones menores en lugar de interrumpirte.
- **Genérico:** rutas, comandos, ámbitos (monorepos incluidos) y convenciones viven en `.sdd/config.json` y en la constitución de cada proyecto, que genera `/sdd-beto:init`.

## Requisitos
- [Claude Code](https://code.claude.com/docs) reciente.
- Node.js ≥ 20 (los scripts del plugin no tienen dependencias).
- Un repositorio git. Los scripts son Node puro y toleran CRLF; está probado en Windows 11 y pensado también para macOS y Linux.

## Instalación
```
claude plugin marketplace add https://github.com/noobpingui/sdd-beto.git
claude plugin install sdd-beto@sdd-beto
```
También vale el formato corto `noobpingui/sdd-beto`: Claude Code clona por SSH si tienes una clave que autentique contra GitHub y, si no, por HTTPS. El plugin queda instalado para tu usuario, pero **en un proyecto sin `.sdd/config.json` no hace nada**.

## Inicio rápido
En la raíz del proyecto, dentro de Claude Code:

1. **`/sdd-beto:init`**: analiza el repo y te propone, paso a paso y con tu aprobación, la config (incluido el modo de gates), la constitución del proyecto y las secciones de `CLAUDE.md`. En modo `flow` también te ofrece permisos locales para que los commits de cada etapa no pidan confirmación. Termina con un commit en una rama `chore/sdd-init`.
2. **`/sdd-beto:new <slug> <idea>`**: crea la feature (número, rama y carpeta). Por ejemplo: `/sdd-beto:new export-csv Exportar el informe mensual a CSV`.
3. **`/sdd-beto:run`**: recorre el flujo. Se detiene para que apruebes la spec y después avanza solo (con un commit local por etapa) hasta la review, donde ves un resumen de todas las etapas y el backlog. El gate de cierre hace el push, abre el PR y lo integra; responde "aprobado" en cada gate.

La [guía de uso](docs/guia.md) explica cada paso con detalle.

## Comandos
| Comando | Qué hace |
|---|---|
| `/sdd-beto:init [notas]` | Adopta el flujo en el repo o lo actualiza (idempotente) |
| `/sdd-beto:new <slug> <idea>` | Crea una feature: rama `feat/NNN-slug` y carpeta `<specs>/NNN-slug/` |
| `/sdd-beto:run [NNN-slug]` | Ejecuta la siguiente etapa y encadena las demás, deteniéndose en los gates del `gate_mode` |
| `/sdd-beto:status [NNN-slug]` | Estado de las features y comprobaciones de consistencia (solo lectura) |
| `/sdd-beto:spec` · `plan` · `tasks` · `test` · `implement` · `verify` · `review` · `docs` · `close` `[NNN-slug]` | Ejecuta una sola etapa |

Todos se invocan a mano: Claude no los lanza por su cuenta.

## Cómo funciona
| Etapa | Agente | Modelo por defecto |
|---|---|---|
| spec | `spec-writer` | opus |
| plan | `planner` (y ADRs) | opus |
| tasks | `task-breaker` | sonnet |
| tests | `implementer` (esqueletos) → `test-author` → `verifier` (red check) | sonnet / sonnet / haiku |
| implement | `implementer` | sonnet |
| verify | `verifier` | haiku |
| review | `reviewer` | opus |
| docs | `doc-keeper` | sonnet |
| close | la sesión principal | el de tu sesión |

- **Artefactos:** cada feature vive en `<specs>/NNN-slug/` (`idea.md`, `spec.md`, `plan.md`, `tasks.md`, `verify-report.md`, `review.md`, `docs-report.md`, `backlog.md` y `state.json`). `state.json` es la única fuente de verdad del estado y solo lo cambia la CLI `sdd-state` del plugin.
- **Constitución:** una parte base, igual para todos los proyectos, y una Parte II propia de cada proyecto (`.sdd/constitution.md`), que solo puede endurecer la base.
- **Hooks:** `role-guard` (cada agente escribe solo en sus rutas y en su etapa), `stage-guard` (no se edita producción sin spec y plan aprobados) y `git-guard` (los subagentes solo usan git de lectura).
- **Modelos:** se pueden cambiar por proyecto con `models` en `.sdd/config.json`.

## Gates y aprobaciones
`gate_mode` en `.sdd/config.json` decide cada cuánto se detiene el flujo para consultarte ([ADR-0029](docs/decisions/ADR-0029-gate-mode-flow.md)).

| | `flow` (por defecto) | `strict` |
|---|---|---|
| Gates | spec, review y cierre | al final de cada etapa |
| Commits por etapa | automáticos, locales, en la rama de la feature | aprobados en el gate de cada etapa |
| Push, PR y merge | una sola aprobación en el gate de cierre | cada push aprobado aparte |

**Con `flow`:**
1. **Gate de spec:** apruebas qué se va a construir. Se hace el commit de la spec.
2. **plan → tasks → tests → implement → verify** avanzan solos, con un commit local por etapa y ciclos de corrección automáticos. Nada sale de tu máquina.
3. **Gate de review:** un resumen de todas las etapas (decisiones de cada agente, ADRs nuevas, correcciones automáticas, commits), el veredicto del reviewer y el backlog de la feature. Desde aquí puedes pedir que se rehaga cualquier etapa o que se resuelva ya un punto del backlog.
4. **docs** avanza sola.
5. **Gate de cierre:** la checklist de "hecho" y, con una sola aprobación, el commit final, el push, el PR (`gh pr create`), su merge con merge commit (`gh pr merge --merge --delete-branch`) y la vuelta a la rama base. Si algún paso falla, el flujo se detiene ahí y explica lo que falta.

Entre gates, el flujo se detiene **solo por una decisión mayor**: cambiar el alcance de la spec aprobada, incumplir la constitución, una dependencia nueva, una migración destructiva o romper una API pública, algo que afecte a la seguridad o a los datos, una ambigüedad con resultados funcionalmente distintos, o el límite de iteraciones. Todo lo demás (nombres, estilo, mejoras opcionales, hallazgos menores de la review) lo decide el agente y queda anotado.

**Backlog en dos niveles:** cada agente informa de lo que dejó pendiente y el orquestador lo copia en `<specs>/NNN-slug/backlog.md`. Al cerrar, los puntos abiertos pasan al backlog del proyecto (`paths.backlog`, por defecto `docs/backlog.md`), con un enlace a la feature.

**Permisos:** con `flow`, `/sdd-beto:init` ofrece permitir `git add` y `git commit` en `.claude/settings.local.json` (personal, no se versiona) para que los commits automáticos no pidan confirmación. Nunca permite `git push`: según tu modo de permisos, Claude Code puede pedirte confirmación antes del push y de los comandos `gh` del cierre.

## Actualizar y desinstalar
```
claude plugin marketplace update sdd-beto
claude plugin update sdd-beto@sdd-beto
claude plugin uninstall sdd-beto@sdd-beto
```
Después de actualizar, reejecuta `/sdd-beto:init` en cada proyecto: entra en modo actualización, propone solo lo que cambió y, si usas permisos locales, los apunta a la versión nueva.

**Si vienes de la 0.1.0:** el comportamiento por defecto pasa de un gate en cada etapa a `flow` en cuanto actualizas, aunque no ejecutes `init`. Para conservar el anterior, añade `"gate_mode": "strict"` a `.sdd/config.json`. Al ejecutar `init` se regenera la sección "Aprobación humana" de `CLAUDE.md` según tu modo y se ofrecen los permisos de commit. Las versiones anteriores a la 0.2.0 rechazan una config con `gate_mode` o `paths.backlog`.

## Documentación
- [Guía de uso](docs/guia.md): adopción, una feature de principio a fin, gates, correcciones y solución de problemas.
- [Decisiones de diseño (ADRs)](docs/decisions/README.md).
- [Informe de la prueba en seco](docs/06-prueba-en-seco.md): el flujo completo ejecutado con un modelo real.
- [Ideas y mejoras pendientes](docs/ideas.md).
- [Changelog](CHANGELOG.md).

## Desarrollo del plugin
- Estructura: la raíz es el marketplace y el plugin vive en `plugins/sdd-beto/` (ADR-0014).
- Tests de los scripts: `node --test plugins/sdd-beto/scripts/test/`
- Validación: `claude plugin validate ./plugins/sdd-beto` y `claude plugin validate .`
- Probar sin instalar: `claude --plugin-dir ./plugins/sdd-beto` en un proyecto de prueba.
- Prueba en seco reproducible: `node tests/fixtures/dryrun/make-dryrun.mjs <destino>` (ver el informe).

## Licencia
[MIT](LICENSE) (ADR-0028).
