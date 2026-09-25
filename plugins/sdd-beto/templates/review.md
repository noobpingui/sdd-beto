# Review NNN — <Título de la feature>

- **Iteración:** <n> de <max_iterations>
- **Diff revisado:** `git diff <base_branch>...<rama>` @ `<sha>` (+ cambios sin commitear, si los hay)
- **Veredicto:** APPROVED | CHANGES_REQUESTED

## 1. Resumen
<!-- 2 a 4 líneas: qué hace el cambio y la impresión general. -->

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 | Sí / No / Parcial | |

## 3. Cumplimiento del plan
<!-- Desviaciones respecto a plan.md y si están justificadas. -->

## 4. Checklist de la constitución
### Parte I (base)
- [ ] B2: cada agente se mantuvo en su rol; los tests no cambiaron durante implement (hashes de `tests_snapshot` y diff desde `commits.tests`)
- [ ] B4: los marcadores `SDD:` son coherentes con los AC que prueban
- [ ] B5: no hay tests borrados, saltados ni debilitados; sin llamadas a servicios externos reales; esqueletos sustituidos por la implementación
- [ ] B5.7: sin errores nuevos de lint ni de tipos
- [ ] B6.5: sin secretos; variables nuevas documentadas en `.env.example`

### Parte II (proyecto)
<!-- Una casilla por artículo relevante de `.sdd/constitution.md` (P1, P2, P3, P4). -->
- [ ] P…

## 5. Hallazgos
<!--
Severidad:
  BLOQUEANTE  impide aprobar
  MAYOR       debe corregirse ahora
  MENOR       se puede diferir a una tarea futura con aprobación del usuario
  NIT         sugerencia opcional
Responsable: el agente al que el orquestador devuelve el hallazgo (spec-writer | planner | test-author | implementer).
-->
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | | | | |

## 6. Decisión
<!-- APPROVED solo si no hay hallazgos BLOQUEANTES ni MAYORES abiertos. -->
