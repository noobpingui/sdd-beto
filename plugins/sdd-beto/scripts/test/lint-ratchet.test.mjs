// Tests del ratchet de lint con un linter falso que imita la salida JSON de ruff y de eslint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS, countByRule, increased } from '../lib/lint-adapters.mjs';

const RATCHET = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'lint-ratchet.mjs');

// Linter falso: cada línea con "BAD" es una violación X001 y cada línea con "UGLY", una X002.
const FAKE_LINTER = `
import { readFileSync } from 'node:fs';
const [format, file] = process.argv.slice(2);
const lines = readFileSync(0, 'utf8').split(/\\r?\\n/);
const v = [];
lines.forEach((l, i) => {
  if (l.includes('BAD')) v.push({ code: 'X001', row: i + 1, msg: 'bad' });
  if (l.includes('UGLY')) v.push({ code: 'X002', row: i + 1, msg: 'ugly' });
});
if (format === 'ruff') console.log(JSON.stringify(v.map((x) => ({ code: x.code, message: x.msg, location: { row: x.row, column: 1 }, filename: file }))));
else console.log(JSON.stringify([{ filePath: file, messages: v.map((x) => ({ ruleId: x.code, line: x.row, message: x.msg, severity: 2 })) }]));
process.exit(v.length ? 1 : 0);
`;

function makeRepo(t, format = 'ruff', cmdOverride) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sdd-ratchet-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.invalid');
  git('config', 'user.name', 't');
  git('config', 'core.autocrlf', 'false');
  const write = (rel, text) => { mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); writeFileSync(path.join(dir, rel), text); };
  write('tools/fake-lint.mjs', FAKE_LINTER);
  const cmd = cmdOverride ?? `node ../tools/fake-lint.mjs ${format} {file}`;
  write('.sdd/config.json', JSON.stringify({
    schema_version: 1,
    scopes: {
      api: { root: 'api', prod: ['api/**'], tests: ['api/tests/**'], commands: { test: 'x', lint_ratchet: { format, cmd } } },
      web: { root: 'web', prod: ['web/**'], tests: ['web/**/*.test.js'], commands: { test: 'x' } },
    },
  }));
  write('api/legacy.py', 'ok\nBAD one\nBAD two\n');
  write('api/clean.py', 'ok\n');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  git('checkout', '-q', '-b', 'feat/001-demo');
  const run = (...args) => {
    const r = spawnSync(process.execPath, [RATCHET, ...args, '--json'], { cwd: dir, encoding: 'utf8' });
    let data = null;
    try { data = JSON.parse(r.stdout); } catch { /* sin JSON */ }
    return { code: r.status, data, stderr: r.stderr };
  };
  return { dir, git, write, run };
}

test('adaptadores: ruff y eslint a recuento por regla', () => {
  const ruff = ADAPTERS.ruff(JSON.stringify([{ code: 'F401', message: 'm', location: { row: 3 } }, { code: 'F401', message: 'n', location: { row: 5 } }]));
  assert.deepEqual(countByRule(ruff), { F401: 2 });
  const eslint = ADAPTERS.eslint(JSON.stringify([{ messages: [{ ruleId: 'no-undef', line: 1, message: 'x' }, { ruleId: null, fatal: true, line: 1, message: 'Parsing error' }] }]));
  assert.deepEqual(countByRule(eslint), { 'no-undef': 1, 'parse-error': 1 });
  assert.deepEqual(ADAPTERS.ruff(''), []);
  assert.throws(() => ADAPTERS.ruff('Traceback: boom'), /no es JSON/);
  assert.throws(() => ADAPTERS.eslint('{}'), /lista de resultados/);
  assert.deepEqual(increased({ A: 2, B: 1 }, { A: 2, B: 3, C: 1 }), [{ rule: 'B', before: 1, after: 3 }, { rule: 'C', before: 0, after: 1 }]);
});

for (const format of ['ruff', 'eslint']) {
  test(`ratchet (${format}): las violaciones previas se toleran y solo fallan las nuevas`, (t) => {
    const r = makeRepo(t, format);
    // Tocar un archivo con deuda previa sin añadir violaciones: OK.
    r.write('api/legacy.py', 'ok changed\nBAD one\nBAD two\n');
    let res = r.run('api');
    assert.equal(res.code, 0, res.stderr);
    assert.equal(res.data.base, 'main');
    assert.equal(res.data.files.find((f) => f.file === 'api/legacy.py').preexisting, 2);

    // Añadir una violación de una regla que ya existía: FAIL con +1.
    r.write('api/legacy.py', 'ok\nBAD one\nBAD two\nBAD three\n');
    res = r.run('api');
    assert.equal(res.code, 1);
    assert.equal(res.data.new_violations, 1);
    assert.deepEqual(res.data.files.find((f) => f.file === 'api/legacy.py').new.map((g) => [g.rule, g.before, g.after]), [['X001', 2, 3]]);

    // Archivo nuevo (sin base) con una violación, y test del ámbito: ambos cuentan.
    r.write('api/legacy.py', 'ok\nBAD one\nBAD two\n');
    r.write('api/new.py', 'UGLY\n');
    r.write('api/tests/test_x.py', 'BAD\n');
    res = r.run('api');
    assert.equal(res.code, 1);
    assert.equal(res.data.new_violations, 2);
  });
}

test('ratchet: arreglar deuda previa nunca falla', (t) => {
  const r = makeRepo(t);
  r.write('api/legacy.py', 'ok\n');
  assert.equal(r.run('api').code, 0);
});

test('ratchet: solo revisa archivos del ámbito pedido', (t) => {
  const r = makeRepo(t);
  r.write('web/app.js', 'BAD\n');
  r.write('README.md', 'BAD\n');
  const res = r.run('api');
  assert.equal(res.code, 0);
  assert.deepEqual(res.data.files, []);
});

test('ratchet: toma la base de state.json de la feature de la rama actual', (t) => {
  const r = makeRepo(t);
  r.git('branch', 'develop', 'main');
  r.write('specs/001-demo/state.json', JSON.stringify({ base_branch: 'develop' }));
  assert.equal(r.run('api').data.base, 'develop');
  assert.equal(r.run('api', '--base', 'main').data.base, 'main');
});

test('ratchet: linter ausente, salida inesperada o configuración incorrecta salen con 2', (t) => {
  const missing = makeRepo(t, 'ruff', 'definitely-not-a-linter-xyz {file}');
  missing.write('api/clean.py', 'ok\nBAD\n');
  const r1 = missing.run('api');
  assert.equal(r1.code, 2);
  assert.match(r1.stderr, /NO SE PUDO EVALUAR/);

  const garbage = makeRepo(t, 'ruff', 'node -e "console.log(\'no json\')"');
  garbage.write('api/clean.py', 'ok\nBAD\n');
  assert.equal(garbage.run('api').code, 2);

  const r = makeRepo(t);
  assert.equal(r.run('web').code, 2); // sin lint_ratchet
  assert.match(r.run('nope').stderr, /ámbito desconocido/);
  assert.match(r.run('api', '--base', 'no-existe').stderr, /no existe/);
});

test('ratchet: un archivo con el mismo contenido que la base (salvo CRLF) no se vuelve a analizar', (t) => {
  const r = makeRepo(t);
  r.write('api/legacy.py', 'ok\r\nBAD one\r\nBAD two\r\n');
  const res = r.run('api');
  assert.equal(res.code, 0);
});
