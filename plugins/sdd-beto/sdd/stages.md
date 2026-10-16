# Etapas del flujo SDD

Orden: `spec → plan → tasks → tests → implement → verify → review → docs → close → done`. Qué etapas terminan en un gate humano lo decide `gate_mode` (`protocol.md` §0.1): en `flow`, solo `spec`, `review` y `close`; en `strict`, todas. Las precondiciones las comprueba `sdd-state check <etapa>`.

| Etapa | Agente(s) (`sdd-beto:…`) | Precondición | Produce | Commit | Gate en `flow` |
|---|---|---|---|---|---|
| `spec` | `spec-writer` | existe `idea.md` | `spec.md` | `Add spec for NNN-slug` | sí |
| `plan` | `planner` | spec aprobada | `plan.md` (+ ADRs en `paths.adr`) | `Add plan for NNN-slug` | no |
| `tasks` | `task-breaker` | plan aprobado | `tasks.md` | `Add tasks for NNN-slug` | no |
| `tests` | `implementer` (modo `scaffold`, solo si hay tareas `(scaffold)`) → `test-author` → `verifier` (modo `red`) | tasks aprobadas | esqueletos, tests, casillas de `tasks.md`, `verify-report.md` (red) | `Add failing tests for NNN-slug` | no |
| `implement` | `implementer` | tests aprobados **y** red check `PASS` | código de producción, casillas de `tasks.md` | `Implement NNN-slug` | no |
| `verify` | `verifier` (modo `full`) | implement aprobado | `verify-report.md` (full) | — (entra en el commit de review) | no |
| `review` | `reviewer` | verify aprobado **y** `PASS` | `review.md` | `Add review for NNN-slug` | sí |
| `docs` | `doc-keeper` | review aprobada **y** `APPROVED` | documentación actualizada, `docs-report.md` | `Update docs for NNN-slug` | no |
| `close` | orquestador | docs aprobados | checklist de "hecho", backlog global, PR y merge, push | `Close NNN-slug` (`state.json` y `paths.backlog`) | sí |

- Comando de cada etapa: `/sdd-beto:spec`, `/sdd-beto:plan`, `/sdd-beto:tasks`, `/sdd-beto:test` (etapa `tests`), `/sdd-beto:implement`, `/sdd-beto:verify`, `/sdd-beto:review`, `/sdd-beto:docs` y `/sdd-beto:close`. `/sdd-beto:run` las encadena y se detiene en los gates del modo y en las decisiones mayores.
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

  Si el red check da `FAIL`, reparte según `verify-report.md` (protocolo §5). Si da `BLOCKED` por entorno, pide al usuario que lo resuelva (`env_hint`). **La etapa solo se cierra (con gate o con avance automático) con el red check en `PASS`**, o se escala al llegar al límite. Al aprobar: `sdd-state snapshot` **antes** de `approve`.
- **implement:** delega en `sdd-beto:implementer`. Si devuelve `NEEDS_INPUT` porque cree que un test es incorrecto, **no** le permitas cambiarlo: muestra el caso al usuario (también en `flow`: un test incorrecto pone en duda la spec, así que es una decisión mayor) y, si procede, devuélvelo al `test-author` (`sdd-state rework tests --counter tests`).
- **verify:** delega en `sdd-beto:verifier` con **Modo: full**. Si da `FAIL`, reparte según `verify-report.md` (protocolo §5). Si da `BLOCKED (entorno)`, pide al usuario que lo resuelva y **no** lo hagas tú. Destaca los AC marcados como "manual" en el gate (en `flow`, en el de review). Esta etapa no tiene commit propio: sus archivos entran en el de review.
- **review:** delega en `sdd-beto:reviewer` y registra el veredicto (`sdd-state review-verdict`). Si es `CHANGES_REQUESTED`, reparte los hallazgos BLOQUEANTE y MAYOR por responsable (protocolo §5); después, `verify` en modo full y `review` de nuevo. Con los hallazgos MENOR y NIT: en `strict`, pregunta en el gate qué hacer; en `flow`, cópialos al backlog de la feature (protocolo §0.1) y preséntalos en el gate de review (protocolo §3.2). El commit incluye `verify-report.md` y `review.md`.
- **docs:** delega en `sdd-beto:doc-keeper`. Si no hubo cambios de documentación, el commit incluye solo `docs-report.md` y `state.json`.
- **close:** la ejecutas tú, según la sección "Etapa `close`" más abajo. Lee las dos partes de la constitución.

