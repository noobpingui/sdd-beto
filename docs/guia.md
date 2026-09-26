# Guía de uso de sdd-beto

Esta guía explica cómo adoptar el flujo en un proyecto, cómo es una feature de principio a fin y qué hacer cuando algo no sale como esperabas. La instalación está en el [README](../README.md).

## 1. Qué se instala y dónde
**El plugin no se copia a tus proyectos.** Al instalarlo, Claude Code guarda `sdd-beto` (agentes, skills, hooks, scripts, plantillas y la constitución base) en su propia carpeta de plugins, en tu usuario, y lo carga en cada sesión. Para mejorar el flujo en todos tus proyectos basta con actualizar el plugin.

En cada proyecto solo aparece lo que crea `/sdd-beto:init` y lo que produce cada feature:

```
proyecto-x/
├── .sdd/
│   ├── config.json          ← rutas, comandos y ámbitos de este proyecto
│   └── constitution.md      ← reglas propias de este proyecto (Parte II)
├── .claude/settings.json    ← límite de profundidad de subagentes
├── CLAUDE.md                ← secciones Proyecto, SDD, Aprobación humana y Convenciones
├── docs/decisions/          ← ADRs de este proyecto (las escribe el planner)
├── specs/                   ← una carpeta por feature
│   └── 001-export-csv/
│       ├── idea.md, spec.md, plan.md, tasks.md
│       ├── verify-report.md, review.md, docs-report.md
│       └── state.json       ← etapa y aprobaciones de la feature
└── (tu código y tus tests)
```

Las rutas `specs/` y `docs/decisions/` son las de por defecto; se cambian en la config (`paths`). Si aceptas los permisos locales, también se crea `.claude/settings.local.json`, que es personal y no se versiona.

No confundas las ADRs de tu proyecto con las del plugin. Las del repositorio `sdd-beto` explican cómo está diseñado el plugin; las de `docs/decisions/` de tu proyecto recogen las decisiones de tu aplicación.

**Quién hace qué:** tú das la idea (`/sdd-beto:new`), arrancas el flujo (`/sdd-beto:run`), respondes a las preguntas y apruebas o pides cambios en cada gate. El harness hace el trabajo de cada etapa con su agente especializado y se detiene en cada una. No elige qué construir, no avanza sin tu "aprobado", no hace commits ni pushes sin tu permiso y no instala nada en tu entorno.

## 2. Antes de empezar
- El proyecto tiene que ser un **repositorio git**, a ser posible con el árbol de trabajo limpio.
- Conviene que los tests del proyecto **se puedan ejecutar** en tu máquina. `init` los detecta, pero no instala nada: si faltan dependencias o servicios, anótalo para indicárselo en el paso 1.
- **Cómo se trabaja:** todo pasa en una sesión de Claude Code abierta en la raíz del proyecto. Tú escribes los comandos `/sdd-beto:*` y respondes a los gates; Claude no los lanza por su cuenta.
- **Coste:** cada feature lanza varios subagentes (tres de ellos con opus) y la sesión principal usa el modelo que tengas elegido. Si tu cuenta es de suscripción, cuenta contra tus límites de uso; con una clave de API, se factura por uso.

## 3. Adoptar el flujo: `/sdd-beto:init`
`init` tiene 5 pasos, cada uno con su gate. **No escribe nada hasta que apruebas el paso 2.**

| Paso | Qué hace | Qué decides tú |
|---|---|---|
| 1 · Análisis | Lee manifiestos, CI, configuración de herramientas y algunos tests. Propone ámbitos y comandos, cada uno con su evidencia (`archivo:línea`), y señala riesgos | Si el análisis es correcto. Es el momento de decir "los tests necesitan una base de datos" o "esa carpeta no es producción" |
| 2 · Config | Propone `.sdd/config.json` y te enseña cómo clasifica los archivos del repo (producción y test por ámbito). Con tu permiso, comprueba que los comandos de test recolectan los tests | La config y el `language` de los artefactos |
| 3 · Constitución | Propone la Parte II (`.sdd/constitution.md`): convenciones de tests, arquitectura, seguridad y la forma de los esqueletos, a partir de lo que el código ya hace | Las reglas y las preguntas abiertas |
| 4 · Integración | Ensaya y luego aplica: carpetas de specs y ADRs, secciones de `CLAUDE.md` y settings | Tres preguntas, más abajo |
| 5 · Commit | Rama `chore/sdd-init` y commit de los archivos de init | El commit (y el push, aparte) |

**Las tres preguntas del paso 4:**
- **Límite de profundidad de subagentes** (`.claude/settings.json`): impide que un subagente lance a otros y se salte la separación de roles. Afecta a todas las sesiones del proyecto. Recomendado: sí.
- **Marketplace del plugin** (`.claude/settings.json`): deja escrito en el repo de dónde se instala `sdd-beto`. Solo sirve a quien abra el repo sin el plugin instalado. Recomendado: no.
- **Permisos locales** (`.claude/settings.local.json`, que no se versiona): permite leer los archivos del plugin y ejecutar sus CLIs sin un aviso de permiso cada vez. Recomendado: sí si trabajas de forma interactiva.

