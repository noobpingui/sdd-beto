# Protocolo del orquestador SDD

Lectura obligatoria para todas las skills `/sdd-beto:*` de flujo. Lo ejecuta **la sesión principal**, nunca un subagente (ADR-0001). La tabla de etapas está en `stages.md`, en esta misma carpeta.

**Convenciones de este documento:**
- `sdd-state <comando>` es la CLI de estado. La ruta exacta viene en el bloque "Rutas del plugin" de la skill que te trajo aquí. Ejecútala siempre como `node <ruta>/sdd-state.mjs <comando> …`, **sin comillas alrededor de la ruta**, para que coincida con el permiso preautorizado de la skill.
- "La config" es `.sdd/config.json` del proyecto. `<specs>` es `paths.specs` (por defecto `specs/`).
- "La constitución" son sus dos partes: la base del plugin (bloque "Rutas del plugin") y `.sdd/constitution.md` del proyecto.
- **Idioma:** hablas con el usuario, y escribes lo que copies en los artefactos, en el `language` de la config.

## 0. Principios
1. **El orquestador no hace el trabajo de los roles.** Nunca escribe spec, plan, tareas, tests, código, informes ni reviews: delega siempre en el subagente de la etapa. Solo escribe:
   - `idea.md`, con la idea literal del usuario;
   - `state.json`, **solo** mediante `sdd-state` (nunca a mano ni con `node -e`);
   - las respuestas o indicaciones del usuario copiadas **literalmente** en el artefacto que corresponda (§3).
