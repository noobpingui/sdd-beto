# Tareas NNN — <Título de la feature>

- **Plan:** [plan.md](plan.md) (aprobado el <fecha>)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos (si necesita más de unos 3, divídela).
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden:
    1. tareas (scaffold): las ejecuta el implementer en modo scaffold (solo firmas que lanzan "not implemented");
    2. tareas (test): las ejecuta el test-author;
    3. tareas impl, migration y config, en orden de dependencia: las ejecuta el implementer.
- Toda tarea impl se cumple cuando pasan los tests (test) que cubren sus mismos AC.
- La casilla la marca [x] el agente responsable al completar la tarea; nadie más cambia el texto.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
<!-- Solo para símbolos NUEVOS que los tests importarán (módulos, funciones, clases). No hace falta cuando la
     ausencia ya es rojo legítimo (p. ej. una ruta HTTP inexistente que responde 404). Si no aplica, escribe
     "No aplica". -->
- [ ] T-001 [REQ-001] (scaffold) Crear `<símbolo>` con su firma exacta, que lance "not implemented" — `<ruta>`

## Fase A — Tests (test-author)
- [ ] T-010 [REQ-001, AC-001.1] (test) <qué comportamiento verifica> — `<ruta del test>`
- [ ] T-011 [REQ-001, AC-001.2] (test) … — `…`

## Fase B — Implementación (implementer)
- [ ] T-020 [REQ-001] (migration) … — `…`
- [ ] T-021 [REQ-001] (impl) … — `…`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-010 | T-021 |
