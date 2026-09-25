#!/usr/bin/env node
// CLI de state.json (ADR-0021). La usan el orquestador y el verifier en lugar de editar el JSON a mano.
//
//   node sdd-state.mjs <comando> [argumentos] [--feature NNN|NNN-slug] [--project <dir>] [--json]
//
// Salida: 0 = ok · 1 = error de uso o de validación · 2 = estado o precondición incorrectos · 3 = límite de iteraciones
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, ConfigError, CONFIG_REL } from './lib/config.mjs';
import { branchFor, classify, classifyReport, featureFromBranch, FEATURE_RE, SLUG_RE } from './lib/paths.mjs';
import { branchExists, changedFiles, currentBranch, refExists, repoFiles, toplevel } from './lib/git.mjs';
import { resolveTemplate } from './lib/templates.mjs';
import * as S from './lib/state.mjs';

const USAGE = `Uso: node sdd-state.mjs <comando> [argumentos] [opciones]

Consultas (no escriben):
  now                                  fecha ISO-8601 del sistema
  next <slug> [--type feature|fix|refactor]
                                       número, carpeta y rama que tendría una feature nueva
  show                                 resumen de la feature
  check <etapa>                        precondiciones de una etapa (sale con 2 si falta algo)
  validate [--git]                     consistencia de state.json (con --git, también ramas y commits)
  snapshot --check                     compara los tests actuales con tests_snapshot (sale con 1 si difieren)
  classify [--limit N]                 cuántos archivos cuenta la config como producción y test por ámbito
  changed [--kind test|prod|env_example|other]
                                       archivos que cambió la feature respecto a su base, clasificados

Cambios (exigen estar en la rama de la feature):
  init <slug> --type <t> --title <texto> --scope <a,b> [--base <rama>]
  start <etapa> [--note <texto>]       empieza (o reanuda) la etapa actual
  gate <etapa> [--note <texto>]        trabajo terminado: queda esperando aprobación
  approve <etapa> --note <texto>       aprobación del usuario (texto literal) y avance
  rework <etapa> [--counter tests|implement|review] --note <texto>
                                       vuelve a una etapa para corregir; anula aprobaciones desde ahí
  block --note <texto>                 bloquea la feature
  result red|verify PASS|FAIL|BLOCKED [--note <texto>]      (verifier)
  review-verdict [APPROVED|CHANGES_REQUESTED]               sin valor: lo lee de review.md
  commit <etiqueta> <sha>              registra el sha de un commit
  event <etapa> <evento> --note <texto>
  snapshot [--reason <texto>]          guarda el SHA-256 de los tests de la feature

Opciones comunes:
  --feature <NNN|NNN-slug>             por defecto, la de la rama actual
  --project <dir>                      por defecto, la raíz git del directorio actual
  --json                               salida en JSON`;

class UsageError extends Error { constructor(m) { super(m); this.code = 1; } }

function parseArgs(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) opt[key] = true;
      else { opt[key] = next; i++; }
    } else pos.push(a);
  }
  return { pos, opt };
}

const nowIso = () => new Date().toISOString();

// ---------- contexto ----------
function projectDir(opt) {
  if (typeof opt.project === 'string') return path.resolve(opt.project);
  return toplevel(process.cwd()) || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function requireConfig(dir) {
  const config = loadConfig(dir);
  if (!config) throw new S.StateError(`no existe ${CONFIG_REL}: ejecuta primero /sdd-beto:init`);
  return config;
}

function listFeatures(dir, config) {
  const specs = path.join(dir, config.paths.specs);
  if (!existsSync(specs)) return [];
  return readdirSync(specs, { withFileTypes: true })
    .filter((d) => d.isDirectory() && FEATURE_RE.test(d.name))
    .map((d) => d.name)
    .sort();
}

function resolveFeature(dir, config, opt) {
  if (typeof opt.feature === 'string') {
    const wanted = opt.feature;
    const matches = listFeatures(dir, config).filter((f) => f === wanted || f.startsWith(`${wanted}-`));
    if (matches.length !== 1) throw new S.StateError(`no encuentro una única feature "${wanted}" en ${config.paths.specs}/`);
    return matches[0];
  }
  const fb = featureFromBranch(currentBranch(dir), config);
  if (!fb) throw new S.StateError(`la rama actual "${currentBranch(dir)}" no es de feature; indica --feature`);
  return fb.feature;
}

const statePath = (dir, config, feature) => path.join(dir, config.paths.specs, feature, 'state.json');

function readState(file) {
  if (!existsSync(file)) throw new S.StateError(`no existe ${file}`);
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new S.StateError(`state.json no es JSON válido: ${e.message}`, 1); }
}

