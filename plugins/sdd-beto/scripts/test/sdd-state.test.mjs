// Integración de la CLI sdd-state con repos git temporales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'sdd-state.mjs');

const CONFIG = {
  schema_version: 1,
  scopes: {
    api: { root: 'api', prod: ['api/**'], tests: ['api/tests/**'], commands: { test: 'echo ok' } },
  },
};

function makeRepo(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sdd-state-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('config', 'core.autocrlf', 'false');
  mkdirSync(path.join(dir, '.sdd'));
  writeFileSync(path.join(dir, '.sdd', 'config.json'), JSON.stringify(CONFIG));
  mkdirSync(path.join(dir, 'api', 'tests'), { recursive: true });
  writeFileSync(path.join(dir, 'api', 'app.py'), 'x = 1\n');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  const write = (rel, text) => { mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); writeFileSync(path.join(dir, rel), text); };
  const cli = (...args) => {
    const r = spawnSync(process.execPath, [CLI, ...args, '--json'], { cwd: dir, encoding: 'utf8' });
    let data = null;
    try { data = JSON.parse(r.stdout); } catch { /* sin JSON */ }
    return { code: r.status, data, stderr: r.stderr };
  };
  const state = (feature = '001-demo') => JSON.parse(readFileSync(path.join(dir, 'specs', feature, 'state.json'), 'utf8'));
  return { dir, git, write, cli, state };
}

function newFeature(r, slug = 'demo') {
  r.git('checkout', '-q', '-b', `feat/001-${slug}`);
  const res = r.cli('init', slug, '--type', 'feature', '--title', 'Demo', '--scope', 'api', '--base', 'main');
  assert.equal(res.code, 0, res.stderr);
  r.write(`specs/001-${slug}/idea.md`, '# Idea\n');
  return res.data;
}

test('cli: sin config pide ejecutar init', (t) => {
  const r = makeRepo(t);
  rmSync(path.join(r.dir, '.sdd'), { recursive: true });
  const res = r.cli('show', '--feature', '001');
  assert.equal(res.code, 2);
  assert.match(res.stderr, /\/sdd-beto:init/);
});

test('cli: config no válida da un error con el campo', (t) => {
  const r = makeRepo(t);
  writeFileSync(path.join(r.dir, '.sdd', 'config.json'), JSON.stringify({ schema_version: 1, scopes: {} }));
  const res = r.cli('next', 'x');
  assert.equal(res.code, 1);
  assert.match(res.stderr, /scopes: necesita al menos un ámbito/);
});

test('cli: next e init crean la feature en la rama correcta', (t) => {
  const r = makeRepo(t);
  const next = r.cli('next', 'demo');
  assert.deepEqual(next.data, { id: '001', feature: '001-demo', dir: 'specs/001-demo', branch: 'feat/001-demo', type: 'feature' });
  const wrongBranch = r.cli('init', 'demo', '--type', 'feature', '--title', 'Demo', '--scope', 'api');
  assert.equal(wrongBranch.code, 2);
  assert.match(wrongBranch.stderr, /crea y cambia primero a la rama "feat\/001-demo"/);
  const created = newFeature(r);
  assert.equal(created.base_branch, 'main');
  const st = r.state();
  assert.equal(st.branch, 'feat/001-demo');
  assert.deepEqual(st.scope, ['api']);
  assert.equal(r.cli('next', 'other').data.id, '002');
  assert.equal(r.cli('next', 'demo').code, 2);
  assert.equal(r.cli('init', 'x', '--type', 'feature', '--title', 'X', '--scope', 'nope').code, 1);
});

test('cli: flujo spec → plan con gate, aprobación y commit', (t) => {
  const r = makeRepo(t);
  newFeature(r);
  assert.equal(r.cli('check', 'plan').code, 2);
  assert.equal(r.cli('start', 'spec').code, 0);
  assert.equal(r.cli('approve', 'spec', '--note', 'sí').code, 2); // sin gate
  assert.equal(r.cli('gate', 'spec', '--note', 'spec lista').data.status, 'awaiting_approval');
  const ok = r.cli('approve', 'spec', '--note', '1. Si. 2. Si');
  assert.equal(ok.code, 0);
  assert.equal(ok.data.stage, 'plan');
  assert.equal(r.state().approvals.spec.note, '1. Si. 2. Si');
  assert.equal(r.cli('commit', 'spec', 'abc1234').code, 0);
  assert.equal(r.state().commits.spec, 'abc1234');
  assert.equal(r.cli('check', 'plan').data.ok, true);
  const v = r.cli('validate');
  assert.equal(v.code, 1); // spec aprobada pero sin spec.md
  assert.match(v.data.issues.join('\n'), /falta spec\.md/);
  r.write('specs/001-demo/spec.md', '# Spec\n');
  assert.equal(r.cli('validate').code, 0);
});

