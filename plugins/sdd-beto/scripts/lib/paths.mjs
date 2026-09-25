// Clasificación de rutas y vínculo rama ↔ feature (ADR-0003, ADR-0007, ADR-0016).
// Todas las rutas internas son relativas a la raíz del proyecto y usan '/'.
import path from 'node:path';
import { matchesAny } from './glob.mjs';

export function toRel(projectDir, target) {
  const abs = path.resolve(projectDir, target);
  const rel = path.relative(projectDir, abs).split(path.sep).join('/');
  const outside = rel === '' ? false : rel.startsWith('../') || rel === '..' || path.isAbsolute(rel);
  return { rel, outside };
}

export const isReadme = (rel) => /(^|\/)README\.md$/i.test(rel);

export const isEnvExample = (rel, config) => matchesAny(rel, config.paths.env_examples);

// .env, .env.local, .env.production… pero nunca un .env.example (ni ningún *.example).
export const isRealEnv = (rel, config) =>
  /(^|\/)\.env(\.[^/]+)?$/.test(rel) && !rel.endsWith('.example') && !isEnvExample(rel, config);

// Archivos del propio flujo SDD y de Claude Code: nunca son producción ni test, aunque un glob
// amplio como "**" los abarque (ADR-0023).
export function isSddOwned(rel, config) {
  if (/^\.(sdd|claude)(\/|$)/.test(rel)) return true;
  if (/(^|\/)(CLAUDE|CLAUDE\.local|AGENTS)\.md$/.test(rel)) return true;
  const under = (dir) => rel === dir || rel.startsWith(`${dir.replace(/\/+$/, '')}/`);
  return under(config.paths.specs) || under(config.paths.adr);
}

// Devuelve { kind: 'test' | 'prod' | 'env_example' | 'other', scopes: [nombres] }.
// Test gana a producción: un test dentro de src/ es test.
export function classify(rel, config) {
  if (isSddOwned(rel, config)) return { kind: 'other', scopes: [] };
  const testScopes = [];
  const prodScopes = [];
  for (const [name, s] of Object.entries(config.scopes)) {
    if (matchesAny(rel, s.tests)) testScopes.push(name);
    if (matchesAny(rel, s.prod)) prodScopes.push(name);
  }
  if (testScopes.length) return { kind: 'test', scopes: testScopes };
  if (isEnvExample(rel, config)) return { kind: 'env_example', scopes: prodScopes };
  if (prodScopes.length && !isReadme(rel)) return { kind: 'prod', scopes: prodScopes };
  return { kind: 'other', scopes: [] };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const FEATURE_RE = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// "feat/007-add-login" → { type: 'feature', prefix: 'feat', feature: '007-add-login', id: '007', slug: 'add-login', dir }
export function featureFromBranch(branch, config) {
  if (!branch) return null;
  for (const [type, prefix] of Object.entries(config.branches)) {
    const m = new RegExp(`^${escapeRe(prefix)}/(\\d{3})-([a-z0-9]+(?:-[a-z0-9]+)*)$`).exec(branch);
    if (m) {
      const feature = `${m[1]}-${m[2]}`;
      return { type, prefix, feature, id: m[1], slug: m[2], dir: `${config.paths.specs}/${feature}` };
    }
  }
  return null;
}

export function branchFor(type, feature, config) {
  const prefix = config.branches[type];
  if (!prefix) throw new Error(`tipo de feature desconocido: "${type}" (usa ${Object.keys(config.branches).join(', ')})`);
  return `${prefix}/${feature}`;
}

// Nombre o carpeta con aspecto de test (test_x.py, x.spec.ts, tests/, __tests__/…). La documentación no cuenta.
export const looksLikeTest = (rel) => !/\.(md|mdx|rst|txt|adoc)$/i.test(rel) && (
  /(^|\/)(tests?|__tests__|specs?)\//i.test(rel) || /(^|[._-])(test|spec)s?[._-][^/]*$|[._-](test|spec)s?\.[^/.]+$/i.test(rel.split('/').pop()));

// Resumen de cómo clasifica una config los archivos del repo (sdd-state classify, sdd-init preview).
export function classifyReport(files, config, { limit = 3 } = {}) {
  const scopes = Object.fromEntries(Object.keys(config.scopes).map((n) => [n, { prod: 0, tests: 0, examples: { prod: [], tests: [] } }]));
  const envExamples = [];
  const overlaps = [];
  const suspicious = [];
  let other = 0;
  let sddOwned = 0;
  for (const f of files) {
    if (isSddOwned(f, config)) sddOwned++;
    const c = classify(f, config);
    if (c.kind === 'env_example') envExamples.push(f);
    if (c.kind === 'other' || c.kind === 'env_example') { if (c.kind === 'other') other++; continue; }
    if (c.scopes.length > 1) overlaps.push({ path: f, scopes: c.scopes });
    if (c.kind === 'prod' && looksLikeTest(f)) suspicious.push(f);
    const bucket = c.kind === 'test' ? 'tests' : 'prod';
    for (const s of c.scopes) {
      scopes[s][bucket]++;
      if (scopes[s].examples[bucket].length < limit) scopes[s].examples[bucket].push(f);
    }
  }
  const warnings = Object.entries(scopes).flatMap(([n, s]) => [
    ...(s.prod === 0 ? [`scopes.${n}.prod no coincide con ningún archivo`] : []),
    ...(s.tests === 0 ? [`scopes.${n}.tests no coincide con ningún archivo (normal si aún no hay tests)`] : []),
  ]);
  if (overlaps.length) warnings.push(`${overlaps.length} archivo(s) pertenecen a más de un ámbito (p. ej. ${overlaps[0].path})`);
  if (suspicious.length) warnings.push(`${suspicious.length} archivo(s) de producción parecen tests (p. ej. ${suspicious[0]}): revisa los globs "tests"`);
  return {
    total: files.length, scopes, env_examples: envExamples, other, sdd_owned: sddOwned,
    overlaps: overlaps.slice(0, limit * 3), suspicious: suspicious.slice(0, limit * 3), warnings,
  };
}
