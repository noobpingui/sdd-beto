# ADR-0004 — Gate humano al cerrar cada etapa y ciclos de corrección acotados

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario (gate en cada etapa) y Claude (formato)

## Contexto
El usuario quiere controlar el flujo de cerca. Los agentes pueden equivocarse en bucle si nadie limita las correcciones.

## Decisión
- **El orquestador se detiene al cerrar cada etapa** (`spec → plan → tasks → tests → implement → verify → review → docs → close`) y espera una aprobación explícita.
- **Contenido del gate:** qué se produjo (rutas), decisiones del agente, verificación objetiva, qué debe revisar el usuario, siguiente etapa, preguntas abiertas y, si la etapa hace commit, el commit propuesto en una sección aparte.
- **Qué es aprobación:** solo una respuesta explícita ("aprobado", "sí" o equivalente claro). El silencio, una pregunta o una respuesta ambigua no aprueban. Nunca se agrupan varias etapas en una aprobación.
- **Commit y push:** la etapa y su commit se aprueban por separado en el mismo mensaje; si solo se aprueba la etapa, no hay commit. Los pushes se aprueban siempre aparte.
- **Ciclos de corrección:** si el red check, `verify` o `review` fallan, el trabajo vuelve al agente responsable con los hallazgos. Tras `max_iterations` (por defecto 3, configurable) se escala al usuario con un resumen de los intentos, la causa probable y las opciones.
- **Reapertura:** un hallazgo que afecta a la spec o al plan reabre esa etapa y anula las aprobaciones posteriores.

## Consecuencias
- (+) Control total y detección temprana de desviaciones.
- (−) Unas 9 pausas por feature. Un modo con menos pausas (`gate_mode`) queda para después de la v1 (ADR-0021) y exigirá una ADR propia.
