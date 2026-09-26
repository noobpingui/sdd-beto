// Integración de sdd-init (ayudante de /sdd-beto:init) con repos git temporales y datos inventados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findSection, isPluginRule, jsonDiff, localPermissionRules, mergeClaudeMd, mergeLocalPermissions, pluginInfo, posixPath, SECTIONS,
} from '../sdd-init.mjs';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'sdd-init.mjs');

const CONFIG = {
  schema_version: 1,
  scopes: {
    core: {
      root: 'core',
      prod: ['core/**'],
      tests: ['core/tests/**'],
      commands: { test: 'run-tests', lint: 'run-lint' },
    },
  },
};

function makeRepo(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sdd-init-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('config', 'core.autocrlf', 'false');
  // Aísla los tests de los excludes globales de quien los ejecuta (Claude Code puede haber añadido ahí
  // **/.claude/settings.local.json).
  writeFileSync(path.join(dir, '.git', 'no-global-excludes'), '');
  git('config', 'core.excludesFile', path.join(dir, '.git', 'no-global-excludes'));
  const r = {
    dir,
    git,
    write(rel, content) {
      mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      writeFileSync(path.join(dir, rel), content);
    },
    read: (rel) => readFileSync(path.join(dir, rel), 'utf8'),
    exists: (rel) => existsSync(path.join(dir, rel)),
    cli(args, input = '') {
      const res = spawnSync(process.execPath, [CLI, ...args, '--project', dir], { encoding: 'utf8', input });
      let data = null;
      try { data = JSON.parse(res.stdout); } catch { /* texto */ }
      return { code: res.status, data, stdout: res.stdout, stderr: res.stderr };
    },
    status: () => git('status', '--porcelain'),
  };
  r.write('core/app.js', 'x\n');
  r.write('core/tests/app_test.js', 'x\n');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  return r;
}

const json = (o) => JSON.stringify(o);

// ---------- scan ----------
test('scan: manifiestos, CI, carpetas de test, .env versionados y AGENTS.md sin importar', (t) => {
  const r = makeRepo(t);
  r.write('package.json', json({ name: 'demo', scripts: { test: 'node --test', lint: 'x' }, devDependencies: { vitest: '1' } }));
  r.write('Makefile', 'VAR := 1\nbuild:\n\techo\ntest: build\n\techo\n.PHONY: test\n');
  r.write('svc/pyproject.toml', '[project]\nname = "x"\n\n[tool.pytest.ini_options]\n');
  r.write('.github/workflows/ci.yml', 'on: push\n');
  r.write('.env', 'SECRET=1\n');
  r.write('.env.example', 'SECRET=\n');
  r.write('AGENTS.md', '# agentes\n');
  r.write('CLAUDE.md', '# notas\n');
  r.git('add', '.');
  r.git('commit', '-q', '-m', 'más');
  const res = r.cli(['scan']);
  assert.equal(res.code, 0, res.stderr);
  const d = res.data;
  const pkg = d.manifests.find((m) => m.path === 'package.json');
  assert.deepEqual(pkg.scripts, { test: 'node --test', lint: 'x' });
  assert.ok(pkg.deps.includes('vitest'));
  assert.deepEqual(d.manifests.find((m) => m.path === 'Makefile').targets, ['build', 'test']);
  assert.deepEqual(d.manifests.find((m) => m.path === 'svc/pyproject.toml').sections, ['project', 'tool.pytest.ini_options']);
  assert.deepEqual(d.ci, ['.github/workflows/ci.yml']);
  assert.deepEqual(d.test_dirs, ['core/tests/']);
  assert.deepEqual(d.env.real_tracked, ['.env']);
  assert.deepEqual(d.env.examples, ['.env.example']);
  assert.ok(d.risks.some((x) => x.includes('.env')));
  assert.ok(d.risks.some((x) => x.includes('AGENTS.md')));
  assert.equal(d.git.clean, true);
  assert.equal(d.sdd.config.exists, false);
  assert.deepEqual(d.sdd.claude_md, { exists: true, sections: { proyecto: 'missing', sdd: 'missing', aprobacion: 'missing', convenciones: 'missing' } });
  assert.equal(d.sdd.settings.exists, false);
});

