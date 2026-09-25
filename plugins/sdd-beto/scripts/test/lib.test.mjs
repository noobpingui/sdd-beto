import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { globToRegExp, matchesAny, matchesGlob } from '../lib/glob.mjs';
import { applyDefaults, COMMAND_KEYS, validateConfig } from '../lib/config.mjs';
import { branchFor, classify, featureFromBranch, isRealEnv, looksLikeTest, toRel } from '../lib/paths.mjs';
import { PLUGIN_ROOT, resolveTemplate } from '../lib/templates.mjs';

const readJson = (rel) => JSON.parse(readFileSync(path.join(PLUGIN_ROOT, rel), 'utf8'));

// ---------- glob ----------
test('glob: ** cubre cero o más directorios', () => {
  assert.ok(matchesGlob('docs', 'docs/**'));
  assert.ok(matchesGlob('docs/a.md', 'docs/**'));
  assert.ok(matchesGlob('docs/x/y/z.md', 'docs/**'));
  assert.ok(!matchesGlob('docsx/a.md', 'docs/**'));
  assert.ok(matchesGlob('.env.example', '**/.env.example'));
  assert.ok(matchesGlob('api/sub/.env.example', '**/.env.example'));
  assert.ok(matchesGlob('a/b', 'a/**/b'));
  assert.ok(matchesGlob('a/x/y/b', 'a/**/b'));
  assert.ok(matchesGlob('anything/at/all', '**'));
});

test('glob: * y ? no cruzan directorios', () => {
  assert.ok(matchesGlob('src/a.ts', 'src/*.ts'));
  assert.ok(!matchesGlob('src/x/a.ts', 'src/*.ts'));
  assert.ok(matchesGlob('a1', 'a?'));
  assert.ok(!matchesGlob('a/', 'a?'));
});

test('glob: alternativas con llaves, también anidadas', () => {
  const g = 'web/src/**/*.test.{ts,tsx}';
  assert.ok(matchesGlob('web/src/a/Foo.test.tsx', g));
  assert.ok(matchesGlob('web/src/Foo.test.ts', g));
  assert.ok(!matchesGlob('web/src/Foo.test.js', g));
  assert.ok(matchesGlob('x.min.js', 'x.{min.{js,css},map}'));
  assert.ok(matchesGlob('x.map', 'x.{min.{js,css},map}'));
});

test('glob: los caracteres especiales de regex son literales', () => {
  assert.ok(matchesGlob('a+b(1).md', 'a+b(1).md'));
  assert.ok(!matchesGlob('aab(1).md', 'a+b(1).md'));
  assert.ok(!matchesGlob('filexmd', 'file.md'));
});

test('glob: errores de sintaxis y lista vacía', () => {
  assert.throws(() => globToRegExp('a{b'), /sin cerrar/);
  assert.throws(() => globToRegExp('a}b'), /sobrante/);
  assert.throws(() => globToRegExp(''), /no vacío/);
  assert.equal(matchesAny('a', []), false);
});

// ---------- config ----------
const baseConfig = () => ({
  schema_version: 1,
  scopes: {
    api: { root: 'api', prod: ['api/**'], tests: ['api/tests/**'], commands: { test: 'run-tests' } },
    web: { prod: ['web/**'], tests: ['web/src/**/*.test.{ts,tsx}'], commands: { test: null, lint_ratchet: { format: 'eslint', cmd: 'x {file}' } } },
  },
});

test('config: una config mínima es válida y recibe los valores por defecto', () => {
  assert.deepEqual(validateConfig(baseConfig()), []);
  const c = applyDefaults(baseConfig());
  assert.equal(c.base_branch, 'main');
  assert.equal(c.paths.specs, 'specs');
  assert.equal(c.scopes.web.root, '.');
  assert.deepEqual(Object.keys(c.scopes.api.commands), COMMAND_KEYS);
  assert.equal(c.scopes.api.commands.build, null);
});

test('config: la plantilla del plugin es válida', () => {
  assert.deepEqual(validateConfig(readJson('templates/config.json')), []);
});

test('config: detecta errores con mensajes que nombran el campo', () => {
  const c = baseConfig();
  c.extra = 1;
  c.scopes.api.prod = ['/abs/**'];
  c.scopes.api.tests = [];
  c.scopes.web.commands.lint_ratchet = { format: 'pylint', cmd: '' };
  c.scopes.Bad = { prod: ['x/**'], tests: ['x/t/**'], commands: {} };
  c.models = { wizard: 'opus' };
  c.paths = { specs: '../out' };
  const issues = validateConfig(c).join('\n');
  for (const frag of ['campo desconocido "extra"', 'scopes.api.prod', 'scopes.api.tests: necesita al menos 1',
    'lint_ratchet.format', 'lint_ratchet.cmd', 'scopes.Bad: el nombre', 'scopes.Bad.commands.test: es obligatorio',
    'agente desconocido "wizard"', 'paths.specs']) {
    assert.ok(issues.includes(frag), `falta el error "${frag}" en:\n${issues}`);
  }
});

test('config: schema_version y scopes son obligatorios', () => {
  const issues = validateConfig({}).join('\n');
  assert.ok(issues.includes('schema_version'));
  assert.ok(issues.includes('scopes: necesita al menos un ámbito'));
});

