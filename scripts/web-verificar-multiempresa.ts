// pnpm web:verify-multiempresa — comprueba con todo REAL (Keycloak, API, PostgreSQL y web) que una persona puede pertenecer a varias
// empresas y cambiar entre ellas (MVP M6b-1, ADR 035): el consultor (una sola cuenta) administra Empresa A y solo colabora en
// Empresa B; el selector aparece solo para quien tiene varias; al cambiar, TODO se atiende con la empresa nueva y el rol que tiene allí;
// la empresa vieja deja de responder en esa sesión; otra sesión de la misma cuenta no se entera; una empresa ajena es «no encontrada»; y
// se respetan Origin, método, sesión y aislamiento con las demás cuentas.
// Requiere: Keycloak (con la cuenta «consultor»: pnpm keycloak:realm y pnpm keycloak:cuentas), API (pnpm dev api), web (pnpm dev web),
// pnpm db:migrate (incluye la 0012) y pnpm db:seed (siembra al consultor en A y en B).
// No escribe datos de negocio: solo cambia la empresa activa de sesiones de prueba (queda `empresa.cambiada` en la bitácora de B y de A).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  enviarWeb,
  iniciarSesionWeb,
  paginaWeb,
  type EntornoWeb,
} from "./lib/sesion-web.ts";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const redirectUri =
  process.env.OIDC_REDIRECT_URI ?? "http://localhost:3000/auth/callback";
const entorno: EntornoWeb = {
  web: new URL(redirectUri).origin,
  emisor: (
    process.env.OIDC_ISSUER_URL ?? "http://127.0.0.1:8080/realms/sigiso"
  ).replace(/\/+$/, ""),
  claves: JSON.parse(
    readFileSync(join(raiz, ".local", "secretos-keycloak.json"), "utf8"),
  ).usuarios,
};

let fallos = 0;
const comprobar = (descripcion: string, ok: boolean, detalle = "") => {
  if (!ok) fallos += 1;
  console.log(
    `${ok ? "✔" : "✖"} ${descripcion}${ok || !detalle ? "" : ` — ${detalle}`}`,
  );
};

const A = "/e/empresa-a";
const B = "/e/empresa-b";
const SOLO_ADMIN =
  "Solo la persona con rol de administrador SIG puede subir librerías";
/** El formulario de cambio de empresa de `actual`: por POST y hacia su ruta, sin depender del orden de los atributos. */
const CAMBIAR = (actual: string) => ({
  test: (html: string) =>
    new RegExp(`<form[^>]*action="${actual}/empresa/cambiar"[^>]*method="post"`).test(html) ||
    new RegExp(`<form[^>]*method="post"[^>]*action="${actual}/empresa/cambiar"`).test(html),
});
/** Los nombres de las librerías que muestra la pantalla «Normas». */
const nombresDeLibrerias = (html: string): string[] =>
  [...html.matchAll(/<p class="font-medium text-fg">([^<]+)<\/p>/g)]
    .map((m) => m[1]!)
    .sort();

