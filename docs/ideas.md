# Ideas y mejoras pendientes

Lista viva de lo que podría entrar en versiones futuras del plugin. Nada de esto está decidido: cuando una idea se vaya a hacer, se escribe primero su ADR (o la que sustituya a una existente) y se quita de aquí.

Origen de cada idea: **v1** = aplazada por la [ADR-0021](decisions/ADR-0021-alcance-v1.md) · **F6** = hallazgo de la [prueba en seco](06-prueba-en-seco.md) · **0.1.0** = observada al instalar la versión publicada.

## Flujo

| Idea | Motivo | Origen |
|---|---|---|
| **Modo `refactor`** con red check invertido: tests de caracterización que ya pasan antes del cambio y deben seguir pasando | Hoy el tipo `refactor` solo cambia el prefijo de la rama. Un refactor puro no supera el red check, que exige tests que fallen (ver la guía, §4) | v1 |
| **Menos pausas** (`gate_mode`): agrupar gates de etapas mecánicas, con la opción documentada y elegida por proyecto | Una feature pequeña, con una corrección, pasó por más de una decena de gates. Chocaría con la ADR-0004 ("una etapa, una aprobación"), así que necesita una ADR que la sustituya en parte | v1 |
| **Modo ligero** para cambios triviales, dentro de las excepciones del Art. B1.2 | Una feature pequeña generó 27 criterios, 31 tareas y 26 tests: coherente con la trazabilidad, pero pesado | F6 (O3) |
| **Cerrar `implement` en el gate de una corrección** que solo toca tests | Evita un gate de trámite. Se decidió **no** hacerlo en la v1 para no debilitar la ADR-0004; se reconsidera junto con `gate_mode` | F6 (O5) |

## Hooks y guardias

| Idea | Motivo | Origen |
|---|---|---|
| **Detectar escrituras desde la shell** (`sed -i`, `>`, `Set-Content`…) en el `role-guard` | Hoy solo las frenan los prompts y el `tests_snapshot` (ADR-0008) | v1 |
| **Hook `SubagentStop`** que valide el formato del informe final de cada agente | La documentación confirma que recibe `last_assistant_message`. En la Fase 6 todos los informes cumplieron el formato, así que es una red de seguridad, no una urgencia | v1 |
| **Proteger las secciones de `CLAUDE.md`**: que el `doc-keeper` solo pueda editar la sección Proyecto | Hoy el hook le permite el archivo completo y la restricción depende de su prompt (ADR-0013) | v1 |

## Proyecto

| Idea | Motivo | Origen |
|---|---|---|
| **Plantilla de CI genérica**: tests, lint, typecheck y build de cada ámbito en las ramas de feature | Los comandos ya están en `.sdd/config.json`; `init` podría proponerla | v1 |
| **Activar el plugin solo en los proyectos que lo usan**: desactivarlo a nivel de usuario (`enabledPlugins: false` en `~/.claude/settings.json`) y que `init` proponga `enabledPlugins: true` en el `.claude/settings.json` del proyecto, que tiene prioridad sobre el del usuario | Instalado a nivel de usuario, `claude plugin details` estima unos 2150 tokens fijos en **cada** sesión, también en proyectos sin SDD (las descripciones de agentes y comandos). Cambia comodidad por ahorro: hay que acordarse de activarlo en cada proyecto | 0.1.0 |
| **Probar el plugin en macOS y Linux** | Los scripts son Node puro, pero solo se ha probado en Windows 11 | F6 |
| **Prueba en seco interactiva** y con una feature que toque dos ámbitos | La Fase 6 fue headless y la feature tocó un solo ámbito | F6 |

## Evaluado y descartado
- **Cambiar el modelo del `verifier` a sonnet** (ADR-0006, ADR-0021): en la Fase 6, haiku respetó el formato del informe y generó las fechas con `sdd-state now` en sus tres informes (red check, verify y verify tras una corrección). Se mantiene haiku; cada proyecto puede cambiarlo con `models.verifier`.
