# ADR-0012 — Andamiaje (scaffold) antes del red check

- **Estado:** Aceptada · 2026-09-25
- **Decidido por:** usuario

## Contexto
En lenguajes con imports estáticos (p. ej. TypeScript), si un módulo nuevo no existe, **todo el archivo de test** falla con un único error de import. El `verifier` no puede comprobar entonces que **cada** AC falla por comportamiento ausente. Y ningún rol podía crear el módulo: el `test-author` no toca producción y el `implementer` actuaba después del red check.

## Decisión
- **Tareas `(scaffold)`:** el `task-breaker` crea una por cada módulo, función o clase **nuevos** que los tests importen. No hacen falta cuando la ausencia ya es rojo legítimo (p. ej. una ruta HTTP inexistente que da 404).
- **Secuencia de la etapa `tests`:** `implementer` en **modo `scaffold`** → `test-author` → `verifier` en modo `red`.
- **Forma de los esqueletos** (sin lógica ni valores de retorno):
  - el mensaje es **exactamente** `not implemented`, sin traducir;
  - en lenguajes que marcan parámetros no usados, se prefijan con `_` y el prefijo se quita al implementar;
  - los constructores guardan sus dependencias sin lanzar, para que cada test falle en el método que prueba y no al construir el objeto;
  - la forma concreta por lenguaje (`throw new Error("not implemented")`, `raise NotImplementedError`…) la fija la constitución del proyecto.
- **El `verifier` comprueba** que los esqueletos no contienen lógica y que cada test falla por separado.
- **`role-guard`** permite al `implementer` escribir producción en la etapa `tests`; sigue sin poder tocar tests.

## Consecuencias
- (+) Rojo test a test y typecheck del test-author desde el principio.
- (+) Los roles se mantienen: el esqueleto también lo escribe el `implementer`.
- (−) Una delegación más en `tests`. Si el `implementer` se excede, el red check lo detecta como FAIL.
