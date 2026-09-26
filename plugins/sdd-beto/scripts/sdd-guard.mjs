#!/usr/bin/env node
// Guardia SDD de sdd-beto: hook PreToolUse del plugin (ADR-0008), registrado en hooks/hooks.json en forma exec.
//
//   node sdd-guard.mjs write   -> Write | Edit | MultiEdit | NotebookEdit
//   node sdd-guard.mjs shell   -> Bash | PowerShell
//
// Lee el JSON del hook por stdin. Para bloquear imprime
// { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", ... } }.
// Si no imprime nada, se aplica el flujo normal de permisos.
//
// Sin .sdd/config.json el guard no hace nada (salvo bloquear a los agentes sdd-beto:*), para que el plugin
// instalado a nivel de usuario no afecte a proyectos que no usan SDD.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CONFIG_REL, ConfigError, loadConfig } from './lib/config.mjs';
import { matchesAny } from './lib/glob.mjs';
import { classify, featureFromBranch, isRealEnv, toRel } from './lib/paths.mjs';
import { currentBranch, toplevel } from './lib/git.mjs';

export const PLUGIN = 'sdd-beto';

// Etapas de state.json en las que cada rol puede escribir.
export const ROLE_STAGES = {
  'spec-writer': ['spec'],
  planner: ['plan'],
  'task-breaker': ['tasks'],
  'test-author': ['tests'],
  implementer: ['tests', 'implement'], // 'tests': solo modo scaffold (ADR-0012)
  verifier: ['tests', 'verify'],
  reviewer: ['review'],
  'doc-keeper': ['docs'],
};

// Subcomandos git permitidos a cualquier subagente (solo lectura).
const READONLY_GIT = new Set([
  'status', 'diff', 'log', 'show', 'rev-parse', 'ls-files', 'blame', 'grep',
  'merge-base', 'describe', 'cat-file', 'rev-list', 'shortlog',
]);

// "sdd-beto:implementer" → "implementer". Un nombre sin el prefijo del plugin NO es un rol SDD.
export function sddRole(agentType) {
  if (typeof agentType !== 'string' || !agentType.startsWith(`${PLUGIN}:`)) return null;
  const role = agentType.slice(PLUGIN.length + 1);
  return Object.hasOwn(ROLE_STAGES, role) ? role : null;
}

const approved = (state, stage) => Boolean(state && state.approvals && state.approvals[stage]);
const under = (rel, dir) => rel === dir || rel.startsWith(`${dir.replace(/\/+$/, '')}/`);

// Un Edit o MultiEdit sobre tasks.md que solo cambia casillas "- [ ]" ↔ "- [x]".
export function onlyCheckboxes(input) {
  const ti = input.tool_input || {};
  const norm = (s) => String(s ?? '').replace(/\r\n/g, '\n').replace(/^(\s*[-*]\s+)\[[ xX]\]/gm, '$1[_]');
  const edits = input.tool_name === 'MultiEdit' ? ti.edits : input.tool_name === 'Edit' ? [ti] : null;
  if (!Array.isArray(edits) || edits.length === 0) return false;
  return edits.every((e) => e && typeof e.old_string === 'string' && norm(e.old_string) === norm(e.new_string));
}

function roleAllows(role, rel, fdir, config, input) {
  const own = (name) => rel === `${fdir}/${name}`;
  const kind = classify(rel, config).kind;
  const tasksCheckboxes = own('tasks.md') && onlyCheckboxes(input);
  switch (role) {
    case 'spec-writer': return own('spec.md');
    case 'planner': {
      const adr = config.paths.adr.replace(/\/+$/, '');
      return own('plan.md') || new RegExp(`^${adr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(ADR-\\d{4}-[^/]+|README)\\.md$`).test(rel);
    }
    case 'task-breaker': return own('tasks.md');
    case 'test-author': return kind === 'test' || tasksCheckboxes;
    case 'implementer': return kind === 'prod' || kind === 'env_example' || tasksCheckboxes;
    case 'verifier': return own('verify-report.md') || own('state.json');
    case 'reviewer': return own('review.md');
    case 'doc-keeper':
      if (own('docs-report.md') || kind === 'env_example') return true;
      if (rel === 'CLAUDE.md') return true; // la sección Proyecto la limita su prompt (ADR-0013)
      if (under(rel, config.paths.adr) || under(rel, config.paths.specs)) return false;
      return kind === 'other' && matchesAny(rel, config.paths.docs);
    default: return false;
  }
}

