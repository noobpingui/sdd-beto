# ADR-0029 — Modo de gates configurable (`gate_mode`): flujo con tres pausas

- **Estado:** Aceptada · 2026-10-15
- **Decidido por:** usuario (pausas, commits automáticos, integración, criterio de decisión mayor, backlog y que sea configurable) y Claude (formato y mecánica)
- **Sustituye en parte:** ADR-0004 (gate en cada etapa; commit y push aprobados por separado) y ADR-0007 (cada commit tras aprobación; cierre con un push aprobado aparte)
- **Matiza:** ADR-0016 (dos campos nuevos en la config) y ADR-0025 (la aprobación del commit o push puede ser la de un gate que los agrupa)

## Contexto
Con la ADR-0004, una feature se detiene unas 9 veces y cada commit y cada push piden otra respuesta más. En la práctica, una feature pequeña con una corrección pasó por más de una decena de gates (`docs/ideas.md`, "Menos pausas"). La mayoría eran trámites: el usuario aprobaba artefactos mecánicos (tareas, red check, verify) cuya calidad ya vigilan los hooks, el verifier y el reviewer.

El usuario quiere que la línea de producción fluya. Su control debe concentrarse en tres puntos: **qué** se construye (spec), **qué salió** (review) y **qué se integra** (cierre). Entre esos puntos, el flujo solo debe pararse por decisiones mayores.

## Decisión

### 1. `gate_mode` en la config
- `.sdd/config.json` tiene un campo nuevo, `gate_mode`, con dos valores: `"flow"` (por defecto) o `"strict"`.
- `"strict"` mantiene exactamente el comportamiento de las ADR-0004 y 0007: un gate por etapa, y commits y pushes aprobados aparte.
- `/sdd-beto:init` propone `"flow"` y pregunta por él en el gate de la config.

### 2. Pausas en modo `flow`
| Etapa | ¿Se detiene? | Qué aprueba el usuario |
|---|---|---|
| `spec` | **Sí** (gate 1) | la spec. El commit `Add spec …` se hace solo al aprobarla |
| `plan`, `tasks`, `tests`, `implement`, `verify` | No, salvo por una decisión mayor (§4) | — |
| `review` | **Sí** (gate 2) | el veredicto, el resumen del orquestador, las ADRs nuevas y el backlog |
| `docs` | No | — (lo produce se muestra en el gate 3) |
| `close` | **Sí** (gate 3) | la definición de "hecho" y la integración completa (§5), con una sola aprobación |

- Las etapas sin pausa siguen pasando por `sdd-state gate` y `approve`, igual que siempre. El orquestador registra la aprobación con `--note "auto (gate_mode=flow): <resumen de una línea>"`. Así `state.json` distingue qué aprobó el usuario y qué avanzó solo, y los hooks (que exigen `spec` y `plan` aprobados para escribir producción) no cambian.
- Los ciclos de corrección (red check, verify, review `CHANGES_REQUESTED` por hallazgos BLOQUEANTE o MAYOR) corren sin pausa hasta `max_iterations`. Al llegar al límite se escala al usuario, como antes.
- En el gate de review, el usuario puede pedir que un punto del backlog se corrija ya. Eso es un `rework` normal, y después se vuelve a presentar el gate de review.

### 3. Commits en modo `flow`
- Se mantiene **un commit por etapa** (ADR-0007), con los mismos mensajes, pero **sin pedir aprobación**. Todos son locales, en la rama de la feature, y dejan un punto de retorno por etapa.
- Las salvaguardas del protocolo §4 no cambian: se comprueba la rama antes de cada commit, se añaden las rutas de forma explícita, se revisa que no haya secretos, y nunca se usan `-A`, `--no-verify` ni `--amend`.
- **No hay ningún push antes del gate 3.** Nada sale de la máquina sin aprobación.

### 4. Qué es una decisión mayor
Fuera de los gates, el flujo solo se detiene si:
1. hay que cambiar el alcance o los requisitos de la spec aprobada;
2. habría que incumplir una regla de la constitución (cualquiera de sus partes);
3. hace falta una dependencia nueva, una migración destructiva o romper un contrato o una API pública;
4. el cambio afecta a la seguridad o a los datos;
5. hay una ambigüedad con resultados funcionalmente distintos;
6. se alcanza `max_iterations`, o una etapa termina en `BLOCKED`.

En esos casos el agente devuelve `NEEDS_INPUT` (o el orquestador lo detecta en su informe) y la feature se detiene con las opciones y la recomendación. **Todo lo demás lo decide el agente**: nombres, estilo, mejoras opcionales, hallazgos MENOR y NIT. Si queda algo pendiente, lo anota en el backlog.

Las ADRs nuevas del planner **no** detienen el flujo: se muestran en el gate de review. Una ADR nueva que encaje en el punto 2 o 3 sí lo detiene.

### 5. Gate de cierre con integración completa
Una sola aprobación cubre, en este orden:
1. commit `Close NNN-slug`, que incluye `state.json` y el backlog global actualizado (§6);
2. `git push -u origin <rama>`;
3. `gh pr create --base <base_branch>`;
4. `gh pr merge --merge --delete-branch` (merge commit; se borra la rama remota y la local);
5. `git checkout <base_branch>` y `git pull`.

El gate muestra antes todo lo que va a pasar: ramas, commits que se suben, título y cuerpo del PR, y tipo de merge. Si falta `gh`, no hay remoto o algún paso falla, el orquestador se detiene en ese punto y lo explica, sin intentarlo por otra vía.

### 6. Backlog en dos niveles
- **Por feature:** `<specs>/NNN-slug/backlog.md`. Cada subagente incluye un campo `BACKLOG:` en su informe final, con lo que decidió no hacer o dejó pendiente. El orquestador lo copia **literalmente** en `backlog.md`, con la etapa y el agente. Es una excepción acotada al principio de que el orquestador no escribe artefactos, igual que cuando copia los textos del usuario.
- **Global:** `paths.backlog` en la config (por defecto `docs/backlog.md`). Al cerrar, el orquestador añade allí los puntos que siguen abiertos, con un enlace a la feature de origen, y entran en el commit `Close`.
- Los dos se muestran en el gate de review, junto con los hallazgos MENOR y NIT del reviewer.

## Consecuencias
- (+) De unas 9 pausas (más las de commits y pushes) se pasa a 3 por feature. El usuario revisa en los puntos donde su criterio aporta más.
- (+) Cada etapa sigue teniendo su commit, su registro en `state.json` y sus hooks: la trazabilidad y las barreras técnicas no se debilitan.
- (+) Los nits no se pierden ni bloquean: quedan ordenados en el backlog de la feature y en el del proyecto.
- (−) El usuario ve el plan y las tareas por primera vez en el gate de review, cuando ya hay código. Lo mitigan el criterio de decisión mayor (§4) y el `rework` desde review. Quien prefiera revisarlos antes puede usar `"strict"`.
- (−) Una sola aprobación al cierre llega hasta el merge en la rama base. El gate tiene que mostrar con detalle todo lo que va a hacer.
- La CLI `sdd-state` no cambia: las aprobaciones automáticas usan el mismo `approve` con una nota distinta.
