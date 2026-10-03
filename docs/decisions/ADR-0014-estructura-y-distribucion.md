# ADR-0014 — Estructura del repositorio y distribución como marketplace

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario (P1 de `docs/00-discovery.md`)
- **Matizada por:** ADR-0022 (uso personal y repo privado), sustituida por la ADR-0028 (repo público con licencia MIT)
- **Documentación consultada:** `plugins-reference`, `plugins/components`, `plugin-marketplaces`, `discover-plugins` (Claude Code v2.1.282)

## Contexto
- Un marketplace es un repo con `.claude-plugin/marketplace.json`. Cada entrada apunta a un plugin, que puede estar en un subdirectorio del mismo repo (`"source": "./plugins/<nombre>"`).
- Todo lo que está bajo la raíz del plugin se instala en cada proyecto. Un `CLAUDE.md` en la raíz de un plugin no se carga y `claude plugin validate` lo marca como warning.
- Las subcarpetas de `agents/` forman parte del nombre del agente (`agents/x/y.md` → `sdd-beto:x:y`).

## Decisión
```
sdd-beto/                          raíz del repo = marketplace "sdd-beto"
├── .claude-plugin/marketplace.json
├── plugins/sdd-beto/              raíz del plugin = ${CLAUDE_PLUGIN_ROOT}
│   ├── .claude-plugin/plugin.json
│   ├── skills/<nombre>/SKILL.md   init, new, run, status, spec, plan, tasks, test, implement, verify, review, docs, close
│   ├── agents/*.md                8 agentes, planos (sin subcarpetas)
│   ├── hooks/hooks.json
│   ├── scripts/                   sdd-guard.mjs, lint-ratchet.mjs, sdd-state.mjs, lib/ y sus tests
│   ├── sdd/                       protocol.md, stages.md
│   ├── templates/                 artefactos por feature, config.json, secciones de CLAUDE.md
│   └── constitution/              base.md + plantilla de la parte del proyecto
├── docs/                          desarrollo del plugin: discovery, decisions/ (no se instala)
├── tests/fixtures/                proyectos de prueba neutrales (Fase 6)
├── CLAUDE.md                      reglas para trabajar en este repo (no se instala)
└── README.md (inglés), README.es.md, CHANGELOG.md, LICENSE (MIT, con una copia en plugins/sdd-beto/: ADR-0028)
```
- **Nombres:** marketplace `sdd-beto`, plugin `sdd-beto` (mismo `name` en la entrada y en `plugin.json`, como exige la doc). Instalación: ver ADR-0028 (repo público, URL HTTPS).
- **Skills sin prefijo `sdd-`** en el directorio (`skills/run/`), porque el namespace ya lo aporta el plugin: `/sdd-beto:run`. La documentación usa siempre el nombre completo, porque `/init` y `/status` chocan con comandos integrados.
- **Desarrollo local:** `claude --plugin-dir ./plugins/sdd-beto` o el marketplace añadido como directorio local (carga en sitio; `/reload-plugins` aplica cambios).

## Consecuencias
- (+) La documentación y los tests de desarrollo no llegan a los proyectos consumidores.
- (+) Deja sitio para más plugins en el mismo marketplace.
- (−) Una ruta más de profundidad; hay que acordarse de que la raíz del plugin no es la del repo.
