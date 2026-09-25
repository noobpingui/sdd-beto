# ADR-0002 — Formato de requisitos: historia de usuario, EARS y Given/When/Then

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario

## Contexto
El `verifier` y el `reviewer` necesitan requisitos precisos y comprobables, y el usuario tiene que poder leer la spec de un vistazo en el gate. EARS por sí solo es preciso pero árido; las historias de usuario por sí solas son ambiguas.

## Decisión
`spec.md` combina:
1. **Historia de usuario** como contexto: "Como … quiero … para …".
2. **Requisitos funcionales** `REQ-NNN` en EARS: `THE SYSTEM SHALL …`, `WHEN … THE SYSTEM SHALL …`, `IF … THEN THE SYSTEM SHALL …`, `WHILE …`, `WHERE …`.
3. **Criterios de aceptación** `AC-NNN.M` en Given/When/Then, cada uno comprobable con un test automatizado.
4. **Requisitos no funcionales** `NFR-NNN`, solo si aplican, con criterios `AC-NNNN.M` (prefijo `N`, p. ej. `AC-N001.1`).

Las palabras clave de EARS se mantienen en inglés en cualquier idioma de artefactos (ADR-0019), porque son un formato, no prosa.

## Consecuencias
- (+) Cada REQ y AC tiene un ID que se rastrea hasta sus tareas y tests (ADR-0003).
- (+) Los AC en Given/When/Then se traducen casi directamente a tests.
- (−) Escribir la spec cuesta más; ese trabajo recae en el `spec-writer`, no en el usuario.
