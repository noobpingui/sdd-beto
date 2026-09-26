# ADR-0027 — Criterio para publicar la 1.0.0

- **Estado:** Aceptada · 2026-09-26
- **Decidido por:** usuario (plan de la Fase 8)
- **Sustituye:** el criterio de la 1.0.0 de la ADR-0015 ("cuando un proyecto real haya migrado sin perder funcionalidad (Fase 7)")

## Contexto
La ADR-0015 ataba la 1.0.0 a la Fase 7: migrar al plugin el proyecto del que salió el harness. El usuario sacó esa fase de la hoja de ruta de `sdd-beto`. El plugin y ese proyecto son independientes, y la adopción se hará desde el propio proyecto, cuando vuelva a trabajarse en él. Sin la Fase 7, el criterio de la ADR-0015 no se cumpliría nunca desde este repo.

La prueba en seco (Fase 6) demostró el flujo completo con un modelo real, pero en un proyecto inventado, en modo headless y con el plugin cargado con `--plugin-dir`.

## Decisión
- Al cerrar la Fase 8 se publica la **0.1.0**, con su tag `sdd-beto--v0.1.0` y su changelog.
- La **1.0.0** se publica cuando **un proyecto real**, cualquiera, complete **una feature de principio a fin** con el plugin **instalado desde el marketplace** y en una sesión interactiva, y los hallazgos graves que salgan de ese uso estén resueltos.
- Entre medias, las versiones `0.x` pueden incluir cambios incompatibles; el changelog los marca como tales.
- El resto de la ADR-0015 no cambia: semver en `plugin.json`, tags `sdd-beto--v<versión>`, *Keep a Changelog* y la definición de cambio mayor.

## Consecuencias
- (+) El criterio no depende de un proyecto concreto ni de la hoja de ruta de este repo.
- (+) La 1.0.0 promete estabilidad solo después de un uso real que cubra lo que la prueba en seco no cubrió: instalación publicada, avisos de permiso reales y un proyecto con su propia historia.
- (−) La fecha de la 1.0.0 depende de cuándo se use el plugin en un proyecto real.
