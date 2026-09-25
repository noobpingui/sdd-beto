import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PLUGIN_ROOT } from '../lib/templates.mjs';
import * as S from '../lib/state.mjs';

const template = JSON.parse(readFileSync(path.join(PLUGIN_ROOT, 'templates', 'state.json'), 'utf8'));
let tick = 0;
const now = () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString();

const fresh = () => S.createState(template, {
  feature: '001-demo', title: 'Demo', type: 'feature', scope: ['api'], branch: 'feat/001-demo',
  baseBranch: 'main', maxIterations: 3, now: now(),
});

// Recorre una etapa completa: start → gate → approve.
function pass(st, stage, before) {
  st = S.start(st, stage, { now: now() });
  if (before) st = before(st);
  st = S.gate(st, stage, { now: now() });
  return S.approve(st, stage, { note: 'sí', now: now() });
}

test('state: estado inicial desde la plantilla', () => {
  const st = fresh();
  assert.equal(st.stage, 'spec');
  assert.equal(st.status, 'in_progress');
  assert.deepEqual(st.scope, ['api']);
  assert.equal(st.$comment, undefined);
  assert.equal(st.history[0].event, 'created');
  assert.deepEqual(S.validateState(st), []);
});

test('state: recorrido completo hasta done', () => {
  let st = fresh();
  st = pass(st, 'spec');
  st = pass(st, 'plan');
  st = pass(st, 'tasks');
  st = pass(st, 'tests', (s) => S.setResult(s, 'red', 'PASS', { now: now() }));
  st = pass(st, 'implement');
  st = pass(st, 'verify', (s) => S.setResult(s, 'verify', 'PASS', { now: now() }));
  st = pass(st, 'review', (s) => S.setVerdict(s, 'APPROVED', { now: now() }));
  st = pass(st, 'docs');
  st = pass(st, 'close');
  assert.equal(st.stage, 'done');
  assert.equal(st.status, 'done');
  assert.deepEqual(S.validateState(st), []);
  assert.throws(() => S.start(st, 'close', { now: now() }), /cerrada/);
});

test('state: la función es pura (no modifica la entrada)', () => {
  const st = fresh();
  const copy = JSON.stringify(st);
  S.start(st, 'spec', { now: now() });
  assert.equal(JSON.stringify(st), copy);
});

test('state: precondiciones', () => {
  const st = fresh();
  assert.deepEqual(S.preconditions(st, 'spec', { ideaExists: false }), ['idea.md']);
  assert.deepEqual(S.preconditions(st, 'plan'), ['approvals.spec']);
  assert.deepEqual(S.preconditions(st, 'implement'), ['approvals.tests', 'red_check.result == PASS']);
  assert.throws(() => S.start(st, 'spec', { now: now(), ideaExists: false }), /idea\.md/);
});

test('state: no se salta etapas ni se aprueba sin gate', () => {
  let st = fresh();
  assert.throws(() => S.start(st, 'plan', { now: now() }), /etapa actual es "spec"/);
  st = S.start(st, 'spec', { now: now() });
  assert.throws(() => S.approve(st, 'spec', { note: 'sí', now: now() }), /no hay un gate pendiente/);
  st = S.gate(st, 'spec', { now: now() });
  assert.throws(() => S.start(st, 'spec', { now: now() }), /gate pendiente/);
  assert.throws(() => S.approve(st, 'spec', { now: now() }), /texto literal/);
});

test('state: tests, verify y review exigen su resultado para aprobarse', () => {
  let st = pass(pass(pass(fresh(), 'spec'), 'plan'), 'tasks');
  st = S.gate(S.start(st, 'tests', { now: now() }), 'tests', { now: now() });
  assert.throws(() => S.approve(st, 'tests', { note: 'sí', now: now() }), /red_check/);
  assert.throws(() => S.setResult(st, 'verify', 'PASS', { now: now() }), /solo se registra en la etapa "verify"/);
  assert.throws(() => S.setResult(st, 'red', 'OK', { now: now() }), /resultado desconocido/);
});

