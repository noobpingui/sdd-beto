class UnknownUnitError(ValueError):
    """La unidad pedida no existe en la familia de unidades."""

    def __init__(self, unit: str) -> None:
        super().__init__(f"unidad desconocida: {unit}")
        self.unit = unit
