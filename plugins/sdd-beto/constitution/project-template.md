# Constitución SDD · Parte II: <nombre del proyecto>

> Reglas **propias de este proyecto**. Complementan la Parte I (base), que vive en el plugin `sdd-beto` y que
> todos los agentes leen junto con esta. Esta parte puede **endurecer** la base, nunca relajarla.
>
> - La propone `/sdd-beto:init` a partir del código existente y la aprueba el usuario.
> - Solo cambia mediante un ADR del proyecto (en `paths.adr` de `.sdd/config.json`).
> - Palabras clave: **DEBE** · **NO DEBE** · **DEBERÍA** (salvo justificación escrita en `plan.md`).
> - Cita cada regla como `Art. P<n>.<m>`.

## Art. P1 — Convenciones de tests

<!--
Una subsección por ámbito de la config (`scopes`). Para cada uno:
- dónde van los tests (unitarios, integración…) y cómo se nombran los archivos;
- cómo se aíslan las dependencias (fakes, stubs, mocks: cuáles se permiten y cuáles no);
- qué servicios necesitan los tests (base de datos, colas…) y cómo se simulan los externos;
- idioma de los nombres de test y de los comentarios;
- forma concreta de los esqueletos (Art. B5.6), p. ej. `throw new Error("not implemented")` o `raise NotImplementedError`.
-->

### <ámbito>

1. …

## Art. P2 — Arquitectura y convenciones

<!--
Por ámbito: capas o módulos y sus dependencias permitidas, dónde vive cada tipo de lógica, cómo se inyectan
las dependencias, cómo se expresan los errores, migraciones de datos, organización de carpetas, utilidades que
DEBEN reutilizarse, estilo e idioma de los textos visibles.
-->

### <ámbito>

1. …

### General

1. …

## Art. P3 — Seguridad

<!--
Autenticación y autorización de endpoints o comandos nuevos, validación de entradas, manejo de secretos,
acceso a datos (nada de SQL concatenado…), límites de uso de servicios caros o externos.
-->

1. …

## Art. P4 — Añadidos a la definición de "hecho" (opcional)

<!--
Puntos que este proyecto exige además del Art. B7, p. ej. "si cambian los modelos, la migración está incluida".
Si no hay, escribe "Ninguno".
-->

- [ ] …
