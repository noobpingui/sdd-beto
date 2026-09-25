# ADR-0010 — Harness propio, inspirado en GitHub Spec Kit y Kiro

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** Claude (sin compromisos relevantes)

## Contexto
Ya existen herramientas de SDD:
- **GitHub Spec Kit:** constitución, `/specify`, `/plan` y `/tasks`, con plantillas.
- **Kiro:** requirements en EARS, design y tasks.

Ninguna ofrece a la vez roles aislados por agente, enforcement con hooks por `agent_type`, gates en cada etapa y soporte de primera clase para Windows.

## Decisión
Se construye un plugin propio y ligero que toma ideas concretas de ambas:
- **De Spec Kit:** la constitución no negociable, plantillas con secciones obligatorias, numeración `NNN-slug` y la clarificación explícita de ambigüedades en la spec.
- **De Kiro:** requisitos en EARS y la secuencia requirements → design → tasks con trazabilidad.
- **Propio:** un agente por rol con permisos aislados, `state.json` como máquina de estados, hooks de enforcement, comprobación del rojo y aprobación antes de cada commit y push.

Sin dependencias externas: Markdown, JSON y scripts Node (ADR-0020).

## Consecuencias
- (+) Se entiende completo y no depende de terceros.
- (−) Las mejoras de Spec Kit o Kiro hay que incorporarlas a mano.
