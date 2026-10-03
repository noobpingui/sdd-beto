# Changelog

Todos los cambios relevantes de `sdd-beto`. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [versionado semántico](https://semver.org/lang/es/) según la [ADR-0015](docs/decisions/ADR-0015-versiones.md). Mientras la versión sea `0.x`, puede haber cambios incompatibles; se marcan como tales. La 1.0.0 llegará con el criterio de la [ADR-0027](docs/decisions/ADR-0027-criterio-1-0.md).

## [Sin publicar]

### Cambiado
- **El repositorio es público y el plugin tiene licencia MIT** ([ADR-0028](docs/decisions/ADR-0028-repo-publico-mit.md), que sustituye a la ADR-0022): `LICENSE` en la raíz y en `plugins/sdd-beto/`, y `"license": "MIT"` en `plugin.json`. Instalar o actualizar ya no requiere credenciales de GitHub.
- **README en inglés:** `README.md` pasa a estar en inglés y el español se conserva íntegro en `README.es.md`; cada uno enlaza al otro.

## [0.1.0] - 2026-09-26

Primera versión. Porta a un plugin genérico un harness de Spec-Driven Development que se usaba dentro de un proyecto concreto: todo lo que dependía de ese proyecto pasa a `.sdd/config.json` y a la constitución de cada proyecto.

### Añadido
- **Flujo SDD** `spec → plan → tasks → tests → implement → verify → review → docs → close`, orquestado por la sesión principal, con un gate humano en cada etapa y en cada commit y push.
- **8 subagentes** con permisos separados y modelo por defecto: `spec-writer`, `planner` y `reviewer` (opus); `task-breaker`, `test-author`, `implementer` y `doc-keeper` (sonnet); `verifier` (haiku). Se pueden cambiar por proyecto con `models`.
- **13 comandos:** `/sdd-beto:init`, `new`, `run`, `status` y uno por etapa (`spec`, `plan`, `tasks`, `test`, `implement`, `verify`, `review`, `docs`, `close`).
- **`/sdd-beto:init`:** adopción guiada en 5 pasos con gates. Análisis del repo, config, constitución del proyecto, integración y commit. Es idempotente y tiene modo actualización. Se apoya en el ayudante `sdd-init.mjs`, que escribe los archivos sin tocar nada fuera de sus marcas.
- **Configuración por proyecto** (`.sdd/config.json`, con JSON Schema): ámbitos con globs de producción y de test y sus comandos, rutas, idioma, ramas, estilo de commits, iteraciones y modelos. Admite monorepos.
- **Constitución en dos partes:** la base del plugin (B1–B7) y la Parte II de cada proyecto (P1–P4), que solo puede endurecerla.
- **Hooks:** `role-guard` (cada agente, en sus rutas y en su etapa), `stage-guard` (no se edita producción sin spec y plan aprobados, salvo con `SDD_BYPASS=1`) y `git-guard` (los subagentes solo usan git de lectura). Los archivos del propio flujo nunca cuentan como producción.
- **CLI `sdd-state`** para `state.json`: transiciones, aprobaciones con el texto del usuario, iteraciones, snapshot de los tests, validación contra git y clasificación del repo.
- **Ratchet de lint genérico:** solo cuentan las violaciones nuevas, con adaptadores para ruff y eslint.
- **Permisos locales opcionales** (`.claude/settings.local.json`) para leer el plugin y ejecutar sus CLIs sin avisos.
- **Plantillas** de spec, plan, tareas, informes, review y secciones de `CLAUDE.md`, que cada proyecto puede sobrescribir en `.sdd/templates/`.
- **Documentación:** README, guía de uso, 27 ADRs, informe de la prueba en seco e ideas pendientes.
- **Prueba en seco reproducible:** un proyecto de prueba neutral y un arnés headless en `tests/fixtures/dryrun/`.

### Limitaciones conocidas
- El tipo `refactor` sigue el mismo flujo que una feature: un refactor puro no supera el red check (ver la [guía](docs/guia.md), §4).
- Solo se ha probado en Windows 11.
- El resto de mejoras previstas está en [docs/ideas.md](docs/ideas.md).

[Sin publicar]: https://github.com/noobpingui/sdd-beto/compare/sdd-beto--v0.1.0...HEAD
[0.1.0]: https://github.com/noobpingui/sdd-beto/releases/tag/sdd-beto--v0.1.0
