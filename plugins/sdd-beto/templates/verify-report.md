# Verify report NNN — <Título de la feature>

- **Modo:** red (tras la etapa tests) | full (etapa verify)
- **Fecha:** <ISO-8601 obtenida del sistema> · **Rama:** `<rama>` @ `<sha>` · **Base:** `<base_branch>`
- **Resultado:** PASS | FAIL | BLOCKED (entorno)

## 1. Comandos ejecutados
<!-- Una fila por comando declarado en `scopes.<ámbito>.commands` de la config, solo de los ámbitos tocados.
     Los comandos a null no se ejecutan ni se listan. -->
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| <ámbito> | `<test>` (`<root>`) | ✅ / ❌ / ⚠️ | <p. ej. 30 passed> |
| <ámbito> | `<lint>` o ratchet | | <errores / violaciones nuevas> |
| <ámbito> | `<typecheck>` | | |
| <ámbito> | `<build>` | | |

<!--
Modo red: solo se ejecutan los tests nuevos (los que llevan el marcador SDD:). PASS significa que TODOS fallan
por comportamiento ausente, no por errores de sintaxis, configuración, fixture o imports fuera del plan.
-->

## 2. Trazabilidad
| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.1 | T-010, T-021 | `<archivo>::<test>` | ✅ |

- AC sin test: —
- REQ sin tarea: —
- Tareas sin marcar `[x]`: —
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: —

## 3. Criterios de aceptación manuales
<!-- AC que no se pueden comprobar de forma automática (visuales, UX): se listan para que los pruebe el usuario en el gate. -->

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