test('scan: con config existente informa de su versión y de si es válida (modo actualización)', (t) => {
  const r = makeRepo(t);
  r.write('.sdd/config.json', json({ ...CONFIG, schema_version: 2 }));
  const d = r.cli(['scan']).data;
  assert.equal(d.sdd.config.exists, true);
  assert.equal(d.sdd.config.valid, false);
  assert.equal(d.sdd.config.schema_version, 2);
  assert.equal(d.sdd.config.supported_schema, 1);
});

test('fuera de un repo git: error de precondición', (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sdd-init-nogit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const res = spawnSync(process.execPath, [CLI, 'scan', '--project', dir], { encoding: 'utf8' });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /no es un repositorio git/);
});

// ---------- preview ----------
test('preview: valida la config borrador sin escribir nada', (t) => {
  const r = makeRepo(t);
  const bad = r.cli(['preview'], json({ schema_version: 1, scopes: {} }));
  assert.equal(bad.code, 1);
  assert.equal(bad.data.valid, false);
  assert.ok(bad.data.issues.some((i) => i.startsWith('scopes')));
  assert.equal(r.cli(['preview'], '').code, 1);
  assert.equal(r.cli(['preview'], '{nope').code, 1);
  assert.equal(r.status(), '');
});

test('preview: cuenta por ámbito, avisa de tests mal clasificados, solapamientos y raíces que no existen', (t) => {
  const r = makeRepo(t);
  r.write('core/util.spec.js', 'x\n');
  r.write('CLAUDE.md', 'x\n');
  const draft = {
    schema_version: 1,
    scopes: {
      core: { root: 'core', prod: ['**'], tests: ['core/tests/**'], commands: { test: null } },
      extra: { root: 'nope', prod: ['core/app.js'], tests: ['x/**'], commands: { test: null } },
    },
  };
  const res = r.cli(['preview', '--limit', '5'], json(draft));
  assert.equal(res.code, 0, res.stderr);
  const d = res.data;
  assert.equal(d.valid, true);
  assert.equal(d.scopes.core.tests, 1);
  assert.equal(d.scopes.core.prod, 2); // core/app.js y core/util.spec.js; CLAUDE.md es del flujo SDD
  assert.equal(d.sdd_owned, 1);
  assert.deepEqual(d.suspicious, ['core/util.spec.js']);
  assert.deepEqual(d.overlaps, [{ path: 'core/app.js', scopes: ['core', 'extra'] }]);
  assert.ok(d.warnings.some((w) => w.includes('scopes.extra.root')));
  assert.ok(d.warnings.some((w) => w.includes('parecen tests')));
  assert.ok(!r.exists('.sdd'));
});

// ---------- write-config ----------
test('write-config: crea, es idempotente, muestra el diff y no escribe una config inválida', (t) => {
  const r = makeRepo(t);
  const dry = r.cli(['write-config', '--dry-run'], json(CONFIG));
  assert.equal(dry.data.action, 'create');
  assert.ok(!r.exists('.sdd/config.json'));

  assert.equal(r.cli(['write-config'], json(CONFIG)).data.action, 'create');
  const written = r.read('.sdd/config.json');
  assert.deepEqual(JSON.parse(written), CONFIG);
  assert.ok(written.endsWith('}\n'));

  assert.equal(r.cli(['write-config'], json(CONFIG)).data.action, 'unchanged');
  // Mismo contenido con otro formato (CRLF, sangría de 4): no se reescribe.
  r.write('.sdd/config.json', JSON.stringify(CONFIG, null, 4).replace(/\n/g, '\r\n'));
  const before = r.read('.sdd/config.json');
  assert.equal(r.cli(['write-config'], json(CONFIG)).data.action, 'unchanged');
  assert.equal(r.read('.sdd/config.json'), before);

  const changed = { ...CONFIG, language: 'en' };
  const upd = r.cli(['write-config', '--dry-run'], json(changed));
  assert.equal(upd.data.action, 'update');
  assert.deepEqual(upd.data.diff, [{ path: 'language', from: '(no existe)', to: 'en' }]);
  assert.equal(r.read('.sdd/config.json'), before);

  const bad = r.cli(['write-config'], json({ ...CONFIG, max_iterations: 0 }));
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /max_iterations/);
  assert.equal(r.read('.sdd/config.json'), before);
});

