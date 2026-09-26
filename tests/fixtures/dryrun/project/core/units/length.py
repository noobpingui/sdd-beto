import math

from units.errors import UnknownUnitError

# Metros por unidad.
_FACTORS = {
    "m": 1.0,
    "km": 1000.0,
    "ft": 0.3048,
    "mi": 1609.344,
}


def convert_length(value: float, from_unit: str, to_unit: str) -> float:
    """Convierte una longitud entre dos unidades de _FACTORS."""
    for unit in (from_unit, to_unit):
        if unit not in _FACTORS:
            raise UnknownUnitError(unit)
    if from_unit == to_unit:
        return value
    return value * _FACTORS[from_unit] / _FACTORS[to_unit]
