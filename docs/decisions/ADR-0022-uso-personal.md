# ADR-0022 — Uso personal: repositorio privado y sin licencia

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario
- **Matiza:** ADR-0014 (distribución) y ADR-0019 (idioma)
- **Documentación consultada:** `plugins/host-marketplace` → *Grant access to a private marketplace*, `discover-plugins` → *Add a private marketplace* (Claude Code v2.1.282)

## Contexto
El plugin es para los proyectos del propio usuario, no para distribución pública. Un marketplace en un repo privado funciona igual que uno público: Claude Code clona con las credenciales de git que ya tiene la máquina y nunca pide contraseña.

## Decisión
- **El repositorio `sdd-beto` es privado** y **no lleva licencia** (ni `LICENSE` ni el campo `license` en `plugin.json`).
- **Instalación** en cada proyecto o máquina del usuario, con la URL HTTPS completa, que usa el gestor de credenciales de git (el formato corto `owner/repo` puede intentar SSH):
  ```
  claude plugin marketplace add https://github.com/noobpingui/sdd-beto.git
  claude plugin install sdd-beto@sdd-beto
  ```
  Comprobado en la Fase 2 con el repo ya privado ([`02-verificacion-esqueleto.md`](../02-verificacion-esqueleto.md)).
- **La neutralidad se mantiene** (`CLAUDE.md`, sección Neutralidad): el plugin se usará en varios proyectos del usuario, así que sigue sin contener nada específico de ninguno.
- **Idioma:** la consecuencia de ADR-0019 sobre abrir el plugin a más usuarios queda sin efecto; los prompts en español son la opción definitiva mientras el uso sea personal.

## Consecuencias
- (+) Nada del contenido del repo es visible para terceros.
- (−) Cada máquina necesita credenciales de GitHub guardadas en el gestor de credenciales de git. Sin ellas, añadir o actualizar el marketplace falla sin preguntar.
- (−) El auto-update en segundo plano de un marketplace privado también depende de esas credenciales; si falla, se actualiza a mano con `claude plugin update sdd-beto`.
