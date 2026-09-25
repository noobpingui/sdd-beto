// Máquina de estados de una feature (state.json, ADR-0003 y ADR-0004).
// Funciones puras: reciben el estado y devuelven una copia modificada. No leen disco ni git.

export const STAGES = ['spec', 'plan', 'tasks', 'tests', 'implement', 'verify', 'review', 'docs', 'close'];
export const STATUSES = ['in_progress', 'awaiting_approval', 'blocked', 'done'];
export const COUNTERS = ['tests', 'implement', 'review'];
export const RESULTS = ['PASS', 'FAIL', 'BLOCKED'];
export const VERDICTS = ['APPROVED', 'CHANGES_REQUESTED'];
export const TYPES = ['feature', 'fix', 'refactor'];
export const EVENTS = ['created', 'started', 'done', 'approved', 'changes_requested', 'needs_input', 'rework',
  'blocked', 'commit', 'push', 'env', 'result', 'verdict', 'snapshot', 'note'];

// Artefacto que debe existir cuando una etapa está aprobada (null = no produce uno propio).
export const ARTIFACT_OF = {
  spec: 'spec.md', plan: 'plan.md', tasks: 'tasks.md', tests: 'verify-report.md', implement: null,
  verify: 'verify-report.md', review: 'review.md', docs: 'docs-report.md', close: null,
};

export class StateError extends Error {
  constructor(message, code = 2) {
    super(message);
    this.name = 'StateError';
    this.code = code; // 1 = uso, 2 = estado o precondición, 3 = límite de iteraciones
  }
}

export const stageIndex = (s) => STAGES.indexOf(s);
export const nextStage = (s) => (s === 'close' ? 'done' : STAGES[stageIndex(s) + 1]);

const clone = (o) => JSON.parse(JSON.stringify(o));
const approved = (st, s) => Boolean(st.approvals && st.approvals[s]);

function assertStage(stage, { allowClose = true } = {}) {
  if (!STAGES.includes(stage) || (!allowClose && stage === 'close')) {
    throw new StateError(`etapa desconocida: "${stage}" (etapas: ${STAGES.join(', ')})`, 1);
  }
}

function push(st, now, stage, event, note) {
  st.history = st.history || [];
  st.history.push({ at: now, stage, event, note: note || '' });
}

// Crea el estado inicial a partir de la plantilla.
export function createState(template, { feature, title, type, scope, branch, baseBranch, maxIterations, now }) {
  if (!TYPES.includes(type)) throw new StateError(`tipo desconocido: "${type}" (usa ${TYPES.join(', ')})`, 1);
  const st = clone(template);
  delete st.$comment;
  Object.assign(st, {
    feature, title, type, scope: [...scope], branch, base_branch: baseBranch, created_at: now,
    stage: 'spec', status: 'in_progress', max_iterations: maxIterations, history: [],
  });
  push(st, now, 'spec', 'created', `rama ${branch} desde ${baseBranch}`);
  return st;
}

// Precondiciones para ejecutar una etapa (stages.md). Devuelve la lista de lo que falta.
export function preconditions(st, stage, { ideaExists = true } = {}) {
  assertStage(stage);
  const missing = [];
  const need = (s) => { if (!approved(st, s)) missing.push(`approvals.${s}`); };
  switch (stage) {
    case 'spec': if (!ideaExists) missing.push('idea.md'); break;
    case 'plan': need('spec'); break;
    case 'tasks': need('plan'); break;
    case 'tests': need('tasks'); break;
    case 'implement': need('tests'); if (st.red_check?.result !== 'PASS') missing.push('red_check.result == PASS'); break;
    case 'verify': need('implement'); break;
    case 'review': need('verify'); if (st.verify?.result !== 'PASS') missing.push('verify.result == PASS'); break;
    case 'docs': need('review'); if (st.review?.verdict !== 'APPROVED') missing.push('review.verdict == APPROVED'); break;
    case 'close': need('docs'); break;
    default: break;
  }
  return missing;
}

function assertCurrent(st, stage) {
  assertStage(stage);
  if (st.status === 'done') throw new StateError('la feature ya está cerrada (status "done")');
  if (st.stage !== stage) throw new StateError(`la etapa actual es "${st.stage}", no "${stage}". Para volver atrás usa rework.`);
}

export function start(st0, stage, { note, now, ideaExists }) {
  const st = clone(st0);
  assertCurrent(st, stage);
  if (st.status === 'awaiting_approval') throw new StateError(`hay un gate pendiente en "${stage}": apruébalo o pide cambios antes de volver a empezar`);
  const missing = preconditions(st, stage, { ideaExists });
  if (missing.length) throw new StateError(`no se cumplen las precondiciones de "${stage}": falta ${missing.join(', ')}`);
  st.status = 'in_progress';
  push(st, now, stage, 'started', note);
  return st;
}