test('state: rework consume iteraciones y bloquea al llegar al límite', () => {
  let st = pass(pass(pass(fresh(), 'spec'), 'plan'), 'tasks');
  st = S.start(st, 'tests', { now: now() });
  st = S.setResult(st, 'red', 'FAIL', { now: now() });
  for (let i = 1; i <= 3; i++) {
    const r = S.rework(st, 'tests', { counter: 'tests', note: `intento ${i}`, now: now() });
    assert.equal(r.blocked, false);
    st = r.state;
    assert.equal(st.iterations.tests, i);
  }
  const r = S.rework(st, 'tests', { counter: 'tests', note: 'cuarto', now: now() });
  assert.equal(r.blocked, true);
  assert.equal(r.state.status, 'blocked');
  assert.equal(r.state.iterations.tests, 3);
});

test('state: rework a implement desde review anula aprobaciones y resultados posteriores, pero no el red check', () => {
  let st = fresh();
  for (const s of ['spec', 'plan', 'tasks']) st = pass(st, s);
  st = pass(st, 'tests', (s) => S.setResult(s, 'red', 'PASS', { now: now() }));
  st = pass(st, 'implement');
  st = pass(st, 'verify', (s) => S.setResult(s, 'verify', 'PASS', { now: now() }));
  st = S.start(st, 'review', { now: now() });
  st = S.setVerdict(st, 'CHANGES_REQUESTED', { now: now() });
  const { state } = S.rework(st, 'implement', { counter: 'review', note: 'F1', now: now() });
  assert.equal(state.stage, 'implement');
  assert.equal(state.approvals.implement, null);
  assert.equal(state.approvals.verify, null);
  assert.ok(state.approvals.tests);
  assert.equal(state.red_check.result, 'PASS');
  assert.equal(state.verify.result, null);
  assert.equal(state.review.verdict, null);
  assert.equal(state.iterations.review, 1);
  assert.deepEqual(S.validateState(state), []);
});

test('state: reabrir la spec anula todo lo posterior, incluido el red check', () => {
  let st = fresh();
  for (const s of ['spec', 'plan', 'tasks']) st = pass(st, s);
  st = pass(st, 'tests', (s) => S.setResult(s, 'red', 'PASS', { now: now() }));
  const { state } = S.rework(st, 'spec', { note: 'cambio de alcance', now: now() });
  assert.equal(state.stage, 'spec');
  assert.ok(S.STAGES.every((s) => state.approvals[s] === null));
  assert.equal(state.red_check.result, null);
  assert.throws(() => S.rework(state, 'plan', { now: now() }), /hacia delante/);
});

test('state: commits, eventos, bloqueo y snapshot', () => {
  let st = fresh();
  st = S.setCommit(st, 'spec', 'abc1234', { now: now() });
  assert.equal(st.commits.spec, 'abc1234');
  assert.throws(() => S.setCommit(st, 'spec', 'zzz', { now: now() }), /sha no válido/);
  st = S.addEvent(st, 'spec', 'needs_input', { note: 'Q1', now: now() });
  assert.throws(() => S.addEvent(st, 'spec', 'magic', { now: now() }), /evento desconocido/);
  st = S.block(st, { note: 'esperando al usuario', now: now() });
  assert.equal(st.status, 'blocked');
  st = S.start(st, 'spec', { now: now() });
  assert.equal(st.status, 'in_progress');
  st = S.setSnapshot(st, { 'api/tests/t.py': 'f'.repeat(64) }, { reason: 'aprobación de tests', now: now() });
  assert.equal(Object.keys(st.tests_snapshot.sha256).length, 1);
});

test('state: validateState detecta inconsistencias', () => {
  const st = fresh();
  st.approvals.plan = { at: now(), note: 'x' };
  st.iterations.tests = 9;
  st.stage = 'implement';
  const issues = S.validateState(st, { artifactExists: () => false }).join('\n');
  for (const frag of ['"spec" es anterior a la actual', '"tasks" es anterior', '"plan" está aprobada pero falta plan.md',
    'iterations.tests supera', 'red_check.result debe ser PASS']) {
    assert.ok(issues.includes(frag), `falta "${frag}" en:\n${issues}`);
  }
  const bad = { ...fresh(), stage: 'done', status: 'in_progress' };
  assert.ok(S.validateState(bad).some((i) => i.includes('deben ir juntos')));
});
