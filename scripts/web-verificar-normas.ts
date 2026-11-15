// pnpm web:verify-normas — comprueba con todo REAL (Keycloak, API, PostgreSQL y web) la carga de librerías propias desde la web
// (MVP M6a, paso 5): la pantalla «Normas», la plantilla descargable (que debe pasar la validación tal cual), subir uno o varios
// archivos, ver el resultado en palabras (una sola vez), rechazos (formato, texto copiado, código sin prefijo, no es texto,
// versión repetida con otro contenido), adoptar la librería propia y ver sus requisitos, permisos por rol, Origin y aislamiento.
// Requiere: Keycloak, API (pnpm dev api), web (pnpm dev web), pnpm db:migrate (incluye la 0011) y pnpm db:seed.
// OJO: escribe en tu base local de desarrollo y NO se puede deshacer: las librerías subidas son inmutables (quedan con el código
// «propia-verif-…»), la de A se ADOPTA y la bitácora no se borra. Los códigos llevan una marca única por ejecución.
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

const MARCA = Date.now().toString(36);
const A = '/e/empresa-a';
const B = '/e/empresa-b';
const CODIGO = `propia-verif-${MARCA}`;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SECRETO = `SECRETO-${MARCA}`;

/** Un YAML de librería válido, con texto sintético propio. */
const yaml = (codigo: string, cambio: { nombre?: string; version?: string; guia?: string; esEjemplo?: boolean } = {}) => `esquema: 3
codigo: ${codigo}
nombre: ${cambio.nombre ?? `Librería de verificación ${MARCA}`}
version: ${cambio.version ?? '1.0.0'}
es_ejemplo: ${cambio.esEjemplo ?? false}
fuente: elaboración propia de la verificación
referencias:
  - { norma: Norma X, edicion: "2022" }
entradas:
  - id: verif-4.1
    capitulo: 4
    nivel: 1
    titulo: Tema de verificación ${MARCA}
    guia: ${cambio.guia ?? 'Texto sintético de prueba, sin relación con ninguna norma.'}
    alcance_comun: comun
    aplica_a:
      - { norma: Norma X, edicion: "2022", clausula: "4.1" }
`;

const archivo = (nombre: string, contenido: string | Uint8Array) => new File([contenido as BlobPart], nombre, { type: 'application/octet-stream' });
const formulario = (...archivos: File[]) => {
  const f = new FormData();
  for (const a of archivos) f.append('archivos', a);
  return f;
};
const idsDeAdopcion = (html: string) => [...html.matchAll(new RegExp(`action="/e/empresa-[ab]/librerias/(${UUID})/adopcion"`, 'g'))].map((m) => m[1]!);
/** El id de la librería con ese código, leído de la lista (la tarjeta lleva el código y, si no está adoptada, su botón). */
const idDeLibreria = (html: string, codigo: string): string | null => {
  const tarjeta = html.split('<li').find((t) => t.includes(codigo) && new RegExp(`/librerias/${UUID}/adopcion`).test(t));
  return tarjeta ? (new RegExp(`/librerias/(${UUID})/adopcion`).exec(tarjeta)?.[1] ?? null) : null;
};