// Cierra el trabajo de la etapa y la deja esperando el gate humano.
export function gate(st0, stage, { note, now }) {
  const st = clone(st0);
  assertCurrent(st, stage);
  if (st.status !== 'in_progress') throw new StateError(`solo se presenta el gate de una etapa en curso (status actual: "${st.status}")`);
  st.status = 'awaiting_approval';
  push(st, now, stage, 'done', note);
  return st;
}

// Requisitos objetivos para aprobar una etapa, además del gate.
function approvalRequirements(st, stage) {
  if (stage === 'tests' && st.red_check?.result !== 'PASS') return 'red_check.result debe ser PASS';
  if (stage === 'verify' && st.verify?.result !== 'PASS') return 'verify.result debe ser PASS';
  if (stage === 'review' && st.review?.verdict !== 'APPROVED') return 'review.verdict debe ser APPROVED (si es CHANGES_REQUESTED, usa rework)';
  return null;
}

export function approve(st0, stage, { note, now }) {
  const st = clone(st0);
  assertCurrent(st, stage);
  if (st.status !== 'awaiting_approval') throw new StateError(`no hay un gate pendiente en "${stage}" (status "${st.status}"): primero gate`);
  if (!note) throw new StateError('la aprobación necesita --note con el texto literal del usuario', 1);
  const req = approvalRequirements(st, stage);
  if (req) throw new StateError(`no se puede aprobar "${stage}": ${req}`);
  st.approvals[stage] = { at: now, note };
  push(st, now, stage, 'approved', note);
  const next = nextStage(stage);
  if (next === 'done') {
    st.stage = 'done';
    st.status = 'done';
    push(st, now, 'done', 'done', 'feature cerrada');
  } else {
    st.stage = next;
    st.status = 'in_progress';
  }
  return st;
}

// Vuelve a una etapa anterior (o repite la actual) para corregir. Con `counter`, consume una iteración.
// Devuelve { state, blocked }: blocked = true si se alcanzó el límite y la feature queda bloqueada.
export function rework(st0, target, { counter, note, now }) {
  const st = clone(st0);
  assertStage(target, { allowClose: false });
  if (st.status === 'done') throw new StateError('la feature ya está cerrada (status "done")');
  if (stageIndex(target) > stageIndex(st.stage === 'done' ? 'close' : st.stage)) {
    throw new StateError(`no se puede hacer rework hacia delante: la etapa actual es "${st.stage}" y el destino "${target}"`);
  }
  if (counter !== undefined && counter !== null) {
    if (!COUNTERS.includes(counter)) throw new StateError(`contador desconocido: "${counter}" (usa ${COUNTERS.join(', ')})`, 1);
    if (st.iterations[counter] >= st.max_iterations) {
      st.status = 'blocked';
      push(st, now, st.stage, 'blocked', `límite de iteraciones alcanzado (${counter}: ${st.iterations[counter]}/${st.max_iterations}). ${note || ''}`.trim());
      return { state: st, blocked: true };
    }
    st.iterations[counter] += 1;
  }
  const idx = stageIndex(target);
  for (const s of STAGES.slice(idx)) st.approvals[s] = null;
  if (idx <= stageIndex('tasks')) st.red_check = { result: null, at: null };
  if (idx <= stageIndex('verify')) st.verify = { result: null, at: null };
  if (idx <= stageIndex('review')) st.review = { verdict: null, at: null };
  st.stage = target;
  st.status = 'in_progress';
  const iter = counter ? ` · ${counter} ${st.iterations[counter]}/${st.max_iterations}` : '';
  push(st, now, target, 'rework', `${note || ''}${iter}`.trim());
  return { state: st, blocked: false };
}

export function block(st0, { note, now }) {
  const st = clone(st0);
  if (st.status === 'done') throw new StateError('la feature ya está cerrada (status "done")');
  if (!note) throw new StateError('el bloqueo necesita --note con el motivo', 1);
  st.status = 'blocked';
  push(st, now, st.stage, 'blocked', note);
  return st;
}

// Resultado del verifier: red (etapa tests) o verify (etapa verify).
export function setResult(st0, kind, result, { note, now }) {
  const st = clone(st0);
  if (!['red', 'verify'].includes(kind)) throw new StateError(`tipo de resultado desconocido: "${kind}" (usa red o verify)`, 1);
  if (!RESULTS.includes(result)) throw new StateError(`resultado desconocido: "${result}" (usa ${RESULTS.join(', ')})`, 1);
  const stage = kind === 'red' ? 'tests' : 'verify';
  if (st.stage !== stage) throw new StateError(`el resultado ${kind} solo se registra en la etapa "${stage}" (actual: "${st.stage}")`);
  st[kind === 'red' ? 'red_check' : 'verify'] = { result, at: now };
  push(st, now, stage, 'result', `${kind} ${result}${note ? `: ${note}` : ''}`);
  return st;
}

