# ADR-0028 — Repositorio público con licencia MIT

- **Estado:** Aceptada · 2026-10-03
- **Decidido por:** usuario
- **Sustituye:** ADR-0022 (uso personal: repositorio privado y sin licencia)
- **Matiza:** ADR-0014 (distribución) y ADR-0019 (idioma)
- **Documentación consultada:** `plugins-reference` → *Plugin manifest schema* (campo `license`), `discover-plugins` → *Add a marketplace* y *Add a private marketplace* (Claude Code v2.1.288)

## Contexto
La ADR-0022 hacía de `sdd-beto` un plugin de uso personal, en un repo privado y sin licencia. El usuario decidió abrirlo al público y ya cambió la visibilidad del repositorio en GitHub. Un repo público sin licencia se puede leer, pero no da a nadie permiso para usar, copiar ni modificar el código: por defecto rigen todos los derechos reservados. La licencia es lo que convierte "visible" en "utilizable".

Al instalarlo, Claude Code copia solo la carpeta del plugin (`plugins/sdd-beto/`) a la caché del usuario (ADR-0014). La raíz del repo no viaja con esa copia.

## Decisión
- **El repositorio `sdd-beto` es público.**
- **Licencia MIT**, con el nombre real del usuario como titular del copyright:
  - `LICENSE` en la raíz del repo, que es donde GitHub la detecta;
  - una copia idéntica en `plugins/sdd-beto/LICENSE`, para que la nota de licencia que exige la MIT acompañe a cada instalación;
  - `"license": "MIT"` en `plugin.json`, como identificador SPDX, que es lo que pide el esquema del manifiesto.
- **Instalación:** se mantiene la URL HTTPS completa de la ADR-0022, que ahora funciona sin credenciales. El formato corto `noobpingui/sdd-beto` también vale: Claude Code prueba SSH si hay una clave que autentique contra GitHub y, si no, clona por HTTPS.
- **README en dos idiomas:** `README.md` en inglés, que es lo que muestran la portada de GitHub y el `homepage` de `plugin.json`, y `README.es.md` en español, con el mismo contenido. Los dos enlazan al otro arriba y se cambian siempre juntos. El inglés añade una nota sobre el idioma de los prompts y enlaza la documentación de `docs/` como "in Spanish".
- **Idioma:** los prompts y la documentación de `docs/` siguen en español (ADR-0019). La traducción al inglés queda como idea para una versión mayor en [`docs/ideas.md`](../ideas.md); abrir el repo no obliga a hacerla ahora.
- **Neutralidad:** sigue igual (`CLAUDE.md`, sección Neutralidad). Con el repo público es todavía más importante que no aparezca nada de ningún proyecto concreto.

## Consecuencias
- (+) Cualquiera puede instalar, usar, modificar y redistribuir el plugin, y el auto-update deja de depender de credenciales.
- (+) La MIT es la licencia más corta y habitual entre los plugins y herramientas de desarrollo.
- (−) Hay dos README que mantener sincronizados.
- (−) Hay dos copias del `LICENSE` que mantener idénticas (solo cambian si cambia el titular).
- (−) La MIT no incluye una cesión explícita de patentes, a diferencia de la Apache-2.0. Se acepta por su sencillez.
- (−) Todo el contenido del repo, historial de git incluido, es visible para terceros.