test('jsonDiff: campos añadidos, cambiados y eliminados', () => {
  assert.deepEqual(jsonDiff({ a: 1, b: { c: [1] }, d: 1 }, { a: 1, b: { c: [2] }, e: 'x' }), [
    { path: 'b.c', from: [1], to: [2] },
    { path: 'd', from: 1, to: '(se elimina)' },
    { path: 'e', from: '(no existe)', to: 'x' },
  ]);
});

// ---------- integrate ----------
function withConfig(r, config = CONFIG) {
  r.write('.sdd/config.json', json(config));
}

test('integrate: sin config es un error de precondición', (t) => {
  const r = makeRepo(t);
  const res = r.cli(['integrate']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /write-config/);
});

test('integrate: crea carpetas, CLAUDE.md y settings; reejecutarlo no cambia nada', (t) => {
  const r = makeRepo(t);
  withConfig(r, { ...CONFIG, paths: { specs: 'work/specs', adr: 'work/adr' } });
  const res = r.cli(['integrate', '--project-section', '-'], '## Proyecto\n\n- **Qué es:** una demo.\n');
  assert.equal(res.code, 0, res.stderr);
  assert.ok(r.exists('work/specs/.gitkeep'));
  assert.ok(r.exists('work/adr/.gitkeep'));

  const md = r.read('CLAUDE.md');
  for (const id of SECTIONS) assert.equal(findSection(md, id).status, 'ok', id);
  assert.match(findSection(md, 'proyecto').body, /una demo/);
  assert.match(md, /`work\/specs\/NNN-slug\/`/);
  assert.match(md, /\| `core` \| `core` \| `run-tests` \| `run-lint` \| — \| — \|/);
  assert.doesNotMatch(md, /\{\{\w+\}\}/);
  assert.ok(!md.startsWith('@AGENTS.md'));

  const settings = JSON.parse(r.read('.claude/settings.json'));
  assert.equal(settings.env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH, '1');
  assert.ok(settings.$schema);
  assert.equal(settings.extraKnownMarketplaces, undefined);

  r.git('add', '.');
  r.git('commit', '-q', '-m', 'sdd');
  const again = r.cli(['integrate', '--project-section', '-'], '## Proyecto\n\notro texto\n');
  assert.equal(again.code, 0, again.stderr);
  assert.ok(again.data.files.every((f) => f.action === 'unchanged'), JSON.stringify(again.data.files));
  assert.equal(again.data.files.find((f) => f.path === 'CLAUDE.md').sections.proyecto, 'kept');
  assert.equal(r.status(), '');
});

test('integrate: respeta el contenido del usuario, sus CRLF y las secciones existentes', (t) => {
  const r = makeRepo(t);
  withConfig(r);
  const user = '# Mi proyecto\r\n\r\nNotas del equipo.\r\n\r\n<!-- sdd-beto:sdd:start -->\r\nviejo\r\n<!-- sdd-beto:sdd:end -->\r\n\r\n## Al final\r\n';
  r.write('CLAUDE.md', user);
  const res = r.cli(['integrate']);
  assert.equal(res.code, 0, res.stderr);
  const md = r.read('CLAUDE.md');
  assert.ok(md.startsWith('# Mi proyecto\r\n\r\nNotas del equipo.\r\n\r\n<!-- sdd-beto:sdd:start -->\r\n## SDD'));
  assert.ok(!/[^\r]\n/.test(md), 'todas las líneas siguen en CRLF');
  assert.ok(md.indexOf('## Al final') < md.indexOf('sdd-beto:proyecto:start'), 'las secciones que faltan van al final');
  const report = res.data.files.find((f) => f.path === 'CLAUDE.md').sections;
  assert.deepEqual(report, { proyecto: 'create', sdd: 'update', aprobacion: 'create', convenciones: 'create' });
  assert.match(findSection(md.replace(/\r\n/g, '\n'), 'proyecto').body, /\(pendiente\)/);
});

