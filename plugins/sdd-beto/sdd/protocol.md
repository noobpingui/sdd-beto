# Protocolo del orquestador SDD

Lectura obligatoria para todas las skills `/sdd-beto:*` de flujo. Lo ejecuta **la sesión principal**, nunca un subagente (ADR-0001). La tabla de etapas está en `stages.md`, en esta misma carpeta.

**Convenciones de este documento:**
- `sdd-state <comando>` es la CLI de estado. La ruta exacta viene en el bloque "Rutas del plugin" de la skill que te trajo aquí. Ejecútala siempre como `node <ruta>/sdd-state.mjs <comando> …`, **sin comillas alrededor de la ruta**, para que coincida con los permisos preautorizados (los de la skill y los que propone init, ADR-0026). Por la misma razón, **no la guardes en variables de shell** (`S="node …"; $S …`) y no la encadenes con comandos que escriban: las reglas de permisos se comparan con el texto literal de cada comando. Encadenar con `cd` dentro del proyecto o con comandos de solo lectura sí es compatible.
- "La config" es `.sdd/config.json` del proyecto. `<specs>` es `paths.specs` (por defecto `specs/`).
- "La constitución" son sus dos partes: la base del plugin (bloque "Rutas del plugin") y `.sdd/constitution.md` del proyecto.
- **Idioma:** hablas con el usuario, y escribes lo que copies en los artefactos, en el `language` de la config.

## 0. Principios
1. **El orquestador no hace el trabajo de los roles.** Nunca escribe spec, plan, tareas, tests, código, informes ni reviews: delega siempre en el subagente de la etapa. Solo escribe:
   - `idea.md`, con la idea literal del usuario;
   - `state.json`, **solo** mediante `sdd-state` (nunca a mano ni con `node -e`);
   - las respuestas o indicaciones del usuario copiadas **literalmente** en el artefacto que corresponda (§3);
   - `backlog.md` de la feature y el backlog global (`paths.backlog`), copiando **literalmente** los puntos de los informes (§0.1).
2. **La comunicación entre agentes pasa solo por disco.** El prompt a un subagente contiene únicamente la ruta de la feature, la etapa, el modo, la iteración y qué artefactos leer (incluidos los informes con hallazgos). No se pasan resúmenes de la conversación ni opiniones del orquestador.
3. **En un gate, nada avanza sin la aprobación explícita del usuario.** Son aprobación "aprobado", "sí", "ok, sigue" o equivalentes claros. **No** lo son el silencio, un "mmm", una pregunta o un "luego vemos". Ante la duda, se pregunta.
4. **Qué etapas tienen gate lo decide `gate_mode`** (§0.1). Nunca se salta un gate que el modo exige, ni se agrupan en una aprobación etapas que el modo no agrupa.
5. **Si la config no existe o no es válida**, `sdd-state` lo dice: detente y sugiere `/sdd-beto:init`.
6. **Una interrupción no es una instrucción del usuario.** Un "[Request interrupted by user]" en una delegación puede generarlo el entorno (un corte de conexión, un tiempo de espera). No digas que el usuario lo pidió: informa de que la delegación se interrumpió y pregunta si se relanza. La etapa sigue en `in_progress` y se reanuda con la misma delegación.

## 0.1 Modos de gate (`gate_mode`, ADR-0029)
`sdd-state show` devuelve el `gate_mode` de la config.

| | `flow` (por defecto) | `strict` |
|---|---|---|
| Etapas con gate | `spec`, `review` y `close` | todas |
| Etapas sin gate | `plan`, `tasks`, `tests`, `implement`, `verify` y `docs`: avance automático (§3.1) | — |
| Commits por etapa | automáticos, locales, sin pedir aprobación (§4) | cada uno aprobado en el gate de su etapa |
| Push, PR y merge | todo en el gate de `close`, con una sola aprobación (stages.md, "Etapa `close`") | cada push aprobado aparte |

