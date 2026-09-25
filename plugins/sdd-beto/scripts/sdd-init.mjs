#!/usr/bin/env node
// Ayudante determinista de /sdd-beto:init (ADR-0018, ADR-0024). La IA decide el contenido; este script
// lee el repo y escribe los archivos de forma idempotente, sin tocar nada fuera de sus marcas.
//
//   node sdd-init.mjs <comando> [opciones]
//
// Salida: JSON por stdout. Código 0 = ok · 1 = uso o validación · 2 = precondición (no es un repo git,
// falta la config, marcas rotas en CLAUDE.md, settings.json no es JSON…).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyDefaults, CONFIG_REL, ConfigError, loadConfig, validateConfig } from './lib/config.mjs';
import { classifyReport, isRealEnv, looksLikeTest } from './lib/paths.mjs';
import { currentBranch, repoFiles, toplevel, tryGit } from './lib/git.mjs';
import { PLUGIN_ROOT, resolveTemplate } from './lib/templates.mjs';

const USAGE = `Uso: node sdd-init.mjs <comando> [opciones]

  scan                          hechos del repo para el análisis (solo lectura)
  preview                       valida una config borrador (stdin) y muestra cómo clasifica el repo (solo lectura)
  write-config [--dry-run]      valida la config de stdin y la escribe en ${CONFIG_REL}
  integrate [--dry-run] [--project-section -] [--replace-project-section]
            [--no-depth-limit] [--marketplace]
                                carpetas de specs y ADRs, secciones de CLAUDE.md y .claude/settings.json

Opciones comunes:
  --project <dir>               por defecto, la raíz git del directorio actual
  --limit <n>                   ejemplos por grupo en preview (por defecto 3)`;

export const SUPPORTED_SCHEMA = 1;
export const SECTIONS = ['proyecto', 'sdd', 'aprobacion', 'convenciones'];
export const SETTINGS_REL = '.claude/settings.json';
export const DEPTH_VAR = 'CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH';
const SETTINGS_SCHEMA = 'https://json.schemastore.org/claude-code-settings.json';

class InitError extends Error { constructor(m, code = 2) { super(m); this.code = code; } }

function parseArgs(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || (next.startsWith('--'))) opt[key] = true;
      else { opt[key] = next; i++; }
    } else pos.push(a);
  }
  return { pos, opt };
}

// ---------- texto: BOM, CRLF y escritura idempotente ----------
const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
export const toLf = (s) => stripBom(s).replace(/\r\n/g, '\n');
const eolOf = (s) => (s.includes('\r\n') ? '\r\n' : '\n');
const withEol = (s, eol) => (eol === '\n' ? s : s.replace(/\n/g, eol));
const readText = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

// Plan de escritura de un archivo: 'create' | 'update' | 'unchanged'. El contenido se compara sin BOM ni CRLF.
function planFile(dir, rel, nextLf, previous) {
  if (previous === null) return { path: rel, action: 'create', content: nextLf };
  if (toLf(previous) === nextLf) return { path: rel, action: 'unchanged' };
  return { path: rel, action: 'update', content: withEol(nextLf, eolOf(previous)) };
}

function applyPlan(dir, plans) {
  for (const p of plans) {
    if (p.action !== 'create' && p.action !== 'update') continue;
    const file = path.join(dir, p.path);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, p.content);
  }
}

function readStdin() {
  try { return stripBom(readFileSync(0, 'utf8')); } catch { return ''; }
}

function parseJsonInput(text, what) {
  if (!text.trim()) throw new InitError(`${what}: stdin está vacío`, 1);
  try { return JSON.parse(text); } catch (e) { throw new InitError(`${what}: JSON no válido (${e.message})`, 1); }
}

// ---------- scan ----------
const MANIFESTS = [
  ['package.json', 'node'], ['deno.json', 'deno'], ['deno.jsonc', 'deno'],
  ['pyproject.toml', 'python'], ['setup.py', 'python'], ['setup.cfg', 'python'], ['tox.ini', 'python'],
  ['noxfile.py', 'python'], ['Pipfile', 'python'], ['requirements.txt', 'python'], ['requirements-dev.txt', 'python'],
  ['go.mod', 'go'], ['Cargo.toml', 'rust'], ['pom.xml', 'java'], ['build.gradle', 'java'], ['build.gradle.kts', 'java'],
  ['Gemfile', 'ruby'], ['composer.json', 'php'], ['mix.exs', 'elixir'], ['pubspec.yaml', 'dart'],
  ['Makefile', 'make'], ['justfile', 'just'], ['Taskfile.yml', 'task'], ['CMakeLists.txt', 'cmake'],
];
const MANIFEST_EXT = [[/\.(csproj|fsproj|sln)$/, 'dotnet']];
const LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock', 'poetry.lock', 'uv.lock',
  'Pipfile.lock', 'Cargo.lock', 'go.sum', 'Gemfile.lock', 'composer.lock'];
