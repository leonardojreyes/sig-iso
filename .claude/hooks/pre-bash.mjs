// PreToolUse (Bash): bloquea comandos destructivos y accesos a producción.
import { bloquear, leerEntrada } from './lib.mjs';

const cmd = (leerEntrada().tool_input?.command ?? '').replace(/\s+/g, ' ');

const reglas = [
  [/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|--recursive)\b/, 'rm -rf'],
  [/\bdocker\s+system\s+prune\b|\bdocker\s+volume\s+(rm|prune)\b|\bdocker\s+compose\s+down\s+.*(-v|--volumes)\b/, 'borrado de volúmenes/imágenes de Docker'],
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard'],
  [/\bgit\s+push\b.*(--force\b|-f\b|--force-with-lease)/, 'git push --force'],
  [/\bgit\s+push\b.*\b(origin\s+)?(HEAD:)?(refs\/heads\/)?main\b/, 'push directo a main'],
  [/\bgit\s+(clean\s+-[a-z]*f|checkout\s+--\s+\.|branch\s+-D\s+main)/, 'operación git destructiva'],
  [/\bDROP\s+(DATABASE|SCHEMA|TABLE)\b|\bTRUNCATE\b/i, 'SQL destructivo'],
  [/\b(kubectl|helm|tofu|terraform)\b.*\b(prod|production)\b|--context[= ]\S*prod/i, 'acceso a producción'],
  [/\bcat\b[^|;&]*\.env(\s|$)|\b(cp|mv)\b[^|;&]*\.env(\s|$)/, 'lectura/copia de .env'],
];

for (const [patron, nombre] of reglas) {
  if (patron.test(cmd)) bloquear(`${nombre} requiere aprobación explícita del responsable.`);
}
