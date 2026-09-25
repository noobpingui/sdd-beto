// Carga y validación de .sdd/config.json (ADR-0016), sin dependencias.
// El esquema de referencia para editores es templates/config.schema.json; los tests comprueban que
// este validador y ese esquema aceptan los mismos campos.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { globToRegExp } from './glob.mjs';

export const CONFIG_REL = '.sdd/config.json';

export const AGENTS = [
  'spec-writer', 'planner', 'task-breaker', 'test-author',
  'implementer', 'verifier', 'reviewer', 'doc-keeper',
];

export const COMMAND_KEYS = ['test', 'test_files', 'test_check', 'lint', 'lint_ratchet', 'typecheck', 'build'];
export const RATCHET_FORMATS = ['ruff', 'eslint'];

export const DEFAULTS = Object.freeze({
  language: 'es',
  base_branch: 'main',
  branches: { feature: 'feat', fix: 'fix', refactor: 'refactor' },
  commits: { language: 'en', style: 'imperative, no conventional prefixes' },
  max_iterations: 3,
  paths: {
    specs: 'specs',
    adr: 'docs/decisions',
    docs: ['README.md', 'docs/**'],
    env_examples: ['**/.env.example'],
  },
  models: {},
});

const TOP_KEYS = ['$schema', '$comment', 'schema_version', 'language', 'base_branch', 'branches', 'commits',
  'max_iterations', 'paths', 'scopes', 'models'];
const SCOPE_KEYS = ['root', 'prod', 'tests', 'commands', 'env_hint'];

