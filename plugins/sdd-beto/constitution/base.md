# Constitución SDD · Parte I: base

> Principios **no negociables** del flujo SDD de `sdd-beto`, iguales en todos los proyectos. Todos los agentes la
> leen antes de actuar y el `reviewer` la usa como checklist, junto con la **Parte II** del proyecto
> (`.sdd/constitution.md`).
>
> - Esta parte la escribe el plugin: el proyecto **no** la edita. Solo cambia con una versión nueva del plugin.
> - La Parte II puede **endurecer** estas reglas, nunca relajarlas. Si chocan, gana esta parte.
> - "La config" es `.sdd/config.json` del proyecto. `<specs>` es `paths.specs` (por defecto `specs/`).
>
> Palabras clave: **DEBE** (obligatorio) · **NO DEBE** (prohibido) · **DEBERÍA** (salvo justificación escrita en `plan.md`).

## Art. B1 — Ningún cambio funcional sin spec

1. Todo cambio de comportamiento **DEBE** pasar por el flujo
   `spec → plan → tasks → tests → implement → verify → review → docs → close`,
   con sus artefactos en `<specs>/NNN-slug/`.
2. Excepciones, sin spec completa pero con commit aprobado por el usuario:
   - erratas;
   - cambios solo de textos o estilos, sin lógica;
   - actualizaciones de dependencias sin cambios de API;
   - hotfixes con `SDD_BYPASS=1`, que **DEBEN** documentarse después en una spec retroactiva.
3. Una spec aprobada no se modifica en silencio. Cambiarla reabre el gate de spec y todo lo que venga después.

## Art. B2 — Separación de roles

1. Cada etapa la ejecuta **un solo agente** y solo dentro de su rol:
   - el que especifica no planifica;
   - el que implementa no escribe ni modifica tests;
   - el que verifica no corrige;
   - el que revisa no participa en la implementación.
2. Los agentes se comunican **solo a través de artefactos en disco**.
3. Ningún subagente ejecuta git con escritura (`commit`, `push`, `merge`, `rebase`, `checkout`, `reset`, `stash`…).
   Esas operaciones son exclusivas del orquestador.
4. Ningún agente escribe en archivos fuera de su rol ni modifica archivos desde la shell (`sed -i`, redirecciones,
   `Set-Content`…) para esquivar los hooks.

## Art. B3 — Aprobación humana

1. El orquestador **DEBE** detenerse al cerrar cada etapa y esperar la aprobación explícita del usuario
   ("aprobado", "sí" o equivalente claro).
2. Antes de **cualquier** `git commit` **DEBE** mostrar los archivos incluidos (`git status` y `git diff --stat`),
   un resumen claro de los cambios y el mensaje propuesto.
3. Antes de **cualquier** `git push` **DEBE** mostrar la rama de origen y de destino y la lista de commits.
4. El silencio o una respuesta ambigua **no** son aprobación.
5. Varias etapas nunca se agrupan en una sola aprobación.

## Art. B4 — Trazabilidad

1. Cada requisito tiene un ID:
   - `REQ-NNN` para los funcionales;
   - `NFR-NNN` para los no funcionales;
   - `AC-NNN.M` para cada criterio de aceptación de un REQ, y `AC-NNNN.M` con el prefijo `N`
     (p. ej. `AC-N001.1`) para los de un NFR.
2. Cada tarea de `tasks.md` referencia al menos un REQ o NFR.
3. Cada AC **DEBE** estar cubierto por al menos un test con el marcador `SDD: <IDs>` en un comentario de línea,
   en la línea anterior a la definición del test y con la sintaxis de comentario de su lenguaje
   (p. ej. `# SDD: REQ-001 AC-001.1` o `// SDD: REQ-001 AC-001.1`).
4. Un AC sin test, o un REQ sin tarea, bloquea la verificación.

## Art. B5 — TDD estricto

1. Los tests del código nuevo o modificado se escriben **antes** de la implementación, a partir de la spec y no
   del código.
2. El `verifier` **DEBE** confirmar que cada test nuevo falla por **comportamiento ausente** (rojo legítimo)
   antes de implementar. No cuentan como rojo legítimo los errores de sintaxis, de configuración o fixture del
   test, ni los imports de módulos que no estén en el plan.
3. La implementación termina cuando pasan **todos** los tests del ámbito tocado, nuevos y existentes.
   **NO DEBE** borrarse, saltarse (`skip`, `xfail`, `.only`, `.skip` o equivalentes) ni debilitarse ningún test
   existente.
4. Ningún test llama a servicios externos reales (APIs de terceros, proveedores de pago, correo, IA…).
   Las dependencias externas se aíslan como indique la Parte II.
5. Los nombres de los tests describen el comportamiento que prueban.
6. **Esqueletos `(scaffold)`:** los símbolos nuevos que los tests importan los crea antes el `implementer`, sin
   lógica y sin valores de retorno:
   - su cuerpo solo lanza un error con el mensaje **exactamente** `not implemented`, sin traducir;
   - en lenguajes que marcan parámetros no usados, los parámetros llevan el prefijo `_`, que se quita al
     implementar;
   - los constructores guardan sus dependencias sin lanzar, para que cada test falle en el método que prueba.

   La forma concreta en cada lenguaje la fija la Parte II (P1).
7. El código nuevo o modificado **NO DEBE** introducir errores de lint ni de tipos. Si el ámbito usa
   `lint_ratchet`, solo cuentan las violaciones **nuevas**; las previas se toleran y no se tocan fuera de una
   tarea que lo pida.

## Art. B6 — Git

1. Se trabaja en una rama por feature, `<prefijo>/NNN-slug`, creada desde la rama base que registra
   `state.json.base_branch`. Nunca directamente en la rama base.
2. Se hace un commit por etapa que produce artefactos.
3. Los mensajes siguen `commits` de la config y terminan con la línea `Co-Authored-By` indicada por el entorno.
4. No se usa `--no-verify`, ni `git add -A` o `git add .`, ni `push --force` sobre la rama base, ni se reescribe
   historia ya publicada.
5. **NO DEBEN** commitearse secretos (`.env` reales, claves privadas, tokens). Las variables nuevas se documentan
   en el `.env.example` que corresponda.

## Art. B7 — Definición de "hecho"

Una feature está **hecha** solo cuando se cumple todo esto:

- [ ] `spec.md`, `plan.md` y `tasks.md` aprobados por el usuario.
- [ ] Todas las tareas de `tasks.md` están marcadas `[x]`.
- [ ] Cada AC tiene al menos un test con el marcador `SDD:` y todos pasan.
- [ ] En cada ámbito tocado pasan todos los comandos declarados en la config: `test`, `lint` (sin errores) o
      `lint_ratchet` (sin violaciones nuevas), `typecheck` y `build`.
- [ ] `verify-report.md` tiene resultado **PASS**.
- [ ] `review.md` tiene veredicto **APPROVED**, sin hallazgos BLOQUEANTES ni MAYORES abiertos.
- [ ] El `doc-keeper` actualizó la documentación afectada o dejó constancia de que no hacía falta.
- [ ] Se cumplen los puntos adicionales de la Parte II (P4), si los hay.
- [ ] El usuario aprobó el cierre y cada commit y push.
