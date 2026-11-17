// pnpm keycloak:cuentas — crea en el Keycloak de desarrollo SOLO las cuentas de prueba que falten (por ejemplo, el consultor de M6b),
// SIN borrar nada: no toca las cuentas que ya existen ni sus sesiones. Es la alternativa a `keycloak:reset`, que borra la base de
// Keycloak. Usa la IMPORTACIÓN PARCIAL de la API de administración porque respeta el `id` de la cuenta (crear un usuario con
// `POST /users` ignora el `id` y Keycloak inventa otro: el `sub` del token ya no coincidiría con la persona de la base).
// Requiere Keycloak en marcha, `pnpm keycloak:realm` (genera las contraseñas) y las variables KEYCLOAK_ADMIN_USER y
// KEYCLOAK_ADMIN_PASSWORD del entorno local (las lee `node --env-file`; este script no las imprime).
// Las contraseñas de las cuentas salen de .local/secretos-keycloak.json; nada se imprime salvo los alias.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CUENTAS_SIN_ACCESO, DATOS_SIEMBRA } from "./lib/datos-siembra.ts";
import { cuentaDePrueba } from "./lib/realm-keycloak.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.env.KEYCLOAK_URL ?? "http://127.0.0.1:8080").replace(
  /\/+$/,
  "",
);
const REALM = "sigiso";

const exigir = (nombre: string): string => {
  const v = process.env[nombre];
  if (!v)
    throw new Error(
      `Falta ${nombre} en el entorno local. Ejecuta pnpm keycloak:realm primero`,
    );
  return v;
};

try {
  const claves = JSON.parse(
    readFileSync(join(raiz, ".local", "secretos-keycloak.json"), "utf8"),
  ).usuarios as Record<string, string>;
  const t = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: exigir("KEYCLOAK_ADMIN_USER"),
      password: exigir("KEYCLOAK_ADMIN_PASSWORD"),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!t.ok)
    throw new Error(
      `Keycloak no aceptó al administrador (respuesta ${t.status}). ¿Está en marcha? pnpm keycloak:status`,
    );
  const token = ((await t.json()) as { access_token: string }).access_token;
  const admin = (ruta: string, init: RequestInit = {}) =>
    fetch(`${base}/admin/realms/${REALM}${ruta}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
  const buscar = async (alias: string): Promise<{ id: string } | null> => {
    const r = await admin(
      `/users?username=${encodeURIComponent(alias)}&exact=true`,
    );
    if (!r.ok)
      throw new Error(
        `No se pudo consultar la cuenta ${alias} (respuesta ${r.status})`,
      );
    return ((await r.json()) as { id: string }[])[0] ?? null;
  };

  const faltan = [];
  for (const u of [...DATOS_SIEMBRA.usuarios, ...CUENTAS_SIN_ACCESO]) {
    const existe = await buscar(u.alias);
    if (existe === null) {
      faltan.push(u);
      continue;
    }
    // Una cuenta con otro identificador que el de la siembra no sirve: su `sub` no coincidiría con la persona de la base.
    if (existe.id !== u.id)
      throw new Error(
        `La cuenta ${u.alias} existe con otro identificador que el de la siembra; bórrela en Keycloak y repita`,
      );
    console.log(`· ${u.alias}: ya existe, no se toca`);
  }
  if (faltan.length > 0) {
    const usuarios = faltan.map((u) => {
      const clave = claves[u.alias];
      if (!clave)
        throw new Error(
          `Falta la contraseña de ${u.alias} en .local/secretos-keycloak.json: ejecuta pnpm keycloak:realm`,
        );
      return cuentaDePrueba(u, clave);
    });
    const r = await admin("/partialImport", {
      method: "POST",
      body: JSON.stringify({ ifResourceExists: "SKIP", users: usuarios }),
    });
    if (!r.ok)
      throw new Error(
        `Keycloak no aceptó la importación parcial (respuesta ${r.status})`,
      );
    for (const u of faltan) {
      const creada = await buscar(u.alias);
      if (creada?.id !== u.id)
        throw new Error(
          `La cuenta ${u.alias} no quedó con el identificador de la siembra`,
        );
      console.log(`✔ ${u.alias}: creada`);
    }
  }
  console.log(
    faltan.length === 0
      ? "\nNo faltaba ninguna cuenta."
      : `\n${faltan.length} cuenta(s) creada(s). Las contraseñas están en .local/secretos-keycloak.json.`,
  );
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