test('cli: los cambios exigen estar en la rama de la feature', (t) => {
  const r = makeRepo(t);
  newFeature(r);
  r.git('checkout', '-q', 'main');
  const res = r.cli('start', 'spec', '--feature', '001');
  assert.equal(res.code, 2);
  assert.match(res.stderr, /rama actual es "main"/);
  assert.equal(r.cli('show', '--feature', '001').code, 0); // las consultas sí funcionan
});

test('cli: resultado del verifier y veredicto leído de review.md', (t) => {
  const r = makeRepo(t);
  newFeature(r);
  assert.equal(r.cli('result', 'red', 'PASS').code, 2); // aún no es la etapa tests
  const st = r.state();
  st.stage = 'review';
  writeFileSync(path.join(r.dir, 'specs', '001-demo', 'state.json'), JSON.stringify(st));
  r.write('specs/001-demo/review.md', '# Review\n\n- **Veredicto:** CHANGES_REQUESTED\n');
  const v = r.cli('review-verdict');
  assert.equal(v.code, 0);
  assert.equal(v.data.verdict, 'CHANGES_REQUESTED');
  assert.equal(r.state().review.verdict, 'CHANGES_REQUESTED');
});

test('cli: rework devuelve 3 al agotar las iteraciones', (t) => {
  const r = makeRepo(t);
  newFeature(r);
  for (let i = 0; i < 3; i++) assert.equal(r.cli('rework', 'spec', '--counter', 'review', '--note', `n${i}`).code, 0);
  const res = r.cli('rework', 'spec', '--counter', 'review', '--note', 'otra');
  assert.equal(res.code, 3);
  assert.equal(r.state().status, 'blocked');
});

test('cli: snapshot de tests y comprobación (tolera CRLF, detecta cambios, nuevos y borrados)', (t) => {
  const r = makeRepo(t);
  newFeature(r);
  r.write('api/tests/test_a.py', 'def test_a():\n    assert 1\n');
  r.write('api/tests/test_b.py', 'def test_b():\n    assert 1\n');
  r.write('api/app.py', 'x = 2\n'); // producción: no entra en el snapshot
  const snap = r.cli('snapshot', '--reason', 'aprobación de tests');
  assert.equal(snap.code, 0, snap.stderr);
  assert.deepEqual(snap.data.files, ['api/tests/test_a.py', 'api/tests/test_b.py']);
  assert.equal(r.cli('snapshot', '--check').data.identical, true);

  r.write('api/tests/test_a.py', 'def test_a():\r\n    assert 1\r\n'); // solo saltos de línea
  assert.equal(r.cli('snapshot', '--check').data.identical, true);

  r.write('api/tests/test_a.py', 'def test_a():\n    assert 0\n');
  rmSync(path.join(r.dir, 'api', 'tests', 'test_b.py'));
  r.write('api/tests/test_c.py', 'def test_c():\n    pass\n');
  const check = r.cli('snapshot', '--check');
  assert.equal(check.code, 1);
  assert.deepEqual(check.data.changed, ['api/tests/test_a.py']);
  assert.deepEqual(check.data.missing, ['api/tests/test_b.py']);
  assert.deepEqual(check.data.added, ['api/tests/test_c.py']);
});

test('cli: classify cuenta producción, tests y .env.example por ámbito', (t) => {
  const r = makeRepo(t);
  r.write('api/tests/test_a.py', 'x\n');
  r.write('api/.env.example', 'A=1\n');
  r.write('README.md', '# x\n');
  const res = r.cli('classify', '--limit', '1');
  assert.equal(res.code, 0, res.stderr);
  assert.equal(res.data.scopes.api.prod, 1); // api/app.py
  assert.equal(res.data.scopes.api.tests, 1);
  assert.deepEqual(res.data.scopes.api.examples.tests, ['api/tests/test_a.py']);
  assert.deepEqual(res.data.env_examples, ['api/.env.example']);
  assert.ok(res.data.other >= 2); // .sdd/config.json y README.md
  assert.deepEqual(res.data.warnings, []);
});

test('cli: now devuelve una fecha ISO del sistema', (t) => {
  const r = makeRepo(t);
  const res = r.cli('now');
  assert.equal(res.code, 0);
  assert.match(res.data.now, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
