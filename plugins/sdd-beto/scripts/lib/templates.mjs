// Resolución de plantillas proyecto → plugin (ADR-0017).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const PROJECT_TEMPLATES_REL = '.sdd/templates';

// Devuelve { path, source: 'project' | 'plugin' } o lanza si no existe en ninguno de los dos.
export function resolveTemplate(name, projectDir, pluginRoot = PLUGIN_ROOT) {
  if (name.includes('/') || name.includes('\\') || name.includes('..')) throw new Error(`nombre de plantilla no válido: "${name}"`);
  const fromProject = path.join(projectDir, PROJECT_TEMPLATES_REL, name);
  if (existsSync(fromProject)) return { path: fromProject, source: 'project' };
  const fromPlugin = path.join(pluginRoot, 'templates', name);
  if (existsSync(fromPlugin)) return { path: fromPlugin, source: 'plugin' };
  throw new Error(`no existe la plantilla "${name}" ni en ${PROJECT_TEMPLATES_REL}/ ni en el plugin`);
}
