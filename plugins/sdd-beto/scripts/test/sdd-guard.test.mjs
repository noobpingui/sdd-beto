import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDefaults } from '../lib/config.mjs';
import { decideShell, decideWrite, gitSubcommands, onlyCheckboxes, sddRole } from '../sdd-guard.mjs';

const ROOT = path.resolve('/repo');
const FEATURE = 'specs/001-demo';
const RAW_CONFIG = {
  schema_version: 1,
  scopes: {
    api: { root: 'api', prod: ['api/**'], tests: ['api/tests/**'], commands: { test: 'x' } },
    web: { root: 'web', prod: ['web/**'], tests: ['web/src/**/*.test.{ts,tsx}', 'web/src/test/**'], commands: { test: 'x' } },
  },
};
const CONFIG = applyDefaults(RAW_CONFIG);
const APPROVED = { spec: { at: 'x' }, plan: { at: 'x' } };

function ctx({ stage = 'spec', approvals = {}, branch = 'feat/001-demo', bypass = false, noState = false, config = CONFIG, configError = null } = {}) {
  return {
    projectDir: ROOT, branch, bypass, config, configError,
    readState: (fdir) => (noState || fdir !== FEATURE ? null : { stage, approvals }),
  };
}
const A = (role) => `sdd-beto:${role}`;
const write = (agent, rel, c, extra = {}) =>
  decideWrite({ agent_type: agent, tool_name: 'Write', tool_input: { file_path: path.join(ROOT, rel) }, ...extra }, c);
const edit = (agent, rel, oldS, newS, c) =>
  decideWrite({ agent_type: agent, tool_name: 'Edit', tool_input: { file_path: path.join(ROOT, rel), old_string: oldS, new_string: newS } }, c);
const shell = (agent, command, c = ctx()) => decideShell({ agent_type: agent, tool_input: { command } }, c);
const denied = (r) => Boolean(r && r.decision === 'deny');

// ---- nombres de agente ----
test('solo los agentes con el prefijo sdd-beto: son roles SDD', () => {
  assert.equal(sddRole('sdd-beto:implementer'), 'implementer');
  assert.equal(sddRole('implementer'), null);
  assert.equal(sddRole('otro-plugin:implementer'), null);
  assert.equal(sddRole('sdd-beto:desconocido'), null);
  assert.equal(sddRole(undefined), null);
});

test('un agente local llamado "implementer" (sin prefijo) no hereda permisos del rol', () => {
  const c = ctx({ stage: 'implement', approvals: APPROVED, branch: 'main' });
  // Sin prefijo cae en la guardia de etapa como cualquier subagente: producción fuera de feature → deny.
  assert.ok(denied(write('implementer', 'api/service.py', c)));
  // Y no puede tocar tests "porque es el implementer": simplemente no es un rol, se trata como sesión.
  assert.equal(write('test-author', 'api/tests/test_x.py', ctx({ stage: 'tests' })), null);
});

// ---- guardia de rol ----
test('spec-writer solo escribe spec.md en la etapa spec', () => {
  assert.equal(write(A('spec-writer'), `${FEATURE}/spec.md`, ctx()), null);
  assert.ok(denied(write(A('spec-writer'), `${FEATURE}/plan.md`, ctx())));
  assert.ok(denied(write(A('spec-writer'), 'api/service.py', ctx())));
  assert.ok(denied(write(A('spec-writer'), `${FEATURE}/spec.md`, ctx({ stage: 'plan' }))));
});

test('planner escribe plan.md y ADRs en paths.adr, no código', () => {
  const c = ctx({ stage: 'plan' });
  assert.equal(write(A('planner'), `${FEATURE}/plan.md`, c), null);
  assert.equal(write(A('planner'), 'docs/decisions/ADR-0012-algo.md', c), null);
  assert.equal(write(A('planner'), 'docs/decisions/README.md', c), null);
  assert.ok(denied(write(A('planner'), 'docs/decisions/notas.md', c)));
  assert.ok(denied(write(A('planner'), 'api/models.py', c)));
  const custom = applyDefaults({ ...RAW_CONFIG, paths: { adr: 'arch/adr' } });
  assert.equal(write(A('planner'), 'arch/adr/ADR-0001-x.md', ctx({ stage: 'plan', config: custom })), null);
  assert.ok(denied(write(A('planner'), 'docs/decisions/ADR-0001-x.md', ctx({ stage: 'plan', config: custom }))));
});