const CI = [/^\.github\/workflows\/[^/]+\.ya?ml$/, /^\.gitlab-ci\.yml$/, /^azure-pipelines\.ya?ml$/, /^\.circleci\/config\.ya?ml$/,
  /^Jenkinsfile$/, /^bitbucket-pipelines\.yml$/, /^\.travis\.yml$/, /^\.buildkite\//];
const MAX_DEPTH_MANIFEST = 3;

function manifestKind(rel) {
  const base = rel.split('/').pop();
  const hit = MANIFESTS.find(([name]) => name === base);
  if (hit) return hit[1];
  const ext = MANIFEST_EXT.find(([re]) => re.test(base));
  return ext ? ext[1] : null;
}

function readManifest(dir, rel, kind) {
  const text = readText(path.join(dir, rel));
  if (text === null) return {};
  const lf = toLf(text);
  if (rel.endsWith('package.json')) {
    try {
      const pkg = JSON.parse(lf);
      const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
      return { name: pkg.name ?? null, scripts: pkg.scripts || {}, workspaces: pkg.workspaces ?? null, type: pkg.type ?? null, deps };
    } catch (e) { return { error: `JSON no válido: ${e.message}` }; }
  }
  if (kind === 'make' || kind === 'just') {
    const targets = [...lf.matchAll(/^([A-Za-z0-9][A-Za-z0-9_.-]*)\s*:(?!=)/gm)].map((m) => m[1]);
    return { targets: [...new Set(targets)] };
  }
  if (/\.(toml|cfg|ini)$/.test(rel)) return { sections: [...new Set([...lf.matchAll(/^\[([^\]\n]+)\]/gm)].map((m) => m[1]))] };
  return {};
}

function markerStatus(text) {
  const out = {};
  const lf = text === null ? null : toLf(text);
  for (const id of SECTIONS) out[id] = lf === null ? 'missing' : findSection(lf, id).status;
  return out;
}

function settingsFacts(dir) {
  const text = readText(path.join(dir, SETTINGS_REL));
  if (text === null) return { exists: false };
  try {
    const s = JSON.parse(toLf(text));
    return {
      exists: true, valid: true,
      depth_limit: s.env?.[DEPTH_VAR] ?? null,
      marketplace: Boolean(s.extraKnownMarketplaces?.[pluginInfo().marketplace]),
      plugin_enabled: s.enabledPlugins?.[pluginInfo().id] ?? null,
    };
  } catch (e) { return { exists: true, valid: false, error: e.message }; }
}

function configFacts(dir) {
  const text = readText(path.join(dir, CONFIG_REL));
  if (text === null) return { exists: false };
  let raw;
  try { raw = JSON.parse(toLf(text)); } catch (e) { return { exists: true, valid: false, issues: [`JSON no válido: ${e.message}`] }; }
  const issues = validateConfig(raw);
  return { exists: true, valid: issues.length === 0, schema_version: raw?.schema_version ?? null, supported_schema: SUPPORTED_SCHEMA, issues, config: raw };
}

