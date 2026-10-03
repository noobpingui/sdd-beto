# Decisiones (ADRs) de sdd-beto

Formato breve: estado, quién decidió, contexto, decisión y consecuencias. Las ADRs que tocan la integración con Claude Code indican qué páginas de la documentación oficial se consultaron y con qué versión.

Estas ADRs son del **plugin**. Las decisiones de cada proyecto consumidor van en su propio `paths.adr`.

## Flujo SDD

| ADR | Decisión |
|---|---|
| [0001](ADR-0001-orquestacion.md) | Orquestador en la sesión principal, sin anidamiento de subagentes; `init` propone limitar la profundidad |
| [0002](ADR-0002-formato-requisitos.md) | Requisitos híbridos: historia de usuario, REQ en EARS y AC en Given/When/Then |
| [0003](ADR-0003-estructura-artefactos.md) | `<specs>/NNN-slug/` con sus artefactos y `state.json` como única fuente de verdad |
| [0004](ADR-0004-gates-humanos.md) | Gate humano en cada etapa; `max_iterations` (3) antes de escalar |
| [0005](ADR-0005-tdd-estricto.md) | TDD estricto con comprobación del rojo y `tests_snapshot` |
| [0006](ADR-0006-modelos-por-agente.md) | opus: spec, plan y review · sonnet: tasks, tests, impl y docs · haiku: verifier; sobrescribible por proyecto |
| [0007](ADR-0007-integracion-git.md) | Rama por feature y un commit por etapa, solo desde el orquestador |
| [0008](ADR-0008-enforcement-hooks.md) | Hooks del plugin: `role-guard` con nombres `sdd-beto:*`, `stage-guard` y `git-guard` (en parte sustituida por la 0025) |
| [0009](ADR-0009-ratchet-lint.md) | Lint con ratchet genérico: solo cuentan las violaciones nuevas, con adaptadores por formato |
| [0010](ADR-0010-harness-propio.md) | Harness propio con ideas de Spec Kit y Kiro |
| [0011](ADR-0011-doc-keeper.md) | Agente `doc-keeper` y etapa `docs` entre review y close |
| [0012](ADR-0012-scaffold.md) | Esqueletos (`implementer` en modo scaffold) antes del red check |
| [0013](ADR-0013-claude-md-proyecto.md) | Secciones delimitadas en el `CLAUDE.md` del proyecto; el `doc-keeper` mantiene la sección Proyecto |

## Plugin

| ADR | Decisión |
|---|---|
| [0014](ADR-0014-estructura-y-distribucion.md) | Repo = marketplace; plugin en `plugins/sdd-beto/` |
| [0015](ADR-0015-versiones.md) | Semver fijado en `plugin.json`, tags `sdd-beto--v*` y changelog (criterio de la 1.0.0 sustituido por la 0027) |
| [0016](ADR-0016-config-proyecto.md) | `.sdd/config.json`: ámbitos con globs y comandos, rutas y modelos |
| [0017](ADR-0017-constitucion-y-plantillas.md) | Constitución base (B1–B7) + parte del proyecto (P1–P4); plantillas sobrescribibles |
| [0018](ADR-0018-init.md) | `/sdd-beto:init` guiado, con un gate por paso e idempotente |
| [0019](ADR-0019-idioma.md) | Prompts en español; artefactos en el `language` de la config |
| [0020](ADR-0020-plataforma.md) | Node ≥ 20 sin dependencias, hooks en forma exec, globs propios, tolerancia a CRLF |
| [0021](ADR-0021-alcance-v1.md) | Alcance de la v1 (portado + `init` + CLI `sdd-state`) |
| [0022](ADR-0022-uso-personal.md) | Uso personal: repo privado, sin licencia, instalación por HTTPS (sustituida por la 0028) |
| [0023](ADR-0023-archivos-del-flujo-no-son-produccion.md) | `.sdd/`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `paths.specs` y `paths.adr` nunca son producción ni test |
| [0024](ADR-0024-implementacion-init.md) | `init`: la IA decide y `sdd-init.mjs` escribe; `CLAUDE.md` con marcas y `@AGENTS.md`; límite de profundidad sí, marketplace opcional |
| [0025](ADR-0025-git-guard-sin-ask.md) | El `git-guard` solo restringe a los subagentes; la sesión principal aprueba commits y pushes en el gate del chat |
| [0026](ADR-0026-permisos-locales.md) | `init` propone reglas `allow` en `.claude/settings.local.json` para leer el plugin y ejecutar sus CLIs sin avisos |
| [0027](ADR-0027-criterio-1-0.md) | 0.1.0 al cerrar la Fase 8; 1.0.0 cuando un proyecto real complete una feature con el plugin instalado |
| [0028](ADR-0028-repo-publico-mit.md) | Repo público con licencia MIT (`LICENSE` en la raíz y en el plugin, `license` en `plugin.json`); README en inglés (`README.md`) y en español (`README.es.md`) |