test('test-author escribe tests pero no producción', () => {
  const c = ctx({ stage: 'tests', approvals: APPROVED });
  assert.equal(write(A('test-author'), 'api/tests/test_x.py', c), null);
  assert.equal(write(A('test-author'), 'web/src/features/a/B.test.tsx', c), null);
  assert.equal(write(A('test-author'), 'web/src/test/setup.ts', c), null);
  assert.ok(denied(write(A('test-author'), 'api/service.py', c)));
  assert.ok(denied(write(A('test-author'), 'web/src/features/a/B.tsx', c)));
});

test('implementer escribe producción pero nunca tests, y solo en las etapas tests (scaffold) e implement', () => {
  const c = ctx({ stage: 'implement', approvals: APPROVED });
  assert.equal(write(A('implementer'), 'api/service.py', c), null);
  assert.equal(write(A('implementer'), 'api/.env.example', c), null);
  assert.ok(denied(write(A('implementer'), 'api/tests/test_x.py', c)));
  assert.ok(denied(write(A('implementer'), 'web/src/a/B.test.tsx', c)));
  assert.ok(denied(write(A('implementer'), `${FEATURE}/spec.md`, c)));
  assert.ok(denied(write(A('implementer'), 'api/.env', c)));
  assert.equal(write(A('implementer'), 'web/src/lib/x.ts', ctx({ stage: 'tests', approvals: APPROVED })), null);
  assert.ok(denied(write(A('implementer'), 'web/src/lib/x.test.ts', ctx({ stage: 'tests', approvals: APPROVED }))));
  assert.ok(denied(write(A('implementer'), 'api/service.py', ctx({ stage: 'tasks', approvals: APPROVED }))));
  assert.ok(denied(write(A('implementer'), 'api/service.py', ctx({ stage: 'review', approvals: APPROVED }))));
});

test('en tasks.md, test-author e implementer solo marcan casillas con Edit', () => {
  const c = ctx({ stage: 'tests', approvals: APPROVED });
  const t = `${FEATURE}/tasks.md`;
  assert.equal(edit(A('test-author'), t, '- [ ] T-010 [REQ-001] (test) x — `a`', '- [x] T-010 [REQ-001] (test) x — `a`', c), null);
  const reworded = edit(A('test-author'), t, '- [ ] T-010 x', '- [x] T-010 otra cosa', c);
  assert.ok(denied(reworded));
  assert.match(reworded.reason, /solo puedes marcar casillas/); // el mensaje le dice al agente qué sí puede hacer
  assert.match(write(A('test-author'), t, c).reason, /solo puedes marcar casillas/);
  assert.equal(edit(A('implementer'), t, '- [ ] T-001 a\r\n- [ ] T-002 b', '- [x] T-001 a\n- [X] T-002 b', ctx({ stage: 'implement', approvals: APPROVED })), null);
  // El task-breaker sí reescribe el archivo en su etapa.
  assert.equal(write(A('task-breaker'), t, ctx({ stage: 'tasks' })), null);
  assert.ok(onlyCheckboxes({ tool_name: 'MultiEdit', tool_input: { edits: [{ old_string: '* [ ] a', new_string: '* [x] a' }] } }));
  assert.ok(!onlyCheckboxes({ tool_name: 'MultiEdit', tool_input: { edits: [] } }));
});

test('verifier, reviewer y doc-keeper solo escriben sus artefactos', () => {
  assert.equal(write(A('verifier'), `${FEATURE}/verify-report.md`, ctx({ stage: 'tests' })), null);
  assert.equal(write(A('verifier'), `${FEATURE}/state.json`, ctx({ stage: 'verify' })), null);
  assert.ok(denied(write(A('verifier'), 'api/service.py', ctx({ stage: 'verify', approvals: APPROVED }))));
  assert.equal(write(A('reviewer'), `${FEATURE}/review.md`, ctx({ stage: 'review' })), null);
  assert.ok(denied(write(A('reviewer'), 'web/src/App.tsx', ctx({ stage: 'review' }))));
  assert.ok(denied(write(A('reviewer'), 'CLAUDE.md', ctx({ stage: 'review' }))));
  const d = ctx({ stage: 'docs' });
  assert.equal(write(A('doc-keeper'), 'README.md', d), null);
  assert.equal(write(A('doc-keeper'), 'docs/api.md', d), null);
  assert.equal(write(A('doc-keeper'), 'CLAUDE.md', d), null);
  assert.equal(write(A('doc-keeper'), 'web/.env.example', d), null);
  assert.equal(write(A('doc-keeper'), `${FEATURE}/docs-report.md`, d), null);
  assert.ok(denied(write(A('doc-keeper'), 'docs/decisions/ADR-0001-x.md', d)));
  assert.ok(denied(write(A('doc-keeper'), `${FEATURE}/spec.md`, d)));
  assert.ok(denied(write(A('doc-keeper'), 'api/README.md', d))); // no está en paths.docs
  assert.ok(denied(write(A('doc-keeper'), 'api/service.py', d)));
});