export function scan(dir) {
  const files = repoFiles(dir);
  const byTop = {};
  const byExt = {};
  const manifests = [];
  const testDirs = new Set();
  let testLike = 0;
  for (const f of files) {
    const parts = f.split('/');
    const top = parts.length > 1 ? `${parts[0]}/` : '(raíz)';
    byTop[top] = (byTop[top] || 0) + 1;
    const ext = /\.([A-Za-z0-9]+)$/.exec(parts[parts.length - 1]);
    if (ext) byExt[`.${ext[1].toLowerCase()}`] = (byExt[`.${ext[1].toLowerCase()}`] || 0) + 1;
    const kind = parts.length <= MAX_DEPTH_MANIFEST && !parts.includes('node_modules') ? manifestKind(f) : null;
    if (kind) manifests.push({ path: f, kind, ...readManifest(dir, f, kind) });
    if (looksLikeTest(f)) {
      testLike++;
      const i = parts.findIndex((p) => /^(tests?|__tests__|specs?)$/i.test(p));
      if (i >= 0) testDirs.add(`${parts.slice(0, i + 1).join('/')}/`);
    }
  }
  const defaults = applyDefaults({ schema_version: 1, scopes: { x: { prod: ['x'], tests: ['x'], commands: { test: null } } } });
  const realEnv = files.filter((f) => isRealEnv(f, defaults));
  const tracked = new Set((tryGit(['ls-files'], dir) || '').split('\n').map((l) => l.trim()).filter(Boolean));
  const claudeMd = readText(path.join(dir, 'CLAUDE.md'));
  const agentsMd = existsSync(path.join(dir, 'AGENTS.md'));
  const risks = [];
  const realTracked = realEnv.filter((f) => tracked.has(f));
  if (realTracked.length) risks.push(`archivos .env reales versionados: ${realTracked.join(', ')} (posibles secretos en el historial)`);
  if (agentsMd && claudeMd !== null && !/^@AGENTS\.md\s*$/m.test(toLf(claudeMd))) {
    risks.push('hay AGENTS.md y CLAUDE.md, pero CLAUDE.md no lo importa: Claude Code solo lee CLAUDE.md');
  }
  const status = tryGit(['status', '--porcelain'], dir);
  const sortDesc = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
  return {
    project_dir: dir,
    git: { branch: currentBranch(dir), clean: status !== null && status.trim() === '', has_commits: tryGit(['rev-parse', '--verify', '--quiet', 'HEAD'], dir) !== null },
    files: { total: files.length, test_like: testLike, by_top_dir: sortDesc(byTop), by_ext: Object.fromEntries(Object.entries(sortDesc(byExt)).slice(0, 15)) },
    manifests,
    lockfiles: files.filter((f) => LOCKFILES.includes(f.split('/').pop()) && f.split('/').length <= MAX_DEPTH_MANIFEST),
    ci: files.filter((f) => CI.some((re) => re.test(f))),
    test_dirs: [...testDirs].sort().slice(0, 30),
    env: { real: realEnv, real_tracked: realTracked, examples: files.filter((f) => /(^|\/)\.env[^/]*\.(example|sample|template)$/.test(f)) },
    sdd: {
      config: configFacts(dir),
      constitution: existsSync(path.join(dir, '.sdd', 'constitution.md')),
      project_templates: existsSync(path.join(dir, '.sdd', 'templates')),
      claude_md: { exists: claudeMd !== null, sections: markerStatus(claudeMd) },
      agents_md: agentsMd,
      settings: settingsFacts(dir),
    },
    risks,
  };
}

// ---------- preview ----------
export function preview(dir, raw, { limit = 3 } = {}) {
  const issues = validateConfig(raw);
  if (issues.length) return { valid: false, issues };
  const config = applyDefaults(raw);
  const report = classifyReport(repoFiles(dir), config, { limit });
  const missingRoots = Object.entries(config.scopes)
    .filter(([, s]) => s.root !== '.' && !existsSync(path.join(dir, s.root)))
    .map(([n, s]) => `scopes.${n}.root: no existe la carpeta "${s.root}"`);
  return { valid: true, issues: [], ...report, warnings: [...missingRoots, ...report.warnings] };
}