**Decisión mayor (solo `flow`).** Fuera de un gate, el flujo se detiene **únicamente** si:
1. hay que cambiar el alcance o los requisitos de la spec aprobada;
2. habría que incumplir una regla de la constitución (cualquiera de sus partes);
3. hace falta una dependencia nueva, una migración destructiva o romper un contrato o una API pública;
4. el cambio afecta a la seguridad o a los datos;
5. hay una ambigüedad con resultados funcionalmente distintos;
6. se alcanza `max_iterations`, o una etapa termina en `BLOCKED`.

Los subagentes devuelven `NEEDS_INPUT` solo en esos casos. Además, revisa sus `DECISIONS` y sus ADRs nuevas: si alguna encaja en la lista, detente igualmente. Para detenerte, `sdd-state event <etapa> needs_input --note "<decisión>"` y presenta la decisión con sus opciones y tu recomendación. **Todo lo demás no detiene el flujo**: nombres, estilo, mejoras opcionales, hallazgos MENOR y NIT. Lo decide el agente y lo pendiente va al backlog.

**Backlog.** Cada informe final trae un campo `BACKLOG:`. Copia sus puntos **literalmente** en `<specs>/NNN-slug/backlog.md` (crea el archivo si no existe), bajo un encabezado con la etapa y el agente, con el formato `- [ ] <punto>`. Es una de las excepciones del principio 1. En `strict` también se lleva el backlog; simplemente no cambia las pausas. El backlog global (`paths.backlog`) se actualiza al cerrar (stages.md, "Etapa `close`").

## 1. Resolver la feature
- Con argumento (`NNN-slug` o solo `NNN`): pásalo a la CLI con `--feature <arg>`.
- Sin argumento: la CLI la deduce de la rama actual (`<prefijo>/NNN-slug`).
- `sdd-state show` muestra la feature, su etapa y su estado. Si falla porque la rama no es de feature, lista las features (`/sdd-beto:status`) y pregunta cuál.
- La CLI **se niega a modificar el estado si la rama actual no es `state.json.branch`**. Si pasa, detente y propón `git checkout <rama>`, que requiere aprobación.

## 2. Delegar una etapa
1. `sdd-state check <etapa>`: si falta alguna precondición, detente y explica qué falta.
2. `sdd-state start <etapa> --note "<qué vas a hacer>"`. Los hooks leen la etapa de `state.json`, así que esto va **antes** de delegar.
3. Invoca al subagente con la herramienta Agent:
   - `subagent_type: "sdd-beto:<agente>"` (con el prefijo del plugin: sin él no se encuentra el agente ni lo reconocen los hooks);
   - `model`: solo si la config tiene `models.<agente>`; si no, omítelo y se usa el del agente;
   - prompt mínimo:
     ```
     Feature: <specs>/NNN-slug/  ·  Etapa: <etapa>  ·  Modo: <scaffold|red|full|->  ·  Iteración: <n>/<max>  ·  Gates: <flow|strict>
     Lee tus entradas según tu definición. Hallazgos a corregir (si aplica): <specs>/NNN-slug/<verify-report.md|review.md>, ítems <F1, F3…>
     No edites la columna "Respuesta del usuario" ni las secciones "Comentarios del usuario": consérvalas tal cual, sin etiquetas ni notas; las tuyas van fuera.
     Tu mensaje final debe ser EXACTAMENTE el bloque "Informe final" de tu definición.
     ```
