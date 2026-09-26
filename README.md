# sdd-beto

Plugin de Claude Code que instala en cualquier repositorio una línea de producción de **Spec-Driven Development (SDD)**:

```
spec → plan → tasks → tests (rojo) → implement → verify → review → docs → close
```

Cada etapa la hace un subagente especializado con permisos separados. La sesión principal orquesta y **tú apruebas cada etapa, cada commit y cada push**. Unos hooks impiden que un agente escriba fuera de su rol o que se toque código de producción sin una spec y un plan aprobados.

## Qué obtienes
- **Specs trazables:** historia de usuario, requisitos en formato EARS y criterios de aceptación Given/When/Then. Cada criterio acaba en un test con el marcador `SDD:`.
- **TDD de verdad:** los tests se escriben antes que el código y un `verifier` comprueba que fallan por el motivo correcto (red check) antes de implementar.
- **Revisión independiente:** un `reviewer` con la constitución del proyecto como checklist y un ciclo de corrección con límite de iteraciones.
- **Documentación al día:** un `doc-keeper` actualiza la documentación afectada y la sección Proyecto de `CLAUDE.md`.
- **Genérico:** rutas, comandos, ámbitos (monorepos incluidos) y convenciones viven en `.sdd/config.json` y en la constitución de cada proyecto, que genera `/sdd-beto:init`.

## Requisitos
- [Claude Code](https://code.claude.com/docs) reciente.
- Node.js ≥ 20 (los scripts del plugin no tienen dependencias).
- Un repositorio git. Los scripts son Node puro y toleran CRLF; está probado en Windows 11 y pensado también para macOS y Linux.
- Credenciales de GitHub en el gestor de credenciales de git: el repositorio del plugin es privado.

## Instalación
```
claude plugin marketplace add https://github.com/noobpingui/sdd-beto.git
claude plugin install sdd-beto@sdd-beto
```
Usa la URL HTTPS completa: el formato corto `noobpingui/sdd-beto` puede intentar SSH. El plugin queda instalado para tu usuario, pero **en un proyecto sin `.sdd/config.json` no hace nada**.

## Inicio rápido
En la raíz del proyecto, dentro de Claude Code:

1. **`/sdd-beto:init`**: analiza el repo y te propone, paso a paso y con tu aprobación, la config, la constitución del proyecto y las secciones de `CLAUDE.md`. Termina con un commit en una rama `chore/sdd-init`.
2. **`/sdd-beto:new <slug> <idea>`**: crea la feature (número, rama y carpeta). Por ejemplo: `/sdd-beto:new export-csv Exportar el informe mensual a CSV`.
3. **`/sdd-beto:run`**: recorre el flujo etapa a etapa. Al final de cada una verás qué se hizo, qué debes revisar y el commit propuesto; responde "aprobado" para seguir.

La [guía de uso](docs/guia.md) explica cada paso con detalle.

## Comandos
| Comando | Qué hace |
|---|---|
| `/sdd-beto:init [notas]` | Adopta el flujo en el repo o lo actualiza (idempotente) |
| `/sdd-beto:new <slug> <idea>` | Crea una feature: rama `feat/NNN-slug` y carpeta `<specs>/NNN-slug/` |
| `/sdd-beto:run [NNN-slug]` | Ejecuta la siguiente etapa y encadena las demás, con un gate en cada una |
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

- **Artefactos:** cada feature vive en `<specs>/NNN-slug/` (`idea.md`, `spec.md`, `plan.md`, `tasks.md`, `verify-report.md`, `review.md`, `docs-report.md` y `state.json`). `state.json` es la única fuente de verdad del estado y solo lo cambia la CLI `sdd-state` del plugin.
- **Constitución:** una parte base, igual para todos los proyectos, y una Parte II propia de cada proyecto (`.sdd/constitution.md`), que solo puede endurecer la base.
- **Hooks:** `role-guard` (cada agente escribe solo en sus rutas y en su etapa), `stage-guard` (no se edita producción sin spec y plan aprobados) y `git-guard` (los subagentes solo usan git de lectura).
- **Modelos:** se pueden cambiar por proyecto con `models` en `.sdd/config.json`.

## Actualizar y desinstalar
```
claude plugin marketplace update sdd-beto
claude plugin update sdd-beto@sdd-beto
claude plugin uninstall sdd-beto@sdd-beto
```
Después de actualizar, reejecuta `/sdd-beto:init` en cada proyecto: entra en modo actualización, propone solo lo que cambió y, si usas permisos locales, los apunta a la versión nueva.

## Documentación
- [Guía de uso](docs/guia.md): adopción, una feature de principio a fin, gates, correcciones y solución de problemas.
- [Decisiones de diseño (ADRs)](docs/decisions/README.md).
- [Informe de la prueba en seco](docs/06-prueba-en-seco.md): el flujo completo ejecutado con un modelo real.

## Desarrollo del plugin
- Estructura: la raíz es el marketplace y el plugin vive en `plugins/sdd-beto/` (ADR-0014).
- Tests de los scripts: `node --test plugins/sdd-beto/scripts/test/`
- Validación: `claude plugin validate ./plugins/sdd-beto` y `claude plugin validate .`
- Probar sin instalar: `claude --plugin-dir ./plugins/sdd-beto` en un proyecto de prueba.
- Prueba en seco reproducible: `node tests/fixtures/dryrun/make-dryrun.mjs <destino>` (ver el informe).