**Lo que queda en el proyecto:**
- `.sdd/config.json` y `.sdd/constitution.md`;
- la carpeta de specs (`specs/`) y la de ADRs (`docs/decisions/`), o las rutas que elijas;
- en `CLAUDE.md`, cuatro secciones entre marcas `<!-- sdd-beto:…:start/end -->`: Proyecto, SDD, Aprobación humana y Convenciones. Lo que tuvieras fuera de las marcas no se toca. Si el repo solo tenía `AGENTS.md`, el `CLAUDE.md` nuevo lo importa.

**Reejecutar `init`** es seguro: entra en modo actualización, propone solo lo que cambió y, si no hay nada, no produce diff. Hazlo después de actualizar el plugin o cuando el repo cambie de estructura (un ámbito nuevo, otro comando de test…).

## 4. Una feature de principio a fin

### Crear la feature
```
/sdd-beto:new <slug> <idea en lenguaje natural>
```
Propone el tipo (`feature`, `fix` o `refactor`), los ámbitos que toca, el número y la rama (`feat/NNN-slug`). Con tu aprobación crea la rama, `state.json` e `idea.md` con tu idea literal. No hace commit: esos archivos entran en el de la spec.

**Limitación del tipo `refactor`:** en esta versión solo cambia el prefijo de la rama; el flujo es el mismo. El red check exige tests nuevos que **fallen** antes de implementar, así que un refactor puro, sin comportamiento nuevo, no puede superarlo. Si el refactor añade o cambia comportamiento, los tests de ese comportamiento sirven. Si no, hazlo fuera del flujo: el Art. B1.1 solo exige el flujo para cambios de comportamiento. Como el `stage-guard` bloquea la edición de producción fuera de una feature, reinicia Claude Code con `SDD_BYPASS=1` (§7), mantén los tests existentes en verde y aprueba el commit como cualquier otro. El modo refactor con tests de caracterización está en [ideas](ideas.md).

### Recorrer el flujo
```
/sdd-beto:run [NNN-slug]
```
Ejecuta la etapa actual, te presenta su gate y, cuando apruebas, sigue con la siguiente. Si cierras la sesión, `/sdd-beto:run` retoma donde lo dejaste: el estado vive en `state.json`.

| Etapa | Qué produce | Qué revisar en el gate |
|---|---|---|
| spec | `spec.md` | ¿Es lo que quieres? ¿Falta algún caso límite o error? ¿Cada criterio es comprobable? ¿Está claro lo que queda fuera? |
| plan | `plan.md` (y ADRs si hacen falta) | ¿Encaja con la arquitectura? ¿Hay migración? ¿Reutiliza lo existente? |
| tasks | `tasks.md` | ¿Cada criterio tiene su test? ¿Tareas pequeñas y en orden? ¿Nada fuera del plan? |
| tests | esqueletos, tests e informe del red check | Lee 2 o 3 tests. ¿Prueban los criterios? ¿El rojo es legítimo? |
| implement | el código | ¿El diff se limita a lo planeado? |
| verify | `verify-report.md` | ¿Todo en verde? ¿Hay criterios "manuales" que debas probar tú? |
| review | `review.md` | El veredicto y qué hacer con los hallazgos menores |
| docs | documentación y `docs-report.md` | ¿La documentación describe bien el cambio? |
| close | checklist de "hecho" | La checklist y cómo integrar la rama (PR o merge) |

`verify` no tiene commit propio: su informe entra en el commit de la review.

### Responder a un gate
Cada gate termina con una o dos preguntas: aprobar la etapa y, si la hay, aprobar su commit.
- **Aprobar:** "aprobado", "sí", "1) aprobado 2) aprobado". El silencio, una pregunta o un "luego vemos" no aprueban.
- **Pedir cambios:** di qué quieres cambiar. Tus palabras se copian literalmente en el artefacto y el agente de la etapa lo rehace; después verás el gate de nuevo.
- **Aprobar la etapa pero no el commit:** los cambios se acumulan para el siguiente commit.
- **Preguntas de un agente** (sobre todo en la spec): se muestran con una respuesta propuesta. Basta con "OK a todas" o con indicar solo las que cambias.
- **Push:** siempre se propone aparte, con la rama y los commits, y necesita su propia aprobación.

Tu "aprobado" en el chat **es** la aprobación del commit (ADR-0025). Según tu modo de permisos, Claude Code puede pedirte además su permiso propio para `git commit` o `git push`.