test('un agente SDD fuera de una rama de feature, sin state.json o fuera del repo queda bloqueado', () => {
  assert.ok(denied(write(A('spec-writer'), `${FEATURE}/spec.md`, ctx({ branch: 'main' }))));
  assert.ok(denied(write(A('spec-writer'), `${FEATURE}/spec.md`, ctx({ noState: true }))));
  assert.ok(denied(decideWrite({ agent_type: A('spec-writer'), tool_input: { file_path: path.resolve('/otro/sitio/spec.md') } }, ctx())));
});

// ---- guardia de etapa ----
test('la sesión principal no edita producción sin la spec y el plan aprobados', () => {
  assert.ok(denied(write(null, 'api/service.py', ctx({ branch: 'main' }))));
  assert.ok(denied(write(null, 'api/service.py', ctx({ stage: 'plan', approvals: { spec: { at: 'x' } } }))));
  assert.equal(write(null, 'api/service.py', ctx({ stage: 'implement', approvals: APPROVED })), null);
});

test('SDD_BYPASS=1 abre la guardia de etapa, pero no la de rol', () => {
  assert.equal(write(null, 'api/service.py', ctx({ branch: 'main', bypass: true })), null);
  assert.ok(denied(write(A('test-author'), 'api/service.py', ctx({ stage: 'tests', approvals: APPROVED, bypass: true }))));
});

test('la sesión principal edita libremente fuera del código de producción', () => {
  assert.equal(write(null, '.claude/settings.json', ctx({ branch: 'main' })), null);
  assert.equal(write(null, `${FEATURE}/state.json`, ctx()), null);
  assert.equal(write(null, 'api/tests/test_x.py', ctx({ branch: 'main' })), null);
  assert.equal(write(null, 'api/README.md', ctx({ branch: 'main' })), null);
});

test('otros subagentes no tocan un .env real', () => {
  assert.ok(denied(write('general-purpose', '.env', ctx())));
  assert.ok(denied(write('Explore', 'api/.env.local', ctx())));
});

// ---- sin config ----
test('sin .sdd/config.json el guard no hace nada, salvo bloquear a los agentes sdd-beto:*', () => {
  const none = ctx({ config: null, branch: 'main' });
  assert.equal(write(null, 'src/anything.js', none), null);
  assert.equal(write('general-purpose', 'src/anything.js', none), null);
  const r = write(A('implementer'), 'src/anything.js', none);
  assert.ok(denied(r));
  assert.match(r.reason, /\/sdd-beto:init/);
  assert.equal(shell(null, 'git commit -m x', none), null);
  assert.equal(shell('general-purpose', 'git push', none), null);
});

test('con la config no válida, avisa a la sesión y bloquea a los agentes', () => {
  const bad = ctx({ config: null, configError: 'scopes: necesita al menos un ámbito' });
  const main = write(null, 'api/service.py', bad);
  assert.equal(main.decision, null);
  assert.match(main.warning, /no es válido/);
  assert.match(write(A('spec-writer'), `${FEATURE}/spec.md`, bad).reason, /no es válido/);
});

// ---- guardia de git ----
test('detecta subcomandos git con opciones globales', () => {
  assert.deepEqual(gitSubcommands('git -C api commit -m x'), ['commit']);
  assert.deepEqual(gitSubcommands('npm test && git push origin feat/001-demo'), ['push']);
  assert.deepEqual(gitSubcommands('git status; git diff main...HEAD'), ['status', 'diff']);
  assert.deepEqual(gitSubcommands('git.exe --no-pager log -1'), ['log']);
  assert.deepEqual(gitSubcommands('npm run build'), []);
});