try {
  const s = {
    consultor: await iniciarSesionWeb(entorno, "consultor", `${A}/panel`),
    consultor2: await iniciarSesionWeb(entorno, "consultor", `${A}/panel`),
    adminA: await iniciarSesionWeb(entorno, "admin-a", `${A}/panel`),
    adminB: await iniciarSesionWeb(entorno, "admin-b", `${B}/panel`),
  };
  type Quien = keyof typeof s;
  const ver = (quien: Quien, ruta: string) =>
    paginaWeb(entorno, ruta, s[quien]);
  const enviar = (
    quien: Quien,
    ruta: string,
    o: {
      origen?: string | null;
      metodo?: string;
      cuerpo?: Record<string, string>;
    } = {},
  ) => enviarWeb(entorno, ruta, s[quien], o);
  const cambiar = (quien: Quien, desde: string, empresa: string | null) =>
    enviar(quien, `${desde}/empresa/cambiar`, {
      cuerpo: empresa === null ? {} : { empresa },
    });

  // ---- El selector solo aparece para quien tiene varias empresas
  const p0 = await ver("consultor", `${A}/panel`);
  comprobar(
    "el consultor abre el panel de A (la empresa de su cuenta): 200",
    p0.estado === 200,
    `respuesta ${p0.estado}`,
  );
  comprobar(
    "el consultor ve el selector de empresa con Empresa B, por POST a su ruta y sin identificadores",
    CAMBIAR(A).test(p0.texto) &&
      p0.texto.includes("Empresa B (prueba)") &&
      /<select[^>]*name="empresa"/.test(p0.texto) &&
      !/name="(empresaId|empresa_id|tenant)"/i.test(p0.texto),
  );
  comprobar(
    "el selector NO ofrece la empresa actual",
    !/<option[^>]*value="empresa-a"/.test(p0.texto),
  );
  const pAdmin = await ver("adminA", `${A}/panel`);
  comprobar(
    "una persona de una sola empresa NO ve el selector",
    pAdmin.estado === 200 && !pAdmin.texto.includes("/empresa/cambiar"),
  );
  const nA = await ver("consultor", `${A}/normas`);
  comprobar(
    "en A el consultor es administrador: ve el formulario de subir librerías",
    nA.estado === 200 &&
      nA.texto.includes("/normas/subir") &&
      !nA.texto.includes(SOLO_ADMIN),
  );
  const librosA = nombresDeLibrerias(nA.texto);
  const librosDeB = nombresDeLibrerias(
    (await ver("adminB", `${B}/normas`)).texto,
  );
  const soloDeA = librosA.filter((n) => !librosDeB.includes(n));
  console.log(
    `· librerías en A: ${librosA.length}; en B: ${librosDeB.length}; solo de A: ${soloDeA.length}`,
  );

  // ---- Protecciones del formulario de cambio
  const alien = await cambiar("adminA", A, "empresa-b");
  comprobar(
    "quien NO pertenece a la empresa pedida recibe «no_encontrada» y se queda donde está",
    alien.estado === 303 &&
      alien.destino?.startsWith(`${A}/panel`) === true &&
      alien.parametros.get("cambio") === "no_encontrada",
    alien.destino ?? "",
  );
  comprobar(
    "…y su sesión sigue en A (A responde, B no)",
    (await ver("adminA", `${A}/panel`)).estado === 200 &&
      (await ver("adminA", `${B}/panel`)).estado === 404,
  );
  const inex = await cambiar("consultor", A, "empresa-que-no-existe");
  comprobar(
    "una empresa inexistente responde igual que una ajena: «no_encontrada»",
    inex.parametros.get("cambio") === "no_encontrada" &&
      inex.destino?.startsWith(`${A}/panel`) === true,
  );
  for (const malo of ["EMPRESA-B", "../b", "a".repeat(40), ""]) {
    const r = await cambiar("consultor", A, malo);
    comprobar(
      `un slug mal formado (${JSON.stringify(malo.slice(0, 12))}) vuelve con «no_valido» sin llamar a nada`,
      r.estado === 303 && r.parametros.get("cambio") === "no_valido",
    );
  }
  const sinCampo = await cambiar("consultor", A, null);
  comprobar(
    "sin elegir empresa: «no_valido»",
    sinCampo.parametros.get("cambio") === "no_valido",
  );
  for (const [origen, nombre] of [
    [null, "sin Origin"],
    ["null", "con Origin «null»"],
    ["https://evil.example", "con Origin de otro sitio"],
  ] as const) {
    comprobar(
      `cambiar de empresa ${nombre}: 403`,
      (
        await enviar("consultor", `${A}/empresa/cambiar`, {
          origen,
          cuerpo: { empresa: "empresa-b" },
        })
      ).estado === 403,
    );
  }
  comprobar(
    "un GET a la ruta de cambio no hace nada (405)",
    (await enviar("consultor", `${A}/empresa/cambiar`, { metodo: "GET" }))
      .estado === 405,
  );
  const porB = await enviar("adminB", `${A}/empresa/cambiar`, {
    cuerpo: { empresa: "empresa-a" },
  });
  comprobar(
    "AISLAMIENTO: B usando la ruta de A para cambiar recibe 404",
    porB.estado === 404,
    `respuesta ${porB.estado}`,
  );
  const sinSesion = await enviarWeb(
    entorno,
    `${A}/empresa/cambiar`,
    new Map(),
    { cuerpo: { empresa: "empresa-b" } },
  );
  comprobar(
    "sin sesión, cambiar lleva a ingresar",
    sinSesion.estado === 303 &&
      (sinSesion.destino ?? "").startsWith("/auth/login"),
  );
  comprobar(
    "lo anterior no movió al consultor: sigue en A",
    (await ver("consultor", `${A}/panel`)).estado === 200 &&
      (await ver("consultor", `${B}/panel`)).estado === 404,
  );

  // ---- Cambiar de A a B
  const c1 = await cambiar("consultor", A, "empresa-b");
  comprobar(
    "el consultor cambia a Empresa B: lo lleva al panel de B",
    c1.estado === 303 && c1.destino === `${B}/panel`,
    c1.destino ?? "",
  );
  const pB = await ver("consultor", `${B}/panel`);
  comprobar(
    "el panel de B responde 200 y ahora el selector ofrece volver a Empresa A",
    pB.estado === 200 &&
      CAMBIAR(B).test(pB.texto) &&
      pB.texto.includes("Empresa A (prueba)") &&
      !/<option[^>]*value="empresa-b"/.test(pB.texto),
  );
  const vieja = await ver("consultor", `${A}/panel`);
  comprobar(
    "en esa sesión la empresa anterior (A) ya no responde: 404",
    vieja.estado === 404,
    `respuesta ${vieja.estado}`,
  );

  // ---- En B manda el rol que tiene en B (colaborador), no el de A (administrador)
  const nB = await ver("consultor", `${B}/normas`);
  comprobar(
    "en B el consultor es solo colaborador: NO ve el formulario de subir librerías",
    nB.estado === 200 &&
      !nB.texto.includes("/normas/subir") &&
      nB.texto.includes(SOLO_ADMIN),
  );
  const subirEnB = await enviar("consultor", `${B}/normas/subir`, {
    cuerpo: {},
  });
  comprobar(
    "…y si intenta subir por otra vía, la API lo rechaza por su rol en B (el rol de A no cuenta)",
    subirEnB.estado === 303 || subirEnB.estado === 409,
    `respuesta ${subirEnB.estado}`,
  );
  const dB = await ver("consultor", `${B}/declaracion`);
  comprobar(
    "en B tampoco puede aprobar la declaración (rol de colaborador)",
    dB.estado === 200 && !dB.texto.includes("/declaracion/aprobar"),
  );
  const dA = await ver("adminA", `${A}/declaracion`);
  comprobar(
    "mientras que el administrador de A sí lo ve (control: el rol se evalúa por empresa)",
    dA.estado === 200 && dA.texto.includes("/declaracion/aprobar"),
  );

  // ---- Los datos son los de B, y solo los de B
  const librosVistos = nombresDeLibrerias(nB.texto);
  comprobar(
    "AISLAMIENTO: en B el consultor ve EXACTAMENTE lo mismo que el administrador de B",
    JSON.stringify(librosVistos) === JSON.stringify(librosDeB),
    `${librosVistos.length} vs ${librosDeB.length}`,
  );
  comprobar(
    "AISLAMIENTO: no aparece ninguna librería propia de A",
    soloDeA.every((n) => !librosVistos.includes(n)),
    soloDeA.join(", "),
  );
  const rB = await ver("consultor", `${B}/requisitos`);
  const rAdminB = await ver("adminB", `${B}/requisitos`);
  comprobar(
    "AISLAMIENTO: los requisitos que ve en B son los de B",
    rB.estado === 200 &&
      rB.texto.length > 0 &&
      JSON.stringify(
        [...rB.texto.matchAll(/ha-[a-z0-9.-]+/g)].map((m) => m[0]).sort(),
      ) ===
        JSON.stringify(
          [...rAdminB.texto.matchAll(/ha-[a-z0-9.-]+/g)]
            .map((m) => m[0])
            .sort(),
        ),
  );

  // ---- Otra sesión de la misma cuenta no se entera
  const o2A = await ver("consultor2", `${A}/panel`);
  const o2B = await ver("consultor2", `${B}/panel`);
  comprobar(
    "el cambio vale solo para ESA sesión: otra sesión del consultor sigue en A",
    o2A.estado === 200 && o2B.estado === 404,
    `A ${o2A.estado} / B ${o2B.estado}`,
  );
  comprobar(
    "la sesión de otra persona (admin de B) no se movió",
    (await ver("adminB", `${B}/panel`)).estado === 200 &&
      (await ver("adminB", `${A}/panel`)).estado === 404,
  );

  // ---- Volver a A
  const c2 = await cambiar("consultor", B, "empresa-a");
  comprobar(
    "el consultor vuelve a Empresa A",
    c2.estado === 303 && c2.destino === `${A}/panel`,
    c2.destino ?? "",
  );
  const nA2 = await ver("consultor", `${A}/normas`);
  comprobar(
    "en A vuelve a ser administrador (ve el formulario) y B ya no responde en esa sesión",
    nA2.estado === 200 &&
      nA2.texto.includes("/normas/subir") &&
      (await ver("consultor", `${B}/panel`)).estado === 404,
  );
  const c3 = await cambiar("consultor", A, "empresa-b");
  comprobar(
    "puede volver a cambiar a B cuantas veces quiera",
    c3.estado === 303 && c3.destino === `${B}/panel`,
  );
  // Se deja la sesión del consultor en su empresa de origen.
  await cambiar("consultor", B, "empresa-a");
} catch (error) {
  fallos += 1;
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
}
if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exitCode = 1;
} else
  console.log(
    "\nTodo correcto: una cuenta pertenece a varias empresas, cambia entre ellas, y en cada una mandan SUS datos y SU rol, sin que una sesión afecte a otra.",
  );
