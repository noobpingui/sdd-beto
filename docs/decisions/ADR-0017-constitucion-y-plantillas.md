# ADR-0017 — Constitución en dos partes y plantillas sobrescribibles

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario (P6 de `docs/00-discovery.md`) y Claude (separación de la constitución)

## Contexto
- La constitución mezcla reglas del flujo, que valen para cualquier proyecto (flujo, roles, aprobación, trazabilidad, TDD, git, "hecho"), con reglas propias de cada proyecto (convenciones de tests, arquitectura, seguridad).
- Las plantillas de `plan.md`, `tasks.md`, `review.md` y `verify-report.md` dependen del stack.
- Los agentes citan artículos por número; si cada proyecto renumerara la parte común, esas citas se romperían.

## Decisión
### Constitución
- **Parte I, base** (`${CLAUDE_PLUGIN_ROOT}/constitution/base.md`): la escribe el plugin, el proyecto no la edita y cambia solo con una versión del plugin (ADR-0015). Artículos con prefijo `B`:
  - B1 Flujo y excepciones · B2 Separación de roles · B3 Aprobación humana · B4 Trazabilidad · B5 TDD y esqueletos · B6 Git · B7 Definición de "hecho".
  - B7 es genérica: "pasan los comandos declarados (`test`, `lint`/`lint_ratchet`, `typecheck`, `build`) de cada ámbito tocado", más los puntos de proceso.
- **Parte II, proyecto** (`.sdd/constitution.md`): la propone `init` a partir del análisis del repo y la aprueba el usuario. Artículos con prefijo `P`, con esta estructura mínima:
  - P1 Convenciones de tests (dónde van, cómo se aíslan dependencias, forma concreta de los esqueletos, idioma de los nombres).
  - P2 Arquitectura y convenciones.
  - P3 Seguridad.
  - P4 Añadidos a la definición de "hecho" (opcional).
- Todos los agentes leen las dos partes. Si chocan, **gana la base**; la parte del proyecto solo puede endurecer, no relajar.
- Cambiar la Parte II requiere una ADR del proyecto.

### Plantillas
- Resolución **proyecto → plugin**: si existe `.sdd/templates/<nombre>`, se usa; si no, `${CLAUDE_PLUGIN_ROOT}/templates/<nombre>`.
- `init` no copia plantillas por defecto; el usuario las copia solo si quiere personalizarlas.
- Las plantillas del plugin son neutrales: secciones por ámbito genéricas, sin capas de ningún stack.

## Consecuencias
- (+) Las reglas del flujo son iguales en todos los proyectos y los números de artículo son estables.
- (+) Cada proyecto adapta lo que depende del stack sin bifurcar el plugin.
- (−) Una plantilla sobrescrita no recibe mejoras del plugin. `/sdd-beto:status` avisará cuando una plantilla del proyecto sea más antigua que la del plugin.
- (−) Una actualización del plugin puede cambiar la Parte I. Se mitiga con la versión fijada (ADR-0015) y listando esos cambios como mayores en el changelog.
