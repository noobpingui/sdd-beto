# Guía de análisis para `/sdd-beto:init`

Material de apoyo de los pasos 1 a 3. Recoge **dónde buscar** y **qué forma tienen** los comandos que acepta `.sdd/config.json`. Los ejemplos son orientativos: el comando que se propone es el que usa **este** repo, con su evidencia (`archivo:línea`).

## 1. Orden de las evidencias
De más a menos fiable:
1. **CI** (`scan.ci`): lo que ejecuta el pipeline funciona de verdad. Fíjate en el directorio de trabajo de cada paso (`working-directory`, `cd`): será el `root` del ámbito.
2. **Scripts declarados:** `scripts` de `package.json`, objetivos del `Makefile` o `justfile`, `[tool.*]` de `pyproject.toml`, tareas de `tox`/`nox`.
3. **Documentación:** README, CONTRIBUTING, `docs/`. Los comandos de la documentación pueden estar desactualizados; contrástalos con los puntos 1 y 2.
4. **Archivos de configuración** de herramientas (`vitest.config.*`, `jest.config.*`, `pytest.ini`, `ruff.toml`, `.eslintrc*`, `eslint.config.*`, `tsconfig*.json`, `mypy.ini`…): indican que la herramienta se usa, no cómo se invoca.

Si solo hay evidencia de tipo 4, propón el comando habitual de esa herramienta y márcalo como **deducido** en el gate.

## 2. Ámbitos
- Un ámbito por unidad que se **testea y construye por separado**: cada paquete de un monorepo con su propio manifiesto, cada servicio, la aplicación cliente…
- Las carpetas compartidas sin tests propios (tipos comunes, utilidades) se asignan al ámbito que las testea. Si no las testea ninguno, pregúntalo en el gate.
- Infraestructura (Dockerfiles, IaC, pipelines) normalmente **no** es producción SDD: déjala fuera de `prod` salvo que el usuario quiera pasarla por el flujo.
- `root` es la carpeta desde la que se ejecutan los comandos del ámbito, normalmente la del manifiesto.

## 3. Globs de producción y de test
- Sintaxis: `**`, `*`, `?` y `{a,b}`. Sin negación ni clases: para excluir algo, enumera lo que sí entra.
- Los tests se reconocen **antes** que la producción: `prod: ["pkg/**"]` con `tests: ["pkg/**/*.test.ts"]` clasifica bien un test que vive junto al código.
- Patrones habituales de tests: `**/tests/**`, `**/test/**`, `**/__tests__/**`, `**/*.test.*`, `**/*.spec.*`, `**/test_*.py`, `**/*_test.py`, `**/*_test.go`, `spec/**`. Incluye también fixtures y utilidades de test (`conftest.py`, `testdata/`, `test-utils/`…): son del `test-author`, no del `implementer`.
- Quedan fuera de `prod` los generados y los vendorizados (`dist/`, `build/`, `vendor/`, `node_modules/`…). Si están versionados, el glob de `prod` no debe abarcarlos.
- Revisa `preview.suspicious`: son archivos de producción con nombre o carpeta de test. Casi siempre falta un patrón en `tests`.

## 4. Comandos por ecosistema
`{files}` se sustituye por las rutas relativas a `root`, separadas por espacios; `{file}`, por una sola ruta, ya entre comillas. No pongas comillas alrededor de los marcadores.

