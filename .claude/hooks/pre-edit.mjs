// PreToolUse (Edit|Write|NotebookEdit): bloquea .env*, migraciones ya aplicadas e infra de producción.
import { existsSync, readFileSync } from 'node:fs';
import { bloquear, leerEntrada, normalizar } from './lib.mjs';

const entrada = leerEntrada();
const ruta = normalizar(entrada.tool_input?.file_path ?? entrada.tool_input?.notebook_path ?? '');
const nombre = ruta.split('/').pop() ?? '';

if (/^\.env(\..+)?$/.test(nombre) && nombre !== '.env.example') {
  bloquear(`no se editan archivos de entorno con secretos (${nombre}). Usa .env.example como plantilla.`);
}
if (/\/infra\/(prod|production)(\/|$)/.test(ruta) || /\/infra\/(opentofu|helm)\/.*(prod|production)/.test(ruta)) {
  bloquear('infra de producción requiere aprobación explícita del responsable.');
}
if (/\/migrations\/[^/]+\.(sql|ts)$/.test(ruta) && existsSync(ruta)) {
  // Una migración existente se considera aplicada; las nuevas se crean con un nombre nuevo.
  const registro = '.claude/hooks/migraciones-aplicadas.txt';
  if (existsSync(registro) && readFileSync(registro, 'utf8').split('\n').some((l) => l.trim() && ruta.endsWith(l.trim()))) {
    bloquear('la migración ya fue aplicada; crea una nueva migración en lugar de editarla.');
  }
}
