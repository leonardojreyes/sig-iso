// pnpm web:verify-diagnostico — comprueba con todo REAL (Keycloak, API, PostgreSQL y web) el alcance y el diagnóstico (MVP M2, paso 5):
// evaluar desde la pantalla, concurrencia (versión vieja = conflicto), validaciones, permisos por rol, Origin, bitácora indirecta y
// aislamiento con la empresa B.
// Requiere: Keycloak, API (pnpm dev api), web (pnpm dev web), pnpm db:migrate, pnpm db:seed y la librería cargada y ADOPTADA por A
// (pnpm libraries:load y, por ejemplo, pnpm web:verify-listado).
// OJO: escribe en tu base local de desarrollo (una evaluación y un alcance de A, con la marca «VERIF-»). No borra nada.
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

const MARCA = `VERIF-${Date.now().toString(36)}`;
const RUTA_EVALUAR = '/e/empresa-a/diagnostico/evaluar';
const RUTA_GUARDAR = '/e/empresa-a/alcance/guardar';
const RUTA_APROBAR = '/e/empresa-a/alcance/aprobar';

const campo = (html: string, nombre: string): string | null =>
  new RegExp(`name="${nombre}"[^>]*value="([^"]*)"`).exec(html)?.[1] ?? new RegExp(`value="([^"]*)"[^>]*name="${nombre}"`).exec(html)?.[1] ?? null;
/** Formularios de evaluación de la pantalla, con lo que traen como campos ocultos. */
const filas = (html: string) =>
  [...html.matchAll(/<form[^>]*action="\/e\/empresa-a\/diagnostico\/evaluar"[^>]*>([\s\S]*?)<\/form>/g)].map((m) => ({
    libreriaCodigo: campo(m[1]!, 'libreriaCodigo') ?? '',
    idEstable: campo(m[1]!, 'idEstable') ?? '',
    version: campo(m[1]!, 'version'),
  }));
const normasDelAlcance = (html: string) =>
  [...html.matchAll(/<form[^>]*action="\/e\/empresa-a\/alcance\/guardar"[^>]*>[\s\S]*?<\/form>/g)].map((m) => campo(m[0], 'norma') ?? '');