4. Lee el **informe final** (`STATUS / ARTIFACTS / SUMMARY / … / BACKLOG`) y **comprueba en disco** que los artefactos existen. No te fíes solo del informe. Copia su `BACKLOG` en `backlog.md` (§0.1).
5. Según el `STATUS`:
   - **`DONE`, `PASS` o `APPROVED`:** tras el `reviewer`, registra el veredicto con `sdd-state review-verdict` (lo lee de `review.md`; el reviewer no puede escribir `state.json`). Después `sdd-state gate <etapa> --note "<resumen de una línea>"`. Si la etapa tiene gate en el modo actual, preséntalo (§3); si no, avanza automáticamente (§3.1).
   - **`NEEDS_INPUT`:**
     - En `flow`, fuera de la etapa `spec`, solo debería llegar por una decisión mayor (§0.1). Si las preguntas son menores, no detengas el flujo: vuelve a delegar añadiendo al prompt la línea fija `Las preguntas de tu informe anterior son menores: aplica tu respuesta propuesta y anótala en BACKLOG.`
     - En los demás casos: `sdd-state event <etapa> needs_input --note "<preguntas>"` y muestra al usuario cada pregunta con su respuesta propuesta. Cuando responda, copia sus respuestas **literalmente** en el artefacto (en `spec.md`, la columna "Respuesta del usuario" de "Preguntas abiertas"; en otro artefacto, una sección "Comentarios del usuario" al final) y vuelve a delegar. No consume iteración.
   - **`FAIL` o `CHANGES_REQUESTED`:** tras el `reviewer`, registra igualmente el veredicto con `sdd-state review-verdict`. Después aplica el ciclo de corrección (§5).
   - **`BLOCKED`:** `sdd-state block --note "<motivo>"`. Explica el bloqueo y el comando o la decisión que lo resuelve, y espera al usuario. Si es de entorno, sugiere el `env_hint` del ámbito, **sin ejecutarlo**.

## 3. Gate de cierre de etapa
Se aplica a las etapas con gate en el modo actual (§0.1). En `flow`:
- **`spec`:** esta estructura, sin la sección "Commit propuesto" ni la pregunta 2: el commit se hace al aprobar la etapa (§4).
- **`review`:** la estructura del §3.2.
- **`close`:** la de stages.md, "Etapa `close`".

En `strict`, todas las etapas usan esta estructura. Tras `sdd-state gate`, muestra **exactamente**:

```markdown
## Etapa <etapa> cerrada · feature NNN-slug
**Agente:** <agente> · **Iteración:** n/<max>
**Producido:**
- `ruta` — qué contiene (1 línea)
**Decisiones del agente:** <las relevantes, o "ninguna">
**Verificación:** <resultado objetivo si aplica: tests, red check, veredicto>
**Qué debes revisar tú:** <2-4 puntos concretos para esta etapa (ver stages.md)>
**Siguiente etapa:** <etapa> (<agente>)
**Preguntas abiertas:** <o "ninguna">

---
## Commit propuesto        ← omitir esta sección si la etapa no hace commit
**Rama:** <rama>
**Archivos:** (salida de `git status --short` y `git diff --stat` de lo que se añadirá)
**Resumen:** <lenguaje claro>
**Mensaje:**
    <mensaje según stages.md y `commits` de la config>

    Co-Authored-By: <línea indicada por el entorno>

---
Responde:
1. ¿Apruebas cerrar la etapa <etapa>?
2. ¿Apruebas el commit?              ← solo si hay commit
```

Después **termina tu turno** y espera.

Cuando el usuario responda:
- **Aprueba la etapa:**
  1. Si la etapa es `tests` (o una corrección autorizada de tests, §5): `sdd-state snapshot --reason "<motivo>"` **antes** de aprobar, para que el hash de los tests entre en el mismo commit.
  2. `sdd-state approve <etapa> --note "<texto literal breve del usuario>"`. La CLI avanza a la siguiente etapa.
  3. En `strict`, si **también** aprobó el commit, haz el commit (§4) y después `sdd-state commit <etapa> <sha>`. Ese sha queda en `state.json` y entra en el commit siguiente (es normal). En `flow`, haz el commit directamente.
  4. En `strict`, si aprobó la etapa pero **no** el commit, los cambios quedan sin commitear y se acumulan para el siguiente; dilo en el próximo gate.
  5. Con `/sdd-beto:run`, continúa con la siguiente etapa. Con una skill de etapa, termina indicando el siguiente comando.
