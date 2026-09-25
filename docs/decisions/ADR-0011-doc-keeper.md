# ADR-0011 — Agente `doc-keeper` y etapa `docs`

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario

## Contexto
Al terminar una feature suele quedar documentación desactualizada: README, `.env.example` con variables nuevas o `docs/`. Ninguno de los otros roles se encarga de ella.

## Decisión
- Agente `doc-keeper` y etapa `docs` **entre `review` y `close`**, con su propio gate.
- **Entradas:** `spec.md`, `plan.md`, `review.md` y el diff de la rama respecto a `base_branch`.
- **Rutas de escritura:** las de `paths.docs` de la config (por defecto `README.md` y `docs/**`), los `paths.env_examples`, la sección Proyecto de `CLAUDE.md` (ADR-0013) y `<feature>/docs-report.md`. Nunca `paths.adr`, código, tests, artefactos SDD ni la constitución.
- Si no hay nada que actualizar, `docs-report.md` lo indica con su motivo.
- **Codificación:** comprueba la de cada archivo antes y después de editarlo; si no es UTF-8, no lo edita y lo reporta.
- Respeta el idioma de cada archivo, que puede no coincidir con `language`.

## Consecuencias
- (+) La documentación queda sincronizada con cada feature, y la definición de "hecho" lo exige.
- (−) Una etapa y una pausa más por feature.
