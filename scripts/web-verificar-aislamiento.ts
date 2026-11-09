// pnpm web:verify-aislamiento — prueba de aislamiento de extremo a extremo (tarea 12.4, pasos 4 y 5 del plan) con todo REAL:
// Keycloak, API, web y PostgreSQL. NO adopta ni modifica nada: solo lee, hace pedidos que deben fallar y prueba privilegios con
// sentencias que nunca tocan filas (`where false`). Los pedidos rechazados SÍ dejan hechos en la bitácora (acceso.denegado, etc.).
// Requiere: Keycloak, API (pnpm dev api), web (pnpm dev web), pnpm db:seed y pnpm libraries:load.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IntegridadKysely } from "@sig/auditoria";
import { conTenant, GestorPools, leerUrls } from "@sig/db";
import { sql, type RawBuilder, type Transaction } from "kysely";
import { crearEmpresaId } from "@sig/tenancy";
import { ingresarConCodigo } from "./lib/flujo-codigo.mjs";
import { DATOS_SIEMBRA, exigirBaseLocal } from "./lib/datos-siembra.js";
import {
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
const apiUrl = (process.env.API_URL ?? "http://127.0.0.1:3001").replace(
  /\/+$/,
  "",
);
const clienteId = process.env.OIDC_CLIENT_ID ?? "sigiso-web";
const clienteSecreto = process.env.OIDC_CLIENT_SECRET ?? "";

let fallos = 0;
const comprobar = (descripcion: string, ok: boolean, detalle = "") => {
  if (!ok) fallos += 1;
  console.log(
    `${ok ? "✔" : "✖"} ${descripcion}${ok || !detalle ? "" : ` — ${detalle}`}`,
  );
};
const aviso = (texto: string) => console.log(`· ${texto}`);
let brechas = 0;
const brecha = (texto: string) => {
  brechas += 1;
  console.log(`⚠ BRECHA CONOCIDA: ${texto}`);
};

const tokenDe = async (usuario: string) =>
  (
    await ingresarConCodigo({
      emisor: entorno.emisor,
      clienteId,
      clienteSecreto,
      redirectUri,
      usuario,
      clave: entorno.claves[usuario] ?? "",
    })
  ).tokens.access_token as string;

const llamar = async (ruta: string, token?: string, metodo = "GET") => {
  const r = await fetch(`${apiUrl}${ruta}`, {
    method: metodo,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const texto = await r.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    /* cuerpo no JSON */
  }
  return {
    estado: r.status,
    tipo: r.headers.get("content-type") ?? "",
    texto,
    json,
  };
};

/** Lo que debe ser idéntico entre un 404 «cruzado» y uno normal: estado, tipo de contenido y forma del problema. */
const firma404 = (r: Awaited<ReturnType<typeof llamar>>) =>
  JSON.stringify({
    e: r.estado,
    t: r.tipo,
    type: r.json.type,
    title: r.json.title,
    status: r.json.status,
  });

let pools: GestorPools | undefined;
try {
  const urls = leerUrls(process.env, ["owner", "app"], {});
  exigirBaseLocal(urls.owner!, process.env);
  pools = new GestorPools(urls, { max: 3 });
  const owner = pools.db("owner");
  const app = pools.db("app");

  // `empresa` aplica RLS incluso al rol dueño: los identificadores salen de los datos de siembra.
  const idA = DATOS_SIEMBRA.empresas.find((e) => e.slug === "empresa-a")?.id;
  const idB = DATOS_SIEMBRA.empresas.find((e) => e.slug === "empresa-b")?.id;
  if (!idA || !idB)
    throw new Error("Faltan las empresas de prueba en los datos de siembra.");
  const empresaA = crearEmpresaId(idA);

  // ---- Paso 4a: por URL, con la sesión web de A
  const sesionA = await iniciarSesionWeb(
    entorno,
    "admin-a",
    "/e/empresa-a/requisitos",
  );
  const sesionB = await iniciarSesionWeb(
    entorno,
    "admin-b",
    "/e/empresa-b/requisitos",
  );
  const aPideB = await paginaWeb(entorno, "/e/empresa-b/requisitos", sesionA);
  const bPideA = await paginaWeb(entorno, "/e/empresa-a/requisitos", sesionB);
  const aPideNadie = await paginaWeb(
    entorno,
    "/e/empresa-z/requisitos",
    sesionA,
  );
  comprobar(
    "POR URL: la sesión de A pidiendo /e/empresa-b/… recibe 404",
    aPideB.estado === 404,
    `respuesta ${aPideB.estado}`,
  );
  comprobar(
    "POR URL: la sesión de B pidiendo /e/empresa-a/… recibe 404",
    bPideA.estado === 404,
    `respuesta ${bPideA.estado}`,
  );
  // La página repite el slug de la URL y Next.js agrega un identificador aleatorio por petición (`__next_r`); se neutralizan
  // para comparar todo lo demás byte a byte.
  const sinSlug = (texto: string, slug: string) =>
    texto
      .replaceAll(slug, "«slug»")
      .replace(/__next_r="[^"]*"/g, '__next_r="«id»"');
  const textoCruzado = sinSlug(aPideB.texto, "empresa-b");
  const textoNadie = sinSlug(aPideNadie.texto, "empresa-z");
  const primeraDiferencia = [...textoCruzado].findIndex(
    (c, i) => c !== textoNadie[i],
  );
  comprobar(
    "POR URL: el 404 cruzado es indistinguible del de una empresa inexistente (mismo estado y mismo contenido, salvo el slug de la URL)",
    aPideB.estado === aPideNadie.estado && textoCruzado === textoNadie,
    primeraDiferencia < 0
      ? ""
      : `difiere desde el carácter ${primeraDiferencia}: «${textoCruzado.slice(Math.max(0, primeraDiferencia - 30), primeraDiferencia + 50)}» frente a «${textoNadie.slice(Math.max(0, primeraDiferencia - 30), primeraDiferencia + 50)}»`,
  );
  comprobar(
    "POR URL: el 404 cruzado no muestra datos de la otra empresa",
    !/Empresa B|Contexto de la organización/.test(aPideB.texto),
  );

  // ---- Paso 4b y 3: por la API, con el token de cada cuenta
  const tokenAdminA = await tokenDe("admin-a");
  const tokenColabA = await tokenDe("colab-a");
  const tokenAdminB = await tokenDe("admin-b");
  const inexistente = await llamar(
    "/requisitos/00000000-0000-4000-8000-000000000000",
    tokenAdminA,
  );
  comprobar(
    "POR API: A pidiendo una entrada inexistente recibe 404",
    inexistente.estado === 404,
    `respuesta ${inexistente.estado}`,
  );
  const listadoB = await llamar("/requisitos", tokenAdminB);
  const listadoA = await llamar("/requisitos", tokenAdminA);
  const entradasA = Array.isArray(listadoA.json)
    ? listadoA.json
    : ((listadoA.json.items as Array<{ id?: string }>) ?? []);
  const entradasB = Array.isArray(listadoB.json)
    ? listadoB.json
    : ((listadoB.json.items as unknown[]) ?? []);
  aviso(
    `entradas visibles por API: A ${entradasA.length}, B ${entradasB.length} (B no ha adoptado nada)`,
  );
  // Sin entradas visibles para A, «B ve 0» no probaría nada.
  comprobar(
    "POR API: A ve sus entradas adoptadas (control positivo del aislamiento)",
    listadoA.estado === 200 && entradasA.length > 0,
    `respuesta ${listadoA.estado}, ${entradasA.length} entradas`,
  );
  comprobar(
    "POR API: B no ve ninguna entrada de las que adoptó A",
    listadoB.estado === 200 && entradasB.length === 0,
    `respuesta ${listadoB.estado}, ${entradasB.length} entradas`,
  );
  // Cruce real: un id de entrada que A sí ve, pedido por B (que no adoptó esa librería), debe dar el mismo 404 que un id inexistente.
  const idEntradaDeA = (entradasA[0] as { id?: string } | undefined)?.id;
  if (idEntradaDeA) {
    const propia = await llamar(`/requisitos/${idEntradaDeA}`, tokenAdminA);
    const ajena = await llamar(`/requisitos/${idEntradaDeA}`, tokenAdminB);
    comprobar(
      "POR API: A sí obtiene su entrada por id (el id es real)",
      propia.estado === 200,
      `respuesta ${propia.estado}`,
    );
    comprobar(
      "POR API: B pidiendo por id una entrada que solo adoptó A recibe el mismo 404 que un id inexistente",
      ajena.estado === 404 && firma404(ajena) === firma404(inexistente),
      `respuesta ${ajena.estado}`,
    );
  } else comprobar("POR API: el listado de A trae ids de entrada", false);
  comprobar(
    "POR API: sin token → 401",
    (await llamar("/requisitos")).estado === 401,
  );
  comprobar(
    "POR API: token inválido → 401",
    (await llamar("/requisitos", "no.es.un.token")).estado === 401,
  );
  const colabAdopta = await llamar(
    "/librerias/00000000-0000-4000-8000-000000000000/adopcion",
    tokenColabA,
    "POST",
  );
  comprobar(
    "POR API: el colaborador intentando adoptar recibe 403 (antes de mirar el id)",
    colabAdopta.estado === 403,
    `respuesta ${colabAdopta.estado}`,
  );

  // ---- Paso 5: bitácora
  const hechos = await sql<{ accion: string; resultado: string; n: number }>`
    select accion, resultado, count(*)::int as n from bitacora group by 1, 2 order by 1, 2`.execute(
    owner,
  );
  const hay = (accion: string, resultado?: string) =>
    hechos.rows.some(
      (h) =>
        h.accion === accion &&
        (resultado === undefined || h.resultado === resultado) &&
        h.n > 0,
    );
  aviso(
    `hechos en la bitácora: ${hechos.rows.map((h) => `${h.accion}/${h.resultado}=${h.n}`).join(", ")}`,
  );
  comprobar(
    "BITÁCORA: hay ingresos correctos (login.ok)",
    hay("login.ok", "ok"),
  );
  comprobar(
    "BITÁCORA: hay adopciones correctas (libreria.adoptada)",
    hay("libreria.adoptada", "ok"),
  );
  comprobar(
    "BITÁCORA: el 403 del colaborador quedó registrado (acceso.denegado)",
    hay("acceso.denegado", "rechazado"),
  );
  if (hay("acceso.cruzado", "rechazado"))
    comprobar("BITÁCORA: hay hechos de acceso cruzado (acceso.cruzado)", true);
  else
    brecha(
      "el plan pide registrar el 404 cruzado (acceso.cruzado, H6.10), pero ningún código de producción lanza AccesoCruzadoException y el proxy de la web responde 404 sin escribir en la bitácora. Ver estado.md.",
    );
  if (!hay("login.fallido"))
    aviso(
      "sin login.fallido: el worker de intentos fallidos (11.2 y 11.3) está diferido a la Fase 1",
    );

  const problemas = await new IntegridadKysely(owner).verificar();
  comprobar(
    "BITÁCORA: la cadena de huellas de todas las empresas se verifica sin problemas",
    problemas.length === 0,
    JSON.stringify(problemas),
  );

  // La bitácora de A, vista con el rol de la aplicación y el contexto de A, no contiene filas de B (RLS).
  const deB = await conTenant(app, empresaA, (trx) =>
    sql<{
      n: number;
    }>`select count(*)::int as n from bitacora where empresa_id = ${idB}`.execute(
      trx,
    ),
  );
  const deA = await conTenant(app, empresaA, (trx) =>
    sql<{
      n: number;
    }>`select count(*)::int as n from bitacora where empresa_id = ${idA}`.execute(
      trx,
    ),
  );
  comprobar(
    "AISLAMIENTO: con el contexto de A, sigiso_app ve 0 hechos de B en la bitácora",
    (deB.rows[0]?.n ?? -1) === 0,
    `${deB.rows[0]?.n} filas`,
  );
  comprobar(
    "AISLAMIENTO: con el contexto de A, sigiso_app sí ve los hechos de A",
    (deA.rows[0]?.n ?? 0) > 0,
  );

  // Inmutabilidad. UPDATE y DELETE llevan `where false` (no tocan filas); el vaciado de la tabla no admite condición, así que
  // TODAS las sentencias corren dentro de una transacción que se revierte siempre: si alguna llegara a ejecutarse, se deshace.
  class Revertir extends Error {}
  const intentar = async (
    rol: "sigiso_app" | "sigiso_owner",
    consulta: RawBuilder<unknown>,
  ) => {
    try {
      const dentro = async (trx: Transaction<unknown>) => {
        await consulta.execute(trx);
        throw new Revertir("la sentencia se ejecutó (se revirtió)");
      };
      if (rol === "sigiso_app") await conTenant(app, empresaA, dentro);
      else await owner.transaction().execute(dentro);
      return null;
    } catch (e) {
      return e instanceof Revertir
        ? "EJECUTADA"
        : e instanceof Error
          ? e.message
          : String(e);
    }
  };
  for (const rol of ["sigiso_app", "sigiso_owner"] as const) {
    for (const [nombre, consulta] of [
      ["UPDATE", sql`update bitacora set motivo = motivo where false`],
      ["DELETE", sql`delete from bitacora where false`],
      ["TRUNCATE", sql`truncate bitacora`],
    ] as const) {
      const resultado = await intentar(rol, consulta);
      const fallo = resultado !== null && resultado !== "EJECUTADA";
      comprobar(
        `INMUTABLE: ${nombre} sobre la bitácora como ${rol} falla`,
        fallo,
        "la sentencia se ejecutó (y se revirtió)",
      );
      if (fallo)
        aviso(`${rol} ${nombre}: ${resultado.split("\n")[0]?.slice(0, 90)}`);
    }
  }
} catch (error) {
  fallos += 1;
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await pools?.cerrar();
}
if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exitCode = 1;
} else if (brechas > 0)
  console.log(
    `\nComprobaciones correctas, pero queda(n) ${brechas} brecha(s) conocida(s) abierta(s) (ver arriba): el corte no cumple todo lo que pide el plan.`,
  );
else
  console.log(
    "\nTodo correcto: aislamiento por URL y por API, bitácora encadenada e inmutable.",
  );
