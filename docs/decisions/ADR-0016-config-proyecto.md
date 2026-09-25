# ADR-0016 — Configuración por proyecto en `.sdd/config.json`

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** Claude, a partir del borrador del brief y de las respuestas P3–P6 del usuario

## Contexto
El plugin no puede tener rutas ni comandos de ningún proyecto. El guard, el ratchet y los agentes `test-author`, `implementer`, `verifier` y `doc-keeper` necesitan saber qué es código de producción, qué son tests y cómo se ejecutan los tests, el lint, el typecheck y el build de cada parte del repo.

## Decisión
Cada proyecto tiene `.sdd/config.json`, generado por `/sdd-beto:init` y versionado en el repo. Todo campo salvo `schema_version` y `scopes` tiene valor por defecto. Ejemplo con valores inventados:

```jsonc
{
  "schema_version": 1,
  "language": "es",                         // artefactos y mensajes al usuario (ADR-0019)
  "base_branch": "main",                    // valor por defecto; la feature guarda la suya en state.json
  "branches": { "feature": "feat", "fix": "fix", "refactor": "refactor" },
  "commits": { "language": "en", "style": "imperative, no conventional prefixes" },
  "max_iterations": 3,
  "paths": {
    "specs": "specs",
    "adr": "docs/decisions",
    "docs": ["README.md", "docs/**"],       // escribibles por el doc-keeper (además de CLAUDE.md § Proyecto)
    "env_examples": ["**/.env.example"]
  },
  "scopes": {
    "api": {
      "root": "api",                        // cwd de sus comandos
      "prod": ["api/**"],
      "tests": ["api/tests/**"],
      "commands": {
        "test": "python -m pytest -q",
        "test_files": "python -m pytest -q {files}",
        "test_check": "python -m pytest --collect-only -q {files}",
        "lint": null,
        "lint_ratchet": { "format": "ruff", "cmd": "python -m ruff check --output-format json --stdin-filename {file} -" },
        "typecheck": null,
        "build": null
      },
      "env_hint": "docker compose up -d db"
    },
    "web": {
      "root": "web",
      "prod": ["web/**"],
      "tests": ["web/src/**/*.test.{ts,tsx}", "web/src/test/**"],
      "commands": {
        "test": "npm test",
        "test_files": "npx vitest run {files}",
        "test_check": "npx tsc -b",
        "lint": "npm run lint",
        "lint_ratchet": null,
        "typecheck": "npx tsc -b",
        "build": "npm run build"
      },
      "env_hint": "npm ci"
    }
  },
  "models": { "verifier": "sonnet" }       // opcional; sobrescribe ADR-0006
}
```

### Reglas
- **Globs** con la sintaxis de ADR-0020: `**`, `*`, `?` y `{a,b}`. Sin extglob.
- **Clasificación de una ruta** (relativa a la raíz, con `/`):
  - **test** si coincide con algún `scopes.*.tests`;
  - **producción** si coincide con algún `scopes.*.prod` y no es test, ni un `paths.env_examples`, ni un `README.md`;
  - todo lo demás no es ni producción ni test (p. ej. configuración del repo), y el guard no lo restringe para la sesión principal.
- **Comandos:** cadenas que se ejecutan con la shell desde `scopes.<ámbito>.root`. `{files}` se sustituye por las rutas relativas a `root`; `{file}`, por una sola. `null` = no aplica. `test_check` comprueba que los tests nuevos se recolectan o compilan sin exigir que pasen.
- **`env_hint`:** lo que el `verifier` y el `implementer` sugieren al usuario cuando el entorno no responde. **Nunca lo ejecutan.**
- **`scope` de una feature** en `state.json` es la lista de nombres de ámbitos que toca (p. ej. `["api"]`), en lugar de booleanos fijos.
- **Validación:** los scripts del plugin validan la config al cargarla y, si no es válida, el error dice qué campo falla. Se publicará un JSON Schema en `templates/` para autocompletado en el editor.
- **Cambios:** la config es parte del repo; cambiarla es un cambio del proyecto con su propio commit aprobado.

## Consecuencias
- (+) El mismo plugin sirve para monorepos, proyectos de un solo lenguaje y stacks que no conocemos.
- (+) El guard pasa a ser una función pura de (config, state, ruta, agente), fácil de testear.
- (−) La config puede ejecutar comandos arbitrarios. No es nuevo: los ejecutan agentes sujetos a los permisos normales, y la config vive en el propio repo, igual que un `package.json`.
- (−) Un glob mal escrito puede dejar código de producción sin proteger. `/sdd-beto:status` mostrará qué archivos del repo clasifica como producción y como test, para revisarlo.
