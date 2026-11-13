// pnpm web:verify-declaracion — comprueba con todo REAL (Keycloak, API, PostgreSQL y web) la Declaración de Aplicabilidad (MVP M5,
// paso 5): el borrador derivado, no poder aprobar con controles por decidir, aprobar (versión congelada que NO cambia aunque el
// diagnóstico cambie después), la numeración, la descarga en Word (un .docx de verdad, adjunto, con el rótulo de preliminar solo en el
// borrador), permisos por rol, Origin y aislamiento con la empresa B.
// Requiere: Keycloak, API (pnpm dev api), web (pnpm dev web), pnpm db:migrate, pnpm db:seed y la librería del Anexo A cargada y
// ADOPTADA por A (pnpm libraries:load y, por ejemplo, pnpm web:verify-listado).
// OJO: escribe en tu base local de desarrollo y NO se puede deshacer: si quedan controles del Anexo A sin evaluar, el script los evalúa
// como «Parcial» (con la marca «VERIF-») para poder aprobar, y crea versiones aprobadas de la declaración de A (nada se borra).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { descargarWeb, enviarWeb, iniciarSesionWeb, paginaWeb, type EntornoWeb } from './lib/sesion-web.ts';

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
const aviso = (texto: string) => console.log(`· ${texto}`);

const MARCA = `VERIF-${Date.now().toString(36)}`;
const A = '/e/empresa-a';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ID_FALSO = 'dddddddd-0000-4000-8000-000000000000';