- **Pide cambios:** copia sus indicaciones **literalmente** en el artefacto (§2.5, NEEDS_INPUT), `sdd-state rework <etapa> --note "<resumen>"` (sin contador: no es un fallo) y vuelve a delegar en el agente de la etapa. Después presenta de nuevo el gate. En el gate de `review` de `flow`, el usuario puede pedir cambios sobre cualquier etapa anterior o sobre puntos del backlog: haz `rework` de la etapa del responsable, deja que el flujo avance solo hasta `review` y vuelve a presentar su gate.
- **Rechaza o pausa:** `sdd-state block --note "<lo que dijo>"`.

### 3.1 Avance automático (`flow`, etapas sin gate)
Tras `sdd-state gate <etapa>`:
1. Si la etapa es `tests`: `sdd-state snapshot --reason "<motivo>"`.
2. `sdd-state approve <etapa> --note "auto (gate_mode=flow): <resumen de una línea>"`. La nota empieza siempre por `auto`, para distinguir en `state.json` estas aprobaciones de las del usuario.
3. Haz el commit de la etapa (§4) y `sdd-state commit <etapa> <sha>`, si la etapa tiene commit (stages.md).
4. Informa en **una línea**: `✔ <etapa> · <agente> · <resultado objetivo> · commit <sha corto>`. Si el informe trae `DECISIONS` relevantes, regístralas con `sdd-state event <etapa> note --note "<decisiones en una línea>"`: así el resumen de review se puede reconstruir desde `state.json` aunque la sesión se reinicie o se compacte.
5. Continúa con la siguiente etapa sin terminar el turno (con `/sdd-beto:run`) o indica el siguiente comando (con una skill de etapa).

### 3.2 Gate de `review` en `flow`
Es el primer momento en que el usuario ve el plan, las tareas y el código, así que el resumen debe ser completo. Constrúyelo a partir de los artefactos, de `backlog.md` y del historial de `state.json` (`sdd-state show` y el propio archivo), no de memoria:

```markdown
## Review cerrada · feature NNN-slug
**Veredicto:** <APPROVED> · **Iteraciones:** tests n · implement n · review n

### Resumen del orquestador
| Etapa | Agente | Resultado | Decisiones relevantes | Commit |
|---|---|---|---|---|
| plan | planner | … | … | sha |
| … | | | | |

**ADRs nuevas:** <ruta — decisión en una línea, o "ninguna">
**Correcciones automáticas:** <qué falló y cómo se resolvió en cada ciclo, o "ninguna">
**AC manuales que debes probar tú:** <de verify-report.md, o "ninguno">

### Backlog de la feature (`<specs>/NNN-slug/backlog.md`)
<puntos abiertos, agrupados por etapa, más los hallazgos MENOR y NIT de review.md>

**Qué debes revisar tú:** plan.md (encaje con la arquitectura), el diff (`git diff <base_branch>...HEAD --stat`) y el backlog.
**Siguiente:** docs (automático) y gate de cierre.

---
Responde:
1. ¿Apruebas la review? (o indica qué etapa o punto del backlog se corrige ahora)
```

## 4. Commits y push
- **Solo el orquestador** ejecuta `git add`, `git commit`, `git push`, `git merge` y `git checkout -b`. Un hook impide que lo haga un subagente.
- **Justo antes de cada commit**, comprueba que `git branch --show-current` es la rama de la feature: otra ventana (p. ej. el IDE) puede haberla cambiado.
- **Commit:**
  - añade solo los archivos del resumen aprobado, con `git add <rutas>` explícitas; **nunca** `git add -A` ni `git add .`;
  - comprueba que no se cuela ningún `.env` real, clave privada ni secreto;
  - mensaje con heredoc; nunca `--no-verify` ni `--amend` sobre commits ya aprobados.
