#!/usr/bin/env node
// Ratchet de lint genérico (ADR-0009): falla SOLO si aparecen violaciones nuevas en los archivos que cambió la feature.
//
//   node lint-ratchet.mjs <ámbito> [--base <rama>] [--project <dir>] [--json]
//
// Para cada archivo del ámbito cambiado respecto a la base, ejecuta scopes.<ámbito>.commands.lint_ratchet.cmd
// (desde scopes.<ámbito>.root, con el contenido por stdin y {file} = ruta relativa a root) sobre el contenido
// actual y sobre el de la base, y compara el número de violaciones por regla.
//
// Salida: 0 = sin violaciones nuevas · 1 = hay violaciones nuevas · 2 = no se pudo evaluar (linter ausente,
// salida inesperada o configuración incorrecta): el verifier lo informa como BLOCKED, no como FAIL.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ConfigError, loadConfig } from './lib/config.mjs';
import { classify, featureFromBranch } from './lib/paths.mjs';
import { changedFiles, currentBranch, toplevel, tryGit } from './lib/git.mjs';
import { ADAPTERS, countByRule, increased } from './lib/lint-adapters.mjs';

class RatchetError extends Error {}

function parseArgs(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) opt[a.slice(2)] = true;
      else { opt[a.slice(2)] = next; i++; }
    } else pos.push(a);
  }
  return { pos, opt };
}

// Base: --base; si no, la de la feature de la rama actual; si no, base_branch de la config.
function resolveBase(dir, config, opt) {
  if (typeof opt.base === 'string') return opt.base;
  const feature = featureFromBranch(currentBranch(dir), config);
  if (feature) {
    const file = path.join(dir, feature.dir, 'state.json');
    try {
      const st = JSON.parse(readFileSync(file, 'utf8'));
      if (st.base_branch) return st.base_branch;
    } catch { /* sin state.json legible: se usa la base de la config */ }
  }
  return config.base_branch;
}

const quote = (p) => `"${p.replace(/"/g, '\\"')}"`;

function runLinter(cmd, format, fileRelToRoot, content, cwd) {
  const command = cmd.split('{file}').join(quote(fileRelToRoot));
  const r = spawnSync(command, { cwd, input: content, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new RatchetError(`no se pudo ejecutar el linter: ${r.error.message}`);
  const stderr = (r.stderr || '').trim().split('\n').slice(0, 3).join(' | ');
  // Sin salida y con error: el linter no se ejecutó (p. ej. no está instalado). No es "cero violaciones".
  if (!(r.stdout || '').trim() && r.status !== 0) {
    throw new RatchetError(`el linter no produjo salida (código ${r.status})${stderr ? ` · stderr: ${stderr}` : ''}`);
  }
  try {
    return ADAPTERS[format](r.stdout);
  } catch (e) {
    throw new RatchetError(`${e.message}${stderr ? ` · stderr: ${stderr}` : ''} (código ${r.status})`);
  }
}

export function ratchet({ dir, scopeName, opt = {} }) {
  let config;
  try {
    config = loadConfig(dir);
  } catch (e) {
    if (e instanceof ConfigError) throw new RatchetError(e.message);
    throw e;
  }
  if (!config) throw new RatchetError('no existe .sdd/config.json: ejecuta /sdd-beto:init');
  const scope = config.scopes[scopeName];
  if (!scope) throw new RatchetError(`ámbito desconocido "${scopeName}" (ámbitos: ${Object.keys(config.scopes).join(', ')})`);
  const spec = scope.commands.lint_ratchet;
  if (!spec) throw new RatchetError(`el ámbito "${scopeName}" no tiene commands.lint_ratchet; usa commands.lint`);

  const base = resolveBase(dir, config, opt);
  if (tryGit(['rev-parse', '--verify', '--quiet', `${base}^{commit}`], dir) === null) {
    throw new RatchetError(`la rama base "${base}" no existe`);
  }
  const root = path.join(dir, scope.root);
  const files = changedFiles(base, dir).filter((f) => {
    const c = classify(f, config);
    return (c.kind === 'prod' || c.kind === 'test') && c.scopes.includes(scopeName) && existsSync(path.join(dir, f));
  });

  const results = [];
  for (const f of files) {
    const head = readFileSync(path.join(dir, f), 'utf8');
    const baseContent = tryGit(['show', `${base}:${f}`], dir) ?? '';
    const relToRoot = path.relative(root, path.join(dir, f)).split(path.sep).join('/');
    const after = runLinter(spec.cmd, spec.format, relToRoot, head, root);
    if (baseContent.replace(/\r\n/g, '\n') === head.replace(/\r\n/g, '\n')) {
      results.push({ file: f, preexisting: after.length, new: [] });
      continue;
    }
    const before = baseContent ? runLinter(spec.cmd, spec.format, relToRoot, baseContent, root) : [];
    const grew = increased(countByRule(before), countByRule(after));
    const detail = grew.map((g) => ({
      ...g,
      locations: after.filter((v) => v.rule === g.rule).map((v) => `L${v.line ?? '?'}: ${v.message}`),
    }));
    results.push({ file: f, preexisting: after.length - grew.reduce((n, g) => n + (g.after - g.before), 0), new: detail });
  }
  const newTotal = results.reduce((n, r) => n + r.new.reduce((m, g) => m + (g.after - g.before), 0), 0);
  return { scope: scopeName, base, format: spec.format, files: results, new_violations: newTotal };
}

function format(report) {
  const lines = [];
  if (report.files.length === 0) lines.push(`lint-ratchet [${report.scope}]: no hay archivos del ámbito cambiados respecto a ${report.base}. OK`);
  for (const r of report.files) {
    if (r.new.length === 0) { lines.push(`OK    ${r.file}  (violaciones previas toleradas: ${r.preexisting})`); continue; }
    for (const g of r.new) {
      lines.push(`NUEVO ${r.file}  ${g.rule} +${g.after - g.before} (base ${g.before} -> ahora ${g.after})`);
      for (const loc of g.locations) lines.push(`        ${loc}`);
    }
  }
  if (report.files.length) {
    lines.push(report.new_violations === 0
      ? `lint-ratchet [${report.scope}]: sin violaciones nuevas respecto a ${report.base}. OK`
      : `lint-ratchet [${report.scope}]: ${report.new_violations} violación(es) nueva(s) respecto a ${report.base}. FAIL`);
  }
  return lines.join('\n');
}

export function main(argv = process.argv.slice(2)) {
  const { pos, opt } = parseArgs(argv);
  const json = Boolean(opt.json);
  try {
    if (!pos[0]) throw new RatchetError('uso: node lint-ratchet.mjs <ámbito> [--base <rama>] [--project <dir>] [--json]');
    const start = typeof opt.project === 'string' ? path.resolve(opt.project) : process.cwd();
    const dir = toplevel(start) || start;
    const report = ratchet({ dir, scopeName: pos[0], opt });
    process.stdout.write(`${json ? JSON.stringify(report, null, 2) : format(report)}\n`);
    return report.new_violations === 0 ? 0 : 1;
  } catch (e) {
    const msg = e instanceof RatchetError ? e.message : `error interno: ${e.message}`;
    process.stderr.write(`[lint-ratchet] NO SE PUDO EVALUAR: ${msg}\n`);
    if (json) process.stdout.write(`${JSON.stringify({ error: msg })}\n`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
