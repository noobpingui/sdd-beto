# ADR-0006 — Modelo de cada agente, con valores por defecto configurables

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario (reparto) y Claude (mecanismo)
- **Documentación consultada:** `sub-agents` → orden de resolución del modelo (Claude Code v2.1.282)

## Contexto
Los roles de juicio (especificar, diseñar, revisar) y los mecánicos (descomponer, escribir código, ejecutar comandos) piden modelos distintos. Los archivos de agente del plugin no los puede editar el proyecto, pero la herramienta Agent acepta un `model` por invocación, que tiene prioridad sobre el frontmatter.

## Decisión
- **Valores por defecto en el frontmatter de cada agente**, con alias (no IDs fijos) para usar siempre la versión vigente:

  | Agente | Modelo | Motivo |
  |---|---|---|
  | `spec-writer`, `planner`, `reviewer` | `opus` | ambigüedades, arquitectura y juicio crítico |
  | `task-breaker`, `test-author`, `implementer`, `doc-keeper` | `sonnet` | trabajo estructurado y escritura de código |
  | `verifier` | `haiku` | ejecuta comandos y compara con criterios explícitos |

- **Sobrescritura por proyecto:** `models.<agente>` en `.sdd/config.json`. Si existe, el orquestador lo pasa como `model` al delegar.

**Evaluado en la Fase 6** (ADR-0021): el `verifier` con haiku respetó el formato del informe final y generó las fechas con `sdd-state now` en sus tres informes de la prueba en seco. Se mantiene haiku.

## Consecuencias
- (+) Equilibrio entre coste, velocidad y calidad, ajustable sin tocar el plugin.
- (−) Con `haiku`, el `verifier` tiende a ignorar el formato del informe y a inventar fechas. Se mitiga exigiendo el formato en el prompt de delegación y obteniendo las fechas con un comando. En la prueba en seco (Fase 6) se evalúa si el valor por defecto debe ser `sonnet`.
