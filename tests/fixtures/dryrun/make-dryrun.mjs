#!/usr/bin/env node
// Crea el proyecto de la prueba en seco (Fase 6): copia project/ al destino, hace git init y el commit
// inicial, y escribe el arnés headless (settings con un hook PermissionRequest que aprueba y registra).
//
//   node tests/fixtures/dryrun/make-dryrun.mjs <destino>
//
// Se niega si el destino existe y no está vacío.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] && path.resolve(process.argv[2]);
if (!target) {
  console.error('Uso: node make-dryrun.mjs <destino>');
  process.exit(1);
}
if (existsSync(target) && readdirSync(target).length > 0) {
  console.error(`${target} existe y no está vacío`);
  process.exit(2);
}
mkdirSync(target, { recursive: true });
cpSync(path.join(here, 'project'), target, { recursive: true });

const git = (...args) => execFileSync('git', args, { cwd: target, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
git('init', '-q', '-b', 'main');
git('config', 'user.name', 'sdd-dryrun');
git('config', 'user.email', 'sdd-dryrun@example.invalid');
git('add', '.');
git('commit', '-q', '-m', 'Initial commit');

// Arnés: fuera del repo de prueba, junto a él.
const harness = `${target}-harness`;
mkdirSync(harness, { recursive: true });
const log = path.join(harness, 'permission-requests.jsonl').split(path.sep).join('/');
const approve = path.join(here, 'approve.mjs').split(path.sep).join('/');
writeFileSync(path.join(harness, 'settings.json'), `${JSON.stringify({
  hooks: {
    PermissionRequest: [{ matcher: '*', hooks: [{ type: 'command', command: 'node', args: [approve, log], timeout: 15 }] }],
  },
}, null, 2)}\n`);
console.log(JSON.stringify({ project: target, harness, settings: path.join(harness, 'settings.json'), log }, null, 2));