function allowedText(role, config) {
  const s = config.paths.specs;
  return {
    'spec-writer': `${s}/<feature>/spec.md`,
    planner: `${s}/<feature>/plan.md y ${config.paths.adr}/ADR-*.md (y su README.md)`,
    'task-breaker': `${s}/<feature>/tasks.md`,
    'test-author': 'los globs "tests" de los ámbitos de .sdd/config.json y las casillas de <feature>/tasks.md (solo con Edit)',
    implementer: 'los globs "prod" de los ámbitos (sin tests), los .env.example y las casillas de <feature>/tasks.md (solo con Edit)',
    verifier: `${s}/<feature>/verify-report.md (el estado se registra con sdd-state result)`,
    reviewer: `${s}/<feature>/review.md`,
    'doc-keeper': `paths.docs (${config.paths.docs.join(', ')}), los .env.example, la sección Proyecto de CLAUDE.md y ${s}/<feature>/docs-report.md`,
  }[role];
}

// ---------- decisiones (funciones puras: testeables) ----------
// ctx = { projectDir, branch, config | null, configError | null, readState(fdir) -> obj|null, bypass }
// Devuelve null (sin decisión) o { decision: 'deny' | null, reason?, warning? }.
export function decideWrite(input, ctx) {
  const agent = input.agent_type || null;
  const role = sddRole(agent);
  const ti = input.tool_input || {};
  const target = ti.file_path || ti.notebook_path || ti.path;

  if (!ctx.config) {
    if (role) {
      const why = ctx.configError ? `${CONFIG_REL} no es válido (${ctx.configError})` : `no existe ${CONFIG_REL}`;
      return { decision: 'deny', reason: `[SDD role-guard] ${agent} no puede escribir: ${why}. Ejecuta /sdd-beto:init o corrige la config.` };
    }
    if (ctx.configError) return { decision: null, warning: `[SDD guard] ${CONFIG_REL} no es válido; la guardia de etapa está desactivada hasta corregirlo: ${ctx.configError}` };
    return null;
  }
  if (!target) return null;

  const config = ctx.config;
  const { rel, outside } = toRel(ctx.projectDir, target);
  const feature = featureFromBranch(ctx.branch, config);
  const fdir = feature ? feature.dir : null;
  const state = fdir ? ctx.readState(fdir) : null;
  const kind = outside ? 'outside' : classify(rel, config).kind;

  // --- Guardia de rol: solo para agentes sdd-beto:* ---
  if (role) {
    const deny = (why) => ({
      decision: 'deny',
      reason: `[SDD role-guard] ${agent} no puede escribir en "${rel}": ${why}. ` +
        `Rutas permitidas para ${role}: ${allowedText(role, config)}. ` +
        'Si crees que necesitas escribir ahí, termina con STATUS: NEEDS_INPUT y explícalo.',
    });
    if (outside) return deny('la ruta está fuera del repositorio');
    if (!fdir) return deny(`la rama actual "${ctx.branch}" no es una rama de feature (<prefijo>/NNN-slug)`);
    if (!state) return deny(`no existe ${fdir}/state.json`);
    if (!ROLE_STAGES[role].includes(state.stage)) {
      return deny(`la etapa actual es "${state.stage}" y ${role} solo actúa en: ${ROLE_STAGES[role].join(', ')}`);
    }
    if (isRealEnv(rel, config)) return deny('los archivos .env reales nunca se editan (solo los .env.example)');
    if (rel === `${fdir}/tasks.md` && ['test-author', 'implementer'].includes(role) && !onlyCheckboxes(input)) {
      return deny('en tasks.md solo puedes marcar casillas ("- [ ]" → "- [x]") con Edit, sin cambiar el texto');
    }
    if (!roleAllows(role, rel, fdir, config, input)) return deny('la ruta no pertenece a su rol');
    if (kind === 'prod' && !(approved(state, 'spec') && approved(state, 'plan'))) {
      return deny('la spec y el plan no están aprobados en state.json');
    }
    return null;
  }

  // --- Otros subagentes (Explore, general-purpose, agentes locales…): no tocan un .env real ---
  if (agent && !outside && isRealEnv(rel, config)) {
    return { decision: 'deny', reason: `[SDD role-guard] el subagente ${agent} no puede editar ${rel}.` };
  }

  // --- Guardia de etapa: sesión principal y cualquier otro agente ---
  if (kind === 'prod' && !ctx.bypass) {
    const hint = 'Sigue el flujo (/sdd-beto:new, /sdd-beto:run) o, solo en un hotfix o excepción del Art. B1.2 de la ' +
      'constitución, reinicia Claude Code con SDD_BYPASS=1.';
    if (!fdir) return { decision: 'deny', reason: `[SDD stage-guard] "${rel}" es código de producción y la rama "${ctx.branch}" no es una rama de feature SDD. ${hint}` };
    if (!state) return { decision: 'deny', reason: `[SDD stage-guard] no existe ${fdir}/state.json. ${hint}` };
    if (!(approved(state, 'spec') && approved(state, 'plan'))) {
      return { decision: 'deny', reason: `[SDD stage-guard] la feature ${fdir} no tiene la spec y el plan aprobados; no se puede editar "${rel}". ${hint}` };
    }
  }
  return null;
}

