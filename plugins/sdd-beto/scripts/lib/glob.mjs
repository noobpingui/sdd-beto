// Conversor de globs a expresiones regulares, sin dependencias (ADR-0020).
//
// Sintaxis soportada, sobre rutas relativas con '/':
//   **   cero o más segmentos completos ("a/**" = todo lo que cuelga de a/; "**/x" = x en cualquier nivel)
//   *    cualquier secuencia sin '/'
//   ?    un carácter que no sea '/'
//   {a,b} alternativas (se pueden anidar)
// No hay extglob, clases [...] ni negación.

const cache = new Map();

const escapeRe = (ch) => ch.replace(/[.+^$()|[\]\\]/g, '\\$&');

function splitAlternatives(body) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function findClosingBrace(glob, open) {
  let depth = 0;
  for (let i = open; i < glob.length; i++) {
    if (glob[i] === '{') depth++;
    if (glob[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function toSource(glob) {
  let out = '';
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') {
      const atStart = i === 0 || glob[i - 1] === '/';
      const next = glob[i + 2];
      if (atStart && next === '/') {
        out += '(?:.*/)?'; // "**/": cero o más directorios
        i += 3;
        continue;
      }
      if (atStart && next === undefined) {
        // "a/**" también coincide con "a" ya quitado el '/' previo: lo resuelve el caso "/**" abajo
        out += '.*';
        i += 2;
        continue;
      }
      out += '[^/]*'; // "**" pegado a otros caracteres se comporta como "*"
      i += 2;
      continue;
    }
    if (ch === '/' && glob.slice(i, i + 3) === '/**' && i + 3 === glob.length) {
      out += '(?:/.*)?'; // "a/**": a y todo lo que cuelga de a
      i += 3;
      continue;
    }
    if (ch === '*') {
      out += '[^/]*';
      i++;
      continue;
    }
    if (ch === '?') {
      out += '[^/]';
      i++;
      continue;
    }
    if (ch === '{') {
      const close = findClosingBrace(glob, i);
      if (close === -1) throw new Error(`glob con llave sin cerrar: "${glob}"`);
      const alts = splitAlternatives(glob.slice(i + 1, close));
      out += `(?:${alts.map(toSource).join('|')})`;
      i = close + 1;
      continue;
    }
    if (ch === '}') throw new Error(`glob con llave de cierre sobrante: "${glob}"`);
    out += escapeRe(ch);
    i++;
  }
  return out;
}

export function globToRegExp(glob) {
  if (typeof glob !== 'string' || glob.length === 0) throw new Error('el glob debe ser un texto no vacío');
  if (!cache.has(glob)) cache.set(glob, new RegExp(`^${toSource(glob)}$`));
  return cache.get(glob);
}

export const matchesGlob = (relPath, glob) => globToRegExp(glob).test(relPath);

export const matchesAny = (relPath, globs) => (globs || []).some((g) => matchesGlob(relPath, g));