test('integrate: la sección Proyecto se conserva salvo con --replace-project-section', (t) => {
  const r = makeRepo(t);
  withConfig(r);
  r.cli(['integrate', '--project-section', '-'], 'versión 1');
  assert.equal(r.cli(['integrate', '--project-section', '-'], 'versión 2').data.files.find((f) => f.path === 'CLAUDE.md').action, 'unchanged');
  assert.match(r.read('CLAUDE.md'), /versión 1/);
  const missing = r.cli(['integrate', '--replace-project-section']);
  assert.equal(missing.code, 1);
  const res = r.cli(['integrate', '--replace-project-section', '--project-section', '-'],
    '<!-- sdd-beto:proyecto:start -->\nversión 2\n<!-- sdd-beto:proyecto:end -->\n');
  assert.equal(res.code, 0, res.stderr);
  const md = r.read('CLAUDE.md');
  assert.equal(findSection(md, 'proyecto').body, 'versión 2');
  assert.equal((md.match(/sdd-beto:proyecto:start/g) || []).length, 1);
  assert.equal(r.cli(['integrate', '--project-section', '-'], 'x <!-- sdd-beto:sdd:start -->').code, 1);
});

test('integrate: con marcas rotas no toca CLAUDE.md ni ningún otro archivo', (t) => {
  const r = makeRepo(t);
  withConfig(r);
  const broken = '<!-- sdd-beto:sdd:start -->\nx\n<!-- sdd-beto:sdd:start -->\n<!-- sdd-beto:sdd:end -->\n';
  r.write('CLAUDE.md', broken);
  const res = r.cli(['integrate']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /marcas rotas.*sdd/);
  assert.equal(r.read('CLAUDE.md'), broken);
  assert.ok(!r.exists('specs'));
  assert.ok(!r.exists('.claude'));
});

test('integrate: si solo existe AGENTS.md, el CLAUDE.md nuevo lo importa', (t) => {
  const r = makeRepo(t);
  withConfig(r);
  r.write('AGENTS.md', '# agentes\n');
  r.cli(['integrate']);
  assert.ok(r.read('CLAUDE.md').startsWith('@AGENTS.md\n\n<!-- sdd-beto:proyecto:start -->'));
});