// Lista de subcomandos git presentes en un comando de shell (Bash o PowerShell).
export function gitSubcommands(command) {
  const re = /(?:^|[\s;&|(`{])git(?:\.exe)?((?:\s+(?:-C|-c)\s+\S+|\s+--?[\w-]+(?:=\S+)?)*)\s+([a-z][a-z-]*)/g;
  const out = [];
  let m;
  while ((m = re.exec(command || '')) !== null) out.push(m[2]);
  return out;
}

export function decideShell(input, ctx) {
  if (!ctx.config) return null; // proyecto sin SDD: nada que vigilar
  const agent = input.agent_type || null;
  const command = (input.tool_input && input.tool_input.command) || '';
  const subs = gitSubcommands(command);
  if (subs.length === 0) return null;

  if (agent) {
    const readonlyBranch = (s) => s === 'branch' && /git(?:\.exe)?\s+branch\s*(--show-current|--list\b|$|\s*[;&|])/.test(command);
    const bad = subs.filter((s) => !READONLY_GIT.has(s) && !readonlyBranch(s));
    if (bad.length) {
      return {
        decision: 'deny',
        reason: `[SDD git-guard] los subagentes solo pueden usar git de lectura (${[...READONLY_GIT].join(', ')}, branch --show-current). ` +
          `Bloqueado: git ${bad.join(', git ')}. Los commits, pushes y cambios de rama los hace solo el orquestador, con aprobación del usuario.`,
      };
    }
    return null;
  }

  // Sesión principal: la aprobación de commits y pushes es el gate del chat (ADR-0025). El hook no añade
  // un "ask": en sesiones sin interfaz equivale a denegar y en las interactivas duplica la aprobación.
  return null;
}

// ---------- entorno real ----------
function loadContext(input) {
  const start = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const projectDir = toplevel(start) || start;
  let config = null;
  let configError = null;
  try {
    config = loadConfig(projectDir);
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    configError = e.issues.join('; ');
  }
  return { projectDir, config, configError };
}

function readStateFrom(projectDir) {
  return (fdir) => {
    const p = path.join(projectDir, fdir, 'state.json');
    if (!existsSync(p)) return null;
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return { stage: '__invalid__', approvals: {} }; }
  };
}

function emit(result) {
  if (!result) return;
  const out = {};
  if (result.decision) {
    out.hookSpecificOutput = {
      hookEventName: 'PreToolUse',
      permissionDecision: result.decision,
      permissionDecisionReason: result.reason,
    };
  }
  if (result.warning) out.systemMessage = result.warning;
  if (Object.keys(out).length) process.stdout.write(JSON.stringify(out));
}

export function main(mode = process.argv[2]) {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
    const base = loadContext(input);
    if (mode === 'write') {
      emit(decideWrite(input, {
        ...base,
        branch: base.config ? currentBranch(base.projectDir) : '',
        readState: readStateFrom(base.projectDir),
        bypass: process.env.SDD_BYPASS === '1',
      }));
    } else if (mode === 'shell') {
      emit(decideShell(input, base));
    }
  } catch (err) {
    // Si falla el hook: los agentes sdd-beto:* se bloquean (fail-closed); el resto sigue con un aviso (fail-open).
    if (sddRole(input.agent_type)) {
      emit({ decision: 'deny', reason: `[SDD guard] error interno del hook (${err.message}); se bloquea por seguridad.` });
    } else {
      emit({ decision: null, warning: `[SDD guard] error interno del hook ignorado: ${err.message}` });
    }
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
