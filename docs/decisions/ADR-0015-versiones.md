# ADR-0015 — Versiones: semver fijado en `plugin.json`, con tags y changelog

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario (P2 de `docs/00-discovery.md`)
- **Documentación consultada:** `plugins/loading` → *Versions and updates*, `plugins/host-marketplace` (Claude Code v2.1.282)

## Contexto
- Si `plugin.json` fija `version`, los usuarios se quedan en su copia hasta que esa cadena cambie. Sin `version`, cada commit es una actualización.
- No se debe fijar `version` a la vez en `plugin.json` y en la entrada del marketplace.
- El auto-update está desactivado por defecto en marketplaces de terceros.
- Un flujo con gates y artefactos versionados en cada proyecto no debe cambiar de comportamiento sin que el usuario lo decida.

## Decisión
- **`version` semver solo en `plugin.json`**, subida a mano en cada release.
- **Tag por release:** `sdd-beto--v<versión>` (la convención que la doc usa para resolver dependencias entre plugins).
- **`CHANGELOG.md`** en formato *Keep a Changelog*.
- **Qué es un cambio mayor:** un cambio incompatible en el esquema de `.sdd/config.json` o de `state.json`, en las rutas o nombres de comandos y agentes, o en el significado de un artículo de la constitución base. Cada esquema lleva `schema_version`; si sube, el changelog explica la migración y `/sdd-beto:init` la propone.
- **Versión inicial `0.1.0`.** Se publica `1.0.0` cuando un proyecto real haya migrado sin perder funcionalidad (Fase 7).
- **Durante el desarrollo** no se sube versión en cada commit: se prueba con el plugin cargado en sitio.

## Consecuencias
- (+) Los proyectos solo cambian cuando se publica una versión, y el changelog dice qué cambió.
- (−) Hay que acordarse de subir la versión; un commit sin subida no llega a los usuarios. Se añadirá a la checklist de release (Fase 8).
