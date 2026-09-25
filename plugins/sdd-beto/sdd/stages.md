# Etapas del flujo SDD

Orden: `spec → plan → tasks → tests → implement → verify → review → docs → close → done`. Cada etapa termina en un gate humano (`protocol.md` §3). Las precondiciones las comprueba `sdd-state check <etapa>`.

| Etapa | Agente(s) (`sdd-beto:…`) | Precondición | Produce | Commit (si se aprueba) |
|---|---|---|---|---|
| `spec` | `spec-writer` | existe `idea.md` | `spec.md` | `Add spec for NNN-slug` |
| `plan` | `planner` | spec aprobada | `plan.md` (+ ADRs en `paths.adr`) | `Add plan for NNN-slug` |
| `tasks` | `task-breaker` | plan aprobado | `tasks.md` | `Add tasks for NNN-slug` |
| `tests` | `implementer` (modo `scaffold`, solo si hay tareas `(scaffold)`) → `test-author` → `verifier` (modo `red`) | tasks aprobadas | esqueletos, tests, casillas de `tasks.md`, `verify-report.md` (red) | `Add failing tests for NNN-slug` |
| `implement` | `implementer` | tests aprobados **y** red check `PASS` | código de producción, casillas de `tasks.md` | `Implement NNN-slug` |
| `verify` | `verifier` (modo `full`) | implement aprobado | `verify-report.md` (full) | — (entra en el commit de review) |
| `review` | `reviewer` | verify aprobado **y** `PASS` | `review.md` | `Add review for NNN-slug` |
| `docs` | `doc-keeper` | review aprobada **y** `APPROVED` | documentación actualizada, `docs-report.md` | `Update docs for NNN-slug` |
| `close` | orquestador | docs aprobados | checklist de "hecho", PR o merge, push | `Close NNN-slug` (solo `state.json`) |

- Comando de cada etapa: `/sdd-beto:spec`, `/sdd-beto:plan`, `/sdd-beto:tasks`, `/sdd-beto:test` (etapa `tests`), `/sdd-beto:implement`, `/sdd-beto:verify`, `/sdd-beto:review`, `/sdd-beto:docs` y `/sdd-beto:close`. `/sdd-beto:run` las encadena, con un gate entre cada una.
- En las correcciones, los commits usan `Fix <qué> for NNN-slug (iteration N)`.
- Los mensajes siguen `commits` de la config (por defecto, inglés en imperativo sin prefijos convencionales) y terminan con la línea `Co-Authored-By` indicada por el entorno.

## Notas por etapa
Las aplican tanto `/sdd-beto:run` como la skill de cada etapa.

- **spec:** delega en `sdd-beto:spec-writer`. Si devuelve `NEEDS_INPUT`, muestra las preguntas con su respuesta propuesta, copia las respuestas literalmente en la tabla de `spec.md` y vuelve a delegar. **La spec no se aprueba con preguntas abiertas.**
- **plan:** delega en `sdd-beto:planner`. Si devuelve `NEEDS_INPUT` porque la spec es inviable o contradictoria, muéstralo: puede implicar reabrir la spec (`sdd-state rework spec`), con aprobación del usuario.
- **tasks:** delega en `sdd-beto:task-breaker`. En el gate, muestra la matriz de cobertura REQ/AC → tareas.
- **tests:** tres pasos, cada uno anotado con `sdd-state event tests started --note "Paso n/3: …"`:
  1. si `tasks.md` tiene tareas `(scaffold)` (búscalas con Grep), `sdd-beto:implementer` con **Modo: scaffold**; si no, sáltalo y dilo;
  2. `sdd-beto:test-author`;
  3. `sdd-beto:verifier` con **Modo: red** (registra `red_check` con la CLI).

  Si el red check da `FAIL`, reparte según `verify-report.md` (protocolo §5). Si da `BLOCKED` por entorno, pide al usuario que lo resuelva (`env_hint`). **El gate solo se presenta con el red check en `PASS`** o escalando al llegar al límite. Al aprobar: `sdd-state snapshot` **antes** de `approve`.
