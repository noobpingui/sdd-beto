# ADR-0013 — `CLAUDE.md` del proyecto con sección Proyecto mantenida por el `doc-keeper`

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario

## Contexto
`CLAUDE.md` es lo único que Claude Code carga automáticamente en cada sesión, principal y subagentes. Sin una descripción del proyecto (áreas, arquitectura, comandos, despliegue, puntos delicados), cada sesión la deduce leyendo código, con coste y riesgo de error. Esa descripción se queda desactualizada con cada feature. Un `CLAUDE.md` dentro del plugin **no** se carga.

## Decisión
- `/sdd-beto:init` añade al `CLAUDE.md` del proyecto (lo crea si no existe) cuatro secciones, delimitadas con comentarios HTML `<!-- sdd-beto:<sección>:start -->` / `:end -->`:
  1. **Proyecto:** qué es, áreas, arquitectura, comandos, despliegue y puntos delicados. `init` propone un borrador a partir del análisis del repo.
  2. **SDD:** el flujo y los comandos `/sdd-beto:*`.
  3. **Aprobación humana.**
  4. **Convenciones.**

  El contenido previo del usuario fuera de esas marcas no se toca.
- El `doc-keeper` puede editar **solo la sección Proyecto**, en la etapa `docs` y cuando la feature lo haga necesario.
- Las demás secciones solo cambian con una ADR del proyecto o al reejecutar `init`.

## Consecuencias
- (+) Cada sesión arranca con el contexto del proyecto, al día con cada feature.
- (+) Las marcas permiten que `init` actualice sus secciones sin pisar el resto, y preparan un futuro hook que proteja las secciones.
- (−) En la v1, que el `doc-keeper` respete la sección depende de su prompt y de la revisión del usuario en el gate de `docs`: el hook permite el archivo completo.