// Escritura atómica: archivo temporal y renombrado, con salto de línea final.
function writeState(file, st) {
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(st, null, 2)}\n`, 'utf8');
  renameSync(tmp, file);
}

function assertOnBranch(dir, st) {
  const cur = currentBranch(dir);
  if (cur !== st.branch) {
    throw new S.StateError(`la rama actual es "${cur}" y la de la feature es "${st.branch}". ` +
      'Otra ventana pudo cambiarla: comprueba con git y vuelve a la rama correcta antes de seguir.');
  }
}

// SHA-256 con saltos de línea normalizados (CRLF → LF), para no confundir un checkout con un cambio.
export function hashFile(file) {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function featureTestFiles(dir, config, st) {
  return changedFiles(st.base_branch, dir)
    .filter((f) => classify(f, config).kind === 'test')
    .filter((f) => existsSync(path.join(dir, f)));
}

// ---------- comandos ----------
function cmdNext(ctx, pos, opt) {
  const slug = pos[0];
  if (!slug || !SLUG_RE.test(slug)) throw new UsageError('next necesita un slug en kebab-case (p. ej. add-login)');
  const type = typeof opt.type === 'string' ? opt.type : 'feature';
  const features = listFeatures(ctx.dir, ctx.config);
  const clash = features.find((f) => f.slice(4) === slug);
  if (clash) throw new S.StateError(`ya existe una feature con ese slug: ${clash}`);
  const max = features.reduce((m, f) => Math.max(m, Number(f.slice(0, 3))), 0);
  const id = String(max + 1).padStart(3, '0');
  const feature = `${id}-${slug}`;
  return { id, feature, dir: `${ctx.config.paths.specs}/${feature}`, branch: branchFor(type, feature, ctx.config), type };
}

function cmdInit(ctx, pos, opt) {
  const next = cmdNext(ctx, pos, opt);
  if (typeof opt.title !== 'string') throw new UsageError('init necesita --title');
  if (typeof opt.scope !== 'string') throw new UsageError(`init necesita --scope (ámbitos: ${Object.keys(ctx.config.scopes).join(', ')})`);
  const scope = opt.scope.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = scope.filter((s) => !ctx.config.scopes[s]);
  if (unknown.length || scope.length === 0) throw new UsageError(`ámbitos desconocidos: ${unknown.join(', ') || '(vacío)'}`);
  const cur = currentBranch(ctx.dir);
  if (cur !== next.branch) throw new S.StateError(`crea y cambia primero a la rama "${next.branch}" (rama actual: "${cur}")`);
  const base = typeof opt.base === 'string' ? opt.base : ctx.config.base_branch;
  const template = JSON.parse(readFileSync(resolveTemplate('state.json', ctx.dir).path, 'utf8'));
  const st = S.createState(template, {
    feature: next.feature, title: opt.title, type: next.type, scope, branch: next.branch,
    baseBranch: base, maxIterations: ctx.config.max_iterations, now: nowIso(),
  });
  const folder = path.join(ctx.dir, next.dir);
  mkdirSync(folder, { recursive: true });
  writeState(path.join(folder, 'state.json'), st);
  return { ...next, base_branch: base, state: `${next.dir}/state.json` };
}

function withState(ctx, opt, mutate, { requireBranch = true } = {}) {
  const feature = resolveFeature(ctx.dir, ctx.config, opt);
  const file = statePath(ctx.dir, ctx.config, feature);
  const st = readState(file);
  if (requireBranch) assertOnBranch(ctx.dir, st);
  const out = mutate(st, feature);
  const next = out && out.state ? out.state : out;
  writeState(file, next);
  return { feature, stage: next.stage, status: next.status, ...(out && out.extra ? out.extra : {}) };
}

function readReviewVerdict(ctx, feature) {
  const file = path.join(ctx.dir, ctx.config.paths.specs, feature, 'review.md');
  if (!existsSync(file)) throw new S.StateError('no existe review.md; indica el veredicto explícitamente');
  // La línea debe tener un único veredicto: la de la plantilla ("APPROVED | CHANGES_REQUESTED") no vale.
  const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => /\*\*Veredicto:\*\*/.test(l));
  const m = lines.length === 1 ? /^\s*(?:-\s*)?\*\*Veredicto:\*\*\s*(APPROVED|CHANGES_REQUESTED)\s*$/.exec(lines[0]) : null;
  if (!m) throw new S.StateError('review.md debe tener una sola línea "**Veredicto:** APPROVED" o "**Veredicto:** CHANGES_REQUESTED"');
  return m[1];
}

function cmdShow(ctx, opt) {
  const feature = resolveFeature(ctx.dir, ctx.config, opt);
  const st = readState(statePath(ctx.dir, ctx.config, feature));
  const approvals = Object.fromEntries(S.STAGES.map((s) => [s, st.approvals[s] ? st.approvals[s].at : null]));
  return {
    feature, title: st.title, type: st.type, scope: st.scope, branch: st.branch, base_branch: st.base_branch,
    stage: st.stage, status: st.status, approvals, iterations: st.iterations, max_iterations: st.max_iterations,
    red_check: st.red_check, verify: st.verify, review: st.review, commits: st.commits,
    tests_snapshot: st.tests_snapshot ? { at: st.tests_snapshot.at, files: Object.keys(st.tests_snapshot.sha256).length } : null,
    last_events: st.history.slice(-5),
  };
}

function cmdValidate(ctx, opt) {
  const feature = resolveFeature(ctx.dir, ctx.config, opt);
  const folder = path.join(ctx.dir, ctx.config.paths.specs, feature);
  const st = readState(path.join(folder, 'state.json'));
  const issues = S.validateState(st, { artifactExists: (name) => existsSync(path.join(folder, name)) });
  if (st.feature && st.feature !== feature) issues.push(`feature "${st.feature}" no coincide con la carpeta "${feature}"`);
  if (opt.git) {
    if (st.branch && !branchExists(st.branch, ctx.dir)) issues.push(`la rama "${st.branch}" no existe`);
    for (const [label, sha] of Object.entries(st.commits || {})) if (!refExists(sha, ctx.dir)) issues.push(`commits.${label}: el sha ${sha} no existe`);
  }
  return { feature, valid: issues.length === 0, issues };
}

function cmdSnapshotCheck(ctx, opt) {
  const feature = resolveFeature(ctx.dir, ctx.config, opt);
  const st = readState(statePath(ctx.dir, ctx.config, feature));
  if (!st.tests_snapshot) throw new S.StateError('no hay tests_snapshot: se guarda al aprobar la etapa tests');
  const saved = st.tests_snapshot.sha256;
  const current = new Set(featureTestFiles(ctx.dir, ctx.config, st));
  const changed = [];
  const missing = [];
  for (const [file, hash] of Object.entries(saved)) {
    const abs = path.join(ctx.dir, file);
    if (!existsSync(abs)) missing.push(file);
    else if (hashFile(abs) !== hash) changed.push(file);
    current.delete(file);
  }
  const added = [...current];
  return { feature, snapshot_at: st.tests_snapshot.at, identical: !changed.length && !missing.length && !added.length, changed, missing, added };
}

// Archivos que cambió la feature respecto a su base (commits de la rama + sin commitear), clasificados.
function cmdChanged(ctx, opt) {
  const feature = resolveFeature(ctx.dir, ctx.config, opt);
  const st = readState(statePath(ctx.dir, ctx.config, feature));
  const kinds = ['test', 'prod', 'env_example', 'other'];
  if (opt.kind !== undefined && !kinds.includes(opt.kind)) throw new UsageError(`--kind debe ser uno de ${kinds.join(', ')}`);
  const files = changedFiles(st.base_branch, ctx.dir).map((f) => {
    const c = classify(f, ctx.config);
    return { path: f, kind: c.kind, scopes: c.scopes, exists: existsSync(path.join(ctx.dir, f)) };
  }).filter((f) => opt.kind === undefined || f.kind === opt.kind);
  const scopesTouched = [...new Set(files.flatMap((f) => f.scopes))].sort();
  return { feature, base_branch: st.base_branch, scopes_touched: scopesTouched, files };
}

// Cómo clasifica la config los archivos del repo (versionados y sin rastrear no ignorados).
function cmdClassify(ctx, opt) {
  const limit = Number.isInteger(Number(opt.limit)) && Number(opt.limit) > 0 ? Number(opt.limit) : 3;
  return classifyReport(repoFiles(ctx.dir), ctx.config, { limit });
}

function run(argv) {
  const { pos, opt } = parseArgs(argv);
  const cmd = pos.shift();
  if (!cmd || cmd === 'help' || opt.help) return { text: USAGE };
  if (cmd === 'now') return { text: nowIso(), data: { now: nowIso() } };

  const dir = projectDir(opt);
  const ctx = { dir, config: requireConfig(dir) };
  const now = nowIso();
  const note = typeof opt.note === 'string' ? opt.note : undefined;
  const needStage = () => { if (!pos[0]) throw new UsageError(`${cmd} necesita una etapa (${S.STAGES.join(', ')})`); return pos[0]; };
  const ideaExists = (feature) => existsSync(path.join(dir, ctx.config.paths.specs, feature, 'idea.md'));

  switch (cmd) {
    case 'next': return { data: cmdNext(ctx, pos, opt) };
    case 'init': return { data: cmdInit(ctx, pos, opt) };
    case 'show': return { data: cmdShow(ctx, opt) };
    case 'classify': return { data: cmdClassify(ctx, opt) };
    case 'changed': return { data: cmdChanged(ctx, opt) };
    case 'validate': {
      const r = cmdValidate(ctx, opt);
      return { data: r, exit: r.valid ? 0 : 1 };
    }
    case 'check': {
      const stage = needStage();
      const feature = resolveFeature(dir, ctx.config, opt);
      const st = readState(statePath(dir, ctx.config, feature));
      const missing = S.preconditions(st, stage, { ideaExists: ideaExists(feature) });
      return { data: { feature, stage, ok: missing.length === 0, missing }, exit: missing.length ? 2 : 0 };
    }
    case 'start': { const stage = needStage(); return { data: withState(ctx, opt, (st, f) => S.start(st, stage, { note, now, ideaExists: ideaExists(f) })) }; }
    case 'gate': { const stage = needStage(); return { data: withState(ctx, opt, (st) => S.gate(st, stage, { note, now })) }; }
    case 'approve': { const stage = needStage(); return { data: withState(ctx, opt, (st) => S.approve(st, stage, { note, now })) }; }
    case 'block': return { data: withState(ctx, opt, (st) => S.block(st, { note, now })) };
    case 'rework': {
      const stage = needStage();
      const counter = typeof opt.counter === 'string' ? opt.counter : undefined;
      let blocked = false;
      const data = withState(ctx, opt, (st) => { const r = S.rework(st, stage, { counter, note, now }); blocked = r.blocked; return { state: r.state, extra: { blocked } }; });
      return { data, exit: blocked ? 3 : 0 };
    }
    case 'result': {
      const [kind, result] = pos;
      return { data: withState(ctx, opt, (st) => S.setResult(st, kind, result, { note, now })) };
    }
    case 'review-verdict': {
      return { data: withState(ctx, opt, (st, f) => {
        const verdict = pos[0] || readReviewVerdict(ctx, f);
        return { state: S.setVerdict(st, verdict, { now }), extra: { verdict } };
      }) };
    }
    case 'commit': {
      const [label, sha] = pos;
      return { data: withState(ctx, opt, (st) => S.setCommit(st, label, sha, { now })) };
    }
    case 'event': {
      const [stage, event] = pos;
      return { data: withState(ctx, opt, (st) => S.addEvent(st, stage, event, { note, now })) };
    }
    case 'snapshot': {
      if (opt.check) {
        const r = cmdSnapshotCheck(ctx, opt);
        return { data: r, exit: r.identical ? 0 : 1 };
      }
      const reason = typeof opt.reason === 'string' ? opt.reason : '';
      return { data: withState(ctx, opt, (st) => {
        const files = featureTestFiles(dir, ctx.config, st);
        const sha256 = Object.fromEntries(files.map((f) => [f, hashFile(path.join(dir, f))]));
        return { state: S.setSnapshot(st, sha256, { reason, now }), extra: { files } };
      }) };
    }
    default: throw new UsageError(`comando desconocido: "${cmd}"\n\n${USAGE}`);
  }
}

function format(data) {
  return Object.entries(data).map(([k, v]) => `${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`).join('\n');
}

export function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  try {
    const r = run(argv);
    if (r.text !== undefined && (!json || !r.data)) process.stdout.write(`${r.text}\n`);
    else process.stdout.write(`${json ? JSON.stringify(r.data, null, 2) : format(r.data)}\n`);
    return r.exit || 0;
  } catch (e) {
    const code = e instanceof ConfigError ? 1 : (e.code && Number.isInteger(e.code) ? e.code : 1);
    process.stderr.write(`[sdd-state] ${e.message}\n`);
    if (json) process.stdout.write(`${JSON.stringify({ error: e.message, code })}\n`);
    return code;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
