// pnpm web:verify-controles — comprueba con todo REAL (Keycloak, API, PostgreSQL y web) el marco de controles (MVP M3, paso 5):
// crear, cambiar con concurrencia, relacionar con entradas de las normas (el marco unificado muestra qué normas cubre),
// quitar, retirar, permisos por rol, Origin y aislamiento con la empresa B.
// Requiere: Keycloak, API (pnpm dev api), web (pnpm dev web), pnpm db:migrate, pnpm db:seed y la librería cargada y ADOPTADA por A
// (pnpm libraries:load y, por ejemplo, pnpm web:verify-listado).
// OJO: escribe en tu base local de desarrollo (controles de A con el código «VERIF-…»). Un control no se borra: queda retirado.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enviarWeb, iniciarSesionWeb, paginaWeb, type EntornoWeb } from './lib/sesion-web.ts';

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

const MARCA = Date.now().toString(36).slice(-6).toUpperCase();
const CODIGO = `VERIF-${MARCA}`;
const NOMBRE = `Control de verificación ${MARCA}`;
const R = (accion: string) => `/e/empresa-a/controles/${accion}`;
const PAGINA = '/e/empresa-a/controles';

/** Valor de un campo oculto dentro del primer formulario cuya acción cumple el patrón, en la fila de `codigo`. */
const campo = (html: string, nombre: string): string | null =>
  new RegExp(`name="${nombre}"[^>]*value="([^"]*)"`).exec(html)?.[1] ?? new RegExp(`value="([^"]*)"[^>]*name="${nombre}"`).exec(html)?.[1] ?? null;
/** El trozo de HTML de la fila de un control (de su código al siguiente <tr>). */
const filaDe = (html: string, codigo: string): string => {
  const i = html.indexOf(`>${codigo}</span>`);
  if (i < 0) return '';
  const fin = html.indexOf('</tr>', i);
  return html.slice(Math.max(0, html.lastIndexOf('<tr', i)), fin < 0 ? undefined : fin);
};
const formulario = (html: string, accion: string): string => new RegExp(`<form[^>]*action="[^"]*/controles/${accion}"[^>]*>[\\s\\S]*?</form>`).exec(html)?.[0] ?? '';

