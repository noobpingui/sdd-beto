# ADR-0021 — Alcance de la v1

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario, a propuesta de Claude

## Contexto
El brief lista ocho mejoras candidatas además del portado. Incluirlas todas retrasaría tener un plugin usable; dejarlas todas fuera obligaría a portar partes frágiles que ya sabemos que hay que cambiar.

## Decisión
**Entra en la v1 (hasta `1.0.0`):**
1. Portado y parametrización completos: agentes, skills, protocolo, plantillas, constitución base, guard y ratchet genérico (ADR-0008, ADR-0009, ADR-0016, ADR-0017).
2. `/sdd-beto:init` (ADR-0018).
3. **CLI `sdd-state.mjs`** (`init`, `start`, `approve`, `advance`, `snapshot`, `commit`, `rework`, `block`, `validate`). Motivo: con las rutas en la config, los `node -e` improvisados del orquestador serían aún más frágiles; una CLI con tests fija el formato de `state.json`, las fechas y el historial.

**Queda para versiones `1.x`:**
- Modo `refactor` con red check invertido (tests de caracterización).
- Detección en el hook de escrituras desde la shell.
- Hook `SubagentStop` que valide el formato del informe final (la doc confirma que recibe `last_assistant_message`).
- Modo con menos pausas (`gate_mode`).
- Hook que proteja las secciones de `CLAUDE.md`.
- Plantilla de CI genérica.

**Se evalúa en la Fase 6, sin código nuevo:** el modelo por defecto del `verifier` (ADR-0006).

## Consecuencias
- (+) Un plugin usable antes, con la pieza más propensa a errores (`state.json`) ya robusta.
- (−) Las escrituras desde la shell siguen sin bloquearse en la v1; las mitigaciones de ADR-0005 y ADR-0008 siguen vigentes.
