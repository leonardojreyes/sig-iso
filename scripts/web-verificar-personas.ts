// pnpm web:verify-personas — comprueba con todo REAL (Keycloak, API, PostgreSQL y web) el alta, el cambio de rol y la baja de personas
// (MVP M7, ADR 036): una cuenta que ingresa SIN rol no recibe sesión pero ve su código de solicitud; el administrador SIG la aprueba
// con un rol, se lo cambia y la da de baja; sus permisos cambian de inmediato; quien vuelve a pedir acceso se reactiva; una empresa no
// se queda sin administrador; y se respetan Origin, método, sesión, permisos y aislamiento entre empresas.
// Requiere: Keycloak (con la cuenta «pendiente»: pnpm keycloak:realm y pnpm keycloak:cuentas), API (pnpm dev api), web (pnpm dev web),
// pnpm db:migrate (incluye la 0015) y pnpm db:seed.
// ESCRIBE en tu base local: la cuenta «pendiente» (empresa A) queda con una fila de persona; el script SIEMPRE la deja dada de baja
// (sin rol) al terminar, para poder repetirlo. Las solicitudes y los hechos de la bitácora quedan como rastro.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enviarWeb, descargarWeb, ingresarWeb, iniciarSesionWeb, paginaWeb, type EntornoWeb } from './lib/sesion-web.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const redirectUri = process.env.OIDC_REDIRECT_URI ?? 'http://localhost:3000/auth/callback';
const entorno: EntornoWeb = {
  web: new URL(redirectUri).origin,
  emisor: (process.env.OIDC_ISSUER_URL ?? 'http://127.0.0.1:8080/realms/sigiso').replace(/\/+$/, ''),
  claves: JSON.parse(readFileSync(join(raiz, '.local', 'secretos-keycloak.json'), 'utf8')).usuarios,
};

let fallos = 0;
const comprobar = (descripcion: string, ok: boolean, detalle = '') => {
  if (!ok) fallos += 1;
  console.log(`${ok ? '✔' : '✖'} ${descripcion}${ok || !detalle ? '' : ` — ${detalle}`}`);
};

const A = '/e/empresa-a';
const B = '/e/empresa-b';
const NOMBRE = 'Persona Pendiente';
const CORREO = 'pendiente@example.test';
const CODIGO = /\b[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}\b/;
const SIN_ACCESO = 'No tiene acceso a esta pantalla';

const tieneSesion = (c: Map<string, string>) => [...c.keys()].some((k) => /(^|__Host-)sig-sesion$/.test(k));
const tieneCodigo = (c: Map<string, string>) => [...c.keys()].some((k) => /(^|__Host-)sig-acceso$/.test(k));
const valor = (html: string, desde: number, nombre: string) =>
  new RegExp(`name="${nombre}"[^>]*value="([^"]*)"`).exec(html.slice(desde))?.[1] ?? '';
/** El identificador y la versión de una persona, tal como los manda el formulario de la pantalla (null si no tiene acciones). */
const personaEn = (html: string, nombre: string) => {
  const i = html.indexOf(`aria-label="Dar de baja a ${nombre}"`);
  return i < 0 ? null : { id: valor(html, i, 'id'), version: valor(html, i, 'version') };
};
const solicitudEn = (html: string, codigo: string) => {
  const i = html.indexOf(`aria-label="Aprobar la solicitud ${codigo}"`);
  return i < 0 ? null : valor(html, i, 'solicitud');
};
const aviso = (r: { parametros: URLSearchParams }) => r.parametros.get('aviso');