| Ecosistema | `test` | `test_files` | `test_check` (recolecta o compila, **sin ejecutar**) |
|---|---|---|---|
| Node · vitest | script `test` del manifiesto | `npx vitest run {files}` | `npx vitest list {files}` o el typecheck si es TypeScript |
| Node · jest | script `test` | `npx jest {files}` | `npx jest --listTests {files}` |
| Node · node:test | script `test` | `node --test {files}` | `null` (no hay forma fiable de recolectar sin ejecutar) |
| Python · pytest | `python -m pytest -q` | `python -m pytest -q {files}` | `python -m pytest --collect-only -q {files}` |
| Go | `go test ./...` | `null` (los tests se agrupan por paquete, no por archivo) | `go test -run '^
| Rust | `cargo test` | `null` (el filtro va por nombre, no por archivo) | `cargo test --no-run` |
| JVM · Maven / Gradle | `mvn -q test` / `./gradlew test` | `null` (el filtro va por clase) | `mvn -q test-compile` / `./gradlew testClasses` |
| .NET | `dotnet test` | `null` (el filtro va por nombre) | `dotnet build` del proyecto de tests |
| Ruby · RSpec | `bundle exec rspec` | `bundle exec rspec {files}` | `bundle exec rspec --dry-run {files}` |
| PHP · PHPUnit | `vendor/bin/phpunit` | `vendor/bin/phpunit {files}` | `vendor/bin/phpunit --list-tests` |

- `test_files` es opcional: si el ecosistema no filtra por archivo, `null`. En el red check, el `verifier` ejecuta entonces `test` y busca los tests nuevos por su nombre.
- Si el script `test` del manifiesto ejecuta en modo *watch* (p. ej. `vitest` sin `run`), propón la variante que termina (`npx vitest run`).
- `test_check` debe fallar si un test nuevo no compila o no se recolecta, y **no** debe exigir que pase. Si el ecosistema no tiene nada así, `null`.
- `typecheck`: `npx tsc --noEmit` o `npx tsc -b`, `mypy`, `pyright`… solo si el repo los usa.
- `build`: solo si el proyecto tiene un paso de build real. No lo ejecutes durante init.

### Lint con ratchet (ADR-0009)
El ratchet solo cuenta violaciones **nuevas**. Necesita un linter con salida JSON y que lea el archivo por stdin:

| `format` | `cmd` |
|---|---|
| `ruff` | `python -m ruff check --output-format json --stdin-filename {file} -` (o `ruff check …` si se invoca así en el repo) |
| `eslint` | `npx eslint --format json --stdin --stdin-filename {file}` |

Si el repo usa otro linter, usa `lint` (el comando normal, que debe pasar sin errores) y deja `lint_ratchet` en `null`. Si el lint tiene mucha deuda previa, `lint_ratchet` es la opción que no bloquea el flujo.

## 5. Estado de los tests y `env_hint`
- Busca lo que necesitan los tests para ejecutarse: servicios en `docker-compose*`, variables de `.env.example`, bases de datos de prueba, datos semilla. El CI suele declararlo (`services:`, pasos previos).
- `env_hint` es una indicación para el usuario, en una línea: "levanta la base de datos con `docker compose up -d db`", "copia `.env.example` a `.env`". **Nunca** se ejecuta.
- En el paso 2 solo se ejecutan los `test_check` que no necesiten nada de esto, y con permiso.

## 6. Constitución del proyecto: qué observar
- **P1 · Tests:** ubicación y nombre de los archivos, fixtures compartidas, cómo se aíslan las dependencias (fakes escritos a mano, mocks de la librería, contenedores), idioma de los nombres de test, qué servicios usan los tests de integración.
- **P1 · Forma de los esqueletos (Art. B5.6):** fíjala por lenguaje, con el mensaje exacto `not implemented`. Por ejemplo:

  | Lenguaje | Cuerpo de un esqueleto |
  |---|---|
  | TypeScript / JavaScript | `throw new Error("not implemented");`, con parámetros `_nombre` |
  | Python | `raise NotImplementedError("not implemented")`; `__init__` guarda las dependencias sin lanzar |
  | Go | `panic("not implemented")` |
  | Rust | `unimplemented!("not implemented")` o `todo!("not implemented")` |
  | Java / Kotlin | `throw new UnsupportedOperationException("not implemented");` / `TODO("not implemented")` |
  | C# | `throw new NotImplementedException("not implemented");` |
  | Ruby | `raise NotImplementedError, "not implemented"` |
  | PHP | `throw new \LogicException('not implemented');` |

  Si el proyecto ya tiene su propia convención, se respeta siempre que el mensaje sea `not implemented`.
- **P2 · Arquitectura:** capas o módulos y qué puede importar a qué, dónde viven la validación, la lógica de negocio y el acceso a datos, cómo se inyectan las dependencias, cómo se representan los errores, migraciones de datos y utilidades que ya existen y deben reutilizarse.
- **P3 · Seguridad:** cómo se autentica y autoriza (decoradores, middleware, guards), cómo se validan las entradas, dónde viven los secretos y cómo se accede a los datos (ORM, consultas parametrizadas).
- Lee 2 o 3 archivos representativos por ámbito antes de escribir una regla. Una regla que el código actual incumple de forma generalizada no es una convención: pregúntala.
 ./...` (compila sin ejecutar) |