test('la sesión principal: commit y push piden confirmación; el resto pasa', () => {
  assert.equal(shell(null, 'git commit -m "x"').decision, 'ask');
  assert.equal(shell(null, 'git push -u origin feat/001-demo').decision, 'ask');
  assert.equal(shell(null, 'git status --short'), null);
  assert.equal(shell(null, 'git checkout -b feat/001-demo'), null);
});

test('los subagentes solo usan git de lectura (Bash y PowerShell)', () => {
  assert.equal(shell(A('verifier'), 'git diff --name-only main...HEAD'), null);
  assert.equal(shell(A('reviewer'), 'git log --oneline main..HEAD'), null);
  assert.equal(shell(A('verifier'), 'git branch --show-current'), null);
  assert.ok(denied(shell(A('implementer'), 'git commit -am x')));
  assert.ok(denied(shell(A('test-author'), 'npm test && git push')));
  assert.ok(denied(shell(A('implementer'), 'git stash')));
  assert.ok(denied(shell('Explore', 'git checkout main')));
  assert.ok(denied(shell(A('implementer'), 'Set-Location api; git reset --hard')));
  assert.ok(denied(shell(A('reviewer'), 'git branch -D feat/x')));
  assert.equal(shell(A('implementer'), 'npm test'), null);
});

// ---- protocolo real stdin → stdout, con un repo git ----
test('el proceso responde con JSON de hook válido y encuentra la config desde un subdirectorio', (t) => {
  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'sdd-guard.mjs');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sdd-guard-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  mkdirSync(path.join(dir, '.sdd'));
  mkdirSync(path.join(dir, 'api', 'sub'), { recursive: true });
  writeFileSync(path.join(dir, '.sdd', 'config.json'), JSON.stringify(RAW_CONFIG));
  const run = (mode, payload, env = {}) => spawnSync(process.execPath, [script, mode], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8', env: { ...process.env, SDD_BYPASS: '', ...env },
  });

  const ask = run('shell', { tool_input: { command: 'git push' } }, { CLAUDE_PROJECT_DIR: dir });
  assert.equal(ask.status, 0);
  assert.equal(JSON.parse(ask.stdout).hookSpecificOutput.permissionDecision, 'ask');

  // Sesión iniciada en un subdirectorio: sube a la raíz git y encuentra la config.
  const deny = run('write', { tool_input: { file_path: path.join(dir, 'api', 'service.py') } }, { CLAUDE_PROJECT_DIR: path.join(dir, 'api', 'sub') });
  assert.equal(JSON.parse(deny.stdout).hookSpecificOutput.permissionDecision, 'deny');

  const none = run('shell', { tool_input: { command: 'ls' } }, { CLAUDE_PROJECT_DIR: dir });
  assert.equal(none.stdout, '');

  const noSdd = mkdtempSync(path.join(os.tmpdir(), 'sdd-guard-nosdd-'));
  t.after(() => rmSync(noSdd, { recursive: true, force: true }));
  assert.equal(run('shell', { tool_input: { command: 'git push' } }, { CLAUDE_PROJECT_DIR: noSdd }).stdout, '');

  const broken = run('write', '{no es json', { CLAUDE_PROJECT_DIR: dir });
  assert.equal(broken.status, 0, 'un error interno no debe romper la sesión principal');
  assert.match(JSON.parse(broken.stdout).systemMessage, /error interno/);

  const brokenAgent = run('write', '{"agent_type":"sdd-beto:implementer", "tool_input": ', { CLAUDE_PROJECT_DIR: dir });
  assert.equal(brokenAgent.status, 0);
});

test('con prod "**", la sesión principal edita la config SDD fuera de una feature y el planner escribe ADRs (ADR-0023)', () => {
  const wide = applyDefaults({ schema_version: 1, scopes: { app: { prod: ['**'], tests: ['test/**'], commands: { test: null } } } });
  const main = ctx({ branch: 'main', config: wide });
  for (const rel of ['.sdd/config.json', '.sdd/constitution.md', 'CLAUDE.md', '.claude/settings.json', 'specs/README.md']) {
    assert.equal(write(null, rel, main), null, rel);
  }
  assert.ok(denied(write(null, 'lib/a.js', main)));
  assert.equal(write(A('planner'), 'docs/decisions/ADR-0001-x.md', ctx({ stage: 'plan', config: wide })), null);
});
