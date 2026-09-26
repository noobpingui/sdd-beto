# units

Conversor de unidades de ejemplo, con dos partes independientes:

- `core/`: núcleo en Python con las conversiones (`units` package).
- `cli/`: utilidades de línea de comandos en JavaScript para leer y formatear cantidades.

## Desarrollo

Núcleo (Python ≥ 3.11):

```
python -m venv .venv
.venv/Scripts/python -m pip install -r core/requirements-dev.txt   # en Linux/macOS: .venv/bin/python
cd core
../.venv/Scripts/python -m pytest -q
../.venv/Scripts/python -m ruff check .
```

CLI (Node ≥ 20):

```
cd cli
npm ci
npm test
npm run lint
```

## Configuración

Copia `.env.example` a `.env`. `UNITS_PRECISION` fija los decimales por defecto al formatear.