/** Texto de `word/document.xml` de un .docx, leído por el directorio central del ZIP (solo para comprobar). */
const textoDelDocx = (zip: Uint8Array): string | null => {
  const b = Buffer.from(zip);
  let fin = -1;
  for (let i = b.length - 22; i >= 0; i--) if (b.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  if (fin < 0) return null;
  let p = b.readUInt32LE(fin + 16);
  for (let k = 0; k < b.readUInt16LE(fin + 10); k++) {
    const metodo = b.readUInt16LE(p + 10);
    const comp = b.readUInt32LE(p + 20);
    const ln = b.readUInt16LE(p + 28);
    const le = b.readUInt16LE(p + 30);
    const lc = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    if (b.toString('utf8', p + 46, p + 46 + ln) === 'word/document.xml') {
      const datos = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
      const crudo = b.subarray(datos, datos + comp);
      return (metodo === 0 ? crudo : inflateRawSync(crudo)).toString('utf8');
    }
    p += 46 + ln + le + lc;
  }
  return null;
};

const campo = (html: string, nombre: string): string | null =>
  new RegExp(`name="${nombre}"[^>]*value="([^"]*)"`).exec(html)?.[1] ?? new RegExp(`value="([^"]*)"[^>]*name="${nombre}"`).exec(html)?.[1] ?? null;
/** Filas de la tabla de la declaración: la entrada y lo que dice la fila. */
const filasDeclaracion = (html: string) =>
  html
    .split('<tr')
    .filter((f) => f.includes('class="font-mono"'))
    .map((f) => f.split('</tr>')[0] ?? f)
    .map((f) => ({ id: /class="font-mono">([^<]+)</.exec(f)?.[1] ?? '', porDecidir: f.includes('>Por decidir<'), texto: f }));
const formsEvaluar = (html: string) =>
  [...html.matchAll(/<form[^>]*action="\/e\/empresa-a\/diagnostico\/evaluar"[^>]*>([\s\S]*?)<\/form>/g)].map((m) => ({ libreriaCodigo: campo(m[1]!, 'libreriaCodigo') ?? '', idEstable: campo(m[1]!, 'idEstable') ?? '', version: campo(m[1]!, 'version') }));
const idsDeVersiones = (html: string) => [...html.matchAll(new RegExp(`href="/e/empresa-a/declaracion/versiones/(${UUID})"`, 'g'))].map((m) => m[1]!).filter((v, i, a) => a.indexOf(v) === i);

try {
  const sesion = {
    adminA: await iniciarSesionWeb(entorno, 'admin-a', `${A}/declaracion`),
    colabA: await iniciarSesionWeb(entorno, 'colab-a', `${A}/declaracion`),
    adminB: await iniciarSesionWeb(entorno, 'admin-b', '/e/empresa-b/declaracion'),
  };
  const ver = (quien: keyof typeof sesion, ruta: string) => paginaWeb(entorno, ruta, sesion[quien]);
  const enviar = (quien: keyof typeof sesion, ruta: string, o: { origen?: string | null; metodo?: string; cuerpo?: Record<string, string> } = {}) => enviarWeb(entorno, ruta, sesion[quien], o);
  const bajar = (quien: keyof typeof sesion, ruta: string) => descargarWeb(entorno, ruta, sesion[quien]);

  // ---- La pantalla del borrador
  const p0 = await ver('adminA', `${A}/declaracion`);
  comprobar('el administrador abre la declaración: 200 y sin caché', p0.estado === 200 && /no-store/.test(p0.cabeceras.get('cache-control') ?? ''), `respuesta ${p0.estado}`);
  comprobar('la navegación ofrece «Declaración» como página actual', /href="\/e\/empresa-a\/declaracion"[^>]*aria-current="page"/.test(p0.texto) || /aria-current="page"[^>]*href="\/e\/empresa-a\/declaracion"/.test(p0.texto));
  if (p0.texto.includes('No hay controles del Anexo A')) throw new Error('A no tiene el Anexo A de 27001 adoptado: ejecuta pnpm libraries:load y pnpm web:verify-listado primero');
  let filas = filasDeclaracion(p0.texto);
  aviso(`${filas.length} control(es) del Anexo A en la declaración; ${filas.filter((f) => f.porDecidir).length} por decidir`);
  comprobar('hay una fila por control, con su título y el rótulo de preliminar', filas.length > 0 && p0.texto.includes('Documento preliminar: todavía no está aprobado') && p0.texto.includes('Borrador de hoy'));
  comprobar('el administrador ve el formulario para aprobar, hacia su ruta y por POST', /<form[^>]*action="\/e\/empresa-a\/declaracion\/aprobar"/.test(p0.texto) && !/name="(empresa|empresaId|empresa_id)"/.test(p0.texto));
  const pColab = await ver('colabA', `${A}/declaracion`);
  comprobar('el colaborador ve la declaración pero NO el formulario de aprobar', pColab.estado === 200 && !pColab.texto.includes('/declaracion/aprobar') && pColab.texto.includes('Solo el administrador SIG puede aprobar'));
  const porB = await ver('adminB', `${A}/declaracion`);
  comprobar('AISLAMIENTO: la sesión de B pidiendo la declaración de A recibe 404', porB.estado === 404, `respuesta ${porB.estado}`);
  const propiaB = await ver('adminB', '/e/empresa-b/declaracion');
  comprobar('AISLAMIENTO: la declaración de B no menciona versiones de A', propiaB.estado === 200 && !idsDeVersiones(propiaB.texto).some((id) => p0.texto.includes(id)));
  const antes = idsDeVersiones(p0.texto);
  aviso(`versiones aprobadas antes de empezar: ${antes.length}`);

  // ---- Descargar el borrador (Word)
  const d0 = await bajar('adminA', `${A}/declaracion/documento`);
  comprobar('el borrador se descarga: 200, tipo Word y adjunto con nombre fijado por el servidor', d0.estado === 200 && d0.cabeceras.get('content-type') === DOCX && /^attachment; filename="declaracion-iso-iec-27001-borrador\.docx"/.test(d0.cabeceras.get('content-disposition') ?? ''), `${d0.estado} ${d0.cabeceras.get('content-type')} | ${d0.cabeceras.get('content-disposition')}`);
  comprobar('lleva las cabeceras de seguridad y ninguna lleva un token', d0.cabeceras.get('x-content-type-options') === 'nosniff' && /no-store/.test(d0.cabeceras.get('cache-control') ?? '') && d0.cabeceras.get('content-security-policy') === "default-src 'none'; sandbox" && ![...d0.cabeceras.values()].some((v) => /eyJ[A-Za-z0-9_-]{20,}/.test(v)));
  const xml0 = textoDelDocx(d0.bytes);
  comprobar('es un .docx de verdad (ZIP con word/document.xml) con el rótulo de PRELIMINAR y las filas', Buffer.from(d0.bytes.subarray(0, 2)).toString() === 'PK' && !!xml0 && xml0.includes('DOCUMENTO PRELIMINAR') && xml0.includes('Declaración de Aplicabilidad') && (filas[0] ? xml0.includes(filas[0].id) : false));
  comprobar('el colaborador también lo descarga', (await bajar('colabA', `${A}/declaracion/documento`)).estado === 200);
  const dB = await bajar('adminB', `${A}/declaracion/documento`);
  comprobar('AISLAMIENTO: B pidiendo el documento por la ruta de A recibe 404 y ningún documento', dB.estado === 404 && textoDelDocx(dB.bytes) === null, `respuesta ${dB.estado}`);
  const sinSesion = await descargarWeb(entorno, `${A}/declaracion/documento`, new Map());
  comprobar('sin sesión, la descarga lleva a ingresar y no entrega nada', (sinSesion.estado === 303 || sinSesion.estado === 307) && (sinSesion.destino ?? '').startsWith('/auth/login') && textoDelDocx(sinSesion.bytes) === null);
  comprobar('un POST a la ruta de descarga no hace nada (405)', (await enviar('adminA', `${A}/declaracion/documento`)).estado === 405);

  // ---- Aprobar sin poder: permisos, Origin y método
  const sinPermiso = await enviar('colabA', `${A}/declaracion/aprobar`);
  comprobar('un colaborador que envía «aprobar» por otra vía recibe «sin permiso» (lo decide la API)', sinPermiso.estado === 303 && sinPermiso.parametros.get('aviso') === 'sin_permiso', sinPermiso.destino ?? '');
  for (const [origen, nombre] of [[null, 'sin Origin'], ['null', 'con Origin «null»'], ['https://evil.example', 'con Origin de otro sitio']] as const) {
    comprobar(`aprobar ${nombre}: 403`, (await enviar('adminA', `${A}/declaracion/aprobar`, { origen })).estado === 403);
  }
  comprobar('un GET a la ruta de aprobar no hace nada (405)', (await enviar('adminA', `${A}/declaracion/aprobar`, { metodo: 'GET' })).estado === 405);
  const deB = await enviar('adminB', `${A}/declaracion/aprobar`);
  comprobar('AISLAMIENTO: B enviando «aprobar» a la ruta de A recibe 404 y no se crea nada', deB.estado === 404, `respuesta ${deB.estado}`);
  comprobar('sin sesión, aprobar lleva a ingresar', await (async () => { const r = await enviarWeb(entorno, `${A}/declaracion/aprobar`, new Map()); return r.estado === 303 && (r.destino ?? '').startsWith('/auth/login'); })());

  // ---- Con controles por decidir no se puede aprobar; después se completan
  const pendientes = filas.filter((f) => f.porDecidir);
  if (pendientes.length > 0) {
    comprobar('con controles por decidir, la pantalla lo avisa y «Aprobar» queda deshabilitado', p0.texto.includes('Todavía no se puede aprobar') && /<button[^>]*disabled[^>]*>Aprobar la declaración/.test(p0.texto));
    const r = await enviar('adminA', `${A}/declaracion/aprobar`);
    comprobar('aprobar de todos modos (por otra vía): aviso «declaracion_no_aprobada» y no se crea ninguna versión', r.estado === 303 && r.parametros.get('aviso') === 'declaracion_no_aprobada' && idsDeVersiones((await ver('adminA', `${A}/declaracion`)).texto).length === antes.length, r.destino ?? '');
    const diag = await ver('adminA', `${A}/diagnostico`);
    const forms = formsEvaluar(diag.texto);
    let hechas = 0;
    for (const f of pendientes) {
      const form = forms.find((x) => x.idEstable === f.id && !x.version);
      if (!form) continue;
      const e = await enviar('adminA', `${A}/diagnostico/evaluar`, { cuerpo: { libreriaCodigo: form.libreriaCodigo, idEstable: form.idEstable, estado: 'parcial', comentario: `${MARCA} para poder aprobar` } });
      if (e.estado === 303 && e.parametros.get('aviso') === 'evaluado') hechas += 1;
    }
    aviso(`se evaluaron ${hechas} de ${pendientes.length} controles como «Parcial»`);
    const p1 = await ver('adminA', `${A}/declaracion`);
    filas = filasDeclaracion(p1.texto);
    comprobar('tras evaluar todo, ya no queda nada por decidir y se puede aprobar', filas.every((f) => !f.porDecidir) && !p1.texto.includes('Todavía no se puede aprobar') && !/<button[^>]*disabled[^>]*>Aprobar la declaración/.test(p1.texto));
  } else aviso('no había controles por decidir: se omite la comprobación de «no se puede aprobar»');

  // ---- Aprobar
  const ap = await enviar('adminA', `${A}/declaracion/aprobar`);
  comprobar('aprobar: 303 con aviso «declaracion_aprobada»', ap.estado === 303 && ap.parametros.get('aviso') === 'declaracion_aprobada', `respuesta ${ap.estado} ${ap.destino ?? ''}`);
  const p2 = await ver('adminA', ap.destino ?? `${A}/declaracion`);
  comprobar('la pantalla muestra «Declaración aprobada»', p2.texto.includes('Declaración aprobada'));
  const despues = idsDeVersiones(p2.texto);
  const nueva = despues.find((id) => !antes.includes(id));
  comprobar('aparece UNA versión nueva en el historial', despues.length === antes.length + 1 && !!nueva, `${antes.length} → ${despues.length}`);
  if (!nueva) throw new Error('No se encontró la versión recién aprobada');
  const numero = Number(new RegExp(`Versión (\\d+)[\\s\\S]{0,400}versiones/${nueva}`).exec(p2.texto)?.[1] ?? NaN);
  comprobar(`la numeración es correlativa (esta es la versión ${Number.isFinite(numero) ? numero : '?'}, mayor que las anteriores)`, Number.isFinite(numero) && numero >= antes.length + 1);

  // ---- La versión congelada
  const v1 = await ver('adminA', `${A}/declaracion/versiones/${nueva}`);
  comprobar('la versión se abre: 200, sin caché, con su alcance, sus filas y el texto de «congelada»', v1.estado === 200 && /no-store/.test(v1.cabeceras.get('cache-control') ?? '') && v1.texto.includes('congelada') && filasDeclaracion(v1.texto).length === filas.length, `respuesta ${v1.estado}; ${filasDeclaracion(v1.texto).length} filas`);
  const dv = await bajar('colabA', `${A}/declaracion/versiones/${nueva}/documento`);
  comprobar(`el Word de la versión se descarga (colaborador): adjunto «…-v${numero}.docx»`, dv.estado === 200 && dv.cabeceras.get('content-type') === DOCX && new RegExp(`filename="declaracion-iso-iec-27001-v${numero}\\.docx"`).test(dv.cabeceras.get('content-disposition') ?? ''), `${dv.estado} | ${dv.cabeceras.get('content-disposition')}`);
  const xmlv = textoDelDocx(dv.bytes);
  comprobar('el documento de la versión NO lleva el rótulo de preliminar y dice su número', !!xmlv && !xmlv.includes('PRELIMINAR') && xmlv.includes(`Versión ${numero}, aprobada el`));
  comprobar('un identificador que no es UUID es 404 (pantalla y descarga)', (await ver('adminA', `${A}/declaracion/versiones/no-es-uuid`)).estado === 404 && (await bajar('adminA', `${A}/declaracion/versiones/no-es-uuid/documento`)).estado === 404);
  const inexistente = await bajar('adminA', `${A}/declaracion/versiones/${ID_FALSO}/documento`);
  comprobar('una versión inexistente: «no encontrado» y ningún documento', inexistente.estado === 303 && inexistente.parametros.get('aviso') === 'no_encontrado' && textoDelDocx(inexistente.bytes) === null, `${inexistente.estado} ${inexistente.destino ?? ''}`);
  comprobar('AISLAMIENTO: B no puede abrir la versión de A (404 por la ruta de A y por la suya)', (await ver('adminB', `${A}/declaracion/versiones/${nueva}`)).estado === 404 && (await ver('adminB', `/e/empresa-b/declaracion/versiones/${nueva}`)).estado === 404);
  const dvB = await bajar('adminB', `/e/empresa-b/declaracion/versiones/${nueva}/documento`);
  comprobar('AISLAMIENTO: B pidiendo el Word de la versión de A por su propia ruta recibe «no encontrado» y ningún documento', dvB.estado === 303 && dvB.parametros.get('aviso') === 'no_encontrado' && textoDelDocx(dvB.bytes) === null, `${dvB.estado} ${dvB.destino ?? ''}`);
  const dvB2 = await bajar('adminB', `${A}/declaracion/versiones/${nueva}/documento`);
  comprobar('AISLAMIENTO: lo mismo por la ruta de A (404)', dvB2.estado === 404 && textoDelDocx(dvB2.bytes) === null);

  // ---- La versión no cambia aunque el diagnóstico cambie después
  const elegida = filasDeclaracion(p2.texto).find((f) => f.texto.includes('>Aplica<'));
  if (elegida) {
    const diag = await ver('adminA', `${A}/diagnostico`);
    const form = formsEvaluar(diag.texto).find((x) => x.idEstable === elegida.id);
    const eraImplementado = elegida.texto.includes('Implementado');
    if (form?.version) {
      const nuevoEstado = eraImplementado ? 'parcial' : 'cumple';
      const cambio = await enviar('adminA', `${A}/diagnostico/evaluar`, { cuerpo: { libreriaCodigo: form.libreriaCodigo, idEstable: form.idEstable, estado: nuevoEstado, comentario: `${MARCA} cambio posterior`, version: form.version } });
      comprobar(`después de aprobar se cambia ${elegida.id} a «${nuevoEstado}»`, cambio.estado === 303 && cambio.parametros.get('aviso') === 'evaluado');
      const v1b = await ver('adminA', `${A}/declaracion/versiones/${nueva}`);
      // Se comparan las FILAS de la tabla (la página trae un identificador aleatorio de Next que cambia en cada carga).
      const tabla = (html: string) => filasDeclaracion(html).map((f) => f.texto).join('');
      comprobar('LA VERSIÓN APROBADA NO CAMBIÓ: sus filas siguen siendo las que se aprobaron', tabla(v1b.texto) === tabla(v1.texto) && tabla(v1.texto).length > 0);
      const p3 = await ver('adminA', `${A}/declaracion`);
      const fHoy = filasDeclaracion(p3.texto).find((f) => f.id === elegida.id);
      comprobar('el borrador de hoy sí refleja el cambio', !!fHoy && fHoy.texto.includes('Implementado') === !eraImplementado);
      const dvDespues = textoDelDocx((await bajar('adminA', `${A}/declaracion/versiones/${nueva}/documento`)).bytes);
      comprobar('el Word de la versión tampoco cambió (sale de la copia congelada)', !!dvDespues && !!xmlv && dvDespues.replace(/\d{4}-\d{2}-\d{2}/g, '') === xmlv.replace(/\d{4}-\d{2}-\d{2}/g, ''));
    } else aviso(`no se pudo ubicar el formulario de ${elegida.id} para cambiarlo: se omite la comprobación de que la versión no cambia`);
  }

  // ---- Una segunda aprobación crea la versión siguiente
  const ap2 = await enviar('adminA', `${A}/declaracion/aprobar`);
  const p4 = await ver('adminA', ap2.destino ?? `${A}/declaracion`);
  const finales = idsDeVersiones(p4.texto);
  comprobar('una segunda aprobación crea otra versión (la anterior sigue ahí)', ap2.parametros.get('aviso') === 'declaracion_aprobada' && finales.length === despues.length + 1 && finales.includes(nueva), `${despues.length} → ${finales.length}`);
} catch (error) {
  fallos += 1;
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
}
if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exitCode = 1;
} else console.log('\nTodo correcto: la declaración se deriva, se aprueba y se exporta de punta a punta, la versión aprobada no cambia y se respetan permisos y aislamiento.');
