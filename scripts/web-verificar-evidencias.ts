// pnpm web:verify-evidencias — comprueba con todo REAL (Keycloak, API, PostgreSQL, disco y web) las evidencias con archivo y la
// cobertura (MVP M4, paso 5): subir, descargar idéntico, rechazar archivos disfrazados, reemplazar, eliminar, permisos por rol, Origin,
// tamaños (incluida una subida de más de 10 MB, que Next truncaría sin su configuración) y aislamiento con la empresa B.
// Requiere: Keycloak, API (pnpm dev api), web (pnpm dev web), pnpm db:migrate, pnpm db:seed y la librería cargada y ADOPTADA por A
// (pnpm libraries:load y, por ejemplo, pnpm web:verify-listado).
// OJO: escribe en tu base local y en la carpeta de evidencias (EVIDENCIAS_DIR; por omisión ~/.sigiso/evidencias): unos 11 MB de archivos
// de prueba y un control «VERIF-…» que queda retirado. Las evidencias no se borran (ADR 032): quedan eliminadas o reemplazadas.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

const MARCA = Date.now().toString(36).slice(-6).toUpperCase();
const CODIGO = `VERIF-E${MARCA}`;
const A = '/e/empresa-a';
const texto = (s: string) => new TextEncoder().encode(s);

// ---- Archivos de prueba (válidos y disfrazados)
const pdf = (relleno = 0): Uint8Array => {
  const base = texto(`%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF ${MARCA}\n`);
  if (relleno === 0) return base;
  const b = new Uint8Array(base.length + relleno).fill(0x41);
  b.set(base);
  return b;
};
const png = (): Uint8Array => {
  const b = new Uint8Array(70);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  b[40] = MARCA.charCodeAt(0); // que cada ejecución tenga una huella distinta
  return b;
};
const ejecutable = (): Uint8Array => Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, ...new Array(200).fill(0)]);
const zip = (nombres: string[]): Uint8Array => {
  const locales: Buffer[] = [];
  const central: Buffer[] = [];
  let inicio = 0;
  for (const n of nombres) {
    const nombre = Buffer.from(n);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(nombre.length, 26);
    locales.push(local, nombre);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(nombre.length, 28);
    c.writeUInt32LE(inicio, 42);
    central.push(c, nombre);
    inicio += 30 + nombre.length;
  }
  const dir = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(nombres.length, 8);
  fin.writeUInt16LE(nombres.length, 10);
  fin.writeUInt32LE(dir.length, 12);
  fin.writeUInt32LE(inicio, 16);
  return new Uint8Array(Buffer.concat([...locales, dir, fin]));
};

const formulario = (campos: Record<string, string>, archivo?: { bytes: Uint8Array; nombre: string }, archivoPrimero = false) => {
  const f = new FormData();
  const añadir = () => archivo && f.append('archivo', new Blob([archivo.bytes as BlobPart]), archivo.nombre);
  if (archivoPrimero) añadir();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  if (!archivoPrimero) añadir();
  return f;
};
const campo = (html: string, nombre: string): string | null =>
  new RegExp(`name="${nombre}"[^>]*value="([^"]*)"`).exec(html)?.[1] ?? new RegExp(`value="([^"]*)"[^>]*name="${nombre}"`).exec(html)?.[1] ?? null;
const filaDe = (html: string, codigo: string): string => {
  const i = html.indexOf(`>${codigo}</span>`);
  if (i < 0) return '';
  const fin = html.indexOf('</tr>', i);
  return html.slice(Math.max(0, html.lastIndexOf('<tr', i)), fin < 0 ? undefined : fin);
};
const formularioDe = (html: string, accion: string): string => new RegExp(`<form[^>]*action="[^"]*${accion}"[^>]*>[\\s\\S]*?</form>`).exec(html)?.[0] ?? '';

