# ADR-0005 — TDD estricto con comprobación del rojo

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario

## Contexto
Si los tests se escriben después del código, tienden a reflejar la implementación en lugar de la spec.

## Decisión
- **El `test-author` escribe los tests** a partir de `spec.md` y `tasks.md`, **antes** de que exista la implementación, con el marcador `SDD:` de cada AC (ADR-0003).
- **Red check:** el `verifier`, en modo `red`, ejecuta solo los tests nuevos y confirma que **cada uno** falla por comportamiento ausente:
  - **rojo legítimo:** aserción fallida, recurso inexistente (p. ej. 404), método ausente, el error `not implemented` de un esqueleto (ADR-0012), o un import de un módulo que el plan define y aún no existe;
  - **rojo ilegítimo:** errores de sintaxis, de fixture o de configuración del test, imports de módulos fuera del plan, errores de tipos en el propio test.

  Un test que pasa sin implementación es FAIL: no prueba nada.
- **El `implementer` no puede modificar tests.** Si cree que uno es incorrecto, termina con `NEEDS_INPUT` y el orquestador lo devuelve al `test-author` o escala.
- **Corregir un test después de `implement`** no repite el red check (el test debe pasar); el orquestador actualiza `tests_snapshot` y el `reviewer` confirma que sigue probando su AC.
- **Integridad:** al aprobar la etapa `tests`, el orquestador guarda el SHA-256 de cada archivo de test tocado (`tests_snapshot`), y el `reviewer` lo compara. Esto detecta también escrituras hechas desde la shell.
- **Alcance:** solo el código nuevo o modificado por la feature.
- Los comandos para ejecutar tests salen de `scopes.<ámbito>.commands` (ADR-0016). Si el entorno no responde, el resultado es `BLOCKED (entorno)` con la pista `env_hint`, no FAIL.

## Consecuencias
- (+) Los tests validan la spec y la trazabilidad REQ → test queda garantizada.
- (−) El código muy acoplado es difícil de probar así; cada proyecto fija en su constitución cómo aislar dependencias.
