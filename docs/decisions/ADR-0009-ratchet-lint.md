# ADR-0009 — Lint con ratchet: solo cuentan las violaciones nuevas

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario (P5 de `docs/00-discovery.md`)

## Contexto
Muchos proyectos tienen violaciones de lint previas. Un lint directo sobre un archivo tocado obligaría a arreglar líneas ajenas a la feature, y el código existente no se debe reformatear fuera de una tarea que lo pida. Cada linter formatea su salida de forma distinta.

## Decisión
Cada ámbito de la config puede declarar, de forma independiente:

- **`lint`**: un comando que pasa o falla (sin ratchet). Para proyectos sin deuda de lint, o con linters que distinguen errores de warnings.
- **`lint_ratchet`**: `{ "format": "<adaptador>", "cmd": "<comando>" }`. El script `lint-ratchet.mjs` del plugin:
  1. toma los archivos cambiados respecto a la base (`git diff <base>...HEAD` más los no confirmados) que pertenecen a `prod` o `tests` del ámbito;
  2. para cada uno, ejecuta el comando sobre el contenido actual y sobre el de la base (`git show <base>:<archivo>`; archivo nuevo = base vacía), pasando el contenido por stdin;
  3. cuenta violaciones por regla con el adaptador del formato y **falla solo si alguna regla aumenta**.

  Adaptadores de la v1: `ruff` y `eslint` (ambos admiten stdin con nombre de archivo y salida JSON).
- **Base:** argumento explícito o `state.json.base_branch`; nunca un nombre fijo.
- **Salida:** 0 = sin violaciones nuevas, 1 = hay nuevas, 2 = error de entorno (linter no instalado) → `BLOCKED (entorno)`. Los mensajes `fatal:` de git se silencian.

## Consecuencias
- (+) La deuda previa no bloquea features y la nueva no entra.
- (+) Añadir un linter es escribir un adaptador pequeño con sus tests.
- (−) Contar por regla y archivo no detecta que una violación se "movió" de línea; es aceptable.
- (−) Los linters sin stdin ni salida estructurada solo pueden usar `lint` sin ratchet.
