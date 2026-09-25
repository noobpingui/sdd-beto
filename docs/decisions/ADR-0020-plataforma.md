# ADR-0020 — Plataforma: Node sin dependencias, portable a Windows

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** Claude (sin compromisos relevantes)
- **Documentación consultada:** `hooks` → *Exec form and shell form*, `plugins-reference` → *Environment variables* (Claude Code v2.1.282)

## Contexto
- El plugin debe funcionar en Windows (Git Bash y PowerShell), macOS y Linux.
- Las variables `${CLAUDE_PLUGIN_ROOT}` y `${CLAUDE_PLUGIN_DATA}` se sustituyen en hooks y en el cuerpo de skills y agentes, pero **no** están en el entorno de los comandos que Claude lanza con Bash.
- `path.matchesGlob` de Node es experimental y emite un `ExperimentalWarning` (comprobado en Node 20.19.4).
- Git en Windows convierte a CRLF al hacer checkout.

## Decisión
- **Node ≥ 20** para todos los scripts, **sin dependencias npm** (solo módulos integrados). No hay `package.json` con dependencias en el plugin.
- **Hooks en forma exec:** `"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/…", …]`. Sin shell intermedia ni problemas de comillas.
- **Scripts desde skills y agentes:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/<script>.mjs" …`, escrito en el cuerpo Markdown para que Claude Code sustituya la ruta. `bin/` queda como posible mejora tras probarlo en Windows (Fase 2).
- **Globs con un conversor propio** a expresiones regulares, con tests. Sintaxis soportada: `**`, `*`, `?` y `{a,b}`; sin extglob.
- **Tolerancia a CRLF:** todo parseo de archivos de texto (tasks, state, plantillas) acepta `\r\n`; los reemplazos automáticos también.
- **Rutas:** internamente siempre relativas a la raíz del proyecto y con `/`.
- **Fechas:** siempre del sistema (`new Date().toISOString()`), nunca escritas por un modelo.
- **Tests de los scripts** con `node --test`.
- **Versión mínima de Claude Code:** la probada en la Fase 6 (hoy, v2.1.282); se declara en el README.

## Consecuencias
- (+) Instalar el plugin no instala nada más, y funciona igual en los tres sistemas.
- (−) El conversor de globs es código propio que hay que mantener; es pequeño y está cubierto por tests.