try {
  const sesion = {
    adminA: await iniciarSesionWeb(entorno, 'admin-a', PAGINA),
    colabA: await iniciarSesionWeb(entorno, 'colab-a', PAGINA),
    adminB: await iniciarSesionWeb(entorno, 'admin-b', '/e/empresa-b/controles'),
  };
  const ver = (quien: keyof typeof sesion, ruta: string) => paginaWeb(entorno, ruta, sesion[quien]);
  const enviar = (quien: keyof typeof sesion, ruta: string, cuerpo: Record<string, string>, o: { origen?: string | null; metodo?: string } = {}) =>
    enviarWeb(entorno, ruta, sesion[quien], { cuerpo, ...o });

  // ---- Lo que se ve
  const p0 = await ver('adminA', PAGINA);
  comprobar('el administrador de A abre el marco de controles: 200 y sin caché', p0.estado === 200 && /no-store/.test(p0.cabeceras.get('cache-control') ?? ''), `respuesta ${p0.estado}`);
  comprobar('la navegación ofrece Controles', p0.texto.includes('href="/e/empresa-a/controles"'));
  comprobar('el administrador ve el formulario para crear', formulario(p0.texto, 'crear') !== '');
  comprobar('ningún formulario lleva un campo de empresa', !/name="(empresa|empresaId|empresa_id)"/.test(p0.texto));
  const colab0 = await ver('colabA', PAGINA);
  comprobar('el colaborador ve el marco (200) pero ningún formulario de gestión', colab0.estado === 200 && !/action="[^"]*\/controles\/(crear|cambiar|retirar|mapear|desmapear)"/.test(colab0.texto) && colab0.texto.includes('Solo el administrador SIG puede crear'));

  // ---- Crear
  const c1 = await enviar('adminA', R('crear'), { codigo: CODIGO, nombre: NOMBRE, descripcion: `${CODIGO} descripción` });
  comprobar('crear un control: 303 con aviso «creado»', c1.estado === 303 && c1.parametros.get('aviso') === 'creado', `respuesta ${c1.estado} ${c1.destino ?? ''}`);
  const p1 = await ver('adminA', c1.destino ?? PAGINA);
  comprobar('la pantalla muestra «Control creado», su código, su nombre y «Vigente»', p1.texto.includes('Control creado') && p1.texto.includes(CODIGO) && p1.texto.includes(NOMBRE) && filaDe(p1.texto, CODIGO).includes('Vigente'));
  const fila1 = filaDe(p1.texto, CODIGO);
  const id = campo(formulario(fila1, 'cambiar'), 'id');
  const version1 = campo(formulario(fila1, 'cambiar'), 'version');
  if (!id || !version1) throw new Error('No se encontró el control recién creado en la pantalla');
  aviso(`control ${CODIGO} (versión ${version1})`);
  const repetido = await enviar('adminA', R('crear'), { codigo: CODIGO, nombre: 'Otro nombre' });
  comprobar('el mismo código otra vez: aviso «conflicto»', repetido.estado === 303 && repetido.parametros.get('aviso') === 'conflicto', repetido.destino ?? '');
  const pRep = await ver('adminA', repetido.destino ?? PAGINA);
  comprobar('el aviso aclara que puede ser un código repetido y no se duplicó', pRep.texto.includes('el código ya exista') && pRep.texto.split(`>${CODIGO}</span>`).length === 2);

  // ---- Relacionar: una medida, varias normas (marco unificado)
  const opciones = [...formulario(fila1, 'mapear').matchAll(/<option value="([^"|]+\|[^"]+)">([^<]+)<\/option>/g)].map((m) => m[1]!);
  comprobar('el desplegable ofrece las entradas de las librerías adoptadas', opciones.length > 0, `${opciones.length} opción(es)`);
  const primera = opciones[0]!;
  const m1 = await enviar('adminA', R('mapear'), { id, entrada: primera });
  comprobar('relacionar con una entrada: aviso «mapeado»', m1.estado === 303 && m1.parametros.get('aviso') === 'mapeado', m1.destino ?? '');
  const p2 = await ver('adminA', m1.destino ?? PAGINA);
  const fila2 = filaDe(p2.texto, CODIGO);
  const idEntrada = primera.split('|')[1]!;
  comprobar('la entrada aparece relacionada y el control ya cubre al menos una norma', fila2.includes(idEntrada) && /<li><span[^>]*>(ISO[^<]+)<\/span><\/li>/.test(fila2), '');
  const otra = await enviar('adminA', R('mapear'), { id, entrada: primera });
  comprobar('relacionar de nuevo lo ya relacionado no es un error («No hubo cambios»)', otra.estado === 303 && otra.parametros.get('aviso') === 'sin_cambios');
  const falsa = await enviar('adminA', R('mapear'), { id, entrada: 'libreria-inexistente|zz-9' });
  comprobar('una entrada que la empresa no adoptó: aviso «no encontrado»', falsa.estado === 303 && falsa.parametros.get('aviso') === 'no_encontrado', falsa.destino ?? '');
  const filtrado = await ver('adminA', `${PAGINA}?norma=${encodeURIComponent('ISO 42001')}`);
  comprobar('filtrar por una norma que no alcanza: el control no aparece', filtrado.estado === 200 && !filtrado.texto.includes(`>${CODIGO}</span>`));
  const normasCubiertas = [...fila2.matchAll(/<li><span[^>]*>(ISO[^<]+)<\/span><\/li>/g)].map((m) => m[1]!);
  const conNorma = await ver('adminA', `${PAGINA}?norma=${encodeURIComponent(normasCubiertas[0] ?? 'ISO 9001')}`);
  comprobar('filtrar por una norma que sí alcanza: el control aparece', conNorma.texto.includes(`>${CODIGO}</span>`), normasCubiertas.join(', '));

  // ---- Cambiar con concurrencia
  const ca = await enviar('adminA', R('cambiar'), { id, version: version1, nombre: `${NOMBRE} v2`, descripcion: '' });
  comprobar('cambiar con la versión vista: aviso «guardado»', ca.estado === 303 && ca.parametros.get('aviso') === 'guardado', ca.destino ?? '');
  const p3 = await ver('adminA', ca.destino ?? PAGINA);
  const version2 = campo(formulario(filaDe(p3.texto, CODIGO), 'cambiar'), 'version');
  comprobar('la pantalla muestra el nombre nuevo y la versión subió', p3.texto.includes(`${NOMBRE} v2`) && Number(version2) === Number(version1) + 1, `${version1} → ${version2}`);
  const vieja = await enviar('adminA', R('cambiar'), { id, version: version1, nombre: `${NOMBRE} pisada` });
  comprobar('con la versión que ya cambió: aviso «conflicto» y no pisa lo guardado', vieja.estado === 303 && vieja.parametros.get('aviso') === 'conflicto' && !(await ver('adminA', PAGINA)).texto.includes('pisada'));

  // ---- Permisos por rol
  for (const [accion, cuerpo] of [['crear', { codigo: `${CODIGO}-C`, nombre: 'x' }], ['cambiar', { id, version: String(version2), nombre: `${NOMBRE} colab` }], ['mapear', { id, entrada: primera }], ['retirar', { id, version: String(version2) }]] as const) {
    const r = await enviar('colabA', R(accion), cuerpo);
    comprobar(`un colaborador que envía «${accion}» por otra vía recibe «sin permiso» (lo decide la API)`, r.estado === 303 && r.parametros.get('aviso') === 'sin_permiso', r.destino ?? '');
  }
  comprobar('lo del colaborador no cambió nada', !(await ver('adminA', PAGINA)).texto.includes('colab') && !(await ver('adminA', PAGINA)).texto.includes(`${CODIGO}-C`));

  // ---- Protecciones del formulario
  for (const [origen, nombre] of [[null, 'sin Origin'], ['null', 'con Origin «null»'], ['https://evil.example', 'con Origin de otro sitio']] as const) {
    const r = await enviar('adminA', R('crear'), { codigo: `${CODIGO}-X`, nombre: 'x' }, { origen });
    comprobar(`crear ${nombre}: 403`, r.estado === 403, `respuesta ${r.estado}`);
  }
  comprobar('un GET a una ruta de escritura no hace nada (405)', (await enviar('adminA', R('retirar'), {}, { metodo: 'GET' })).estado === 405);
  const sinSesion = await enviarWeb(entorno, R('crear'), new Map(), { cuerpo: { codigo: 'X', nombre: 'x' } });
  comprobar('sin sesión manda a ingresar', sinSesion.estado === 303 && (sinSesion.destino ?? '').startsWith('/auth/login'), `${sinSesion.estado} ${sinSesion.destino ?? ''}`);
  for (const [nombre, cuerpo] of [['identificador mal formado', { id: 'no-uuid', version: '1' }], ['versión inválida', { id, version: '0' }], ['sin versión', { id }]] as const) {
    const r = await enviar('adminA', R('retirar'), cuerpo);
    comprobar(`retirar con ${nombre}: aviso «no_valido» sin tocar nada`, r.estado === 303 && r.parametros.get('aviso') === 'no_valido', r.destino ?? '');
  }

  // ---- Quitar la relación
  const q = await enviar('adminA', R('desmapear'), { id, entrada: primera });
  comprobar('quitar la relación: aviso «desmapeado»', q.estado === 303 && q.parametros.get('aviso') === 'desmapeado', q.destino ?? '');
  const p4 = await ver('adminA', q.destino ?? PAGINA);
  comprobar('el control ya no muestra esa entrada y vuelve a «no cubre ninguna norma»', filaDe(p4.texto, CODIGO).includes('Sin entradas relacionadas') || !filaDe(p4.texto, CODIGO).includes(`>${idEntrada}</span>`));
  const q2 = await enviar('adminA', R('desmapear'), { id, entrada: primera });
  comprobar('quitar una relación que no existe: aviso «no encontrado»', q2.estado === 303 && q2.parametros.get('aviso') === 'no_encontrado', q2.destino ?? '');

  // ---- Aislamiento con B
  const bP = await ver('adminB', '/e/empresa-b/controles');
  comprobar('B abre su propio marco (200) sin nada de A', bP.estado === 200 && !bP.texto.includes(CODIGO) && !bP.texto.includes(NOMBRE));
  const cruzada = await ver('adminB', PAGINA);
  comprobar('AISLAMIENTO: la sesión de B pidiendo el marco de A recibe 404 sin datos', cruzada.estado === 404 && !cruzada.texto.includes(CODIGO), `respuesta ${cruzada.estado}`);
  for (const [accion, cuerpo] of [['crear', { codigo: `${CODIGO}-B`, nombre: 'x' }], ['cambiar', { id, version: String(version2), nombre: 'desde B' }], ['retirar', { id, version: String(version2) }], ['mapear', { id, entrada: primera }], ['desmapear', { id, entrada: primera }]] as const) {
    const r = await enviar('adminB', R(accion), cuerpo);
    comprobar(`AISLAMIENTO: B enviando «${accion}» a la ruta de A recibe 404 y no cambia nada`, r.estado === 404, `respuesta ${r.estado}`);
  }
  // Lo de B con la sesión de B: el control de A es inexistente para B (mismo resultado que un id inventado).
  const ajeno = await enviar('adminB', '/e/empresa-b/controles/retirar', { id, version: String(version2) });
  const inventado = await enviar('adminB', '/e/empresa-b/controles/retirar', { id: 'dddddddd-0000-4000-8000-000000000000', version: '1' });
  comprobar('AISLAMIENTO: un control de A es indistinguible de uno inexistente para B', ajeno.estado === 303 && ajeno.parametros.get('aviso') === 'no_encontrado' && inventado.parametros.get('aviso') === 'no_encontrado', `${ajeno.destino} / ${inventado.destino}`);

  // ---- Retirar (cierra el ciclo: el control de prueba queda retirado, no ensucia el marco)
  const ret = await enviar('adminA', R('retirar'), { id, version: String(version2) });
  comprobar('retirar el control: aviso «retirado»', ret.estado === 303 && ret.parametros.get('aviso') === 'retirado', ret.destino ?? '');
  const p5 = await ver('adminA', PAGINA);
  comprobar('el control retirado ya no aparece en el marco por omisión', !p5.texto.includes(`>${CODIGO}</span>`));
  const p6 = await ver('adminA', `${PAGINA}?retirados=true`);
  const fila6 = filaDe(p6.texto, CODIGO);
  comprobar('con «incluir retirados» aparece como Retirado, sin formularios para cambiarlo', fila6.includes('Retirado') && formulario(fila6, 'cambiar') === '' && formulario(fila6, 'mapear') === '');
  const otraVez = await enviar('adminA', R('retirar'), { id, version: String(Number(version2) + 1) });
  comprobar('retirar otra vez: aviso «conflicto»', otraVez.estado === 303 && otraVez.parametros.get('aviso') === 'conflicto', otraVez.destino ?? '');
  const mapRet = await enviar('adminA', R('mapear'), { id, entrada: primera });
  comprobar('un control retirado no recibe relaciones: aviso «conflicto»', mapRet.estado === 303 && mapRet.parametros.get('aviso') === 'conflicto', mapRet.destino ?? '');
  const reusar = await enviar('adminA', R('crear'), { codigo: CODIGO, nombre: 'Reutilizado' });
  comprobar('el código de un control retirado no se reutiliza', reusar.estado === 303 && reusar.parametros.get('aviso') === 'conflicto', reusar.destino ?? '');
} catch (error) {
  fallos += 1;
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
}
if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exitCode = 1;
} else console.log('\nTodo correcto: el marco de controles funciona de punta a punta y respeta permisos, concurrencia y aislamiento.');