- **Cuándo se commitea:**
  - en `strict`, solo si el usuario aprobó el commit en el gate de la etapa;
  - en `flow`, después de cada `approve` (del usuario o automático), sin pedir aprobación. Las comprobaciones de arriba se aplican igual. Si alguna falla (rama distinta, un secreto, un archivo inesperado), **no** hagas el commit: detente y explícalo, porque es una decisión mayor.
- **Push en `flow`:** ninguno antes del gate de `close`, que aprueba de una vez el commit final, el push, el PR y el merge (stages.md, "Etapa `close`").
- **Push en `strict`:** siempre en una aprobación **separada**:
  ```markdown
  ## Push propuesto
  **Origen → destino:** <rama> → origin/<rama>
  **Commits a subir:** (salida de `git log --oneline origin/<rama>..HEAD`, o `<base_branch>..HEAD` si la rama es nueva)
  ¿Apruebas el push?
  ```
- **La aprobación del usuario en el chat es la del commit o el push** (ADR-0025): en `strict`, la del gate de cada etapa y la de cada push; en `flow`, la del gate de `close` (ADR-0029). El hook no vuelve a preguntar. El entorno puede pedir además su propio permiso, según el modo de permisos del usuario; eso no sustituye al resumen ni al gate.
- Si el entorno bloquea el push (p. ej. por el modo de permisos), no lo intentes por otra vía: pide al usuario que lo ejecute él con `! git push …`.

## 5. Ciclos de corrección
| Falla | Vuelve a | Comando | Luego |
|---|---|---|---|
| red check `FAIL` (tests inválidos o que pasan sin implementación) | `test-author` | `sdd-state rework tests --counter tests` | red check de nuevo |
| red check `FAIL` por un esqueleto con lógica | `implementer` (modo scaffold) | `sdd-state rework tests --counter tests` | test-author si hace falta, red check |
| verify `FAIL` atribuible al código | `implementer` | `sdd-state rework implement --counter implement` | gate de implement (solo `strict`), verify |
| verify `FAIL` atribuible a un test | `test-author` | `sdd-state rework tests --counter tests` | **sin** red check (el test debe pasar); snapshot; implement si hace falta; verify |
| review `CHANGES_REQUESTED` | el responsable de cada hallazgo | `sdd-state rework <etapa del responsable> --counter review` | verify `full` y review de nuevo |
| hallazgo que afecta a la spec o al plan | `spec-writer` o `planner` | `sdd-state rework spec` o `rework plan` (con `--counter review` si viene de la review) | se repite el flujo desde ahí, con los gates que el modo exija |

- La etapa de destino es la del agente responsable (`tests` para el `test-author`, `implement` para el `implementer`…), para que los hooks le permitan escribir. `rework` anula las aprobaciones desde esa etapa.
- Si hay hallazgos para varios responsables, empieza por el más temprano en el flujo (p. ej. `tests` antes que `implement`).
- **Límite:** si `rework` sale con código **3**, la feature queda bloqueada. Escala al usuario con:
  - un resumen de cada intento: qué falló y qué se cambió;
  - la causa raíz probable;
  - las opciones: (a) conceder más iteraciones (editando `max_iterations` con su aprobación), (b) ajustar la spec o el plan, (c) intervenir manualmente, (d) abandonar la feature.
- Las correcciones pasan por el gate de la etapa que se repite si el modo le da gate (en `flow`, solo `spec`); si no, avanzan solas (§3.1). Los ciclos de `flow` corren sin pausa hasta el límite y se resumen en el gate de review.

## 6. `state.json`
- **Nunca** se edita a mano. Todos los cambios pasan por `sdd-state`, que pone las fechas del sistema, valida las transiciones y escribe de forma atómica.
- Si necesitas una fecha para un texto (p. ej. `idea.md`), usa `sdd-state now`.
- `sdd-state validate --git` revisa la consistencia. Si hay un problema, propón la reparación al usuario y aplícala solo con su aprobación.
