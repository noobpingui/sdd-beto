// Adaptadores de salida de linters para el ratchet (ADR-0009).
// Cada adaptador recibe la salida estándar del linter (JSON) y devuelve [{ rule, line, message }].
// Si la salida no es la esperada, lanza un error: el ratchet lo trata como error de entorno.

function parseJson(stdout, format) {
  const text = (stdout || '').trim();
  if (!text) return [];
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`la salida de ${format} no es JSON: ${text.slice(0, 200)}`);
  }
}

export const ADAPTERS = {
  // ruff check --output-format json --stdin-filename <archivo> -
  // [{ "code": "F401", "message": "...", "location": { "row": 1, "column": 8 } }, ...]
  ruff(stdout) {
    const data = parseJson(stdout, 'ruff');
    if (!Array.isArray(data)) throw new Error('ruff: se esperaba una lista de violaciones');
    return data.map((v) => ({
      rule: v.code || 'syntax-error',
      line: v.location?.row ?? null,
      message: v.message || '',
    }));
  },

  // eslint --format json --stdin --stdin-filename <archivo>
  // [{ "filePath": "...", "messages": [{ "ruleId": "no-unused-vars", "line": 1, "message": "...", "severity": 2 }] }]
  eslint(stdout) {
    const data = parseJson(stdout, 'eslint');
    if (!Array.isArray(data)) throw new Error('eslint: se esperaba una lista de resultados');
    return data.flatMap((r) => (r.messages || []).map((m) => ({
      rule: m.ruleId || (m.fatal ? 'parse-error' : 'unknown'),
      line: m.line ?? null,
      message: m.message || '',
    })));
  },
};

export function countByRule(violations) {
  const counts = {};
  for (const v of violations) counts[v.rule] = (counts[v.rule] || 0) + 1;
  return counts;
}

// Reglas cuyo número aumentó: [{ rule, before, after }].
export function increased(before, after) {
  return Object.keys(after)
    .filter((rule) => after[rule] > (before[rule] || 0))
    .sort()
    .map((rule) => ({ rule, before: before[rule] || 0, after: after[rule] }));
}