2. **La comunicación entre agentes pasa solo por disco.** El prompt a un subagente contiene únicamente la ruta de la feature, la etapa, el modo, la iteración y qué artefactos leer (incluidos los informes con hallazgos). No se pasan resúmenes de la conversación ni opiniones del orquestador.
3. **Nada avanza sin la aprobación explícita del usuario.** Son aprobación "aprobado", "sí", "ok, sigue" o equivalentes claros. **No** lo son el silencio, un "mmm", una pregunta o un "luego vemos". Ante la duda, se pregunta.
4. **Una etapa por aprobación.** Nunca se encadena la siguiente etapa sin gate, ni se agrupan varias etapas en una sola aprobación.
5. **Si la config no existe o no es válida**, `sdd-state` lo dice: detente y sugiere `/sdd-beto:init`.

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
     Feature: <specs>/NNN-slug/  ·  Etapa: <etapa>  ·  Modo: <scaffold|red|full|->  ·  Iteración: <n>/<max>
     Lee tus entradas según tu definición. Hallazgos a corregir (si aplica): <specs>/NNN-slug/<verify-report.md|review.md>, ítems <F1, F3…>
     Tu mensaje final debe ser EXACTAMENTE el bloque "Informe final" de tu definición.
     ```
4. Lee el **informe final** (`STATUS / ARTIFACTS / SUMMARY / …`) y **comprueba en disco** que los artefactos existen. No te fíes solo del informe.
5. Según el `STATUS`:
   - **`DONE`, `PASS` o `APPROVED`:** tras el `reviewer`, registra el veredicto con `sdd-state review-verdict` (lo lee de `review.md`; el reviewer no puede escribir `state.json`). Después `sdd-state gate <etapa> --note "<resumen de una línea>"` y presenta el gate (§3).
   - **`NEEDS_INPUT`:** `sdd-state event <etapa> needs_input --note "<preguntas>"`. Muestra al usuario cada pregunta con su respuesta propuesta. Cuando responda, copia sus respuestas **literalmente** en el artefacto (en `spec.md`, la columna "Respuesta del usuario" de "Preguntas abiertas"; en otro artefacto, una sección "Comentarios del usuario" al final) y vuelve a delegar. No consume iteración.
   - **`FAIL` o `CHANGES_REQUESTED`:** tras el `reviewer`, registra igualmente el veredicto con `sdd-state review-verdict`. Después aplica el ciclo de corrección (§5).
   - **`BLOCKED`:** `sdd-state block --note "<motivo>"`. Explica el bloqueo y el comando o la decisión que lo resuelve, y espera al usuario. Si es de entorno, sugiere el `env_hint` del ámbito, **sin ejecutarlo**.

## 3. Gate de cierre de etapa
Tras `sdd-state gate`, muestra **exactamente** esta estructura:

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
  3. Si **también** aprobó el commit, haz el commit (§4) y después `sdd-state commit <etapa> <sha>`. Ese sha queda en `state.json` y entra en el commit siguiente (es normal).
  4. Si aprobó la etapa pero **no** el commit, los cambios quedan sin commitear y se acumulan para el siguiente; dilo en el próximo gate.
  5. Con `/sdd-beto:run`, continúa con la siguiente etapa. Con una skill de etapa, termina indicando el siguiente comando.
- **Pide cambios:** copia sus indicaciones **literalmente** en el artefacto (§2.5, NEEDS_INPUT), `sdd-state rework <etapa> --note "<resumen>"` (sin contador: no es un fallo) y vuelve a delegar en el agente de la etapa. Después presenta de nuevo el gate.
- **Rechaza o pausa:** `sdd-state block --note "<lo que dijo>"`.

## 4. Commits y push
- **Solo el orquestador** ejecuta `git add`, `git commit`, `git push`, `git merge` y `git checkout -b`. Un hook impide que lo haga un subagente.
- **Justo antes de cada commit**, comprueba que `git branch --show-current` es la rama de la feature: otra ventana (p. ej. el IDE) puede haberla cambiado.
- **Commit:**
  - añade solo los archivos del resumen aprobado, con `git add <rutas>` explícitas; **nunca** `git add -A` ni `git add .`;
  - comprueba que no se cuela ningún `.env` real, clave privada ni secreto;
  - mensaje con heredoc; nunca `--no-verify` ni `--amend` sobre commits ya aprobados.
- **Push:** siempre en una aprobación **separada**:
  ```markdown
  ## Push propuesto
  **Origen → destino:** <rama> → origin/<rama>
  **Commits a subir:** (salida de `git log --oneline origin/<rama>..HEAD`, o `<base_branch>..HEAD` si la rama es nueva)
  ¿Apruebas el push?
  ```
- **La aprobación del usuario en el chat es la del commit o el push** (ADR-0025): el hook no vuelve a preguntar. El entorno puede pedir además su propio permiso, según el modo de permisos del usuario; eso no sustituye al resumen ni al gate.
- Si el entorno bloquea el push (p. ej. por el modo de permisos), no lo intentes por otra vía: pide al usuario que lo ejecute él con `! git push …`.

## 5. Ciclos de corrección
| Falla | Vuelve a | Comando | Luego |
|---|---|---|---|
| red check `FAIL` (tests inválidos o que pasan sin implementación) | `test-author` | `sdd-state rework tests --counter tests` | red check de nuevo |
| red check `FAIL` por un esqueleto con lógica | `implementer` (modo scaffold) | `sdd-state rework tests --counter tests` | test-author si hace falta, red check |
| verify `FAIL` atribuible al código | `implementer` | `sdd-state rework implement --counter implement` | gate de implement, verify |
| verify `FAIL` atribuible a un test | `test-author` | `sdd-state rework tests --counter tests` | **sin** red check (el test debe pasar); snapshot; implement si hace falta; verify |
| review `CHANGES_REQUESTED` | el responsable de cada hallazgo | `sdd-state rework <etapa del responsable> --counter review` | verify `full` y review de nuevo |
| hallazgo que afecta a la spec o al plan | `spec-writer` o `planner` | `sdd-state rework spec` o `rework plan` (con `--counter review` si viene de la review) | se repiten los gates desde ahí |

- La etapa de destino es la del agente responsable (`tests` para el `test-author`, `implement` para el `implementer`…), para que los hooks le permitan escribir. `rework` anula las aprobaciones desde esa etapa.
- Si hay hallazgos para varios responsables, empieza por el más temprano en el flujo (p. ej. `tests` antes que `implement`).
- **Límite:** si `rework` sale con código **3**, la feature queda bloqueada. Escala al usuario con:
  - un resumen de cada intento: qué falló y qué se cambió;
  - la causa raíz probable;
  - las opciones: (a) conceder más iteraciones (editando `max_iterations` con su aprobación), (b) ajustar la spec o el plan, (c) intervenir manualmente, (d) abandonar la feature.
- Las correcciones pasan por el gate de la etapa que se repite, igual que la primera vez.

## 6. `state.json`
- **Nunca** se edita a mano. Todos los cambios pasan por `sdd-state`, que pone las fechas del sistema, valida las transiciones y escribe de forma atómica.
- Si necesitas una fecha para un texto (p. ej. `idea.md`), usa `sdd-state now`.
- `sdd-state validate --git` revisa la consistencia. Si hay un problema, propón la reparación al usuario y aplícala solo con su aprobación.