// ---------- write-config ----------
// Diferencias campo a campo entre dos valores JSON: [{ path, from, to }].
export function jsonDiff(a, b, prefix = '') {
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (isObj(a) && isObj(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.flatMap((k) => jsonDiff(a[k], b[k], prefix ? `${prefix}.${k}` : k));
  }
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  return [{ path: prefix || '(raíz)', from: a === undefined ? '(no existe)' : a, to: b === undefined ? '(se elimina)' : b }];
}

export const formatConfig = (raw) => `${JSON.stringify(raw, null, 2)}\n`;

export function writeConfig(dir, raw, { dryRun = false } = {}) {
  const issues = validateConfig(raw);
  if (issues.length) throw new InitError(new ConfigError(CONFIG_REL, issues).message, 1);
  const previousText = readText(path.join(dir, CONFIG_REL));
  let previous = null;
  if (previousText !== null) {
    try { previous = JSON.parse(toLf(previousText)); } catch { previous = null; }
  }
  const diff = previous === null ? [] : jsonDiff(previous, raw);
  // Si el contenido es el mismo, no se reescribe aunque cambie el formato: reejecutar init no produce diff.
  const plan = previous !== null && diff.length === 0
    ? { path: CONFIG_REL, action: 'unchanged' }
    : planFile(dir, CONFIG_REL, formatConfig(raw), previousText);
  if (!dryRun) applyPlan(dir, [plan]);
  return { dry_run: dryRun, file: CONFIG_REL, action: plan.action, diff, ...(dryRun && plan.content ? { content: toLf(plan.content) } : {}) };
}

// ---------- CLAUDE.md ----------
const startMarker = (id) => `<!-- sdd-beto:${id}:start -->`;
const endMarker = (id) => `<!-- sdd-beto:${id}:end -->`;
const lineRe = (m) => new RegExp(`^[ \\t]*${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ \\t]*$`, 'gm');

// Localiza una sección delimitada: { status: 'ok' | 'missing' | 'broken', start, end, body }.
export function findSection(text, id) {
  const starts = [...text.matchAll(lineRe(startMarker(id)))];
  const ends = [...text.matchAll(lineRe(endMarker(id)))];
  if (starts.length === 0 && ends.length === 0) return { status: 'missing' };
  if (starts.length !== 1 || ends.length !== 1 || ends[0].index < starts[0].index) return { status: 'broken' };
  const bodyStart = starts[0].index + starts[0][0].length;
  return {
    status: 'ok',
    start: starts[0].index,
    end: ends[0].index + ends[0][0].length,
    body: text.slice(bodyStart, ends[0].index).replace(/^\n+|\n+$/g, ''),
  };
}

const block = (id, body) => `${startMarker(id)}\n${body}\n${endMarker(id)}`;

function scopesTable(config) {
  const c = (v) => (v === null || v === undefined ? '—' : `\`${String(typeof v === 'object' ? v.cmd : v).replace(/\|/g, '\\|')}\``);
  const rows = Object.entries(config.scopes).map(([n, s]) =>
    `| \`${n}\` | \`${s.root}\` | ${c(s.commands.test)} | ${c(s.commands.lint_ratchet || s.commands.lint)} | ${c(s.commands.typecheck)} | ${c(s.commands.build)} |`);
  return ['| Ámbito | Raíz | Test | Lint | Typecheck | Build |', '|---|---|---|---|---|---|', ...rows].join('\n');
}

export function renderTemplate(text, config) {
  const vars = {
    specs: config.paths.specs, adr: config.paths.adr, language: config.language, base_branch: config.base_branch,
    branch_feature: config.branches.feature, branch_fix: config.branches.fix, branch_refactor: config.branches.refactor,
    commit_language: config.commits.language, commit_style: config.commits.style, max_iterations: String(config.max_iterations),
    scopes_table: scopesTable(config),
  };
  return text.replace(/\{\{(\w+)\}\}/g, (m, k) => (Object.hasOwn(vars, k) ? vars[k] : m));
}

function templateSections(dir, config) {
  const tpl = resolveTemplate('claude-md.md', dir);
  const text = renderTemplate(toLf(readFileSync(tpl.path, 'utf8')), config);
  const out = {};
  for (const id of SECTIONS) {
    const s = findSection(text, id);
    if (s.status !== 'ok') throw new InitError(`la plantilla ${tpl.path} no tiene la sección "${id}" bien delimitada`);
    out[id] = s.body;
  }
  return { sections: out, source: tpl.source };
}

// Contenido de la sección Proyecto que llega por stdin: sin marcas y sin espacios sobrantes.
function cleanProjectSection(text) {
  const body = toLf(text).replace(lineRe(startMarker('proyecto')), '').replace(lineRe(endMarker('proyecto')), '').trim();
  if (!body) throw new InitError('la sección Proyecto recibida por stdin está vacía', 1);
  if (/<!--\s*sdd-beto:/.test(body)) throw new InitError('la sección Proyecto no puede contener otras marcas sdd-beto', 1);
  return body;
}

// Devuelve el nuevo CLAUDE.md (LF) y qué pasó con cada sección.
export function mergeClaudeMd(previousText, sections, { projectSection = null, replaceProject = false, agentsMd = false } = {}) {
  const report = {};
  if (previousText === null) {
    const body = SECTIONS.map((id) => {
      report[id] = 'create';
      return block(id, id === 'proyecto' && projectSection ? projectSection : sections[id]);
    }).join('\n\n');
    return { text: `${agentsMd ? '@AGENTS.md\n\n' : ''}${body}\n`, report };
  }
  let text = toLf(previousText);
  const broken = SECTIONS.filter((id) => findSection(text, id).status === 'broken');
  if (broken.length) {
    throw new InitError(`CLAUDE.md tiene marcas rotas o repetidas en: ${broken.join(', ')}. Corrígelas a mano (una marca start y una end por sección) y reejecuta init.`);
  }
  const missing = [];
  for (const id of SECTIONS) {
    const found = findSection(text, id);
    let body = sections[id];
    if (id === 'proyecto') {
      if (found.status === 'ok' && !replaceProject) { report[id] = 'kept'; continue; }
      if (projectSection) body = projectSection;
      else if (found.status === 'ok') throw new InitError('--replace-project-section necesita la sección nueva por stdin (--project-section -)', 1);
    }
    if (found.status === 'missing') { missing.push(id); continue; }
    report[id] = found.body === body ? 'unchanged' : 'update';
    text = text.slice(0, found.start) + block(id, body) + text.slice(found.end);
  }
  if (missing.length) {
    const add = missing.map((id) => {
      report[id] = 'create';
      return block(id, id === 'proyecto' && projectSection ? projectSection : sections[id]);
    });
    const head = text.replace(/\s+$/, '');
    text = `${head ? `${head}\n\n` : ''}${add.join('\n\n')}\n`;
  }
  return { text, report };
}

// ---------- .claude/settings.json ----------
export function pluginInfo(root = PLUGIN_ROOT) {
  const manifest = JSON.parse(toLf(readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8')));
  // El repo del plugin es también su marketplace, con el mismo nombre (ADR-0014).
  const marketplace = manifest.name;
  const repo = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url;
  const url = repo ? (repo.endsWith('.git') ? repo : `${repo.replace(/\/+$/, '')}.git`) : null;
  return { name: manifest.name, marketplace, id: `${manifest.name}@${marketplace}`, url };
}

const detectIndent = (text) => {
  const m = /^([ \t]+)"/m.exec(text || '');
  return m ? m[1] : '  ';
};

export function mergeSettings(previousText, { depthLimit = true, marketplace = false, plugin = pluginInfo() } = {}) {
  let s = {};
  if (previousText !== null) {
    try { s = JSON.parse(toLf(previousText)); } catch (e) {
      throw new InitError(`${SETTINGS_REL} no es JSON válido (${e.message}); corrígelo antes de integrar`);
    }
    if (s === null || typeof s !== 'object' || Array.isArray(s)) throw new InitError(`${SETTINGS_REL} debe ser un objeto JSON`);
  } else {
    s = { $schema: SETTINGS_SCHEMA };
  }
  const notes = [];
  if (depthLimit) {
    const current = s.env?.[DEPTH_VAR];
    if (current !== '1') {
      s.env = { ...(s.env || {}), [DEPTH_VAR]: '1' };
      notes.push(current === undefined ? `env.${DEPTH_VAR} = "1"` : `env.${DEPTH_VAR}: "${current}" → "1"`);
    }
  }
  if (marketplace) {
    if (!plugin.url) throw new InitError('plugin.json no tiene "repository": no se puede declarar el marketplace', 1);
    if (!s.extraKnownMarketplaces?.[plugin.marketplace]) {
      s.extraKnownMarketplaces = { ...(s.extraKnownMarketplaces || {}), [plugin.marketplace]: { source: { source: 'git', url: plugin.url } } };
      notes.push(`extraKnownMarketplaces.${plugin.marketplace} → ${plugin.url}`);
    }
    const enabled = s.enabledPlugins?.[plugin.id];
    if (enabled === undefined) {
      s.enabledPlugins = { ...(s.enabledPlugins || {}), [plugin.id]: true };
      notes.push(`enabledPlugins["${plugin.id}"] = true`);
    } else if (enabled === false) {
      notes.push(`enabledPlugins["${plugin.id}"] está a false: se respeta; cámbialo a mano si quieres activarlo`);
    }
  }
  return { text: `${JSON.stringify(s, null, detectIndent(previousText && toLf(previousText)))}\n`, notes };
}

// ---------- integrate ----------
export function integrate(dir, opts = {}) {
  let config;
  try { config = loadConfig(dir); } catch (e) {
    if (e instanceof ConfigError) throw new InitError(e.message);
    throw e;
  }
  if (!config) throw new InitError(`no existe ${CONFIG_REL}: escribe primero la config (write-config)`);
  const plans = [];

  // 1. Carpetas de specs y ADRs (un .gitkeep para que git las conserve vacías).
  for (const rel of [config.paths.specs, config.paths.adr]) {
    if (!existsSync(path.join(dir, rel))) plans.push({ path: `${rel}/.gitkeep`, action: 'create', content: '' });
  }

  // 2. CLAUDE.md
  const { sections, source } = templateSections(dir, config);
  const projectSection = opts.projectSection ? cleanProjectSection(opts.projectSection) : null;
  const previousMd = readText(path.join(dir, 'CLAUDE.md'));
  const merged = mergeClaudeMd(previousMd, sections, {
    projectSection, replaceProject: Boolean(opts.replaceProject), agentsMd: existsSync(path.join(dir, 'AGENTS.md')),
  });
  plans.push({ ...planFile(dir, 'CLAUDE.md', merged.text, previousMd), sections: merged.report, template: source });

  // 3. .claude/settings.json
  if (opts.depthLimit !== false || opts.marketplace) {
    const previousSettings = readText(path.join(dir, SETTINGS_REL));
    const settings = mergeSettings(previousSettings, { depthLimit: opts.depthLimit !== false, marketplace: Boolean(opts.marketplace) });
    const plan = settings.notes.length === 0 && previousSettings !== null
      ? { path: SETTINGS_REL, action: 'unchanged' }
      : planFile(dir, SETTINGS_REL, settings.text, previousSettings);
    plans.push({ ...plan, notes: settings.notes });
  }

  if (!opts.dryRun) applyPlan(dir, plans);
  return {
    dry_run: Boolean(opts.dryRun),
    files: plans.map((p) => {
      const { content, ...rest } = p;
      return opts.dryRun && content !== undefined ? { ...rest, content: toLf(content) } : rest;
    }),
  };
}

// ---------- CLI ----------
function projectDir(opt) {
  const start = typeof opt.project === 'string' ? path.resolve(opt.project) : process.cwd();
  const top = toplevel(start);
  if (!top) throw new InitError(`${start} no es un repositorio git: el flujo SDD necesita git (ejecuta git init primero)`);
  return path.resolve(top);
}

export function run(argv, { stdin = readStdin } = {}) {
  const { pos, opt } = parseArgs(argv);
  const cmd = pos[0];
  if (!cmd || cmd === 'help' || opt.help) return { text: USAGE };
  const dir = projectDir(opt);
  const limit = Number.isInteger(Number(opt.limit)) && Number(opt.limit) > 0 ? Number(opt.limit) : 3;
  switch (cmd) {
    case 'scan': return { data: scan(dir) };
    case 'preview': {
      const r = preview(dir, parseJsonInput(stdin(), 'preview'), { limit });
      return { data: r, exit: r.valid ? 0 : 1 };
    }
    case 'write-config': return { data: writeConfig(dir, parseJsonInput(stdin(), 'write-config'), { dryRun: Boolean(opt['dry-run']) }) };
    case 'integrate': {
      if (opt['project-section'] !== undefined && opt['project-section'] !== '-') {
        throw new InitError('--project-section solo admite "-" (la sección se lee de stdin)', 1);
      }
      return {
        data: integrate(dir, {
          dryRun: Boolean(opt['dry-run']),
          projectSection: opt['project-section'] === '-' ? stdin() : null,
          replaceProject: Boolean(opt['replace-project-section']),
          depthLimit: !opt['no-depth-limit'],
          marketplace: Boolean(opt.marketplace),
        }),
      };
    }
    default: throw new InitError(`comando desconocido: ${cmd}\n\n${USAGE}`, 1);
  }
}

export function main(argv = process.argv.slice(2)) {
  try {
    const r = run(argv);
    if (r.text) process.stdout.write(`${r.text}\n`);
    else process.stdout.write(`${JSON.stringify(r.data, null, 2)}\n`);
    return r.exit ?? 0;
  } catch (e) {
    if (e instanceof InitError) {
      process.stderr.write(`sdd-init: ${e.message}\n`);
      return e.code;
    }
    throw e;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