- **implement:** delega en `sdd-beto:implementer`. Si devuelve `NEEDS_INPUT` porque cree que un test es incorrecto, **no** le permitas cambiarlo: muestra el caso al usuario y, si procede, devuélvelo al `test-author` (`sdd-state rework tests --counter tests`).
- **verify:** delega en `sdd-beto:verifier` con **Modo: full**. Si da `FAIL`, reparte según `verify-report.md` (protocolo §5). Si da `BLOCKED (entorno)`, pide al usuario que lo resuelva y **no** lo hagas tú. En el gate, destaca los AC marcados como "manual". Esta etapa no tiene commit propio: sus archivos entran en el de review.
- **review:** delega en `sdd-beto:reviewer` y registra el veredicto (`sdd-state review-verdict`). Si es `CHANGES_REQUESTED`, reparte los hallazgos BLOQUEANTE y MAYOR por responsable (protocolo §5); después, `verify` en modo full y `review` de nuevo. En el gate, pregunta qué hacer con los hallazgos MENOR y NIT. El commit incluye `verify-report.md` y `review.md`.
- **docs:** delega en `sdd-beto:doc-keeper`. Si no hubo cambios de documentación, el commit incluye solo `docs-report.md` y `state.json`.
- **close:** la ejecutas tú, según la sección "Etapa `close`" más abajo. Lee las dos partes de la constitución.

## Qué debe revisar el usuario en cada gate
| Etapa | Revisa sobre todo |
|---|---|
| `spec` | ¿Es lo que quieres? ¿Falta algún caso límite o error? ¿Cada AC es comprobable? ¿Está claro lo que queda fuera de alcance? |
| `plan` | ¿Encaja con la arquitectura (Parte II de la constitución)? ¿Hay migración? ¿Riesgos razonables? ¿Reutiliza lo existente? ¿Algún ADR nuevo? |
| `tasks` | ¿Cada AC tiene una tarea de test? ¿Tareas pequeñas y en orden lógico? ¿Nada fuera del plan? Muestra la matriz de cobertura |
| `tests` | ¿Los tests prueban los AC (lee 2 o 3)? ¿El red check es legítimo? ¿Se aíslan las dependencias como pide la Parte II? ¿Los esqueletos solo tienen firmas que lanzan "not implemented"? |
| `implement` | ¿El diff se limita a lo planeado? ¿Tests en verde según el implementer? |
| `verify` | ¿Todo en verde? ¿Trazabilidad completa? ¿Hay AC "manuales" que debas probar tú? |
| `review` | Veredicto y hallazgos MENOR/NIT: ¿se corrigen ahora (rework) o se aceptan / se crea una tarea futura? |
| `docs` | ¿La documentación describe bien el cambio? ¿Hay valores reales en algún `.env.example`? |
| `close` | Checklist de "hecho" (constitución, Art. B7 y P4) y modo de integración |

## Etapa `close`: la ejecuta el orquestador
1. `sdd-state start close`. Recorre la **definición de "hecho"** (Art. B7 de la base y P4 del proyecto) y muestra cada punto con ✅ o ❌, con la evidencia (artefacto, resultado de `sdd-state show`, `sdd-state validate --git`). Si hay algún ❌, detente.
2. `sdd-state gate close` y presenta el gate con el commit `Close NNN-slug`.
3. Con la aprobación: `sdd-state approve close --note "…"` (queda `stage` y `status` en `done`), y commit de `state.json`. Así el estado final queda versionado en la rama.
4. Propón la integración y **pregunta cuál prefiere el usuario**:
   - **(a) PR (recomendado):** push de la rama y `gh pr create --base <base_branch>` con la spec enlazada;
   - **(b) merge local:** `git checkout <base_branch> && git merge --no-ff <rama>`, y después push de `<base_branch>`.
5. Cada push se aprueba por separado. El push y el PR o merge no se anotan en `state.json` (ya está commiteado como `done`): se informan en el chat con el enlace al PR o el sha del merge.
