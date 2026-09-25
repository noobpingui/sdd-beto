# ADR-0007 — Git: rama por feature y un commit por etapa, solo desde el orquestador

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario (granularidad) y Claude (convenciones)

## Contexto
Cada commit y cada push requieren aprobación, así que la granularidad de los commits determina la fricción del flujo. Las convenciones de rama y de mensaje varían entre proyectos.

## Decisión
- **Rama por feature:** `<prefijo>/NNN-slug`, con los prefijos de `branches` en la config (por defecto `feat` para `feature`, `fix` para `fix` y `refactor` para `refactor`). La crea `/sdd-beto:new` desde la rama actual, con aprobación, y la guarda como `state.json.base_branch`. El valor por defecto de la config es `base_branch`; **nunca** se asume `main` en el código.
- **Un commit por etapa que produce artefactos:** `Add spec for NNN-slug`, `Add plan for …`, `Add tasks for …`, `Add failing tests for …`, `Implement …`, `Add review for …` (incluye `verify-report.md`), `Update docs for …` y `Close …` (solo `state.json`). Las correcciones usan `Fix <qué> for NNN-slug (iteration N)`.
- **Idioma y estilo de los mensajes:** `commits` en la config (por defecto, inglés en imperativo sin prefijos convencionales). Todos terminan con la línea `Co-Authored-By` del entorno.
- **Solo el orquestador** ejecuta `git add`, `commit`, `push`, `merge` y `checkout -b`, y siempre tras mostrar el resumen y recibir aprobación. `git add` con rutas explícitas; nunca `-A`, `--no-verify`, `--amend` sobre commits aprobados ni `push --force` a la rama base.
- **Antes de cada commit se verifica la rama actual**, porque otra ventana (p. ej. el IDE) puede haberla cambiado.
- **SHA con retraso:** el sha de un commit se registra en `state.json` y entra en el commit siguiente.
- **Cierre:** el orquestador propone PR (recomendado) o merge local contra `base_branch`; cada push lleva su propia aprobación.

## Consecuencias
- (+) Historia legible y puntos de retorno por etapa.
- (−) Commits de solo documentación en la rama; quien prefiera una historia limpia puede usar squash merge.