test('config: el validador y config.schema.json aceptan los mismos campos', () => {
  const schema = readJson('templates/config.schema.json');
  // Cada campo de primer nivel del esquema debe ser conocido por el validador (no "campo desconocido").
  for (const k of Object.keys(schema.properties)) {
    const probe = { ...baseConfig(), [k]: k in baseConfig() ? baseConfig()[k] : 'x' };
    assert.ok(!validateConfig(probe).some((i) => i.includes(`campo desconocido "${k}"`)), `el validador no conoce "${k}"`);
  }
  // Y a la inversa: un campo que no está en el esquema es rechazado.
  assert.ok(validateConfig({ ...baseConfig(), nope: 1 }).some((i) => i.includes('campo desconocido "nope"')));
  const scopeKeys = Object.keys(schema.$defs.scope.properties).sort();
  assert.deepEqual(scopeKeys, ['commands', 'env_hint', 'prod', 'root', 'tests']);
  assert.deepEqual(Object.keys(schema.$defs.scope.properties.commands.properties).sort(), [...COMMAND_KEYS].sort());
  assert.deepEqual(schema.$defs.lintRatchet.oneOf[1].properties.format.enum, ['ruff', 'eslint']);
});

// ---------- paths ----------
const cfg = applyDefaults(baseConfig());

test('paths: clasifica test, producción, .env.example y resto', () => {
  assert.deepEqual(classify('api/tests/test_x.py', cfg), { kind: 'test', scopes: ['api'] });
  assert.deepEqual(classify('api/service.py', cfg), { kind: 'prod', scopes: ['api'] });
  assert.deepEqual(classify('web/src/A.test.tsx', cfg), { kind: 'test', scopes: ['web'] });
  assert.deepEqual(classify('web/src/A.tsx', cfg), { kind: 'prod', scopes: ['web'] });
  assert.equal(classify('api/.env.example', cfg).kind, 'env_example');
  assert.equal(classify('api/README.md', cfg).kind, 'other');
  assert.equal(classify('package.json', cfg).kind, 'other');
  assert.equal(classify('specs/001-x/spec.md', cfg).kind, 'other');
});

test('paths: los archivos del flujo SDD nunca son producción ni test, aunque "**" los abarque (ADR-0023)', () => {
  const wide = applyDefaults({
    schema_version: 1,
    paths: { adr: 'docs/adr' },
    scopes: { app: { prod: ['**'], tests: ['**/*.test.js', 'specs/**'], commands: { test: null } } },
  });
  for (const rel of ['.sdd/config.json', '.sdd/constitution.md', '.sdd/templates/plan.md', '.claude/settings.json',
    'CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md', 'lib/CLAUDE.md', 'specs/001-x/state.json', 'specs', 'docs/adr/ADR-0001-x.md']) {
    assert.deepEqual(classify(rel, wide), { kind: 'other', scopes: [] }, rel);
  }
  assert.equal(classify('lib/a.js', wide).kind, 'prod');
  assert.equal(classify('lib/a.test.js', wide).kind, 'test');
  assert.equal(classify('docs/guide.md', wide).kind, 'prod'); // solo paths.adr se excluye, no todo docs/
  assert.equal(classify('specsheet/a.js', wide).kind, 'prod'); // prefijo de carpeta, no de texto
  assert.equal(classify('.sddrc', wide).kind, 'prod');
});

test('paths: .env reales frente a ejemplos', () => {
  assert.ok(isRealEnv('.env', cfg));
  assert.ok(isRealEnv('api/.env.local', cfg));
  assert.ok(!isRealEnv('api/.env.example', cfg));
  assert.ok(!isRealEnv('config/env.ts', cfg));
});

test('paths: toRel normaliza y detecta rutas fuera del proyecto', () => {
  const root = path.resolve('/proj');
  assert.deepEqual(toRel(root, path.join(root, 'a', 'b.txt')), { rel: 'a/b.txt', outside: false });
  assert.equal(toRel(root, path.resolve('/other/x')).outside, true);
  assert.equal(toRel(root, path.join(root, '..', 'x')).outside, true);
});

test('paths: rama ↔ feature con los prefijos de la config', () => {
  assert.deepEqual(featureFromBranch('feat/007-add-login', cfg),
    { type: 'feature', prefix: 'feat', feature: '007-add-login', id: '007', slug: 'add-login', dir: 'specs/007-add-login' });
  assert.equal(featureFromBranch('fix/012-typo', cfg).type, 'fix');
  assert.equal(featureFromBranch('main', cfg), null);
  assert.equal(featureFromBranch('feat/7-x', cfg), null);
  assert.equal(featureFromBranch('feat/007-Bad', cfg), null);
  const custom = applyDefaults({ ...baseConfig(), branches: { feature: 'feature' } });
  assert.equal(featureFromBranch('feature/001-a', custom).type, 'feature');
  assert.equal(branchFor('refactor', '003-x', cfg), 'refactor/003-x');
  assert.throws(() => branchFor('chore', '003-x', cfg), /tipo de feature desconocido/);
});

// ---------- templates ----------
test('templates: usa la del plugin si el proyecto no la sobrescribe', () => {
  const r = resolveTemplate('spec.md', path.resolve('/no/existe'));
  assert.equal(r.source, 'plugin');
  assert.throws(() => resolveTemplate('../x', '/p'), /no válido/);
  assert.throws(() => resolveTemplate('nada.md', '/p'), /no existe/);
});

test('paths: looksLikeTest reconoce tests por nombre o carpeta, pero no la documentación', () => {
  for (const rel of ['a/test_x.py', 'a/x_test.go', 'a/x.test.ts', 'a/x.spec.js', 'tests/a.js', 'a/__tests__/b.js', 'spec/a_spec.rb']) {
    assert.ok(looksLikeTest(rel), rel);
  }
  for (const rel of ['a/x.js', 'a/contest.js', 'a/testing.js', 'skills/test/SKILL.md', 'docs/specs/api.md', 'tests/notes.txt']) {
    assert.ok(!looksLikeTest(rel), rel);
  }
});
