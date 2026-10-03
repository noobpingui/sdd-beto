# ADR-0019 — Idioma: prompts en español, artefactos en el idioma de la config

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario (P4 de `docs/00-discovery.md`)
- **Matizada por:** ADR-0022 (uso personal) y ADR-0028 (repo público: la traducción queda como idea)

## Contexto
Los prompts de agentes y skills están en español y funcionan bien. Traducirlos o mantenerlos en dos idiomas duplica el trabajo de mantenimiento. Los proyectos consumidores pueden necesitar sus artefactos en otro idioma.

## Decisión
- **v1:** los prompts de agentes, skills, protocolo y constitución base, y los mensajes de los hooks, están **en español**.
- **`language`** en `.sdd/config.json` (por defecto `es`) decide el idioma de:
  - los artefactos que se generan (`spec.md`, `plan.md`, informes, `review.md`…);
  - los mensajes del orquestador al usuario (gates, resúmenes).
- Fijos en cualquier idioma: palabras clave de EARS y Given/When/Then, IDs (`REQ`, `AC`, `NFR`, `T`), el marcador `SDD:`, el mensaje `not implemented` de los esqueletos y los valores de `STATUS` de los informes.
- **Commits:** los rige `commits.language` (ADR-0007), independiente de `language`.
- Los textos del propio código del proyecto (UI, comentarios) siguen su constitución (Parte II), no esta ADR.

## Consecuencias
- (+) Un solo juego de prompts que mantener.
- (−) Un proyecto en inglés tendrá prompts en español generando artefactos en inglés. Funciona, pero si el plugin se abre a más usuarios, valorar prompts en inglés en una versión mayor.
