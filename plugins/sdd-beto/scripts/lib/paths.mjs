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

// Devuelve { kind: 'test' | 'prod' | 'env_example' | 'other', scopes: [nombres] }.
// Test gana a producción: un test dentro de src/ es test.
export function classify(rel, config) {
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