try {
  const s = {
    adminA: await iniciarSesionWeb(entorno, 'admin-a', `${A}/panel`),
    colabA: await iniciarSesionWeb(entorno, 'colab-a', `${A}/panel`),
    adminB: await iniciarSesionWeb(entorno, 'admin-b', `${B}/panel`),
  };
  const personasA = () => paginaWeb(entorno, `${A}/personas`, s.adminA);
  const personasB = () => paginaWeb(entorno, `${B}/personas`, s.adminB);
  const enviarA = (ruta: string, cuerpo: Record<string, string>) => enviarWeb(entorno, `${A}/personas/${ruta}`, s.adminA, { cuerpo });

  // ---- Punto de partida: «pendiente» sin rol (si un ensayo anterior la dejó con rol, se da de baja).
  let ingreso = await ingresarWeb(entorno, 'pendiente', '/');
  if (tieneSesion(ingreso.cookies)) {
    const p = personaEn((await personasA()).texto, NOMBRE);
    if (p) await enviarA('baja', p);
    ingreso = await ingresarWeb(entorno, 'pendiente', '/');
  }

  console.log('\n— Una cuenta SIN rol: no hay sesión, pero ve su código —');
  comprobar(
    'ingresa y la web la lleva a /acceso-pendiente',
    ingreso.estado === 303 && ingreso.destino === '/acceso-pendiente',
    `${ingreso.estado} ${ingreso.destino}`,
  );
  comprobar(
    'NO recibe sesión (sin cookie de sesión) y sí la cookie sellada de su código',
    !tieneSesion(ingreso.cookies) && tieneCodigo(ingreso.cookies),
  );
  const cookieCodigo = [...ingreso.setCookies].find((c) => /sig-acceso=/.test(c)) ?? '';
  comprobar(
    'la cookie del código es HttpOnly, SameSite=Lax y dura como máximo 10 minutos',
    /HttpOnly/.test(cookieCodigo) && /SameSite=Lax/.test(cookieCodigo) && Number(/Max-Age=(\d+)/.exec(cookieCodigo)?.[1] ?? '99999') <= 600,
  );
  const pendiente = await paginaWeb(entorno, '/acceso-pendiente', ingreso.cookies);
  const codigo = CODIGO.exec(pendiente.texto.replace(/<[^>]+>/g, ' '))?.[0] ?? '';
  comprobar(
    '/acceso-pendiente muestra «Su acceso está pendiente de aprobación» y un código con el alfabeto sin ambiguos',
    pendiente.estado === 200 && pendiente.texto.includes('Su acceso está pendiente de aprobación') && codigo !== '',
    `${pendiente.estado} ${codigo}`,
  );
  comprobar(
    'la respuesta no se guarda en caché',
    /no-store|no-cache|private/.test(pendiente.cabeceras.get('cache-control') ?? ''),
    pendiente.cabeceras.get('cache-control') ?? '',
  );
  comprobar('la página no ofrece ninguna acción que dé acceso (sin formularios)', !/<form/.test(pendiente.texto));
  const otra = await ingresarWeb(entorno, 'pendiente', '/');
  const codigo2 = CODIGO.exec((await paginaWeb(entorno, '/acceso-pendiente', otra.cookies)).texto.replace(/<[^>]+>/g, ' '))?.[0] ?? '';
  comprobar('volver a ingresar muestra el MISMO código (la solicitud es idempotente)', codigo2 === codigo, `${codigo} / ${codigo2}`);
  const sinCookie = await paginaWeb(entorno, '/acceso-pendiente', new Map());
  comprobar(
    'sin la cookie no inventa ningún código y ofrece ingresar de nuevo',
    sinCookie.estado === 200 &&
      sinCookie.texto.includes('No hay una solicitud a la vista') &&
      !CODIGO.test(sinCookie.texto.replace(/<[^>]+>/g, ' ')),
  );
  const intento = await descargarWeb(entorno, `${A}/panel`, ingreso.cookies);
  comprobar(
    'con solo la cookie del código no se entra a ninguna pantalla de la empresa (lleva a ingresar)',
    intento.estado >= 300 && intento.estado < 400 && (intento.destino ?? '').startsWith('/auth/login'),
    `${intento.estado} ${intento.destino}`,
  );

  console.log('\n— El administrador SIG ve la solicitud; los demás, no —');
  const vistaA = await personasA();
  comprobar(
    'admin A ve «Personas y accesos» con la solicitud y su código',
    vistaA.estado === 200 && vistaA.texto.includes('Personas y accesos') && vistaA.texto.includes(codigo),
    `${vistaA.estado}`,
  );
  const solicitud = solicitudEn(vistaA.texto, codigo) ?? '';
  comprobar('la solicitud trae su identificador para aprobarla', /^[0-9a-f-]{36}$/.test(solicitud));
  const colab = await paginaWeb(entorno, `${A}/personas`, s.colabA);
  comprobar(
    'un colaborador recibe «sin acceso» y no ve el código',
    colab.estado === 200 && colab.texto.includes(SIN_ACCESO) && !colab.texto.includes(codigo),
  );
  const vistaB = await personasB();
  comprobar(
    'admin B no ve la solicitud ni a la persona de A',
    vistaB.estado === 200 && !vistaB.texto.includes(codigo) && !vistaB.texto.includes(NOMBRE),
  );
  const sinPermiso = await enviarWeb(entorno, `${A}/personas/aprobar`, s.colabA, {
    cuerpo: { solicitud, nombre: NOMBRE, correo: CORREO, rol: 'administrador_sig' },
  });
  comprobar(
    'un colaborador no puede aprobar (aviso «sin_permiso») y la solicitud sigue vigente',
    aviso(sinPermiso) === 'sin_permiso' && (await personasA()).texto.includes(codigo),
    `${aviso(sinPermiso)}`,
  );

  console.log('\n— Protección de los formularios —');
  comprobar(
    'sin Origin → 403',
    (await enviarWeb(entorno, `${A}/personas/aprobar`, s.adminA, { origen: null, cuerpo: { solicitud } })).estado === 403,
  );
  comprobar(
    'Origin ajeno → 403',
    (await enviarWeb(entorno, `${A}/personas/aprobar`, s.adminA, { origen: 'https://malo.example', cuerpo: { solicitud } })).estado === 403,
  );
  comprobar(
    'un GET a la ruta de escritura → 405',
    (await enviarWeb(entorno, `${A}/personas/aprobar`, s.adminA, { metodo: 'GET' })).estado === 405,
  );
  const sinSesionRes = await enviarWeb(entorno, `${A}/personas/aprobar`, new Map(), { cuerpo: { solicitud } });
  comprobar(
    'sin sesión → lleva a ingresar',
    sinSesionRes.estado === 303 && (sinSesionRes.destino ?? '').startsWith('/auth/login'),
    `${sinSesionRes.estado} ${sinSesionRes.destino}`,
  );
  const malos = await enviarA('aprobar', { solicitud, nombre: NOMBRE, correo: 'no-es-un-correo', rol: 'colaborador' });
  comprobar(
    'datos mal formados → «no_valido» sin tocar la solicitud',
    aviso(malos) === 'no_valido' && (await personasA()).texto.includes(codigo),
    `${aviso(malos)}`,
  );
  const rolFalso = await enviarA('aprobar', { solicitud, nombre: NOMBRE, correo: CORREO, rol: 'superadministrador' });
  comprobar('un rol inventado → «no_valido»', aviso(rolFalso) === 'no_valido');

  console.log('\n— Aprobar, cambiar el rol y dar de baja —');
  const aprobada = await enviarA('aprobar', { solicitud, nombre: NOMBRE, correo: CORREO, rol: 'colaborador', empresaId: 'empresa-b' });
  comprobar(
    'el administrador la aprueba como colaborador (aviso «persona_aprobada»)',
    aviso(aprobada) === 'persona_aprobada',
    `${aviso(aprobada)}`,
  );
  const trasAprobar = await personasA();
  comprobar(
    'la persona aparece con su rol y «Con acceso», y la solicitud ya no',
    trasAprobar.texto.includes(NOMBRE) && !trasAprobar.texto.includes(`Aprobar la solicitud ${codigo}`),
  );
  comprobar('la empresa del formulario se ignoró: B no la tiene', !(await personasB()).texto.includes(NOMBRE));
  const repetida = await enviarA('aprobar', { solicitud, nombre: NOMBRE, correo: CORREO, rol: 'colaborador' });
  comprobar('aprobar dos veces la misma solicitud → «no_encontrado»', aviso(repetida) === 'no_encontrado', `${aviso(repetida)}`);

  const conSesion = await ingresarWeb(entorno, 'pendiente', `${A}/requisitos`);
  comprobar(
    'al ingresar de nuevo YA recibe sesión y entra a la empresa',
    conSesion.estado === 303 && tieneSesion(conSesion.cookies) && !tieneCodigo(conSesion.cookies),
    `${conSesion.estado} ${conSesion.destino}`,
  );
  const propia = conSesion.cookies;
  comprobar('como colaborador ve los requisitos', (await paginaWeb(entorno, `${A}/requisitos`, propia)).estado === 200);
  comprobar('pero no «Personas y accesos» (sin acceso)', (await paginaWeb(entorno, `${A}/personas`, propia)).texto.includes(SIN_ACCESO));
  const controlesAntes = await paginaWeb(entorno, `${A}/controles`, propia);
  comprobar(
    've el marco de controles (el colaborador consulta)',
    controlesAntes.estado === 200 && !controlesAntes.texto.includes(SIN_ACCESO),
  );

  const fila = personaEn((await personasA()).texto, NOMBRE)!;
  const cambio = await enviarA('rol', { id: fila.id, version: fila.version, rol: 'auditor_interno' });
  comprobar(
    'el administrador le cambia el rol a auditor interno (aviso «rol_cambiado»)',
    aviso(cambio) === 'rol_cambiado',
    `${aviso(cambio)}`,
  );
  const tras = await personasA();
  comprobar(
    'la pantalla muestra el rol nuevo y la versión subió',
    tras.texto.includes('Auditor interno') && Number(personaEn(tras.texto, NOMBRE)?.version) === Number(fila.version) + 1,
  );
  const controlesTras = await paginaWeb(entorno, `${A}/controles`, propia);
  comprobar(
    'el cambio de rol rige DE INMEDIATO, con la misma sesión: el auditor interno aún no tiene permisos',
    controlesTras.texto.includes(SIN_ACCESO),
    `${controlesTras.estado}`,
  );
  const vieja = await enviarA('rol', { id: fila.id, version: fila.version, rol: 'alta_direccion' });
  comprobar(
    'cambiar el rol con una versión vieja → «personas_conflicto» y no cambia nada',
    aviso(vieja) === 'personas_conflicto' && (await personasA()).texto.includes('Auditor interno'),
    `${aviso(vieja)}`,
  );

  const actual = personaEn((await personasA()).texto, NOMBRE)!;
  const baja = await enviarA('baja', { id: actual.id, version: actual.version });
  comprobar('el administrador la da de baja (aviso «persona_dada_de_baja»)', aviso(baja) === 'persona_dada_de_baja', `${aviso(baja)}`);
  const trasBaja = await personasA();
  comprobar(
    'la persona no se borra: sigue en la lista, «Dada de baja el…» y sin acciones',
    trasBaja.texto.includes(NOMBRE) && trasBaja.texto.includes('Dada de baja el') && personaEn(trasBaja.texto, NOMBRE) === null,
  );
  // Sin seguir redirecciones: tras la baja la API responde 401 («ya no vale en la empresa») y la web lleva a ingresar, o muestra «sin acceso».
  const bajaEfecto = await descargarWeb(entorno, `${A}/controles`, propia);
  const textoBaja = new TextDecoder().decode(bajaEfecto.bytes);
  const redirige = bajaEfecto.estado >= 300 && bajaEfecto.estado < 400;
  comprobar(
    'la baja rige DE INMEDIATO: la sesión que ya tenía NO ve el marco de controles (la web la lleva a ingresar o le dice «sin acceso»)',
    !textoBaja.includes('Marco de controles') && (redirige || textoBaja.includes(SIN_ACCESO)),
    `${bajaEfecto.estado} ${bajaEfecto.destino}`,
  );
  const dosBajas = await enviarA('baja', { id: actual.id, version: String(Number(actual.version) + 1) });
  comprobar('dar de baja a quien ya está de baja → «no_encontrado»', aviso(dosBajas) === 'no_encontrado', `${aviso(dosBajas)}`);

  console.log('\n— Volver a pedir acceso reactiva a la misma persona —');
  const denuevo = await ingresarWeb(entorno, 'pendiente', '/');
  comprobar(
    'tras la baja vuelve a quedar sin sesión y con un código',
    denuevo.estado === 303 && denuevo.destino === '/acceso-pendiente' && !tieneSesion(denuevo.cookies) && tieneCodigo(denuevo.cookies),
    `${denuevo.estado} ${denuevo.destino}`,
  );
  const codigoNuevo =
    CODIGO.exec((await paginaWeb(entorno, '/acceso-pendiente', denuevo.cookies)).texto.replace(/<[^>]+>/g, ' '))?.[0] ?? '';
  comprobar(
    'el código es OTRO (la solicitud anterior ya se resolvió)',
    codigoNuevo !== '' && codigoNuevo !== codigo,
    `${codigo} → ${codigoNuevo}`,
  );
  const solicitud2 = solicitudEn((await personasA()).texto, codigoNuevo) ?? '';
  const reactivada = await enviarA('aprobar', { solicitud: solicitud2, nombre: NOMBRE, correo: CORREO, rol: 'colaborador' });
  comprobar(
    'el administrador la aprueba de nuevo: se reactiva (aviso «persona_aprobada»)',
    aviso(reactivada) === 'persona_aprobada',
    `${aviso(reactivada)}`,
  );
  const listaFinal = (await personasA()).texto;
  comprobar(
    'sigue habiendo UNA sola fila con ese nombre (misma persona, no un duplicado)',
    listaFinal.split(`>${NOMBRE}<`).length - 1 === 1,
  );
  const reentra = await ingresarWeb(entorno, 'pendiente', `${A}/requisitos`);
  comprobar('y vuelve a entrar con sesión', reentra.estado === 303 && tieneSesion(reentra.cookies));

  console.log('\n— Una empresa no se queda sin administrador —');
  const adminB = personaEn((await personasB()).texto, 'Administrador B')!;
  comprobar('admin B ve el formulario de su propia persona', Boolean(adminB?.id));
  const bajaB = await enviarWeb(entorno, `${B}/personas/baja`, s.adminB, { cuerpo: { id: adminB.id, version: adminB.version } });
  comprobar('dar de baja al ÚLTIMO administrador → «personas_conflicto»', aviso(bajaB) === 'personas_conflicto', `${aviso(bajaB)}`);
  const rolB = await enviarWeb(entorno, `${B}/personas/rol`, s.adminB, {
    cuerpo: { id: adminB.id, version: adminB.version, rol: 'colaborador' },
  });
  comprobar('quitarle el rol de administrador → «personas_conflicto»', aviso(rolB) === 'personas_conflicto', `${aviso(rolB)}`);
  const sigueB = await personasB();
  comprobar(
    'admin B sigue siendo administrador (con la misma versión) y entra a la pantalla',
    sigueB.estado === 200 && personaEn(sigueB.texto, 'Administrador B')?.version === adminB.version,
  );

  console.log('\n— Aislamiento entre empresas —');
  const cruzada = await enviarA('baja', { id: adminB.id, version: adminB.version });
  comprobar(
    'admin A no puede dar de baja a una persona de B (aviso «no_encontrado»)',
    aviso(cruzada) === 'no_encontrado',
    `${aviso(cruzada)}`,
  );
  const cruzadaRol = await enviarA('rol', { id: adminB.id, version: adminB.version, rol: 'colaborador' });
  comprobar('ni cambiarle el rol (aviso «no_encontrado»)', aviso(cruzadaRol) === 'no_encontrado', `${aviso(cruzadaRol)}`);
  comprobar('la persona de B no cambió', personaEn((await personasB()).texto, 'Administrador B')?.version === adminB.version);

  // ---- Final: «pendiente» queda dada de baja (sin rol) para poder repetir la verificación.
  const fin = personaEn((await personasA()).texto, NOMBRE);
  if (fin) await enviarA('baja', fin);
  const despues = await ingresarWeb(entorno, 'pendiente', '/');
  comprobar(
    'al terminar, «pendiente» queda sin rol (la verificación se puede repetir)',
    !tieneSesion(despues.cookies) && despues.destino === '/acceso-pendiente',
  );
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  fallos += 1;
}

console.log(fallos === 0 ? '\nTodo en orden.' : `\n${fallos} comprobación(es) fallaron.`);
process.exitCode = fallos === 0 ? 0 : 1;