try {
  const sesion = {
    adminA: await iniciarSesionWeb(entorno, 'admin-a', '/e/empresa-a/diagnostico'),
    colabA: await iniciarSesionWeb(entorno, 'colab-a', '/e/empresa-a/diagnostico'),
    adminB: await iniciarSesionWeb(entorno, 'admin-b', '/e/empresa-b/diagnostico'),
  };
  const ver = (quien: keyof typeof sesion, ruta: string) => paginaWeb(entorno, ruta, sesion[quien]);
  const enviar = (quien: keyof typeof sesion, ruta: string, cuerpo: Record<string, string>, o: { origen?: string | null; metodo?: string } = {}) =>
    enviarWeb(entorno, ruta, sesion[quien], { cuerpo, ...o });

  // ---- Diagnóstico: lo que se ve
  const d0 = await ver('adminA', '/e/empresa-a/diagnostico');
  comprobar('el administrador de A abre el diagnóstico: 200 y sin caché', d0.estado === 200 && /no-store/.test(d0.cabeceras.get('cache-control') ?? ''), `respuesta ${d0.estado}`);
  if (d0.texto.includes('Su empresa aún no adoptó ninguna librería')) throw new Error('A no tiene librerías adoptadas: ejecuta pnpm web:verify-listado primero');
  comprobar('muestra la madurez de la autoevaluación y avisa que no es una probabilidad de certificarse', d0.texto.includes('Madurez de la autoevaluación') && d0.texto.includes('no indica la probabilidad de certificarse'));
  comprobar('la navegación ofrece Diagnóstico y Alcance', d0.texto.includes('href="/e/empresa-a/diagnostico"') && d0.texto.includes('href="/e/empresa-a/alcance"'));
  const formularios = filas(d0.texto);
  comprobar('el administrador ve un formulario de evaluación por entrada', formularios.length > 0, `${formularios.length} formulario(s)`);
  const objetivo = formularios[0];
  if (!objetivo || !objetivo.libreriaCodigo || !objetivo.idEstable) throw new Error('No se encontró una entrada para evaluar');
  aviso(`entrada de prueba: ${objetivo.libreriaCodigo} / ${objetivo.idEstable} (versión vista: ${objetivo.version ?? 'sin evaluar'})`);
  comprobar('el formulario no lleva ningún campo de empresa', !/name="(empresa|empresaId|empresa_id)"/.test(d0.texto));

  const colabD = await ver('colabA', '/e/empresa-a/diagnostico');
  comprobar('el colaborador de A también ve y puede evaluar (200 con formularios)', colabD.estado === 200 && filas(colabD.texto).length > 0);

  // ---- Evaluar desde la pantalla
  const base = { libreriaCodigo: objetivo.libreriaCodigo, idEstable: objetivo.idEstable };
  const e1 = await enviar('adminA', RUTA_EVALUAR, { ...base, estado: 'parcial', comentario: `${MARCA} primera`, fechaObjetivo: '2026-12-31', ...(objetivo.version ? { version: objetivo.version } : {}) });
  comprobar('evaluar «Parcial»: 303 con aviso «evaluado»', e1.estado === 303 && e1.parametros.get('aviso') === 'evaluado', `respuesta ${e1.estado} ${e1.destino ?? ''}`);
  const d1 = await ver('adminA', e1.destino ?? '/e/empresa-a/diagnostico');
  comprobar('la pantalla muestra «Evaluación guardada», el comentario y la fecha', d1.texto.includes('Evaluación guardada') && d1.texto.includes(`${MARCA} primera`) && d1.texto.includes('2026-12-31'));
  const nuevaVersion = filas(d1.texto).find((f) => f.libreriaCodigo === base.libreriaCodigo && f.idEstable === base.idEstable)?.version ?? null;
  comprobar('la versión de la evaluación subió', nuevaVersion !== null && Number(nuevaVersion) === Number(objetivo.version ?? 0) + 1, `${objetivo.version ?? 0} → ${nuevaVersion}`);

  // ---- Concurrencia: usar la versión vieja es un conflicto y no pisa lo guardado
  const viejo = await enviar('colabA', RUTA_EVALUAR, { ...base, estado: 'no_cumple', comentario: `${MARCA} pisada`, ...(objetivo.version ? { version: objetivo.version } : {}) });
  comprobar('con la versión que ya cambió: aviso «conflicto» (nadie pisa a nadie)', viejo.estado === 303 && viejo.parametros.get('aviso') === 'conflicto', viejo.destino ?? '');
  const dConflicto = await ver('adminA', viejo.destino ?? '/e/empresa-a/diagnostico');
  comprobar('se muestra «Otra persona lo cambió antes» y lo guardado sigue igual', dConflicto.texto.includes('Otra persona lo cambió antes') && dConflicto.texto.includes(`${MARCA} primera`) && !dConflicto.texto.includes(`${MARCA} pisada`));
  const e2 = await enviar('colabA', RUTA_EVALUAR, { ...base, estado: 'cumple', comentario: `${MARCA} segunda`, version: String(nuevaVersion) });
  comprobar('el colaborador sí evalúa con la versión vigente', e2.estado === 303 && e2.parametros.get('aviso') === 'evaluado', e2.destino ?? '');
  const sinCambios = await enviar('colabA', RUTA_EVALUAR, { ...base, estado: 'cumple', comentario: `${MARCA} segunda`, version: String(Number(nuevaVersion) + 1) });
  comprobar('repetir lo mismo no es un error', sinCambios.estado === 303 && sinCambios.parametros.get('aviso') === 'evaluado');

  // ---- Validaciones
  const noAplica = await enviar('adminA', RUTA_EVALUAR, { ...base, estado: 'no_aplica', version: String(Number(nuevaVersion) + 1) });
  comprobar('«No aplica» sin motivo: aviso «Revise los datos» (lo decide el dominio)', noAplica.estado === 303 && noAplica.parametros.get('aviso') === 'no_valido', noAplica.destino ?? '');
  for (const [nombre, cuerpo] of [
    ['estado inventado', { ...base, estado: 'quizas' }],
    ['identificador con ruta', { ...base, idEstable: '../etc', estado: 'cumple' }],
    ['entrada que no existe', { ...base, idEstable: 'no-existe-zz', estado: 'cumple' }],
  ] as const) {
    const r = await enviar('adminA', RUTA_EVALUAR, cuerpo);
    comprobar(`${nombre}: no guarda nada`, r.estado === 303 && ['no_valido', 'no_encontrado'].includes(r.parametros.get('aviso') ?? ''), `${r.estado} ${r.destino ?? ''}`);
  }

  // ---- Protecciones del formulario
  for (const [origen, nombre] of [[null, 'sin Origin'], ['null', 'con Origin «null»'], ['https://evil.example', 'con Origin de otro sitio']] as const) {
    const r = await enviar('adminA', RUTA_EVALUAR, { ...base, estado: 'cumple' }, { origen });
    comprobar(`evaluar ${nombre}: 403`, r.estado === 403, `respuesta ${r.estado}`);
  }
  comprobar('un GET a la ruta de evaluar no hace nada (405)', (await enviar('adminA', RUTA_EVALUAR, {}, { metodo: 'GET' })).estado === 405);
  const sinSesion = await enviarWeb(entorno, RUTA_EVALUAR, new Map(), { cuerpo: { ...base, estado: 'cumple' } });
  comprobar('sin sesión manda a ingresar', sinSesion.estado === 303 && (sinSesion.destino ?? '').startsWith('/auth/login'), `${sinSesion.estado} ${sinSesion.destino ?? ''}`);

  // ---- Alcance
  const a0 = await ver('adminA', '/e/empresa-a/alcance');
  const normas = normasDelAlcance(a0.texto).filter(Boolean);
  comprobar('el administrador ve el alcance de cada norma adoptada, editable', a0.estado === 200 && normas.length > 0, normas.join(', '));
  const norma = normas.includes('ISO 9001') ? 'ISO 9001' : normas[0]!;
  const g1 = await enviar('adminA', RUTA_GUARDAR, { norma, texto: `${MARCA} alcance` });
  comprobar('guardar el alcance: aviso «guardado»', g1.estado === 303 && g1.parametros.get('aviso') === 'guardado', g1.destino ?? '');
  const a1 = await ver('adminA', g1.destino ?? '/e/empresa-a/alcance');
  comprobar('la pantalla muestra «Cambios guardados», el texto y «Sin aprobar»', a1.texto.includes('Cambios guardados') && a1.texto.includes(`${MARCA} alcance`) && a1.texto.includes('Sin aprobar'));
  const ap = await enviar('adminA', RUTA_APROBAR, { norma });
  comprobar('aprobar el alcance: aviso «aprobado»', ap.estado === 303 && ap.parametros.get('aviso') === 'aprobado', ap.destino ?? '');
  const a2 = await ver('adminA', ap.destino ?? '/e/empresa-a/alcance');
  comprobar('queda «Aprobado el <fecha>»', /Aprobado el \d{4}-\d{2}-\d{2}/.test(a2.texto));
  const apOtra = await enviar('adminA', RUTA_APROBAR, { norma });
  comprobar('aprobar de nuevo lo ya aprobado es un conflicto, no un error', apOtra.estado === 303 && apOtra.parametros.get('aviso') === 'conflicto', apOtra.destino ?? '');
  const g2 = await enviar('adminA', RUTA_GUARDAR, { norma, texto: `${MARCA} alcance cambiado` });
  const a3 = await ver('adminA', g2.destino ?? '/e/empresa-a/alcance');
  comprobar('cambiar el texto aprobado lo devuelve a «Sin aprobar»', a3.texto.includes('Sin aprobar') && !/Aprobado el \d{4}/.test(a3.texto.split(`${MARCA} alcance cambiado`)[0]!.slice(-2000)));
  const noAdoptada = await enviar('adminA', RUTA_GUARDAR, { norma: 'ISO 42001', texto: 'x' });
  comprobar('el alcance de una norma que la empresa no adoptó: aviso «no encontrado»', noAdoptada.estado === 303 && ['no_encontrado'].includes(noAdoptada.parametros.get('aviso') ?? ''), noAdoptada.destino ?? '');

  // ---- Permisos por rol
  const colabAlcance = await ver('colabA', '/e/empresa-a/alcance');
  comprobar('el colaborador ve el alcance en solo lectura (sin formularios) y con el texto', colabAlcance.estado === 200 && !colabAlcance.texto.includes('/alcance/guardar') && colabAlcance.texto.includes(`${MARCA} alcance cambiado`) && colabAlcance.texto.includes('Solo el administrador SIG puede editar'));
  const colabGuarda = await enviar('colabA', RUTA_GUARDAR, { norma, texto: `${MARCA} colab` });
  comprobar('un colaborador que envía el formulario por otra vía recibe «sin permiso» (lo decide la API)', colabGuarda.estado === 303 && colabGuarda.parametros.get('aviso') === 'sin_permiso', colabGuarda.destino ?? '');
  const colabAprueba = await enviar('colabA', RUTA_APROBAR, { norma });
  comprobar('lo mismo al aprobar', colabAprueba.estado === 303 && colabAprueba.parametros.get('aviso') === 'sin_permiso');
  const aDespues = await ver('adminA', '/e/empresa-a/alcance');
  comprobar('lo del colaborador no cambió el alcance', !aDespues.texto.includes(`${MARCA} colab`));

  // ---- Aislamiento con B
  const bD = await ver('adminB', '/e/empresa-b/diagnostico');
  comprobar('B abre su propio diagnóstico (200) sin nada de A', bD.estado === 200 && !bD.texto.includes(MARCA));
  const bA = await ver('adminB', '/e/empresa-b/alcance');
  comprobar('B abre su propio alcance (200) sin el texto de A', bA.estado === 200 && !bA.texto.includes(MARCA));
  for (const ruta of ['/e/empresa-a/diagnostico', '/e/empresa-a/alcance']) {
    const r = await ver('adminB', ruta);
    comprobar(`AISLAMIENTO: la sesión de B pidiendo ${ruta} de A recibe 404 sin datos`, r.estado === 404 && !r.texto.includes(MARCA), `respuesta ${r.estado}`);
  }
  for (const [ruta, cuerpo] of [[RUTA_EVALUAR, { ...base, estado: 'no_cumple', comentario: `${MARCA} desde B` }], [RUTA_GUARDAR, { norma, texto: `${MARCA} desde B` }], [RUTA_APROBAR, { norma }]] as const) {
    const r = await enviar('adminB', ruta, cuerpo);
    comprobar(`AISLAMIENTO: B enviando a ${ruta} de A recibe 404 y no cambia nada`, r.estado === 404, `respuesta ${r.estado}`);
  }
  const finalA = await ver('adminA', '/e/empresa-a/diagnostico');
  comprobar('A sigue viendo lo suyo y nada de B', finalA.texto.includes(`${MARCA} segunda`) && !finalA.texto.includes('desde B'));
} catch (error) {
  fallos += 1;
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
}
if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exitCode = 1;
} else console.log('\nTodo correcto: el alcance y el diagnóstico funcionan de punta a punta y respetan permisos, concurrencia y aislamiento.');