test('integrate: fusiona settings.json conservando claves y sangría; marketplace opcional', (t) => {
  const r = makeRepo(t);
  withConfig(r);
  r.write('.claude/settings.json', JSON.stringify({ permissions: { allow: ['Read'] }, env: { FOO: 'bar' } }, null, 4));
  const res = r.cli(['integrate', '--marketplace']);
  assert.equal(res.code, 0, res.stderr);
  const text = r.read('.claude/settings.json');
  assert.match(text, /^\{\n {4}"permissions"/);
  const s = JSON.parse(text);
  assert.deepEqual(s.permissions, { allow: ['Read'] });
  assert.deepEqual(s.env, { FOO: 'bar', CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: '1' });
  const plugin = pluginInfo();
  assert.deepEqual(s.extraKnownMarketplaces[plugin.marketplace], { source: { source: 'git', url: plugin.url } });
  assert.match(plugin.url, /^https:\/\/.+\.git$/);
  assert.equal(s.enabledPlugins[plugin.id], true);
  assert.equal(s.$schema, undefined, 'no añade $schema a un archivo existente');
  assert.equal(r.cli(['integrate', '--marketplace']).data.files.find((f) => f.path === '.claude/settings.json').action, 'unchanged');
});

test('integrate: respeta un plugin desactivado a mano y un settings.json inválido lo detiene', (t) => {
  const r = makeRepo(t);
  withConfig(r);
  const id = pluginInfo().id;
  r.write('.claude/settings.json', json({ enabledPlugins: { [id]: false } }));
  const res = r.cli(['integrate', '--marketplace']);
  const f = res.data.files.find((x) => x.path === '.claude/settings.json');
  assert.ok(f.notes.some((n) => n.includes('false')));
  assert.equal(JSON.parse(r.read('.claude/settings.json')).enabledPlugins[id], false);

  r.write('.claude/settings.json', '{ "env": { ');
  const bad = r.cli(['integrate']);
  assert.equal(bad.code, 2);
  assert.match(bad.stderr, /no es JSON válido/);
});

test('integrate: --no-depth-limit no crea settings.json; --dry-run no escribe nada', (t) => {
  const r = makeRepo(t);
  withConfig(r);
  r.git('add', '.');
  r.git('commit', '-q', '-m', 'config');
  const dry = r.cli(['integrate', '--dry-run', '--marketplace']);
  assert.equal(dry.code, 0, dry.stderr);
  assert.equal(r.status(), '');
  const md = dry.data.files.find((f) => f.path === 'CLAUDE.md');
  assert.equal(md.action, 'create');
  assert.match(md.content, /sdd-beto:convenciones:end/);
  assert.match(dry.data.files.find((f) => f.path === '.claude/settings.json').content, /enabledPlugins/);

  r.cli(['integrate', '--no-depth-limit']);
  assert.ok(!r.exists('.claude/settings.json'));
  assert.ok(r.exists('CLAUDE.md'));
});

test('integrate: usa .sdd/templates/claude-md.md si el proyecto la sobrescribe', (t) => {
  const r = makeRepo(t);
  withConfig(r);
  r.write('.sdd/templates/claude-md.md', SECTIONS.map((id) => `<!-- sdd-beto:${id}:start -->\npropio ${id} {{base_branch}}\n<!-- sdd-beto:${id}:end -->`).join('\n'));
  const res = r.cli(['integrate']);
  assert.equal(res.data.files.find((f) => f.path === 'CLAUDE.md').template, 'project');
  assert.match(r.read('CLAUDE.md'), /propio convenciones main/);
});

test('mergeClaudeMd: plantilla sin cambios y archivo vacío', () => {
  const sections = Object.fromEntries(SECTIONS.map((id) => [id, `cuerpo ${id}`]));
  const first = mergeClaudeMd(null, sections);
  assert.equal(mergeClaudeMd(first.text, sections).text, first.text);
  const empty = mergeClaudeMd('', sections);
  assert.ok(empty.text.startsWith('<!-- sdd-beto:proyecto:start -->'));
});

test('integrate: la tabla de ámbitos muestra "ratchet (formato)" en lugar del comando con {file}', (t) => {
  const r = makeRepo(t);
  withConfig(r, {
    schema_version: 1,
    scopes: {
      core: {
        root: 'core', prod: ['core/**'], tests: ['core/tests/**'],
        commands: { test: 'run-tests', lint_ratchet: { format: 'ruff', cmd: 'ruff check --stdin-filename {file} -' } },
      },
    },
  });
  r.cli(['integrate']);
  const md = r.read('CLAUDE.md');
  assert.match(md, /\| `core` \| `core` \| `run-tests` \| ratchet \(ruff\) \| — \| — \|/);
  assert.doesNotMatch(md, /\{file\}/);
});

// ---------- permisos locales (ADR-0026) ----------
test('localPermissionRules: lectura del plugin y sus CLIs, con las dos formas de ruta en Windows', () => {
  const win = localPermissionRules(String.raw`C:\Tools\plugins\sdd-beto`);
  assert.deepEqual(win, [
    'Read(//c/Tools/plugins/sdd-beto/**)',
    'Bash(node C:/Tools/plugins/sdd-beto/scripts/sdd-state.mjs *)',
    'Bash(node C:/Tools/plugins/sdd-beto/scripts/lint-ratchet.mjs *)',
    String.raw`Bash(node C:\Tools\plugins\sdd-beto\scripts\sdd-state.mjs *)`,
    String.raw`Bash(node C:\Tools\plugins\sdd-beto\scripts\lint-ratchet.mjs *)`,
  ]);
  assert.deepEqual(localPermissionRules('/opt/sdd-beto'), [
    'Read(//opt/sdd-beto/**)',
    'Bash(node /opt/sdd-beto/scripts/sdd-state.mjs *)',
    'Bash(node /opt/sdd-beto/scripts/lint-ratchet.mjs *)',
  ]);
  assert.equal(posixPath(String.raw`D:\a\b`), '/d/a/b');
  for (const rule of win) assert.ok(isPluginRule(rule), rule);
  assert.ok(!isPluginRule('Read(//c/Tools/other/**)'));
  assert.ok(!isPluginRule('Bash(node scripts/build.mjs *)'));
});

test('mergeLocalPermissions: añade las reglas, sustituye las de otra versión y respeta las del usuario', () => {
  const v1 = localPermissionRules('/p/sdd-beto/0.1.0');
  const v2 = localPermissionRules('/p/sdd-beto/0.2.0');
  const first = mergeLocalPermissions(JSON.stringify({ permissions: { allow: ['Bash(npm test)'] }, other: 1 }), v1);
  const s1 = JSON.parse(first.text);
  assert.deepEqual(s1.permissions.allow, ['Bash(npm test)', ...v1]);
  assert.equal(s1.other, 1);
  assert.deepEqual(mergeLocalPermissions(first.text, v1).notes, []);
  const upgraded = mergeLocalPermissions(first.text, v2);
  assert.deepEqual(JSON.parse(upgraded.text).permissions.allow, ['Bash(npm test)', ...v2]);
  assert.equal(upgraded.notes.filter((n) => n.startsWith('se quita')).length, v1.length);
});

test('integrate --local-permissions: escribe settings.local.json y lo añade a .gitignore; reejecutar no cambia nada', (t) => {
  const r = makeRepo(t);
  withConfig(r);
  r.write('.gitignore', 'node_modules/\r\n');
  const dry = r.cli(['integrate', '--no-depth-limit', '--local-permissions', '--dry-run']);
  assert.equal(dry.code, 0, dry.stderr);
  assert.ok(!r.exists('.claude/settings.local.json'));
  assert.ok(dry.data.files.find((f) => f.path === '.gitignore').notes.length);

  const res = r.cli(['integrate', '--no-depth-limit', '--local-permissions']);
  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(JSON.parse(r.read('.claude/settings.local.json')).permissions.allow, localPermissionRules());
  assert.equal(r.read('.gitignore'), 'node_modules/\r\n.claude/settings.local.json\r\n');
  assert.equal(r.git('check-ignore', '.claude/settings.local.json').trim(), '.claude/settings.local.json');
  assert.ok(!r.exists('.claude/settings.json'), '--no-depth-limit no crea settings.json');

  const again = r.cli(['integrate', '--no-depth-limit', '--local-permissions']);
  assert.ok(again.data.files.every((f) => f.action === 'unchanged'), JSON.stringify(again.data.files));
  assert.ok(!again.data.files.some((f) => f.path === '.gitignore'), 'ya lo ignora: no toca .gitignore');

  const scan = r.cli(['scan']).data.sdd.local_permissions;
  assert.deepEqual(scan, { exists: true, valid: true, up_to_date: true, stale: 0 });
});

test('integrate --local-permissions: avisa si settings.local.json está versionado y no toca .gitignore', (t) => {
  const r = makeRepo(t);
  withConfig(r);
  r.write('.claude/settings.local.json', '{}');
  r.git('add', '-f', '.claude/settings.local.json');
  r.git('commit', '-q', '-m', 'local');
  const res = r.cli(['integrate', '--no-depth-limit', '--local-permissions']);
  const f = res.data.files.find((x) => x.path === '.claude/settings.local.json');
  assert.ok(f.notes.some((n) => n.includes('versionado')));
  assert.ok(!r.exists('.gitignore'));
});