| Rust | `cargo test` | `cargo test` (el filtro va por nombre, no por archivo) | `cargo test --no-run` |
| JVM · Maven / Gradle | `mvn -q test` / `./gradlew test` | según el plugin de test | `mvn -q test-compile` / `./gradlew testClasses` |
| .NET | `dotnet test` | `dotnet test` con filtro | `dotnet build` del proyecto de tests |
| Ruby · RSpec | `bundle exec rspec` | `bundle exec rspec {files}` | `bundle exec rspec --dry-run {files}` |
| PHP · PHPUnit | `vendor/bin/phpunit` | `vendor/bin/phpunit {files}` | `vendor/bin/phpunit --list-tests` |

- Si el script `test` del manifiesto ejecuta en modo *watch* (p. ej. `vitest` sin `run`), propón la variante que termina (`npx vitest run`).
- `test_check` debe fallar si un test nuevo no compila o no se recolecta, y **no** debe exigir que pase. Si el ecosistema no tiene nada así, `null`.
- `typecheck`: `npx tsc --noEmit` o `npx tsc -b`, `mypy`, `pyright`… solo si el repo los usa.
- `build`: solo si el proyecto tiene un paso de build real. No lo ejecutes durante init.

### Lint con ratchet (ADR-0009)
El ratchet solo cuenta violaciones **nuevas**. Necesita un linter con salida JSON y que lea el archivo por stdin:

| `format` | `cmd` |
|---|---|
| `ruff` | `python -m ruff check --output-format json --stdin-filename {file} -` (o `ruff check …` si se invoca así en el repo) |
| `eslint` | `npx eslint --format json --stdin --stdin-filename {file}` |

Si el repo usa otro linter, usa `lint` (el comando normal, que debe pasar sin errores) y deja `lint_ratchet` en `null`. Si el lint tiene mucha deuda previa, `lint_ratchet` es la opción que no bloquea el flujo.

## 5. Estado de los tests y `env_hint`
- Busca lo que necesitan los tests para ejecutarse: servicios en `docker-compose*`, variables de `.env.example`, bases de datos de prueba, datos semilla. El CI suele declararlo (`services:`, pasos previos).
- `env_hint` es una indicación para el usuario, en una línea: "levanta la base de datos con `docker compose up -d db`", "copia `.env.example` a `.env`". **Nunca** se ejecuta.
- En el paso 2 solo se ejecutan los `test_check` que no necesiten nada de esto, y con permiso.

## 6. Constitución del proyecto: qué observar
- **P1 · Tests:** ubicación y nombre de los archivos, fixtures compartidas, cómo se aíslan las dependencias (fakes escritos a mano, mocks de la librería, contenedores), idioma de los nombres de test, qué servicios usan los tests de integración.
- **P1 · Forma de los esqueletos (Art. B5.6):** fíjala por lenguaje, con el mensaje exacto `not implemented`. Por ejemplo:

  | Lenguaje | Cuerpo de un esqueleto |
  |---|---|
  | TypeScript / JavaScript | `throw new Error("not implemented");`, con parámetros `_nombre` |
  | Python | `raise NotImplementedError("not implemented")`; `__init__` guarda las dependencias sin lanzar |
  | Go | `panic("not implemented")` |
  | Rust | `unimplemented!("not implemented")` o `todo!("not implemented")` |
  | Java / Kotlin | `throw new UnsupportedOperationException("not implemented");` / `TODO("not implemented")` |
  | C# | `throw new NotImplementedException("not implemented");` |
  | Ruby | `raise NotImplementedError, "not implemented"` |
  | PHP | `throw new \LogicException('not implemented');` |

  Si el proyecto ya tiene su propia convención, se respeta siempre que el mensaje sea `not implemented`.
- **P2 · Arquitectura:** capas o módulos y qué puede importar a qué, dónde viven la validación, la lógica de negocio y el acceso a datos, cómo se inyectan las dependencias, cómo se representan los errores, migraciones de datos y utilidades que ya existen y deben reutilizarse.
- **P3 · Seguridad:** cómo se autentica y autoriza (decoradores, middleware, guards), cómo se validan las entradas, dónde viven los secretos y cómo se accede a los datos (ORM, consultas parametrizadas).
- Lee 2 o 3 archivos representativos por ámbito antes de escribir una regla. Una regla que el código actual incumple de forma generalizada no es una convención: pregúntala.
