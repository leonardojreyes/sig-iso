// pnpm web:verify-marca — comprueba con todo REAL (Keycloak, API, PostgreSQL y web) que la empresa edita su marca (MVP M6b-2): la
// pantalla «Marca», cambiar el color y el logo, que se vea en toda la aplicación, el aviso cuando el color no cumple el contraste AA,
// que lo inválido se rechace sin cambiar nada, permisos por rol, Origin, método, sesión y aislamiento con la empresa B.
// Requiere: Keycloak, API (pnpm dev api), web (pnpm dev web), pnpm db:migrate (incluye la 0013) y pnpm db:seed.
// OJO: cambia temporalmente la marca de la empresa A en tu base de desarrollo y la RESTAURA al terminar (aunque falle una
// comprobación). La bitácora no se borra: queda `marca.cambiada` por cada cambio real.
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
  "Solo la persona con rol de administrador SIG puede cambiar la marca";
const LOGO_PRUEBA = "https://cdn.example.test/verif-logo.png";

/** El valor de un campo del formulario (sin depender del orden de los atributos). */
const valorDe = (html: string, nombre: string): string | null => {
  const etiqueta = new RegExp(`<input[^>]*name="${nombre}"[^>]*>`).exec(
    html,
  )?.[0];
  if (!etiqueta) return null;
  return /value="([^"]*)"/.exec(etiqueta)?.[1]?.replaceAll("&amp;", "&") ?? "";
};
/** El color primario que la empresa inyecta en el CSS de la página. */
const colorEnCss = (html: string): string | null =>
  /--sig-color-primary:\s*(#[0-9a-fA-F]{6})/.exec(html)?.[1]?.toLowerCase() ??
  null;

let sesionAdmin: Map<string, string> | undefined;
let original: { color: string; logo: string } | undefined;

try {
  const s = {
    adminA: await iniciarSesionWeb(entorno, "admin-a", `${A}/marca`),
    colabA: await iniciarSesionWeb(entorno, "colab-a", `${A}/marca`),
    adminB: await iniciarSesionWeb(entorno, "admin-b", `${B}/marca`),
  };
  sesionAdmin = s.adminA;
  type Quien = keyof typeof s;
  const ver = (quien: Quien, ruta: string) =>
    paginaWeb(entorno, ruta, s[quien]);
  const guardar = (
    quien: Quien,
    campos: Record<string, string> | null,
    o: { ruta?: string; origen?: string | null; metodo?: string } = {},
  ) =>
    enviarWeb(entorno, o.ruta ?? `${A}/marca/guardar`, s[quien], {
      ...(o.origen === undefined ? {} : { origen: o.origen }),
      ...(o.metodo ? { metodo: o.metodo } : {}),
      ...(campos ? { cuerpo: campos } : {}),
    });

  // ---- La pantalla
  const p0 = await ver("adminA", `${A}/marca`);
  comprobar(
    "el administrador abre «Marca»: 200 y sin caché",
    p0.estado === 200 &&
      /no-store/.test(p0.cabeceras.get("cache-control") ?? ""),
    `respuesta ${p0.estado}`,
  );
  comprobar(
    "la navegación ofrece «Marca» como página actual",
    /href="\/e\/empresa-a\/marca"[^>]*aria-current="page"/.test(p0.texto) ||
      /aria-current="page"[^>]*href="\/e\/empresa-a\/marca"/.test(p0.texto),
  );
  const f0 =
    /<form[^>]*action="\/e\/empresa-a\/marca\/guardar"[^>]*>/.exec(
      p0.texto,
    )?.[0] ?? "";
  comprobar(
    "el formulario va por POST a su ruta, con color y logo y sin campo de empresa",
    /method="post"/.test(f0) &&
      valorDe(p0.texto, "color") !== null &&
      valorDe(p0.texto, "logo") !== null &&
      !/name="(empresa|empresaId|empresa_id|tenant|nombre|slug)"/i.test(
        p0.texto,
      ),
  );
  original = {
    color: valorDe(p0.texto, "color") ?? "#0b5fff",
    logo: valorDe(p0.texto, "logo") ?? "",
  };
  console.log(
    `· marca de A al empezar: color ${original.color}, logo ${original.logo === "" ? "(ninguno)" : "configurado"} (se restaura al terminar)`,
  );

  const pColab = await ver("colabA", `${A}/marca`);
  comprobar(
    "el colaborador ve la marca pero NO el formulario",
    pColab.estado === 200 &&
      !pColab.texto.includes("/marca/guardar") &&
      pColab.texto.includes(SOLO_ADMIN),
  );
  const pB0 = await ver("adminB", `${B}/marca`);
  const colorB0 = valorDe(pB0.texto, "color");
  const cssB0 = colorEnCss((await ver("adminB", `${B}/panel`)).texto);
  comprobar(
    "AISLAMIENTO: la sesión de B pidiendo la marca de A recibe 404",
    (await ver("adminB", `${A}/marca`)).estado === 404,
  );

  // ---- Protecciones del envío (nada de esto debe cambiar la marca)
  const sinPermiso = await guardar("colabA", { color: "#112233", logo: "" });
  comprobar(
    "un colaborador que envía el formulario por otra vía recibe «sin permiso» (lo decide la API)",
    sinPermiso.estado === 303 &&
      sinPermiso.parametros.get("aviso") === "sin_permiso",
    sinPermiso.destino ?? "",
  );
  for (const [origen, nombre] of [
    [null, "sin Origin"],
    ["null", "con Origin «null»"],
    ["https://evil.example", "con Origin de otro sitio"],
  ] as const) {
    comprobar(
      `guardar ${nombre}: 403`,
      (await guardar("adminA", { color: "#112233", logo: "" }, { origen }))
        .estado === 403,
    );
  }
  comprobar(
    "un GET a la ruta de guardar no hace nada (405)",
    (await guardar("adminA", null, { metodo: "GET" })).estado === 405,
  );
  const porB = await guardar(
    "adminB",
    { color: "#112233", logo: "" },
    { ruta: `${A}/marca/guardar` },
  );
  comprobar(
    "AISLAMIENTO: B enviando el formulario a la ruta de A recibe 404",
    porB.estado === 404,
    `respuesta ${porB.estado}`,
  );
  const sinSesion = await enviarWeb(entorno, `${A}/marca/guardar`, new Map(), {
    cuerpo: { color: "#112233", logo: "" },
  });
  comprobar(
    "sin sesión, guardar lleva a ingresar",
    sinSesion.estado === 303 &&
      (sinSesion.destino ?? "").startsWith("/auth/login"),
  );
  for (const [nombre, campos] of [
    ["un color mal formado", { color: "rojo", logo: "" }],
    [
      "un logo con http",
      { color: "#112233", logo: "http://inseguro.example.test/x.png" },
    ],
    [
      "un logo con javascript:",
      { color: "#112233", logo: "javascript:alert(1)" },
    ],
    [
      "un logo que apunta a otro host con «//»",
      { color: "#112233", logo: "//evil.example.test/x.png" },
    ],
    [
      "un logo con credenciales",
      { color: "#112233", logo: "https://u:p@cdn.example.test/x.png" },
    ],
  ] as const) {
    const r = await guardar("adminA", campos);
    comprobar(
      `${nombre}: «no_valido» y no cambia nada`,
      r.estado === 303 && r.parametros.get("aviso") === "no_valido",
      r.destino ?? "",
    );
  }
  const pIntacta = await ver("adminA", `${A}/marca`);
  comprobar(
    "…y la marca de A sigue exactamente igual",
    valorDe(pIntacta.texto, "color") === original.color &&
      valorDe(pIntacta.texto, "logo") === original.logo,
  );

  // ---- Cambiar color y logo
  const ok = await guardar("adminA", { color: "#0E5C42", logo: LOGO_PRUEBA });
  comprobar(
    "el administrador guarda color y logo: aviso «guardada»",
    ok.estado === 303 &&
      ok.parametros.get("aviso") === "guardada" &&
      ok.destino?.startsWith(`${A}/marca`) === true,
    ok.destino ?? "",
  );
  const p1 = await ver("adminA", ok.destino ?? `${A}/marca`);
  comprobar(
    "la pantalla muestra «Marca guardada» y los valores nuevos",
    p1.texto.includes("Marca guardada") &&
      valorDe(p1.texto, "color") === "#0e5c42" &&
      valorDe(p1.texto, "logo") === LOGO_PRUEBA,
  );
  const panel1 = await ver("adminA", `${A}/panel`);
  comprobar(
    "el cambio se ve en TODA la aplicación: el color nuevo en el CSS de la empresa y el logo nuevo en la cabecera",
    colorEnCss(panel1.texto) === "#0e5c42" &&
      panel1.texto.includes(LOGO_PRUEBA) &&
      /referrerPolicy="no-referrer"|referrerpolicy="no-referrer"/i.test(
        panel1.texto,
      ),
    `color ${colorEnCss(panel1.texto)}`,
  );
  const colab1 = await ver("colabA", `${A}/panel`);
  comprobar(
    "las demás personas de la empresa también lo ven (colaborador)",
    colorEnCss(colab1.texto) === "#0e5c42" &&
      colab1.texto.includes(LOGO_PRUEBA),
  );
  comprobar(
    "un color que cumple el contraste no muestra aviso de ajuste",
    p1.texto.includes("Cumple el contraste mínimo (AA)") &&
      !p1.texto.includes("no tiene suficiente contraste"),
  );

  // ---- Aislamiento: lo de A no se ve en B
  const pB1 = await ver("adminB", `${B}/marca`);
  const panelB1 = await ver("adminB", `${B}/panel`);
  comprobar(
    "AISLAMIENTO: la marca de B no cambió (color, CSS ni logo)",
    valorDe(pB1.texto, "color") === colorB0 &&
      colorEnCss(panelB1.texto) === cssB0 &&
      !panelB1.texto.includes(LOGO_PRUEBA) &&
      !pB1.texto.includes(LOGO_PRUEBA),
  );

  // ---- Un color con poco contraste se aplica ajustado y se avisa
  const claro = await guardar("adminA", { color: "#ffe066", logo: "" });
  comprobar(
    "un color amarillo claro se guarda",
    claro.parametros.get("aviso") === "guardada",
  );
  const p2 = await ver("adminA", `${A}/marca`);
  comprobar(
    "la pantalla avisa que el color se ajustó para cumplir el contraste, y conserva el color elegido",
    p2.texto.includes("no tiene suficiente contraste") &&
      valorDe(p2.texto, "color") === "#ffe066",
  );
  const panel2 = await ver("adminA", `${A}/panel`);
  comprobar(
    "lo que se APLICA no es el amarillo claro (se ajustó) y el logo se quitó (monograma)",
    colorEnCss(panel2.texto) !== null &&
      colorEnCss(panel2.texto) !== "#ffe066" &&
      !panel2.texto.includes(LOGO_PRUEBA),
    `aplica ${colorEnCss(panel2.texto)}`,
  );
} catch (error) {
  fallos += 1;
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
} finally {
  // Se restaura la marca de A como estaba, pase lo que pase.
  if (sesionAdmin && original) {
    try {
      const r = await enviarWeb(entorno, `${A}/marca/guardar`, sesionAdmin, {
        cuerpo: { color: original.color, logo: original.logo },
      });
      const p = await paginaWeb(entorno, `${A}/marca`, sesionAdmin);
      const restaurada =
        r.parametros.get("aviso") === "guardada" &&
        valorDe(p.texto, "color") === original.color &&
        valorDe(p.texto, "logo") === original.logo;
      comprobar(
        "la marca de A quedó restaurada como estaba",
        restaurada,
        r.destino ?? "",
      );
    } catch (error) {
      fallos += 1;
      console.error(
        `✖ No se pudo restaurar la marca de A: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exitCode = 1;
} else
  console.log(
    "\nTodo correcto: la empresa edita su color y su logo, se ven en toda la aplicación, el contraste se cuida, y se respetan permisos y aislamiento.",
  );
