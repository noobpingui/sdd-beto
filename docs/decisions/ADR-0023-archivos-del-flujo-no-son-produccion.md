# ADR-0023 — Los archivos del flujo SDD nunca son producción ni test

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario (Fase 5), a propuesta de Claude
- **Matiza:** ADR-0016 (clasificación de una ruta)

## Contexto
La clasificación de la ADR-0016 depende solo de los globs de la config. En un repo de un solo paquete, lo natural es `"prod": ["**"]`, y entonces pasan a ser **producción**:
- `.sdd/config.json`, `.sdd/constitution.md` y `.sdd/templates/**`;
- `CLAUDE.md` y `.claude/settings.json`;
- `paths.specs/**` (artefactos y `state.json`) y `paths.adr/**`.

Consecuencias: el stage-guard impide que la sesión principal edite la configuración SDD fuera de una feature, el `planner` no puede escribir ADRs (su rol no escribe producción) y el `doc-keeper` pierde `CLAUDE.md`. Un aviso de `init` no basta: la config se puede editar a mano después.

## Decisión
Antes de aplicar los globs, `classify` trata como **"ni producción ni test"** (`other`):
- todo lo que cuelga de `.sdd/` y `.claude/` en la raíz;
- cualquier `CLAUDE.md`, `CLAUDE.local.md` o `AGENTS.md`, a cualquier nivel;
- `paths.specs` y `paths.adr`, con todo su contenido.

La exclusión se hace por segmentos de ruta completos: `specs/` queda excluida, `specsheet/` no.

Los permisos de cada rol no cambian: siguen decidiéndolos `sdd-guard` y su tabla de rutas. Esta regla solo evita que un glob amplio convierta los archivos del flujo en código protegido.

## Consecuencias
- (+) `"prod": ["**"]` es una config válida y segura para repos sencillos.
- (+) Una config editada a mano no puede bloquear el propio flujo.
- (−) Un proyecto no puede declarar como producción una carpeta que coincida con `paths.specs` o `paths.adr`. Si la necesita, tiene que cambiar esas rutas.
- (−) Un `CLAUDE.md` dentro de una carpeta de producción queda fuera del stage-guard. Es aceptable: son instrucciones para Claude, no código.
