// Lectura y formato de cantidades como "3.5 km".

export function parseQuantity(text) {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s*$/.exec(text);
  if (!match) throw new Error(`cantidad no válida: "${text}"`);
  return { value: Number(match[1]), unit: match[2] };
}

export function formatQuantity({ value, unit }, precision = 2) {
  let rounded = value.toFixed(precision);
  return `${rounded} ${unit}`;
}
