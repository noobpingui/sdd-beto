#!/usr/bin/env node
// Hook PermissionRequest de la prueba en seco: hace de usuario que aprueba cada aviso de permiso y lo
// registra en el .jsonl que recibe como argumento. Los "deny" de otros hooks no llegan aquí.
import { appendFileSync, readFileSync } from 'node:fs';

const log = process.argv[2];
let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { /* entrada vacía */ }
const ti = input.tool_input || {};
const summary = ti.command ?? ti.file_path ?? ti.path ?? ti.pattern ?? null;
if (log) {
  appendFileSync(log, `${JSON.stringify({
    at: new Date().toISOString(),
    session: input.session_id ?? null,
    agent: input.agent_type ?? null,
    tool: input.tool_name ?? null,
    what: typeof summary === 'string' ? summary.slice(0, 300) : summary,
  })}\n`);
}
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } }));
