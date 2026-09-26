# sdd-beto

## Proyecto

`sdd-beto` es un **plugin de Claude Code** que instala en cualquier repositorio una línea de producción de **Spec-Driven Development (SDD)**:

`spec → plan → tasks → tests (rojo) → implement → verify → review → docs → close`

Cada etapa la ejecuta un subagente con permisos separados, la sesión principal orquesta y el usuario aprueba cada etapa, cada commit y cada push. Los hooks impiden que un agente escriba fuera de su rol.

- **Namespace:** `sdd-beto`. Los comandos son `/sdd-beto:<skill>` (por ejemplo `/sdd-beto:init`, `/sdd-beto:new`, `/sdd-beto:run`) y los agentes, `sdd-beto:<agente>`.
- **Distribución:** este repositorio es a la vez el código del plugin y su marketplace de GitHub.
- **Configuración por proyecto:** cada proyecto consumidor tiene su `.sdd/config.json` (rutas, comandos, modelos) y su constitución. El plugin no contiene nada de ningún proyecto concreto.
- **Diagnóstico de la documentación oficial y del harness de origen:** [`docs/00-discovery.md`](docs/00-discovery.md).
- **Decisiones de diseño:** [`docs/decisions/`](docs/decisions/README.md). Antes de cambiar algo que una ADR decide, propón una ADR nueva que la sustituya.
- **Estructura** ([ADR-0014](docs/decisions/ADR-0014-estructura-y-distribucion.md)): la raíz del repo es el marketplace y el plugin vive en `plugins/sdd-beto/` (`${CLAUDE_PLUGIN_ROOT}`). `docs/`, `tests/fixtures/` y este archivo no se instalan.

## Desarrollo

- **Tests de los scripts** (Node ≥ 20, sin dependencias): `node --test plugins/sdd-beto/scripts/test/`
- **Validar el plugin y el marketplace:** `claude plugin validate ./plugins/sdd-beto` y `claude plugin validate .`
- **Probar el plugin sin instalarlo:** `claude --plugin-dir ./plugins/sdd-beto` (o `claude -p … --plugin-dir …` en un proyecto de prueba fuera de este repo).
- **Estado de las features:** nunca se edita `state.json` a mano; se usa `node plugins/sdd-beto/scripts/sdd-state.mjs` (ADR-0021).

## Neutralidad: el plugin es genérico

1. **Nada específico de un proyecto dentro del plugin.** Rutas (`backend/`, `src/`…), comandos (`pytest`, `npm test`, linters), convenciones de arquitectura y ejemplos **no** se escriben a mano en agentes, skills, hooks ni plantillas:
   - lo que depende del proyecto va a `.sdd/config.json` o a la parte específica de la constitución, que genera `/sdd-beto:init` **en cada proyecto**;
   - los ejemplos y fixtures de prueba son neutrales e inventados.
2. **El harness de origen es un consumidor, no una referencia.** Mientras se porta el código (Fases 0–4), la sesión puede abrirse con `--add-dir` hacia el repositorio de origen para leerlo. Después se trabaja solo en este repo, y el proyecto de origen adopta el plugin como cualquier otro.
3. **Las ADRs se redactan de forma genérica**, como decisiones propias de `sdd-beto`, sin referencias a ningún proyecto.
4. **El brief de traspaso ya no existe.** `docs/BRIEF.md` se borró en la Fase 8, cuando su contenido ya vivía en las ADRs, en este archivo, en la documentación y en [`docs/ideas.md`](docs/ideas.md); queda en el historial de git. `grep -ri <nombre-del-proyecto-de-origen>` no debe encontrar nada en el repo.

## Reglas de trabajo con el usuario: obligatorias

- **Idioma:** español, con tono de mentor. El usuario supervisa y decide contigo, así que explica con detalle el porqué.
- **Entorno:** Windows 11, con Git Bash y PowerShell. Todo script del plugin debe funcionar en Windows (Node, no bash) y tolerar CRLF.
- **Trabajo por fases.** Al final de cada fase, detente y muestra:
  - qué se hizo, con las rutas;
  - las decisiones que tomaste tú y por qué;
  - qué viene después;
  - las preguntas pendientes.

  **Espera un "aprobado" o "sí" explícito.** Nunca des algo por aprobado si el usuario no responde, y nunca agrupes varias fases en una sola aprobación.
- **Antes de cada `git commit`:** muestra los archivos (`git status` y `git diff --stat`), un resumen claro y el mensaje propuesto. **Espera aprobación.**
- **Antes de cada `git push`:** muestra la rama de origen y de destino y la lista de commits. **Espera aprobación.**
- **Decisiones:** si tienen compromisos reales, pregúntale al usuario. Si no, decide tú y documéntalo. Si una petición suya contradice las buenas prácticas, díselo **antes** de ejecutarla.
- **Documentación oficial primero.** Antes de crear o cambiar agentes, skills, hooks, el manifiesto o el marketplace, consulta la documentación **actual** de Claude Code (https://code.claude.com/docs; el markdown crudo está en `https://code.claude.com/docs/en/<página>.md`). No te fíes de la memoria ni de resúmenes de otro agente: léela tú.
- **Commits:** en inglés, en imperativo y sin prefijos convencionales. Terminan con la línea `Co-Authored-By` que indique el entorno. Nada de `git add -A`, `--no-verify` ni `push --force` a `main`.

## Hoja de ruta

Cada fase tiene su gate, su commit y su push, todos con aprobación.

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Descubrimiento: documentación oficial y lectura del harness de origen (`docs/00-discovery.md`) | hecha |
| 1 | Decisiones de diseño como ADRs: esquema de `.sdd/config.json`, estructura, `init`, constitución, versiones | hecha |
| 2 | Esqueleto del plugin: manifiesto, marketplace e instalación local de prueba (`docs/02-verificacion-esqueleto.md`) | hecha |
| 3 | Portar y parametrizar agentes, skills, protocolo y plantillas (entregas 3a–3d) | hecha |
| 4 | Portar y parametrizar los hooks con sus tests; ratchet de lint genérico (entregas 4a–4b) | hecha |
| 5 | `/sdd-beto:init`: skill guiada y ayudante `sdd-init` (entregas 5a–5b) | hecha |
| 6 | Prueba en seco en un proyecto de prueba neutral (`docs/06-prueba-en-seco.md`) | hecha |
| 7 | Migración del proyecto de origen al plugin | fuera de alcance: se hará desde ese proyecto, que es independiente (ADR-0027) |
| 8 | Documentación (README, guía, ideas, changelog), borrado del brief y release `0.1.0` (entregas 8a–8c) | hecha |
