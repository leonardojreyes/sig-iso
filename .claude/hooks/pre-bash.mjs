// PreToolUse (Bash): bloquea comandos destructivos y accesos a producción.
import { bloquear, leerEntrada } from "./lib.mjs";
import { evaluar } from "./reglas-bash.mjs";

const motivo = evaluar(leerEntrada().tool_input?.command ?? "");
if (motivo)
  bloquear(`${motivo} requiere aprobación explícita del responsable.`);