try {
  const sesion = {
    adminA: await iniciarSesionWeb(entorno, 'admin-a', `${A}/normas`),
    colabA: await iniciarSesionWeb(entorno, 'colab-a', `${A}/normas`),
    adminB: await iniciarSesionWeb(entorno, 'admin-b', `${B}/normas`),
  };
  type Quien = keyof typeof sesion;
  const ver = (quien: Quien, ruta: string) => paginaWeb(entorno, ruta, sesion[quien]);
  const enviar = (quien: Quien, ruta: string, o: { origen?: string | null; metodo?: string; formulario?: FormData } = {}) => enviarWeb(entorno, ruta, sesion[quien], o);
  const bajar = (quien: Quien, ruta: string) => descargarWeb(entorno, ruta, sesion[quien]);
  /** Sube archivos como `quien` a la empresa de `base` y devuelve el redirect y la página de resultado. */
  const subir = async (quien: Quien, base: string, ...archivos: File[]) => {
    const r = await enviar(quien, `${base}/normas/subir`, { formulario: formulario(...archivos) });
    const pagina = r.destino ? await ver(quien, r.destino) : null;
    return { r, pagina, texto: pagina?.texto ?? '' };
  };

  // ---- La pantalla
  const p0 = await ver('adminA', `${A}/normas`);
  comprobar('el administrador abre «Normas»: 200 y sin caché', p0.estado === 200 && /no-store/.test(p0.cabeceras.get('cache-control') ?? ''), `respuesta ${p0.estado}`);
  comprobar('la navegación ofrece «Normas» como página actual', /href="\/e\/empresa-a\/normas"[^>]*aria-current="page"/.test(p0.texto) || /aria-current="page"[^>]*href="\/e\/empresa-a\/normas"/.test(p0.texto));
  comprobar('el formulario va por POST, multipart, a su ruta, con selector de archivos y de carpeta, y sin campo de empresa', /<form[^>]*action="\/e\/empresa-a\/normas\/subir"/.test(p0.texto) && /multipart\/form-data/i.test(p0.texto) && /webkitdirectory/i.test(p0.texto) && /accept="\.yaml,\.yml"/.test(p0.texto) && !/name="(empresa|empresaId|empresa_id|tenant)"/i.test(p0.texto));
  const pColab = await ver('colabA', `${A}/normas`);
  comprobar('el colaborador ve las librerías pero NO el formulario de subida', pColab.estado === 200 && !pColab.texto.includes('/normas/subir') && pColab.texto.includes('Solo la persona con rol de administrador SIG puede subir librerías'));
  comprobar('el colaborador no ve botones de adoptar', idsDeAdopcion(pColab.texto).length === 0);
  const porB = await ver('adminB', `${A}/normas`);
  comprobar('AISLAMIENTO: la sesión de B pidiendo «Normas» de A recibe 404', porB.estado === 404, `respuesta ${porB.estado}`);

  // ---- La plantilla
  const pl = await bajar('adminA', `${A}/normas/plantilla`);
  const plantilla = new TextDecoder().decode(pl.bytes);
  comprobar('la plantilla se descarga: 200, YAML, adjunto con nombre fijo, nosniff y sin caché', pl.estado === 200 && /^application\/yaml/.test(pl.cabeceras.get('content-type') ?? '') && pl.cabeceras.get('content-disposition') === 'attachment; filename="plantilla-libreria.yaml"' && pl.cabeceras.get('x-content-type-options') === 'nosniff' && /no-store/.test(pl.cabeceras.get('cache-control') ?? ''), `respuesta ${pl.estado}`);
  comprobar('la plantilla es de una librería propia (código con «propia-») y no trae texto de ninguna norma', plantilla.includes('codigo: propia-') && plantilla.includes('esquema: 3'));
  comprobar('el colaborador también la descarga', (await bajar('colabA', `${A}/normas/plantilla`)).estado === 200);
  const plB = await bajar('adminB', `${A}/normas/plantilla`);
  comprobar('AISLAMIENTO: B pidiendo la plantilla por la ruta de A recibe 404', plB.estado === 404, `respuesta ${plB.estado}`);
  const plSin = await descargarWeb(entorno, `${A}/normas/plantilla`, new Map());
  comprobar('sin sesión, la plantilla lleva a ingresar', (plSin.estado === 303 || plSin.estado === 307) && (plSin.destino ?? '').startsWith('/auth/login'));
  comprobar('un POST a la plantilla no hace nada (405)', (await enviar('adminA', `${A}/normas/plantilla`)).estado === 405);

  // ---- Protecciones del envío
  const sinPermiso = await subir('colabA', A, archivo('a.yaml', yaml(`${CODIGO}-colab`)));
  comprobar('un colaborador que envía la subida por otra vía recibe «sin permiso» (lo decide la API)', sinPermiso.r.estado === 303 && sinPermiso.r.parametros.get('aviso') === 'sin_permiso', sinPermiso.r.destino ?? '');
  comprobar('…y esa librería NO se creó', !(await ver('adminA', `${A}/normas`)).texto.includes(`${CODIGO}-colab`));
  for (const [origen, nombre] of [[null, 'sin Origin'], ['null', 'con Origin «null»'], ['https://evil.example', 'con Origin de otro sitio']] as const) {
    comprobar(`subir ${nombre}: 403`, (await enviar('adminA', `${A}/normas/subir`, { origen, formulario: formulario(archivo('a.yaml', yaml(`${CODIGO}-o`))) })).estado === 403);
  }
  comprobar('un GET a la ruta de subir no hace nada (405)', (await enviar('adminA', `${A}/normas/subir`, { metodo: 'GET' })).estado === 405);
  const deB = await enviar('adminB', `${A}/normas/subir`, { formulario: formulario(archivo('a.yaml', yaml(`${CODIGO}-b`))) });
  // Un POST multipart que el proxy reescribe a «no encontrado» lo responde Next con 409 («Server Action unavailable», sin datos).
  const nadaDeB = !(await ver('adminA', `${A}/normas`)).texto.includes(`${CODIGO}-b`) && !(await ver('adminB', `${B}/normas`)).texto.includes(`${CODIGO}-b`);
  comprobar('AISLAMIENTO: B enviando la subida a la ruta de A recibe 404 (o el 409 de Next) y no crea nada ni en A ni en B', (deB.estado === 404 || deB.estado === 409) && nadaDeB, `respuesta ${deB.estado}`);
  const sinSesionSubir = await enviarWeb(entorno, `${A}/normas/subir`, new Map(), { formulario: formulario(archivo('a.yaml', yaml(`${CODIGO}-s`))) });
  comprobar('sin sesión, subir lleva a ingresar', sinSesionSubir.estado === 303 && (sinSesionSubir.destino ?? '').startsWith('/auth/login'));
  const vacio = await enviar('adminA', `${A}/normas/subir`, { formulario: new FormData() });
  comprobar('sin elegir archivos: aviso «sin_archivos»', vacio.estado === 303 && vacio.parametros.get('aviso') === 'sin_archivos');
  const soloMd = await enviar('adminA', `${A}/normas/subir`, { formulario: formulario(archivo('leeme.md', '# nada')) });
  comprobar('solo archivos que no son YAML: aviso «sin_archivos»', soloMd.parametros.get('aviso') === 'sin_archivos');

  // ---- Subir la PLANTILLA tal cual (con otro código): debe pasar la validación de verdad
  const deLaPlantilla = plantilla.replace('codigo: propia-mi-norma', `codigo: ${CODIGO}-plantilla`).replace('nombre: Mi norma (resumen propio)', `nombre: Plantilla de verificación ${MARCA}`);
  const u0 = await subir('adminA', A, archivo('plantilla.yaml', deLaPlantilla));
  comprobar('la plantilla descargada pasa la validación completa (no se rechaza)', u0.r.estado === 303 && u0.r.parametros.has('carga') && u0.texto.includes(`Cargada: «${CODIGO}-plantilla»`), u0.texto.includes('Qué corregir') ? 'la API la rechazó' : u0.r.destino ?? '');

  // ---- Subir una librería válida y verla
  const u1 = await subir('adminA', A, archivo('mi-norma.yaml', yaml(CODIGO)));
  comprobar('subir una librería válida: redirige a «Normas» con un resultado', u1.r.estado === 303 && u1.r.parametros.has('carga') && (u1.r.destino ?? '').startsWith(`${A}/normas?carga=`), u1.r.destino ?? '');
  comprobar('el resultado dice en palabras que se cargó, con su código, versión y número de entradas', u1.texto.includes(`Cargada: «${CODIGO}», versión 1.0.0, con 1 entrada. Ya puede adoptarla.`) && u1.texto.includes('Archivo mi-norma.yaml'));
  const otraVez = u1.r.destino ? await ver('adminA', u1.r.destino) : null;
  comprobar('el resultado se muestra UNA vez: al recargar ya no está', !!otraVez && otraVez.estado === 200 && !otraVez.texto.includes('Resultado de la subida'));
  comprobar('la librería aparece en la lista como propia, sin adoptar, con su botón de adoptar', (() => { const t = otraVez?.texto ?? ''; const tarjeta = t.split('<li').find((x) => x.includes(CODIGO) && !x.includes(`${CODIGO}-plantilla`)) ?? ''; return tarjeta.includes('Propia') && tarjeta.includes('Sin adoptar') && tarjeta.includes('Adoptar'); })());
  const invent = await ver('adminA', `${A}/normas?carga=${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}`);
  comprobar('un identificador de resultado inventado no muestra nada', invent.estado === 200 && !invent.texto.includes('Resultado de la subida'));
  const ajeno = u1.r.parametros.get('carga');
  comprobar('un resultado de A no se puede leer desde la sesión de B (ni por la ruta de B)', ajeno !== null && !(await ver('adminB', `${B}/normas?carga=${ajeno}`)).texto.includes(CODIGO));

  // ---- Repetir
  const u2 = await subir('adminA', A, archivo('mi-norma-otra-vez.yaml', yaml(CODIGO)));
  comprobar('subir lo mismo otra vez: «ya estaba cargada», sin cambios', u2.texto.includes(`Ya estaba cargada: «${CODIGO}», versión 1.0.0, con el mismo contenido`));
  const u3 = await subir('adminA', A, archivo('cambiada.yaml', yaml(CODIGO, { nombre: `Otro nombre ${MARCA}` })));
  comprobar('la misma versión con otro contenido se rechaza y se explica cómo seguir', u3.texto.includes('Esa versión ya existe con otro contenido') && u3.texto.includes('Cambie el número de versión'));
  const u4 = await subir('adminA', A, archivo('v11.yaml', yaml(CODIGO, { version: '1.1.0', nombre: `Otro nombre ${MARCA}` })));
  comprobar('con otro número de versión sí se carga', u4.texto.includes(`Cargada: «${CODIGO}», versión 1.1.0`));

  // ---- Rechazos explicados
  const r1 = await subir('adminA', A, archivo('sin-prefijo.yaml', yaml(`sin-prefijo-${MARCA}`)));
  comprobar('un código sin «propia-» se rechaza y dice cómo corregirlo', r1.texto.includes('El código de la librería no es válido para una librería propia') && r1.texto.includes('el código debe empezar con «propia-»'));
  const r2 = await subir('adminA', A, archivo('ejemplo.yaml', yaml(`${CODIGO}-ej`, { esEjemplo: true })));
  comprobar('una librería marcada como ejemplo se rechaza', r2.texto.includes('una librería propia no puede ser de ejemplo'));
  const r3 = await subir('adminA', A, archivo('copiado.yaml', yaml(`${CODIGO}-cp`, { guia: 'La organización debe determinar las cuestiones externas e internas que son pertinentes para su propósito; debe establecer el alcance.' })));
  comprobar('un texto que suena a norma se rechaza, con dónde está', r3.texto.includes('El texto parece copiado de una norma') && /En «entradas\[0\]\.guia»/.test(r3.texto));
  const r4 = await subir('adminA', A, archivo('roto.yaml', `a: [1, 2\nclave: ${SECRETO}\n`));
  comprobar('un YAML mal formado se rechaza SIN repetir su contenido', r4.texto.includes('El archivo no cumple el formato de una librería') && r4.texto.includes('no es un YAML bien formado') && !r4.texto.includes(SECRETO));
  const r5 = await subir('adminA', A, archivo('incompleto.yaml', `esquema: 3\ncodigo: ${CODIGO}-inc\n`));
  comprobar('un archivo incompleto lista lo que falta', r5.texto.includes('Qué corregir') && r5.texto.includes('falta un campo obligatorio'));
  const r6 = await subir('adminA', A, archivo('no-texto.yaml', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0xfe, 0x00])));
  comprobar('un archivo que no es texto (como un PDF con nombre .yaml) se rechaza', r6.texto.includes('no es un texto YAML válido'));
  const r7 = await subir('adminA', A, archivo('alias.yaml', 'a: &x [1,2,3]\nb: [*x,*x,*x]\n'));
  comprobar('un YAML con alias (bomba) se rechaza', r7.texto.includes('El archivo no cumple el formato de una librería'));
  const r8 = await subir('adminA', A, archivo('<img src=x onerror=alert(1)>.yaml', 'no: yaml: valido: ['));
  comprobar('el nombre del archivo no se muestra como HTML', !/<img[^>]*onerror/i.test(r8.texto));
  const grande = await subir('adminA', A, archivo('grande.yaml', new Uint8Array(1_048_576 + 10).fill(97)));
  comprobar('un archivo de más de 1 MB no se envía y se informa', grande.texto.includes('El archivo pasa de 1 MB y no se envió'));

  // ---- Varios archivos en una subida (y una carpeta con archivos que no son YAML)
  const multi = await subir('adminA', A, archivo('uno.yaml', yaml(`${CODIGO}-m1`)), archivo('dos.yml', yaml(`${CODIGO}-m2`)), archivo('leeme.md', '# nada'), archivo('norma.pdf', 'no'));
  comprobar('varios archivos: se procesan todos los YAML (.yaml y .yml) y se informa de cada uno', multi.texto.includes('Archivo dos.yml') && multi.texto.includes('Archivo uno.yaml') && multi.texto.includes(`Cargada: «${CODIGO}-m1»`) && multi.texto.includes(`Cargada: «${CODIGO}-m2»`));
  comprobar('…y los que no son YAML se ignoran y se cuentan', multi.texto.includes('Se ignoraron 2 archivos que no eran .yaml ni .yml'));
  const mezcla = await subir('adminA', A, archivo('bien.yaml', yaml(`${CODIGO}-m3`)), archivo('mal.yaml', 'basura: ['));
  comprobar('si uno falla, los demás igual se cargan', mezcla.texto.includes(`Cargada: «${CODIGO}-m3»`) && mezcla.texto.includes('Archivo mal.yaml') && mezcla.texto.includes('no cumple el formato'));

  // ---- Adoptar la librería propia y ver sus requisitos
  const lista = await ver('adminA', `${A}/normas`);
  const id = idDeLibreria(lista.texto, `${CODIGO} ·`);
  comprobar('la librería propia tiene su botón de adoptar', !!id, 'no se encontró su tarjeta');
  if (id) {
    const ad = await enviar('adminA', `${A}/librerias/${id}/adopcion`);
    comprobar('adoptarla desde la web funciona (aviso «adoptada»)', ad.estado === 303 && ad.parametros.get('adopcion') === 'adoptada', ad.destino ?? '');
    const req = await ver('adminA', `${A}/requisitos`);
    comprobar('sus requisitos aparecen en el listado de requisitos de A', req.texto.includes(`Tema de verificación ${MARCA}`));
    const despues = await ver('adminA', `${A}/normas`);
    comprobar('en «Normas» ya figura como adoptada', (() => { const t = despues.texto.split('<li').find((x) => x.includes(`${CODIGO} ·`) && x.includes('versión 1.0.0')) ?? ''; return t.includes('Adoptada') && !t.includes('/adopcion'); })());
    // ---- Aislamiento: lo de A no es visible ni usable por B
    const pB = await ver('adminB', `${B}/normas`);
    comprobar('AISLAMIENTO: la lista de B no menciona ninguna librería subida por A', pB.estado === 200 && !pB.texto.includes(CODIGO) && !pB.texto.includes(id));
    const reqB = await ver('adminB', `${B}/requisitos`);
    comprobar('AISLAMIENTO: los requisitos de B no incluyen los de la librería de A', !reqB.texto.includes(`Tema de verificación ${MARCA}`));
    const adB = await enviar('adminB', `${B}/librerias/${id}/adopcion`);
    comprobar('AISLAMIENTO: B intentando adoptar la librería de A recibe «no encontrada» (y no la adopta)', adB.estado === 303 && adB.parametros.get('adopcion') === 'no_encontrada', adB.destino ?? '');
    const adBporA = await enviar('adminB', `${A}/librerias/${id}/adopcion`);
    comprobar('AISLAMIENTO: ni usando la ruta de la empresa A (404)', adBporA.estado === 404, `respuesta ${adBporA.estado}`);
  }

  // ---- B sube el MISMO código: es otra librería, independiente
  const uB = await subir('adminB', B, archivo('mi-norma.yaml', yaml(CODIGO, { nombre: `La de B ${MARCA}` })));
  comprobar('B puede subir el mismo código y versión: es otra librería suya (se carga, no «ya estaba»)', uB.texto.includes(`Cargada: «${CODIGO}», versión 1.0.0`), uB.r.destino ?? '');
  const listaB = await ver('adminB', `${B}/normas`);
  comprobar('B ve la suya (con su nombre) y no la de A', listaB.texto.includes(`La de B ${MARCA}`) && !listaB.texto.includes(`Librería de verificación ${MARCA}`));
  const listaA2 = await ver('adminA', `${A}/normas`);
  comprobar('lo que subió B no cambia lo de A', listaA2.texto.includes(`Librería de verificación ${MARCA}`) && !listaA2.texto.includes(`La de B ${MARCA}`));

  // ---- Un token vencido o inválido no entrega nada (la sesión de la web es lo único que habilita la subida)
  const sinCookie = await enviarWeb(entorno, `${A}/normas/subir`, new Map([['sig-sesion', 'inventada']]), { formulario: formulario(archivo('a.yaml', yaml(`${CODIGO}-x`))) });
  comprobar('una cookie de sesión inventada lleva a ingresar y no sube nada', sinCookie.estado === 303 && (sinCookie.destino ?? '').startsWith('/auth/login'), sinCookie.destino ?? '');
} catch (error) {
  fallos += 1;
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
}
if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exitCode = 1;
} else console.log('\nTodo correcto: las librerías propias se suben, se validan y se explican en la web, se adoptan, y se respetan permisos y aislamiento.');
aviso(`marca de esta ejecución: ${MARCA}`);