## Qué debe revisar el usuario en cada gate
En `strict`, cada fila es un gate. En `flow`, los puntos de `plan` a `verify` se resumen en el gate de `review` (protocolo §3.2), y los de `docs`, en el de `close`.

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
2. **Backlog global:** añade al final de `paths.backlog` (créalo con un título `# Backlog` si no existe) los puntos que sigan abiertos (`- [ ]`) en `<specs>/NNN-slug/backlog.md`, bajo un encabezado `## NNN-slug · <título> (<fecha de sdd-state now>)` con un enlace a la carpeta de la feature. Si no queda ninguno, no lo toques.
3. `sdd-state gate close` y presenta el gate según el modo.

### `close` en `flow`: una sola aprobación para toda la integración
Antes del gate, reúne los datos: `git log --oneline <base_branch>..HEAD`, si existe el remoto `origin` y si `gh` está disponible (`gh auth status`). Si falta alguno, dilo en el gate y propón la alternativa (merge local, o que el usuario ejecute los pasos), sin intentarlo por otra vía.

```markdown
## Cierre · feature NNN-slug
**Definición de "hecho":** <checklist con ✅>
**Docs:** <qué cambió el doc-keeper, de docs-report.md>
**Backlog que pasa a `<paths.backlog>`:** <n puntos, o "ninguno">

### Integración propuesta
1. Commit `Close NNN-slug`: <archivos (`git status --short`)>
2. Push: <rama> → origin/<rama>, con estos commits: <git log --oneline <base_branch>..HEAD>
3. PR: `gh pr create --base <base_branch>`, título "<título>" y cuerpo <resumen + enlace a spec.md>
4. Merge: `gh pr merge --merge --delete-branch` (merge commit; borra la rama remota y la local)
5. Vuelta a la base: `git checkout <base_branch>` y `git pull`

---
¿Apruebas cerrar la feature y ejecutar los 5 pasos?
```

Con la aprobación:
1. `sdd-state approve close --note "<texto literal>"` (queda `stage` y `status` en `done`) y el commit `Close NNN-slug` (protocolo §4).
2. `git push -u origin <rama>`.
3. `gh pr create --base <base_branch> --head <rama> --title "…" --body "…"` (cuerpo con heredoc). Guarda la URL.
4. `gh pr merge <url> --merge --delete-branch`.
5. `git checkout <base_branch>` y `git pull`, si el paso 4 no lo dejó ya así.

Ejecuta los pasos en orden y **detente en el primero que falle**: explica qué pasó, qué quedó hecho y qué falta, y espera al usuario. No repitas un paso fallido de otra forma ni uses `--force`. Al terminar, informa del enlace al PR y del sha del merge. Ni el push ni el PR ni el merge se anotan en `state.json`, que ya está commiteado como `done`.

### `close` en `strict`
1. Presenta el gate (protocolo §3) con el commit `Close NNN-slug`.
2. Con la aprobación: `sdd-state approve close --note "…"` (queda `stage` y `status` en `done`) y commit de `state.json` y del backlog global. Así el estado final queda versionado en la rama.
3. Propón la integración y **pregunta cuál prefiere el usuario**:
   - **(a) PR (recomendado):** push de la rama y `gh pr create --base <base_branch>` con la spec enlazada;
   - **(b) merge local:** `git checkout <base_branch> && git merge --no-ff <rama>`, y después push de `<base_branch>`.
4. Cada push se aprueba por separado. El push y el PR o merge no se anotan en `state.json` (ya está commiteado como `done`): se informan en el chat con el enlace al PR o el sha del merge.
