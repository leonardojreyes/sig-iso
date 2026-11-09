// Reglas del hook pre-bash como función pura (para poder probarlas).

const LECTORES =
  "cat|head|tail|less|more|grep|egrep|fgrep|rg|sed|awk|bat|cp|mv|source|strings|xxd|od|tee";
// .env, .env.local, .env.prod…, pero no .env.example
const ENV = String.raw`(?:^|[\s/"'=<])\.env(?!\.example\b)(?:\.[\w-]+)*(?=$|[\s"';|&<>])`;
const SQL_ESCRITURA =
  /\b(DELETE|UPDATE|ALTER|GRANT|REVOKE|CREATE\s+ROLE|DROP\s+ROLE)\b/i;

const reglas = [
  [
    /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|--recursive)\b/,
    "rm -rf",
  ],
  [
    /\bdocker\s+system\s+prune\b|\bdocker\s+volume\s+(rm|prune)\b|\bdocker\s+compose\s+down\s+.*(-v|--volumes)\b/,
    "borrado de volúmenes/imágenes de Docker",
  ],
  [/\bgit\s+reset\s+--hard\b/, "git reset --hard"],
  [/\bgit\s+push\b.*(--force\b|-f\b|--force-with-lease)/, "git push --force"],
  [
    /\bgit\s+push\b.*\b(origin\s+)?(HEAD:)?(refs\/heads\/)?main\b/,
    "push directo a main",
  ],
  [
    /\bgit\s+(clean\s+-[a-z]*f|checkout\s+(--\s+)?\.(\s|$)|branch\s+-D\s+main)/,
    "operación git destructiva",
  ],
  // restore solo se acepta para sacar del índice (--staged sin --worktree)
  [
    /\bgit\s+restore\b(?!(?=.*--staged)(?!.*--worktree))/,
    "git restore (descarta cambios)",
  ],
  [/\bDROP\s+(DATABASE|SCHEMA|TABLE)\b|\bTRUNCATE\b/i, "SQL destructivo"],
  [
    /\b(kubectl|helm|tofu|terraform)\b.*\b(prod|production)\b|--context[= ]\S*prod/i,
    "acceso a producción",
  ],
  [
    new RegExp(String.raw`\b(${LECTORES})\b[^|;&]*${ENV}`),
    "lectura/copia de .env",
  ],
  [
    /<\s*\S*\.env(?!\.example\b)(\.[\w-]+)*(\s|$)/,
    "lectura de .env por redirección",
  ],
];

/** Devuelve el motivo del bloqueo o null si el comando es aceptable. */
export const evaluar = (comando = "") => {
  const cmd = comando.replace(/\s+/g, " ");
  for (const [patron, nombre] of reglas) {
    if (patron.test(cmd)) return nombre;
  }
  if (
    /\bpsql\b/.test(cmd) &&
    SQL_ESCRITURA.test(cmd) &&
    !/\bsigiso_test\b/.test(cmd)
  ) {
    return "SQL de escritura/permisos con psql fuera de sigiso_test";
  }
  return null;
};
