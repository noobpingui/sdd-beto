<!-- sdd-beto:proyecto:start -->
## Proyecto

<!-- Borrador de /sdd-beto:init. Lo mantiene el doc-keeper en la etapa docs (ADR-0013). -->

- **Qué es:** (pendiente)
- **Áreas:** (pendiente)
- **Arquitectura:** (pendiente)
- **Comandos:** ver la tabla de ámbitos en Convenciones.
- **Despliegue:** (pendiente)
- **Puntos delicados:** (pendiente)
<!-- sdd-beto:proyecto:end -->

<!-- sdd-beto:sdd:start -->
## SDD

Este proyecto usa el plugin `sdd-beto` (Spec-Driven Development). Todo cambio funcional pasa por:

`spec → plan → tasks → tests (rojo) → implement → verify → review → docs → close`

- Cada etapa la hace un subagente `sdd-beto:<rol>`; la sesión principal orquesta y no hace el trabajo de los roles.
- Comandos: `/sdd-beto:new <slug> <idea>` crea una feature, `/sdd-beto:run [NNN-slug]` recorre el flujo, `/sdd-beto:status` muestra el estado y `/sdd-beto:<etapa>` ejecuta una sola etapa.
- Artefactos de cada feature: `{{specs}}/NNN-slug/`. Su estado vive en `state.json` y solo se cambia con la CLI `sdd-state` del plugin, nunca a mano.
- Configuración: `.sdd/config.json`. Constitución: la base del plugin más `.sdd/constitution.md` (Parte II, propia de este proyecto). Si chocan, gana la base.
- Decisiones del proyecto: `{{adr}}/`.
- Los hooks del plugin impiden editar código de producción fuera de una feature con spec y plan aprobados. Solo un hotfix o una excepción del Art. B1.2 justifica reiniciar con `SDD_BYPASS=1`.
<!-- sdd-beto:sdd:end -->

<!-- sdd-beto:aprobacion:start -->
## Aprobación humana

- Nada avanza sin un "aprobado" o "sí" explícito del usuario. El silencio, una pregunta o un "luego vemos" no son aprobación.
- Un gate por etapa: nunca se encadenan etapas ni se agrupan en una sola aprobación.
- Antes de cada `git commit`: se muestran los archivos, un resumen y el mensaje propuesto, y se espera la aprobación.
- Antes de cada `git push`: se muestran la rama de origen, la de destino y los commits, y se espera la aprobación.
- Los subagentes nunca hacen commit, push ni cambian de rama.
<!-- sdd-beto:aprobacion:end -->

<!-- sdd-beto:convenciones:start -->
## Convenciones

- **Idioma de los artefactos y de los mensajes al usuario:** `{{language}}`.
- **Ramas:** se parte de `{{base_branch}}`; `{{branch_feature}}/NNN-slug`, `{{branch_fix}}/NNN-slug` y `{{branch_refactor}}/NNN-slug`.
- **Commits:** idioma `{{commit_language}}`, estilo "{{commit_style}}". Un commit por etapa aprobada. Nunca `--no-verify`, `git add -A` ni `push --force` a `{{base_branch}}`.
- **Iteraciones de corrección** antes de escalar al usuario: {{max_iterations}}.
- **Ámbitos** (`scopes` de `.sdd/config.json`):

{{scopes_table}}
<!-- sdd-beto:convenciones:end -->
