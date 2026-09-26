import pytest

from units import UnknownUnitError, convert_length


def test_kilometers_to_meters():
    assert convert_length(2, "km", "m") == 2000


def test_miles_to_kilometers():
    assert convert_length(1, "mi", "km") == pytest.approx(1.609344)


def test_same_unit_returns_same_value():
    assert convert_length(3.5, "ft", "ft") == 3.5


def test_unknown_unit_raises():
    with pytest.raises(UnknownUnitError) as info:
        convert_length(1, "parsec", "m")
    assert info.value.unit == "parsec"