export function setVerdict(st0, verdict, { now }) {
  const st = clone(st0);
  if (!VERDICTS.includes(verdict)) throw new StateError(`veredicto desconocido: "${verdict}" (usa ${VERDICTS.join(', ')})`, 1);
  if (st.stage !== 'review') throw new StateError(`el veredicto solo se registra en la etapa "review" (actual: "${st.stage}")`);
  st.review = { verdict, at: now };
  push(st, now, 'review', 'verdict', verdict);
  return st;
}

export function setCommit(st0, label, sha, { now }) {
  const st = clone(st0);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(label || '')) throw new StateError(`etiqueta de commit no válida: "${label}"`, 1);
  if (!/^[0-9a-f]{7,40}$/.test(sha || '')) throw new StateError(`sha no válido: "${sha}"`, 1);
  st.commits[label] = sha;
  push(st, now, st.stage, 'commit', `${label}: ${sha}`);
  return st;
}

export function setSnapshot(st0, sha256, { reason, now }) {
  const st = clone(st0);
  st.tests_snapshot = { at: now, reason: reason || '', sha256 };
  push(st, now, st.stage, 'snapshot', `${Object.keys(sha256).length} archivo(s) de test${reason ? `: ${reason}` : ''}`);
  return st;
}

export function addEvent(st0, stage, event, { note, now }) {
  const st = clone(st0);
  if (stage !== 'done') assertStage(stage);
  if (!EVENTS.includes(event)) throw new StateError(`evento desconocido: "${event}" (usa ${EVENTS.join(', ')})`, 1);
  push(st, now, stage, event, note);
  return st;
}

// Comprobaciones de consistencia. `artifactExists(nombre)` indica si existe <feature>/<nombre>.
export function validateState(st, { artifactExists = () => true } = {}) {
  const issues = [];
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(st)) return ['state.json no es un objeto JSON'];
  if (st.schema_version !== 1) issues.push('schema_version debe ser 1');
  for (const k of ['feature', 'branch', 'base_branch', 'created_at']) if (typeof st[k] !== 'string' || !st[k]) issues.push(`${k} vacío o ausente`);
  if (!TYPES.includes(st.type)) issues.push(`type no válido: "${st.type}"`);
  if (!Array.isArray(st.scope) || st.scope.length === 0) issues.push('scope debe ser una lista no vacía de ámbitos');
  if (![...STAGES, 'done'].includes(st.stage)) issues.push(`stage no válido: "${st.stage}"`);
  if (!STATUSES.includes(st.status)) issues.push(`status no válido: "${st.status}"`);
  if ((st.stage === 'done') !== (st.status === 'done')) issues.push('stage "done" y status "done" deben ir juntos');
  if (!isObj(st.approvals)) issues.push('approvals ausente');
  if (!isObj(st.iterations)) issues.push('iterations ausente');
  if (!Array.isArray(st.history)) issues.push('history debe ser una lista');
  if (issues.length) return issues;

  const cur = st.stage === 'done' ? STAGES.length : stageIndex(st.stage);
  STAGES.forEach((s, i) => {
    if (i < cur && !approved(st, s)) issues.push(`la etapa "${s}" es anterior a la actual y no está aprobada`);
    if (i >= cur && approved(st, s)) issues.push(`la etapa "${s}" no ha llegado y ya tiene aprobación`);
    if (approved(st, s) && ARTIFACT_OF[s] && !artifactExists(ARTIFACT_OF[s])) issues.push(`"${s}" está aprobada pero falta ${ARTIFACT_OF[s]}`);
  });
  if (cur > stageIndex('tests') && st.red_check?.result !== 'PASS') issues.push('después de tests, red_check.result debe ser PASS');
  if (cur > stageIndex('verify') && st.verify?.result !== 'PASS') issues.push('después de verify, verify.result debe ser PASS');
  if (cur > stageIndex('review') && st.review?.verdict !== 'APPROVED') issues.push('después de review, review.verdict debe ser APPROVED');
  for (const c of COUNTERS) {
    if (!Number.isInteger(st.iterations[c]) || st.iterations[c] < 0) issues.push(`iterations.${c} debe ser un entero ≥ 0`);
    else if (st.iterations[c] > st.max_iterations) issues.push(`iterations.${c} supera max_iterations`);
  }
  let prev = '';
  for (const [i, h] of st.history.entries()) {
    if (!h || typeof h.at !== 'string' || !h.event) { issues.push(`history[${i}] incompleto`); continue; }
    if (h.at < prev) issues.push(`history[${i}] tiene una fecha anterior a la entrada previa`);
    prev = h.at;
  }
  return issues;
}
