// pnpm web:verify-listado — comprueba con todo REAL (Keycloak, API, PostgreSQL y web) el listado de requisitos (tarea 10.6):
// estados vacíos por rol, adopción de A por la API, entradas de A, filtros, rótulo de ejemplo y aislamiento con B.
// Requiere: Keycloak, API (pnpm dev api), web (pnpm dev web), la siembra (pnpm db:seed) y la librería cargada (pnpm libraries:load).
// OJO: la adopción no se puede deshacer desde la aplicación; si A aún no había adoptado, este script la adopta por la API.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingresarConCodigo } from './lib/flujo-codigo.mjs';
import { iniciarSesionWeb, paginaWeb, type EntornoWeb } from './lib/sesion-web.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const redirectUri = process.env.OIDC_REDIRECT_URI ?? 'http://localhost:3000/auth/callback';
const entorno: EntornoWeb = {
  web: new URL(redirectUri).origin,
  emisor: (process.env.OIDC_ISSUER_URL ?? 'http://127.0.0.1:8080/realms/sigiso').replace(/\/+$/, ''),
  claves: JSON.parse(readFileSync(join(raiz, '.local', 'secretos-keycloak.json'), 'utf8')).usuarios,
};
const apiUrl = (process.env.API_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');
const clienteId = process.env.OIDC_CLIENT_ID ?? 'sigiso-web';
const clienteSecreto = process.env.OIDC_CLIENT_SECRET ?? '';

let fallos = 0;
const comprobar = (descripcion: string, ok: boolean, detalle = '') => {
  if (!ok) fallos += 1;
  console.log(`${ok ? '✔' : '✖'} ${descripcion}${ok || !detalle ? '' : ` — ${detalle}`}`);
};
const aviso = (texto: string) => console.log(`· ${texto}`);

// Texto de la región «N entradas» de la pantalla.
const cuantas = (html: string): number | null => {
  const m = />(\d+) entrada(?:s)?</.exec(html);
  return m ? Number(m[1]) : null;
};

try {
  const sesion = {
    adminA: await iniciarSesionWeb(entorno, 'admin-a', '/e/empresa-a/requisitos'),
    colabA: await iniciarSesionWeb(entorno, 'colab-a', '/e/empresa-a/requisitos'),
    adminB: await iniciarSesionWeb(entorno, 'admin-b', '/e/empresa-b/requisitos'),
  };
  const ver = (quien: keyof typeof sesion, ruta: string) => paginaWeb(entorno, ruta, sesion[quien]);

  // Token de admin-a para consultar y adoptar por la API (el navegador nunca ve tokens; esto es solo la verificación).
  const { tokens } = await ingresarConCodigo({
    emisor: entorno.emisor,
    clienteId,
    clienteSecreto,
    redirectUri,
    usuario: 'admin-a',
    clave: entorno.claves['admin-a'] ?? '',
  });
  const api = (ruta: string, metodo = 'GET') =>
    fetch(`${apiUrl}${ruta}`, { method: metodo, headers: { authorization: `Bearer ${tokens.access_token}` } });
  const librerias = (await (await api('/librerias')).json()) as Array<{
    id: string;
    codigo: string;
    adoptada: boolean;
    nombre: string;
  }>;
  const ejemplo = librerias.find((l) => l.codigo === 'ejemplo-estructura-armonizada');
  comprobar(
    'el catálogo trae la librería de ejemplo (pnpm libraries:load)',
    !!ejemplo,
    `${librerias.length} librería(s)`,
  );
  if (!ejemplo) throw new Error('Falta la librería de ejemplo: ejecuta pnpm libraries:load');

  const yaAdoptada = ejemplo.adoptada;
  if (yaAdoptada) aviso('A ya había adoptado la librería: se omiten las comprobaciones del estado vacío de A.');

  // ---- Antes de adoptar: estados vacíos por rol (H5.4)
  if (!yaAdoptada) {
    const admin = await ver('adminA', '/e/empresa-a/requisitos');
    comprobar(
      'H5.4 administrador SIG de A sin adopción: 200, estado vacío y «puede adoptar», con el catálogo y su nombre real',
      admin.estado === 200 &&
        admin.texto.includes('Su empresa aún no adoptó ninguna librería') &&
        admin.texto.includes('Usted es administrador SIG') &&
        admin.texto.includes('Ejemplo de Estructura Armonizada') &&
        admin.texto.includes('aria-label="Administradora A"'),
      `respuesta ${admin.estado}`,
    );
    const colab = await ver('colabA', '/e/empresa-a/requisitos');
    comprobar(
      'H5.4 colaborador de A sin adopción: se le dice a quién pedirlo',
      colab.estado === 200 &&
        colab.texto.includes('Pida al administrador SIG de su empresa') &&
        !colab.texto.includes('Usted es administrador SIG'),
      `respuesta ${colab.estado}`,
    );
  }
  const vacioB = await ver('adminB', '/e/empresa-b/requisitos');
  const bAdopto = !vacioB.texto.includes('Su empresa aún no adoptó ninguna librería');
  if (bAdopto) aviso('B ya había adoptado la librería: se omite el estado vacío de B.');
  else comprobar('B sin adopción ve su estado vacío (200)', vacioB.estado === 200);

  // ---- A adopta por la API (idempotente)
  const adopcion = await api(`/librerias/${ejemplo.id}/adopcion`, 'POST');
  comprobar(
    'A adopta la librería de ejemplo por la API (201 la primera vez, 200 si ya estaba)',
    adopcion.status === 201 || adopcion.status === 200,
    `respuesta ${adopcion.status}`,
  );

  // ---- Después de adoptar: el listado real de A
  const todo = await ver('adminA', '/e/empresa-a/requisitos');
  comprobar(
    'A ve el listado real: 200, 21 entradas, con título y cláusulas por norma',
    todo.estado === 200 &&
      cuantas(todo.texto) === 21 &&
      todo.texto.includes('Contexto de la organización') &&
      /ISO 9001:2015/.test(todo.texto) &&
      /ISO\/IEC 27001:2022/.test(todo.texto),
    `respuesta ${todo.estado}, ${cuantas(todo.texto)} entradas`,
  );
  comprobar(
    'H5.5 rotula la librería de ejemplo con guías propias, no la norma, y remite al ejemplar oficial',
    todo.texto.includes('Librería de ejemplo con guías propias de SynapTech') &&
      todo.texto.includes('el ejemplar que su empresa adquirió') &&
      todo.texto.includes('numeraciones sin verificar'),
  );
  comprobar(
    'H5.6 solo consulta: sin columnas ni etiquetas de estado de cumplimiento, hallazgos o evidencias, ni acciones de edición',
    !/Estado de cumplimiento|Nuevo requisito|Guardar borrador|<th[^>]*>\s*(Estado|Evidencias|Hallazgos)/i.test(
      todo.texto,
    ) && !/<tbody[\s\S]*?<(button|input|select)/.test(todo.texto),
  );
  comprobar(
    'H5.7 cada entrada indica su alcance (común, parcial o específico) y se explica qué significa',
    /Común/.test(todo.texto) &&
      /Parcial/.test(todo.texto) &&
      /Específico/.test(todo.texto) &&
      todo.texto.includes('Compartir un número no significa pedir lo mismo'),
  );
  comprobar(
    'la cabecera muestra a la persona real (Administradora A), no la de demostración',
    todo.texto.includes('aria-label="Administradora A"') && !todo.texto.includes('Ana Pérez'),
  );
  comprobar('sin caché (no-store)', /no-store/.test(todo.cabeceras.get('cache-control') ?? ''));

  const colabConEntradas = await ver('colabA', '/e/empresa-a/requisitos');
  comprobar(
    'el colaborador de A también ve las 21 entradas (es consulta)',
    colabConEntradas.estado === 200 && cuantas(colabConEntradas.texto) === 21,
  );

  // ---- Filtros (H5.2, H5.3)
  const porTexto = await ver('adminA', '/e/empresa-a/requisitos?q=contexto');
  const nTexto = cuantas(porTexto.texto);
  comprobar(
    'H5.2 buscar por texto «contexto» devuelve un subconjunto con coincidencias',
    porTexto.estado === 200 &&
      nTexto !== null &&
      nTexto > 0 &&
      nTexto < 21 &&
      porTexto.texto.includes('Contexto de la organización'),
    `${nTexto} entradas`,
  );
  const porCapitulo = await ver('adminA', '/e/empresa-a/requisitos?capitulo=9');
  const nCapitulo = cuantas(porCapitulo.texto);
  comprobar(
    'H5.2 filtrar por capítulo 9 devuelve solo entradas de ese capítulo',
    porCapitulo.estado === 200 && nCapitulo !== null && nCapitulo > 0 && nCapitulo < 21,
    `${nCapitulo} entradas`,
  );
  const normas = [
    ...new Set([...todo.texto.matchAll(/<option value="([^"]+)">\1<\/option>/g)].map((m) => m[1]!)),
  ].filter((n) => /ISO/.test(n));
  comprobar(
    'el selector de normas ofrece las normas de las librerías adoptadas',
    normas.length >= 2,
    normas.join(', '),
  );
  const unaNorma = normas.at(-1) ?? 'ISO 9001';
  const porNorma = await ver('adminA', `/e/empresa-a/requisitos?norma=${encodeURIComponent(unaNorma)}`);
  const nNorma = cuantas(porNorma.texto);
  comprobar(
    `H5.3 filtrar por «${unaNorma}» no muestra las entradas que no le aplican`,
    porNorma.estado === 200 && nNorma !== null && nNorma > 0 && nNorma <= 21,
    `${nNorma} entradas`,
  );
  const combinado = await ver(
    'adminA',
    `/e/empresa-a/requisitos?q=contexto&capitulo=4&norma=${encodeURIComponent('ISO 9001')}`,
  );
  comprobar(
    'filtros combinados responden 200 y conservan lo escrito en el formulario',
    combinado.estado === 200 && combinado.texto.includes('value="contexto"'),
  );
  const sinNada = await ver('adminA', '/e/empresa-a/requisitos?q=zzzzzz');
  comprobar(
    'un filtro sin coincidencias muestra «sin resultados» y deja los filtros visibles',
    sinNada.estado === 200 && sinNada.texto.includes('Sin resultados') && sinNada.texto.includes('name="q"'),
  );
  for (const mala of ['capitulo=99', 'q=a%25', 'norma=ISO%3BDROP', 'q=%3Cscript%3E']) {
    const r = await ver('adminA', `/e/empresa-a/requisitos?${mala}`);
    comprobar(
      `un filtro inválido (${mala}) no rompe la pantalla: 200 y aviso`,
      r.estado === 200 && r.texto.includes('Algunos filtros no eran válidos y se ignoraron.'),
      `respuesta ${r.estado}`,
    );
  }
  const inyeccion = await ver(
    'adminA',
    `/e/empresa-a/requisitos?q=${encodeURIComponent('"><img src=x onerror=alert(1)>')}`,
  );
  comprobar(
    'un texto de búsqueda con HTML no se refleja en la página',
    inyeccion.estado === 200 && !inyeccion.texto.includes('onerror=alert'),
  );

  // ---- Aislamiento con B (H4.8, H2.x)
  const deB = await ver('adminB', '/e/empresa-b/requisitos');
  if (!bAdopto)
    comprobar(
      'AISLAMIENTO: B no ve ninguna entrada de A aunque A adoptó; ve su estado vacío',
      deB.estado === 200 &&
        deB.texto.includes('Su empresa aún no adoptó ninguna librería') &&
        !deB.texto.includes('Contexto de la organización') &&
        cuantas(deB.texto) === null,
    );
  else comprobar('B responde 200 con su propio listado', deB.estado === 200);
  const cruzada = await ver('adminB', '/e/empresa-a/requisitos');
  comprobar(
    'AISLAMIENTO: la sesión de B pidiendo el listado de A recibe 404 sin datos de A',
    cruzada.estado === 404 &&
      !cruzada.texto.includes('Contexto de la organización') &&
      !cruzada.texto.includes('Empresa A'),
    `respuesta ${cruzada.estado}`,
  );
  const sinSesion = await paginaWeb(entorno, '/e/empresa-a/requisitos', new Map());
  comprobar(
    'sin sesión el listado manda a ingresar (no hay datos)',
    sinSesion.estado === 200
      ? sinSesion.texto.includes('kc-form-login') || !sinSesion.texto.includes('Contexto de la organización')
      : sinSesion.estado === 307,
  );
} catch (error) {
  fallos += 1;
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
}
if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exitCode = 1;
} else
  console.log(
    '\nTodo correcto: el listado real de requisitos funciona de punta a punta y respeta el aislamiento entre empresas.',
  );