try {
  const sesion = {
    adminA: await iniciarSesionWeb(entorno, 'admin-a', `${A}/controles`),
    colabA: await iniciarSesionWeb(entorno, 'colab-a', `${A}/controles`),
    adminB: await iniciarSesionWeb(entorno, 'admin-b', '/e/empresa-b/controles'),
  };
  const ver = (quien: keyof typeof sesion, ruta: string) => paginaWeb(entorno, ruta, sesion[quien]);
  const enviar = (quien: keyof typeof sesion, ruta: string, o: Parameters<typeof enviarWeb>[3] = {}) => enviarWeb(entorno, ruta, sesion[quien], o);
  const bajar = (quien: keyof typeof sesion, ruta: string) => descargarWeb(entorno, ruta, sesion[quien]);

  // ---- Un control nuevo (vigente) con una entrada relacionada, para la cobertura
  const c0 = await enviar('adminA', `${A}/controles/crear`, { cuerpo: { codigo: CODIGO, nombre: `Control de evidencias ${MARCA}` } });
  comprobar('se crea un control de prueba', c0.estado === 303 && c0.parametros.get('aviso') === 'creado', `respuesta ${c0.estado} ${c0.destino ?? ''}`);
  const lista = await ver('adminA', `${A}/controles`);
  const fila = filaDe(lista.texto, CODIGO);
  const idControl = campo(formularioDe(fila, '/controles/cambiar'), 'id');
  if (!idControl) throw new Error('No se encontró el control recién creado');
  aviso(`control ${CODIGO} (${idControl})`);
  comprobar('la lista de controles enlaza a las evidencias de cada control', lista.texto.includes(`href="${A}/controles/${idControl}"`));
  const entrada = [...formularioDe(fila, '/controles/mapear').matchAll(/<option value="([^"|]+\|[^"]+)">/g)].map((m) => m[1]!)[0];
  if (!entrada) throw new Error('No hay entradas adoptadas para relacionar (pnpm libraries:load y adoptar una librería)');
  const idEntrada = entrada.split('|')[1]!;
  const m = await enviar('adminA', `${A}/controles/mapear`, { cuerpo: { id: idControl, entrada } });
  comprobar('se relaciona el control con una entrada de las normas', m.estado === 303 && m.parametros.get('aviso') === 'mapeado');

  const PAG = `${A}/controles/${idControl}`;
  const filaCobertura = async (quien: keyof typeof sesion = 'adminA') => {
    const html = (await ver(quien, `${A}/cobertura`)).texto;
    const i = html.indexOf(`>${idEntrada}</span>`);
    return i < 0 ? '' : html.slice(i, html.indexOf('</tr>', i));
  };

  // ---- La pantalla
  const p0 = await ver('adminA', PAG);
  comprobar('el administrador abre las evidencias del control: 200, sin caché, con el formulario de subida multipart', p0.estado === 200 && /no-store/.test(p0.cabeceras.get('cache-control') ?? '') && /enctype="multipart\/form-data"/i.test(formularioDe(p0.texto, '/evidencias/subir')), `respuesta ${p0.estado}; ${(p0.texto.match(/<form[^>]*subir[^>]*>/) ?? ['sin formulario de subida'])[0]}`);
  comprobar('sin evidencias aún dice que no hay', p0.texto.includes('Este control todavía no tiene evidencias'));
  const cobertura0 = await filaCobertura();
  comprobar('la cobertura de esa entrada empieza «Sin evidencia»', cobertura0.includes('Sin evidencia'), cobertura0.slice(0, 80));
  const pColab = await ver('colabA', PAG);
  comprobar('el colaborador también puede subir (formulario visible) pero no eliminar', pColab.estado === 200 && formularioDe(pColab.texto, '/evidencias/subir') !== '');
  const ajena = await ver('adminB', PAG);
  comprobar('AISLAMIENTO: la sesión de B pidiendo las evidencias de A recibe 404', ajena.estado === 404 && !ajena.texto.includes(CODIGO), `respuesta ${ajena.estado}`);
  const inexistente = await ver('adminA', `${A}/controles/dddddddd-0000-4000-8000-000000000000`);
  comprobar('un control inexistente es 404 (igual que el de otra empresa)', inexistente.estado === 404);
  comprobar('un identificador que no es UUID es 404', (await ver('adminA', `${A}/controles/no-es-uuid`)).estado === 404);

  // ---- Subir (vencida primero, para ver el estado «evidencia vencida»)
  const bytes1 = pdf();
  const s1 = await enviar('adminA', `${PAG}/evidencias/subir`, { formulario: formulario({ tipo: 'documento', titulo: `Política ${MARCA}`, fechaHecho: '2026-01-01', vigenteHasta: '2026-01-02' }, { bytes: bytes1, nombre: 'politica antigua.pdf' }) });
  comprobar('subir una evidencia: 303 con aviso «evidencia_subida»', s1.estado === 303 && s1.parametros.get('aviso') === 'evidencia_subida', `respuesta ${s1.estado} ${s1.destino ?? ''}`);
  const p1 = await ver('adminA', s1.destino ?? PAG);
  comprobar('la pantalla muestra «Evidencia subida», su título, su archivo y «Vencida» (su vigencia ya pasó)', p1.texto.includes('Evidencia subida') && p1.texto.includes(`Política ${MARCA}`) && p1.texto.includes('politica antigua.pdf') && p1.texto.includes('Vencida'));
  comprobar('muestra la huella SHA-256 completa del archivo', p1.texto.includes(sha(bytes1)));
  const id1 = /\/evidencias\/([0-9a-f-]{36})\/descargar/.exec(p1.texto)?.[1];
  if (!id1) throw new Error('No se encontró la evidencia recién subida');
  comprobar('la cobertura pasa a «Evidencia vencida» (hay evidencia, pero ya no está vigente)', (await filaCobertura()).includes('Evidencia vencida'));

  // ---- Descargar: idéntica, adjunta y sin filtrar el token
  const d1 = await bajar('adminA', `${A}/evidencias/${id1}/descargar`);
  comprobar('descargar: 200 y el archivo es IDÉNTICO (misma huella)', d1.estado === 200 && sha(d1.bytes) === sha(bytes1), `respuesta ${d1.estado}`);
  comprobar('la descarga es un adjunto con el tipo detectado y las cabeceras de seguridad', d1.cabeceras.get('content-type') === 'application/pdf' && /^attachment; filename="politica antigua\.pdf"/.test(d1.cabeceras.get('content-disposition') ?? '') && d1.cabeceras.get('x-content-type-options') === 'nosniff' && /no-store/.test(d1.cabeceras.get('cache-control') ?? '') && d1.cabeceras.get('content-security-policy') === "default-src 'none'; sandbox", `${d1.cabeceras.get('content-type')} | ${d1.cabeceras.get('content-disposition')}`);
  comprobar('ninguna cabecera lleva un token', ![...d1.cabeceras.values()].some((v) => /eyJ[A-Za-z0-9_-]{20,}/.test(v)));
  comprobar('el colaborador también descarga', sha((await bajar('colabA', `${A}/evidencias/${id1}/descargar`)).bytes) === sha(bytes1));
  const dB = await bajar('adminB', `${A}/evidencias/${id1}/descargar`);
  comprobar('AISLAMIENTO: B pidiendo la descarga por la ruta de A recibe 404 y nunca los bytes del archivo', dB.estado === 404 && sha(dB.bytes) !== sha(bytes1) && dB.cabeceras.get('content-disposition') === null, `respuesta ${dB.estado}`);
  const dB2 = await bajar('adminB', '/e/empresa-b/evidencias/' + id1 + '/descargar');
  comprobar('AISLAMIENTO: B pidiendo el mismo archivo por SU ruta recibe «no encontrado» (igual que uno inexistente)', dB2.estado === 303 && dB2.parametros.get('aviso') === 'no_encontrado', `${dB2.estado} ${dB2.destino ?? ''}`);
  comprobar('una descarga con un identificador mal formado es 404', (await bajar('adminA', `${A}/evidencias/no-es-uuid/descargar`)).estado === 404);
  comprobar('sin sesión, la descarga lleva a ingresar y no entrega nada', await (async () => { const r = await descargarWeb(entorno, `${A}/evidencias/${id1}/descargar`, new Map()); return (r.estado === 303 || r.estado === 307) && (r.destino ?? '').startsWith('/auth/login') && sha(r.bytes) !== sha(bytes1); })());

  // ---- Subir otra, vigente: la cobertura pasa a «Cubierta»
  const bytes2 = png();
  const s2 = await enviar('colabA', `${PAG}/evidencias/subir`, { formulario: formulario({ tipo: 'registro', titulo: `Captura ${MARCA}`, fechaHecho: '2026-11-01' }, { bytes: bytes2, nombre: 'captura.png' }, true) }); // el archivo ANTES de los campos
  comprobar('el colaborador sube un PNG (aunque el navegador mande el archivo antes de los campos): la web reordena y funciona', s2.estado === 303 && s2.parametros.get('aviso') === 'evidencia_subida', s2.destino ?? '');
  const p2 = await ver('adminA', PAG);
  const id2 = [...p2.texto.matchAll(/\/evidencias\/([0-9a-f-]{36})\/descargar/g)].map((x) => x[1]!).find((x) => x !== id1);
  comprobar('queda como «Sin vencimiento» y la cobertura pasa a «Cubierta»', p2.texto.includes('Sin vencimiento') && (await filaCobertura()).includes('Cubierta'));
  comprobar('el colaborador ve la misma cobertura', (await filaCobertura('colabA')).includes('Cubierta'));
  const coberturaB = (await ver('adminB', '/e/empresa-b/cobertura')).texto;
  comprobar('AISLAMIENTO: la cobertura de B no tiene nada de A', coberturaB.length > 0 && !coberturaB.includes(CODIGO) && !(await ver('adminB', `${A}/cobertura`)).texto.includes('Cubierta'));
  const filtrada = await ver('adminA', `${A}/cobertura?norma=${encodeURIComponent('ISO 42001')}`);
  comprobar('filtrar la cobertura por una norma que no adoptó: sin la entrada', filtrada.estado === 200 && !filtrada.texto.includes(`>${idEntrada}</span>`));
  const filtroMalo = await ver('adminA', `${A}/cobertura?norma=${encodeURIComponent('<script>')}`);
  comprobar('un filtro inválido no rompe la pantalla: 200 y aviso', filtroMalo.estado === 200 && filtroMalo.texto.includes('El filtro no era válido'));

  // ---- Archivos disfrazados y tipos: se deciden por el CONTENIDO
  const rechazos: [string, Uint8Array, string, string][] = [
    ['un ejecutable con nombre .pdf', ejecutable(), 'factura.pdf', 'tipo_no_permitido'],
    ['un documento con macros', zip(['[Content_Types].xml', 'word/document.xml', 'word/vbaProject.bin']), 'acta.docx', 'tipo_no_permitido'],
    ['un HTML con nombre .txt', texto('<html><script>alert(1)</script></html>'), 'nota.txt', 'tipo_no_permitido'],
    ['un SVG con nombre .png', texto('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'logo.png', 'tipo_no_permitido'],
    ['un PDF truncado', texto('%PDF-1.4'), 'informe.pdf', 'tipo_no_permitido'],
    ['un archivo vacío', new Uint8Array(0), 'vacio.pdf', 'no_valido'],
  ];
  for (const [nombre, bytes, archivo, esperado] of rechazos) {
    const r = await enviar('adminA', `${PAG}/evidencias/subir`, { formulario: formulario({ tipo: 'documento', titulo: `Rechazada ${MARCA}`, fechaHecho: '2026-11-01' }, { bytes, nombre: archivo }) });
    comprobar(`${nombre}: aviso «${esperado}»`, r.estado === 303 && r.parametros.get('aviso') === esperado, `${r.estado} ${r.destino ?? ''}`);
  }
  const pRech = await ver('adminA', `${PAG}?aviso=tipo_no_permitido&historicas=true`);
  comprobar('ninguna de las rechazadas quedó registrada y el aviso lo explica', !pRech.texto.includes(`Rechazada ${MARCA}`) && pRech.texto.includes('Tipo de archivo no permitido') && pRech.texto.includes('no por su extensión'));
  const bytesTxt = texto('Registro de la revisión de accesos.\n');
  const sTxt = await enviar('adminA', `${PAG}/evidencias/subir`, { formulario: formulario({ tipo: 'registro', titulo: `Texto ${MARCA}`, fechaHecho: '2026-11-01' }, { bytes: bytesTxt, nombre: 'informe.pdf' }) });
  const pTxt = await ver('adminA', sTxt.destino ?? PAG);
  const idTxt = [...pTxt.texto.matchAll(/\/evidencias\/([0-9a-f-]{36})\/descargar/g)].map((x) => x[1]!).find((x) => x !== id1 && x !== id2);
  comprobar('un TXT con nombre .pdf se guarda como TXT (el tipo sale del contenido)', sTxt.parametros.get('aviso') === 'evidencia_subida' && pTxt.texto.includes('Texto'));
  const dTxt = idTxt ? await bajar('adminA', `${A}/evidencias/${idTxt}/descargar`) : null;
  comprobar('…y se descarga como text/plain con extensión .txt', !!dTxt && dTxt.cabeceras.get('content-type') === 'text/plain' && /filename="informe\.txt"/.test(dTxt.cabeceras.get('content-disposition') ?? ''), dTxt?.cabeceras.get('content-disposition') ?? '');

  // ---- Tamaños: más de 10 MB pasa íntegro por el proxy de la web; más de 25 MB se rechaza
  const grande = pdf(11 * 1024 * 1024);
  const sGrande = await enviar('adminA', `${PAG}/evidencias/subir`, { formulario: formulario({ tipo: 'documento', titulo: `Grande ${MARCA}`, fechaHecho: '2026-11-01' }, { bytes: grande, nombre: 'grande.pdf' }) });
  comprobar('un archivo de 11 MB se acepta (el proxy de Next no lo trunca a 10 MB)', sGrande.estado === 303 && sGrande.parametros.get('aviso') === 'evidencia_subida', `${sGrande.estado} ${sGrande.destino ?? ''}`);
  const pGrande = await ver('adminA', PAG);
  const idGrande = [...pGrande.texto.matchAll(/\/evidencias\/([0-9a-f-]{36})\/descargar/g)].map((x) => x[1]!).find((x) => ![id1, id2, idTxt].includes(x));
  const dGrande = idGrande ? await bajar('adminA', `${A}/evidencias/${idGrande}/descargar`) : null;
  comprobar('…y se descarga completo e idéntico (misma huella y mismo tamaño)', !!dGrande && dGrande.bytes.length === grande.length && sha(dGrande.bytes) === sha(grande), `${dGrande?.bytes.length} de ${grande.length} bytes`);
  const demasiado = await enviar('adminA', `${PAG}/evidencias/subir`, { formulario: formulario({ tipo: 'documento', titulo: `Enorme ${MARCA}`, fechaHecho: '2026-11-01' }, { bytes: pdf(26 * 1024 * 1024), nombre: 'enorme.pdf' }) });
  comprobar('uno de más de 25 MB: aviso «archivo_grande» y no se guarda', demasiado.estado === 303 && demasiado.parametros.get('aviso') === 'archivo_grande', `${demasiado.estado} ${demasiado.destino ?? ''}`);
  comprobar('…y el aviso dice cuál es el máximo', (await ver('adminA', demasiado.destino ?? PAG)).texto.includes('El máximo es 25 MB'));

  // ---- Validaciones y protecciones del formulario
  for (const [nombre, campos] of [['sin título', { tipo: 'documento', titulo: '', fechaHecho: '2026-11-01' }], ['con una fecha inexistente', { tipo: 'documento', titulo: 'x', fechaHecho: '2026-02-31' }], ['con un tipo desconocido', { tipo: 'otro', titulo: 'x', fechaHecho: '2026-11-01' }], ['con una vigencia anterior al hecho', { tipo: 'documento', titulo: 'x', fechaHecho: '2026-11-01', vigenteHasta: '2026-10-01' }]] as const) {
    const r = await enviar('adminA', `${PAG}/evidencias/subir`, { formulario: formulario({ ...campos }, { bytes: pdf(), nombre: 'x.pdf' }) });
    comprobar(`subir ${nombre}: aviso «no_valido»`, r.estado === 303 && r.parametros.get('aviso') === 'no_valido', r.destino ?? '');
  }
  const futura = await enviar('adminA', `${PAG}/evidencias/subir`, { formulario: formulario({ tipo: 'documento', titulo: 'x', fechaHecho: '2099-01-01' }, { bytes: pdf(), nombre: 'x.pdf' }) });
  comprobar('un hecho con fecha futura lo rechaza la API (aviso «no_valido»)', futura.parametros.get('aviso') === 'no_valido', futura.destino ?? '');
  const sinArchivo = await enviar('adminA', `${PAG}/evidencias/subir`, { formulario: formulario({ tipo: 'documento', titulo: 'x', fechaHecho: '2026-11-01' }) });
  comprobar('subir sin archivo: aviso «no_valido»', sinArchivo.parametros.get('aviso') === 'no_valido');
  for (const [origen, nombre] of [[null, 'sin Origin'], ['null', 'con Origin «null»'], ['https://evil.example', 'con Origin de otro sitio']] as const) {
    const r = await enviar('adminA', `${PAG}/evidencias/subir`, { origen, formulario: formulario({ tipo: 'documento', titulo: 'x', fechaHecho: '2026-11-01' }, { bytes: pdf(), nombre: 'x.pdf' }) });
    comprobar(`subir ${nombre}: 403`, r.estado === 403, `respuesta ${r.estado}`);
  }
  comprobar('un GET a la ruta de subida no hace nada (405)', (await enviar('adminA', `${PAG}/evidencias/subir`, { metodo: 'GET' })).estado === 405);
  comprobar('subir a un control con identificador mal formado es 404', (await enviar('adminA', `${A}/controles/no-es-uuid/evidencias/subir`, { formulario: formulario({ tipo: 'documento', titulo: 'x', fechaHecho: '2026-11-01' }, { bytes: pdf(), nombre: 'x.pdf' }) })).estado === 404);
  const sinSesion = await enviarWeb(entorno, `${PAG}/evidencias/subir`, new Map(), { formulario: formulario({ tipo: 'documento', titulo: 'x', fechaHecho: '2026-11-01' }, { bytes: pdf(), nombre: 'x.pdf' }) });
  comprobar('sin sesión, la subida lleva a ingresar', sinSesion.estado === 303 && (sinSesion.destino ?? '').startsWith('/auth/login'), `${sinSesion.estado} ${sinSesion.destino ?? ''}`);
  const deB = await enviar('adminB', `${PAG}/evidencias/subir`, { formulario: formulario({ tipo: 'documento', titulo: `Intrusa ${MARCA}`, fechaHecho: '2026-11-01' }, { bytes: pdf(), nombre: 'x.pdf' }) });
  comprobar('AISLAMIENTO: B subiendo a la ruta de A es rechazado (404; Next responde 409 a un multipart que el proxy manda a «no encontrado») y no se guarda nada', (deB.estado === 404 || deB.estado === 409) && !(await ver('adminA', `${PAG}?historicas=true`)).texto.includes('Intrusa'), `respuesta ${deB.estado}`);
  const deB2 = await enviar('adminB', `/e/empresa-b/controles/${idControl}/evidencias/subir`, { formulario: formulario({ tipo: 'documento', titulo: `Intrusa ${MARCA}`, fechaHecho: '2026-11-01' }, { bytes: pdf(), nombre: 'x.pdf' }) });
  comprobar('AISLAMIENTO: B subiendo a un control de A por SU propia ruta: «no encontrado» (sin crear nada)', deB2.estado === 303 && deB2.parametros.get('aviso') === 'no_encontrado' && !(await ver('adminA', `${PAG}?historicas=true`)).texto.includes('Intrusa'), `${deB2.estado} ${deB2.destino ?? ''}`);

  // ---- Reemplazar
  const bytes3 = pdf(500);
  const r1 = await enviar('adminA', `${A}/evidencias/${id2}/reemplazar`, { formulario: formulario({ control: idControl, fechaHecho: '2026-11-10', titulo: `Captura nueva ${MARCA}` }, { bytes: bytes3, nombre: 'captura-nueva.pdf' }) });
  comprobar('reemplazar una evidencia: aviso «evidencia_reemplazada», y vuelve al control', r1.estado === 303 && r1.parametros.get('aviso') === 'evidencia_reemplazada' && (r1.destino ?? '').startsWith(`/e/empresa-a/controles/${idControl}`), `${r1.estado} ${r1.destino ?? ''}`);
  const pH = await ver('adminA', `${PAG}?historicas=true`);
  comprobar('el historial muestra la anterior «Reemplazada» y la nueva «Reemplaza a una evidencia anterior»', pH.texto.includes('Reemplazada') && pH.texto.includes('Reemplaza a una evidencia anterior') && pH.texto.includes(`Captura nueva ${MARCA}`));
  comprobar('sin el historial, la reemplazada ya no aparece como activa', !(await ver('adminA', PAG)).texto.includes(`>${`Captura ${MARCA}`}<`));
  comprobar('el archivo de la reemplazada se sigue descargando (el historial se conserva)', sha((await bajar('adminA', `${A}/evidencias/${id2}/descargar`)).bytes) === sha(bytes2));
  const r2 = await enviar('adminA', `${A}/evidencias/${id2}/reemplazar`, { formulario: formulario({ control: idControl, fechaHecho: '2026-11-10' }, { bytes: pdf(7), nombre: 'otra.pdf' }) });
  comprobar('reemplazar una que ya está reemplazada: aviso «conflicto»', r2.parametros.get('aviso') === 'conflicto', r2.destino ?? '');
  const r3 = await enviar('adminA', `${A}/evidencias/${id1}/reemplazar`, { formulario: formulario({ control: idControl, fechaHecho: '2026-11-10' }, { bytes: ejecutable(), nombre: 'x.pdf' }) });
  comprobar('si el archivo nuevo se rechaza, la original sigue activa', r3.parametros.get('aviso') === 'tipo_no_permitido' && (await ver('adminA', PAG)).texto.includes(`Política ${MARCA}`));
  const r4 = await enviar('adminB', `${A}/evidencias/${id1}/reemplazar`, { formulario: formulario({ control: idControl, fechaHecho: '2026-11-10' }, { bytes: pdf(), nombre: 'x.pdf' }) });
  comprobar('AISLAMIENTO: B reemplazando una evidencia de A por la ruta de A es rechazado (404/409 de Next)', r4.estado === 404 || r4.estado === 409, `respuesta ${r4.estado}`);

  // ---- Eliminar
  const e1 = await enviar('colabA', `${A}/evidencias/${id1}/eliminar`, { formulario: (() => { const f = new FormData(); f.append('control', idControl); return f; })() });
  comprobar('un colaborador que envía «eliminar» por otra vía recibe «sin permiso» (lo decide la API)', e1.estado === 303 && e1.parametros.get('aviso') === 'sin_permiso', e1.destino ?? '');
  comprobar('el colaborador no ve el botón de eliminar', formularioDe((await ver('colabA', PAG)).texto, '/eliminar') === '' && formularioDe((await ver('adminA', PAG)).texto, '/eliminar') !== '');
  const e2 = await enviar('adminA', `${A}/evidencias/${id1}/eliminar`, { formulario: (() => { const f = new FormData(); f.append('control', idControl); return f; })() });
  comprobar('el administrador elimina: aviso «evidencia_eliminada»', e2.estado === 303 && e2.parametros.get('aviso') === 'evidencia_eliminada', e2.destino ?? '');
  const dEl = await bajar('adminA', `${A}/evidencias/${id1}/descargar`);
  comprobar('una evidencia eliminada ya no se descarga («no encontrado»)', dEl.estado === 303 && dEl.parametros.get('aviso') === 'no_encontrado', `${dEl.estado} ${dEl.destino ?? ''}`);
  const e3 = await enviar('adminA', `${A}/evidencias/${id1}/eliminar`, { formulario: (() => { const f = new FormData(); f.append('control', idControl); return f; })() });
  comprobar('eliminar otra vez: aviso «conflicto»', e3.parametros.get('aviso') === 'conflicto', e3.destino ?? '');
  comprobar('eliminar con Origin ajeno: 403; con GET: 405', (await enviar('adminA', `${A}/evidencias/${id2}/eliminar`, { origen: 'https://evil.example', formulario: new FormData() })).estado === 403 && (await enviar('adminA', `${A}/evidencias/${id2}/eliminar`, { metodo: 'GET' })).estado === 405);
  const e4 = await enviar('adminB', `${A}/evidencias/${id2}/eliminar`, { formulario: new FormData() });
  comprobar('AISLAMIENTO: B eliminando una evidencia de A por la ruta de A es rechazado (404/409 de Next)', e4.estado === 404 || e4.estado === 409, `respuesta ${e4.estado}`);

  // ---- Control retirado: lo que ya tenía se conserva, pero no recibe nada nuevo
  const ver0 = await ver('adminA', `${A}/controles`);
  const idsMasReciente = campo(formularioDe(filaDe(ver0.texto, CODIGO), '/controles/retirar'), 'version');
  const ret = await enviar('adminA', `${A}/controles/retirar`, { cuerpo: { id: idControl, version: String(idsMasReciente) } });
  comprobar('se retira el control de prueba', ret.estado === 303 && ret.parametros.get('aviso') === 'retirado', ret.destino ?? '');
  const pRet = await ver('adminA', PAG);
  comprobar('un control retirado conserva sus evidencias y lo explica, pero ya no ofrece subir ni reemplazar', pRet.estado === 200 && pRet.texto.includes('Este control está retirado') && formularioDe(pRet.texto, '/evidencias/subir') === '' && formularioDe(pRet.texto, '/reemplazar') === '');
  const sRet = await enviar('adminA', `${PAG}/evidencias/subir`, { formulario: formulario({ tipo: 'documento', titulo: 'x', fechaHecho: '2026-11-01' }, { bytes: pdf(), nombre: 'x.pdf' }) });
  comprobar('subir a un control retirado por otra vía: aviso «conflicto»', sRet.parametros.get('aviso') === 'conflicto', sRet.destino ?? '');
  comprobar('lo que tenía sigue descargable', sha((await bajar('adminA', `${A}/evidencias/${idGrande}/descargar`)).bytes) === sha(grande));
  comprobar('y la cobertura ya no lo cuenta (un control retirado no cubre nada)', (await filaCobertura()).includes('Sin control'));
} catch (error) {
  fallos += 1;
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
}
if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exitCode = 1;
} else console.log('\nTodo correcto: las evidencias con archivo y la cobertura funcionan de punta a punta y respetan permisos, tamaños y aislamiento.');