## 5. Correcciones
- **Red check `FAIL`:** los tests no fallan por el motivo correcto (o alguno pasa sin implementación). Vuelven al `test-author`.
- **Verify `FAIL`:** el informe dice a quién se atribuye cada fallo, al código o a un test, y vuelve a ese agente.
- **Review `CHANGES_REQUESTED`:** los hallazgos bloqueantes y mayores vuelven a su responsable; después se repiten verify y review. Los menores y los "nit" los decides tú en el gate.
- **Límite:** cada contador (tests, implement, review) admite `max_iterations` intentos (3 por defecto). Si se agotan, la feature se bloquea y recibes un resumen con las opciones.
- Cada corrección pasa por los gates de las etapas que se repiten, aunque alguno sea de trámite: una etapa, una aprobación.

## 6. Otros comandos
- **`/sdd-beto:status [NNN-slug]`:** tabla de features, detalle de la actual, comprobaciones de consistencia y el siguiente paso sugerido. Nunca modifica nada.
- **`/sdd-beto:<etapa> [NNN-slug]`:** ejecuta una sola etapa, sin encadenar la siguiente. Útil para repetir o retomar una etapa concreta.

## 7. Excepciones al flujo
La constitución base (Art. B1.2) permite, sin spec completa pero con commit aprobado: erratas, cambios solo de textos o estilos, actualizaciones de dependencias sin cambios de API y **hotfixes**.

Para un hotfix, reinicia Claude Code con la variable de entorno `SDD_BYPASS=1`: el `stage-guard` deja de bloquear la edición de producción fuera de una feature. Después hay que documentarlo con una spec retroactiva. Los guards de los subagentes siguen activos.

## 8. Configuración
- **`.sdd/config.json`:** ámbitos (globs de producción y de test, comandos), rutas, idioma, ramas, estilo de commits, iteraciones y modelos. El esquema está en `plugins/sdd-beto/templates/config.schema.json`. Cambiarla es un cambio del proyecto con su propio commit; `/sdd-beto:status` te enseña cómo clasifica los archivos.
- **Comandos:** deben funcionar tanto en la shell del sistema (`cmd.exe` en Windows) como en Bash o PowerShell. Pon entre comillas las rutas a ejecutables.
- **Modelos:** `"models": { "verifier": "sonnet" }` cambia el modelo de un agente en ese proyecto.
- **Plantillas:** si creas `.sdd/templates/<nombre>.md`, se usa en lugar de la del plugin (spec, plan, tasks, informes y secciones de `CLAUDE.md`).
- **Constitución:** la Parte II solo cambia mediante un ADR del proyecto. La base la escribe el plugin y no se edita.
- **Nunca edites `state.json` a mano.** Si hay una inconsistencia, `/sdd-beto:status` propone la reparación y la aplica la sesión principal con tu aprobación.

## 9. Qué protegen los hooks
| Guard | Qué bloquea |
|---|---|
| `role-guard` | Que un agente `sdd-beto:*` escriba fuera de sus rutas, fuera de su etapa o fuera de una rama de feature. Los agentes que escriben casillas de `tasks.md` solo pueden marcarlas |
| `stage-guard` | Que cualquiera, incluida la sesión principal, edite código de producción sin una feature con spec y plan aprobados |
| `git-guard` | Que un subagente use git con escritura (commit, push, checkout…) |

Los archivos del propio flujo (`.sdd/`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, specs y ADRs) nunca cuentan como producción, aunque un glob como `**` los abarque (ADR-0023). En un proyecto sin `.sdd/config.json`, los hooks no hacen nada.

## 10. Solución de problemas
| Síntoma | Causa y solución |
|---|---|
| "no existe .sdd/config.json" | El proyecto no ha adoptado el flujo: ejecuta `/sdd-beto:init` |
| "config.json no es válido: …" | El mensaje dice qué campo falla. Corrígelo o reejecuta `init` |
| `[SDD stage-guard] … es código de producción …` | Estás editando producción fuera de una feature con spec y plan aprobados. Crea la feature (`/sdd-beto:new`) o, solo para un hotfix, usa `SDD_BYPASS=1` |
| `[SDD role-guard] …` | Un agente intentó escribir fuera de su rol. Normalmente el propio agente lo informa con `NEEDS_INPUT`; revisa el motivo antes de seguir |
| Un archivo de producción aparece como "otro" (o al revés) | Revisa los globs con `/sdd-beto:status` y ajusta la config |
| El `verifier` informa `BLOCKED (entorno)` | Falta algo para ejecutar los tests (servicio, dependencias). Sigue el `env_hint` del ámbito; el plugin nunca lo ejecuta por ti |
| El ratchet de lint falla con código 2 | El linter no está disponible o su salida no es la esperada. Comprueba el comando `lint_ratchet` desde la raíz del ámbito |
| `integrate` dice que hay marcas rotas en `CLAUDE.md` | Hay una marca `sdd-beto:…:start` o `:end` repetida o suelta. Déjala con una de cada por sección y reejecuta `init` |
| Una delegación se interrumpe | Puede ser un corte del entorno. La etapa sigue en curso: pide que se relance |
| Muchos avisos de permiso | Acepta los permisos locales en el paso 4 de `init`. Tras actualizar el plugin, reejecuta `init` para que apunten a la versión nueva |
