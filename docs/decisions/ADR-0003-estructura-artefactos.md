# ADR-0003 — Artefactos por feature y `state.json` como única fuente de verdad

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** Claude (sin compromisos relevantes)

## Contexto
Los agentes se comunican solo por disco, así que cada feature necesita un lugar fijo y predecible para sus artefactos y su estado. Esos artefactos pertenecen al proyecto, no al plugin.

## Decisión
En el repositorio del proyecto, bajo `paths.specs` de `.sdd/config.json` (por defecto `specs/`):

```
<specs>/NNN-slug/          una carpeta por feature; NNN correlativo de 3 dígitos desde 001
  idea.md                  orquestador: la idea original del usuario, literal
  spec.md                  spec-writer
  plan.md                  planner
  tasks.md                 task-breaker (el test-author y el implementer solo marcan casillas)
  verify-report.md         verifier (se sobrescribe en cada ejecución)
  review.md                reviewer
  docs-report.md           doc-keeper
  state.json               etapa, aprobaciones, commits, iteraciones, rama, base e historial
```

- **`state.json` es la única fuente de verdad del flujo.** Solo lo escriben el orquestador y el `verifier` (secciones `red_check` y `verify`). Lleva `schema_version`.
- **Trazabilidad:** `REQ-001` → `AC-001.1` (spec) → `T-003 [REQ-001, AC-001.1]` (tasks) → marcador `SDD: REQ-001 AC-001.1` en el comentario de línea anterior al test, con la sintaxis de comentario del lenguaje.
- **Vínculo rama ↔ feature:** `<prefijo>/NNN-slug` (ADR-0007) → `<specs>/NNN-slug/`.
- Las ADRs que genere una feature van en `paths.adr` del proyecto.
- Las plantillas de estos artefactos vienen del plugin y el proyecto puede sobrescribirlas (ADR-0017).

## Consecuencias
- (+) `/sdd-beto:status` y cualquier sesión nueva retoman el trabajo leyendo solo el disco.
- (+) Los hooks deciden qué se permite según `state.json`.
- (−) Un `state.json` editado a mano puede bloquear el flujo. Se mitiga con la CLI `sdd-state` (ADR-0021) y con los chequeos de `/sdd-beto:status`.
