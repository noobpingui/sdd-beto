// Git de solo lectura para los scripts del plugin. Los errores de git (p. ej. "fatal: …") se silencian:
// quien llama decide qué hacer con un resultado vacío (lecciones F15 y F17).
import { execFileSync } from 'node:child_process';

export function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}

export function tryGit(args, cwd) {
  try { return git(args, cwd); } catch { return null; }
}

export function toplevel(cwd) {
  const out = tryGit(['rev-parse', '--show-toplevel'], cwd);
  return out ? out.trim() : null;
}

export function currentBranch(cwd) {
  const out = tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  return out ? out.trim() : '';
}

export const refExists = (ref, cwd) => tryGit(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd) !== null;

export function branchExists(branch, cwd) {
  const out = tryGit(['branch', '--list', branch], cwd);
  return Boolean(out && out.trim());
}

// Rutas de `git status --porcelain=v1 -z -uall`: modificadas, añadidas, borradas y sin rastrear.
export function workingTreeChanges(cwd) {
  const out = tryGit(['status', '--porcelain=v1', '-z', '-uall'], cwd);
  if (!out) return [];
  const parts = out.split('\0');
  const files = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (entry.length < 4) continue;
    const xy = entry.slice(0, 2);
    files.push(entry.slice(3));
    if (xy[0] === 'R' || xy[0] === 'C') i++; // el siguiente elemento es la ruta de origen
  }
  return files;
}

// Archivos cambiados en la rama respecto a `base` (base...HEAD) más los cambios sin commitear.
export function changedFiles(base, cwd) {
  const committed = (tryGit(['diff', '--name-only', `${base}...HEAD`], cwd) || '').split('\n').map((l) => l.trim()).filter(Boolean);
  return [...new Set([...committed, ...workingTreeChanges(cwd)])].sort();
}

// Archivos del repo: versionados y sin rastrear que no estén ignorados.
export function repoFiles(cwd) {
  return (tryGit(['ls-files', '-co', '--exclude-standard'], cwd) || '').split('\n').map((l) => l.trim()).filter(Boolean);
}
