# ADR-0026 — Permisos locales del plugin propuestos por init

- **Estado:** Aceptada · 2026-09-26
- **Decidido por:** usuario (opción (a) del hallazgo O1 de la Fase 6)
- **Amplía:** ADR-0024 (integración de `init`)
- **Documentación consultada:** `permissions` (*Read and Edit*, *Compound commands*) y `settings` (*Where Claude Code keeps the local file*) (Claude Code v2.1.283)

## Contexto
En la prueba en seco hubo 156 avisos de permiso ([`06-prueba-en-seco.md`](../06-prueba-en-seco.md), O1). Muchos se repetían en cada etapa:
- leer los archivos del plugin (constitución base, plantillas, protocolo), que están fuera del proyecto;
- ejecutar `sdd-state` y `lint-ratchet`, las CLIs del plugin.

En una sesión interactiva, cada uno interrumpe al usuario. El `allowed-tools` de las skills no lo evita: solo vale durante el turno en que se invoca la skill.

La documentación fija las restricciones:
- **Rutas absolutas:** una regla `Read` absoluta se escribe con `//`, y en Windows la ruta se normaliza a forma POSIX (`C:\x` → `//c/x`).
- **Reglas Bash:** se comparan con el texto literal de cada subcomando. Un comando compuesto pasa si cada parte coincide con una regla o es de solo lectura (un `cd` dentro del proyecto lo es).
- **`.claude/settings.local.json`:** es personal. Si lo escribe Claude Code, lo añade a los *excludes* globales de git. Si lo crea otra herramienta, hay que ignorarlo a mano. En Windows vive junto a `.claude/settings.json`.

## Decisión
- **`sdd-init integrate --local-permissions`** añade a `permissions.allow` de `.claude/settings.local.json`:
  - `Read(//<ruta POSIX del plugin>/**)`;
  - `Bash(node <plugin>/scripts/sdd-state.mjs *)` y `Bash(node <plugin>/scripts/lint-ratchet.mjs *)`. En Windows se escriben con las dos formas de la ruta (`C:/…` y `C:\…`), porque no hay garantía de cuál usará el modelo.
- **Es opcional:** es una de las tres preguntas del gate 4 de `init`, con recomendación "sí" si se va a usar el flujo en una sesión interactiva.
- **`.gitignore`:** si git no ignora ya `.claude/settings.local.json`, el script lo añade. Si el archivo está versionado, no lo toca y avisa.
- **Actualizaciones del plugin:** la ruta del plugin cambia con cada versión. El script reconoce sus propias reglas (las de las CLIs del plugin y las `Read` de una ruta con un segmento `sdd-beto`), sustituye las de otras versiones y no toca las del usuario. `scan` informa de si las reglas están al día (`sdd.local_permissions.up_to_date`), y el modo actualización de `init` lo propone de nuevo.
- **Protocolo y agentes:** las CLIs se invocan de forma literal, sin comillas alrededor de la ruta y sin guardarlas en variables de shell, para que coincidan con las reglas.

## Consecuencias
- (+) Desaparecen los avisos más repetidos del flujo sin conceder permisos amplios: solo lectura del plugin y sus dos CLIs.
- (+) Las reglas no se versionan: cada máquina tiene las suyas.
- (−) Tras actualizar el plugin hay que reejecutar `init` para que las reglas apunten a la versión nueva. Hasta entonces, simplemente vuelven los avisos.
- (−) Las reglas Bash dependen de la forma en que el modelo escribe el comando. Se mitiga con las dos formas de ruta en Windows y con la instrucción de invocar las CLIs de forma literal.