export class ConfigError extends Error {
  constructor(file, issues) {
    super(`${file} no es válido:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ConfigError';
    this.file = file;
    this.issues = issues;
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyStr = (v) => typeof v === 'string' && v.length > 0;

// Ruta o glob relativo a la raíz: sin '/', letra de unidad, '..' ni barras invertidas.
export function isSafeRel(v) {
  return isNonEmptyStr(v) && !v.startsWith('/') && !/^[A-Za-z]:/.test(v) && !v.includes('\\') &&
    !v.split('/').includes('..');
}

function checkUnknown(obj, allowed, where, issues) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) issues.push(`${where}: campo desconocido "${k}"`);
}

function checkGlobList(v, where, issues, { min = 0 } = {}) {
  if (!Array.isArray(v)) return issues.push(`${where}: debe ser una lista de globs`);
  if (v.length < min) issues.push(`${where}: necesita al menos ${min} glob`);
  const seen = new Set();
  for (const g of v) {
    if (!isSafeRel(g)) { issues.push(`${where}: "${g}" no es un glob relativo válido (sin '/', '..', '\\' ni unidad)`); continue; }
    if (seen.has(g)) issues.push(`${where}: "${g}" está repetido`);
    seen.add(g);
    try { globToRegExp(g); } catch (e) { issues.push(`${where}: ${e.message}`); }
  }
}

function checkCommand(v, where, issues) {
  if (v === null || v === undefined) return;
  if (!isNonEmptyStr(v)) issues.push(`${where}: debe ser un comando (texto) o null`);
}

function validateScope(name, s, issues) {
  const where = `scopes.${name}`;
  if (!/^[a-z][a-z0-9-]*$/.test(name)) issues.push(`${where}: el nombre debe ser kebab-case en minúsculas`);
  if (!isObj(s)) return issues.push(`${where}: debe ser un objeto`);
  checkUnknown(s, SCOPE_KEYS, where, issues);
  if (s.root !== undefined && !isSafeRel(s.root)) issues.push(`${where}.root: ruta relativa no válida`);
  checkGlobList(s.prod, `${where}.prod`, issues, { min: 1 });
  checkGlobList(s.tests, `${where}.tests`, issues, { min: 1 });
  if (!isObj(s.commands)) return issues.push(`${where}.commands: debe ser un objeto`);
  checkUnknown(s.commands, COMMAND_KEYS, `${where}.commands`, issues);
  if (!('test' in s.commands)) issues.push(`${where}.commands.test: es obligatorio (puede ser null)`);
  for (const k of COMMAND_KEYS.filter((c) => c !== 'lint_ratchet')) checkCommand(s.commands[k], `${where}.commands.${k}`, issues);
  const r = s.commands.lint_ratchet;
  if (r !== null && r !== undefined) {
    if (!isObj(r)) issues.push(`${where}.commands.lint_ratchet: debe ser null o { format, cmd }`);
    else {
      checkUnknown(r, ['format', 'cmd'], `${where}.commands.lint_ratchet`, issues);
      if (!RATCHET_FORMATS.includes(r.format)) issues.push(`${where}.commands.lint_ratchet.format: debe ser uno de ${RATCHET_FORMATS.join(', ')}`);
      if (!isNonEmptyStr(r.cmd)) issues.push(`${where}.commands.lint_ratchet.cmd: es obligatorio`);
    }
  }
  if (s.env_hint !== undefined && s.env_hint !== null && typeof s.env_hint !== 'string') issues.push(`${where}.env_hint: debe ser texto o null`);
}

// Devuelve la lista de problemas (vacía si es válida).
export function validateConfig(c) {
  const issues = [];
  if (!isObj(c)) return ['la configuración debe ser un objeto JSON'];
  checkUnknown(c, TOP_KEYS, 'config', issues);
  if (c.schema_version !== 1) issues.push('schema_version: debe ser 1');
  if (c.language !== undefined && !isNonEmptyStr(c.language)) issues.push('language: debe ser texto');
  if (c.base_branch !== undefined && !isNonEmptyStr(c.base_branch)) issues.push('base_branch: debe ser texto no vacío');
  if (c.branches !== undefined) {
    if (!isObj(c.branches)) issues.push('branches: debe ser un objeto');
    else {
      checkUnknown(c.branches, ['feature', 'fix', 'refactor'], 'branches', issues);
      for (const [k, v] of Object.entries(c.branches)) {
        if (typeof v !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(v)) issues.push(`branches.${k}: prefijo de rama no válido`);
      }
    }
  }
  if (c.commits !== undefined) {
    if (!isObj(c.commits)) issues.push('commits: debe ser un objeto');
    else {
      checkUnknown(c.commits, ['language', 'style'], 'commits', issues);
      for (const k of ['language', 'style']) if (c.commits[k] !== undefined && typeof c.commits[k] !== 'string') issues.push(`commits.${k}: debe ser texto`);
    }
  }
  if (c.max_iterations !== undefined && !(Number.isInteger(c.max_iterations) && c.max_iterations >= 1 && c.max_iterations <= 10)) {
    issues.push('max_iterations: debe ser un entero entre 1 y 10');
  }
  if (c.paths !== undefined) {
    if (!isObj(c.paths)) issues.push('paths: debe ser un objeto');
    else {
      checkUnknown(c.paths, ['specs', 'adr', 'docs', 'env_examples'], 'paths', issues);
      for (const k of ['specs', 'adr']) if (c.paths[k] !== undefined && !isSafeRel(c.paths[k])) issues.push(`paths.${k}: ruta relativa no válida`);
      for (const k of ['docs', 'env_examples']) if (c.paths[k] !== undefined) checkGlobList(c.paths[k], `paths.${k}`, issues);
    }
  }
  if (!isObj(c.scopes) || Object.keys(c.scopes).length === 0) issues.push('scopes: necesita al menos un ámbito');
  else for (const [name, s] of Object.entries(c.scopes)) validateScope(name, s, issues);
  if (c.models !== undefined) {
    if (!isObj(c.models)) issues.push('models: debe ser un objeto');
    else for (const [k, v] of Object.entries(c.models)) {
      if (!AGENTS.includes(k)) issues.push(`models: agente desconocido "${k}"`);
      if (!isNonEmptyStr(v)) issues.push(`models.${k}: debe ser un alias o ID de modelo`);
    }
  }
  return issues;
}

export function applyDefaults(c) {
  const d = DEFAULTS;
  const scopes = {};
  for (const [name, s] of Object.entries(c.scopes)) {
    const commands = {};
    for (const k of COMMAND_KEYS) commands[k] = s.commands[k] ?? null;
    scopes[name] = { root: s.root ?? '.', prod: s.prod, tests: s.tests, commands, env_hint: s.env_hint ?? null };
  }
  return {
    schema_version: c.schema_version,
    language: c.language ?? d.language,
    base_branch: c.base_branch ?? d.base_branch,
    branches: { ...d.branches, ...(c.branches || {}) },
    commits: { ...d.commits, ...(c.commits || {}) },
    max_iterations: c.max_iterations ?? d.max_iterations,
    paths: { ...d.paths, ...(c.paths || {}) },
    scopes,
    models: { ...(c.models || {}) },
  };
}

// Lee la config del proyecto. Devuelve null si no existe; lanza ConfigError si no es válida.
export function loadConfig(projectDir) {
  const file = path.join(projectDir, CONFIG_REL);
  if (!existsSync(file)) return null;
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new ConfigError(CONFIG_REL, [`JSON no válido: ${e.message}`]);
  }
  const issues = validateConfig(raw);
  if (issues.length) throw new ConfigError(CONFIG_REL, issues);
  return applyDefaults(raw);
}
