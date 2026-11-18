// pnpm web:verify-riesgos — comprueba con todo REAL (Keycloak, API, PostgreSQL y web) los riesgos mínimos y la Declaración justificada
// (ADR 037): crear, cambiar y retirar riesgos, vincularlos con controles y prever el tratamiento con un control del Anexo A, el motivo
// de inclusión, las referencias al tratamiento, el BLOQUEO de aprobar sin motivo, la versión congelada que no cambia aunque cambie un
// riesgo, el Word con su sección «Tratamiento de riesgos», permisos por rol, Origin y aislamiento con la empresa B.
// Requiere: Keycloak, API (pnpm dev api), web (pnpm dev web), pnpm db:migrate, pnpm db:seed y el Anexo A de 27001 adoptado por A.
// OJO: escribe en tu base local de desarrollo. Repetible y limpio: todo lo que crea lleva la marca «VERIF-» y al terminar QUITA los
// motivos, QUITA la referencia, quita los vínculos, RETIRA los riesgos y el control de prueba. Lo que no se puede deshacer por diseño queda:
// los riesgos y el control retirados (conservan su historia), las evaluaciones «Parcial» de lo que faltaba evaluar y las versiones
// aprobadas de la declaración (inmutables).
// Va despacio a propósito: la API limita a 120 peticiones por minuto por persona y hay que registrar un motivo por cada control.
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
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MARCA = `VERIF-${Date.now().toString(36)}`;
const A = '/e/empresa-a';
const B = '/e/empresa-b';
const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ID_FALSO = 'eeeeeeee-0000-4000-8000-000000000000';

/** Texto de `word/document.xml` de un .docx, leído por el directorio central del ZIP (solo para comprobar). */
const textoDelDocx = (zip: Uint8Array): string | null => {
  const b = Buffer.from(zip);
  let fin = -1;
  for (let i = b.length - 22; i >= 0; i--)
    if (b.readUInt32LE(i) === 0x06054b50) {
      fin = i;
      break;
    }
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
  new RegExp(`name="${nombre}"[^>]*value="([^"]*)"`).exec(html)?.[1] ??
  new RegExp(`value="([^"]*)"[^>]*name="${nombre}"`).exec(html)?.[1] ??
  null;
/** El interior del primer formulario cuya acción termina así (para leer sus campos ocultos). */
const formulario = (html: string, accion: string): string | null =>
  new RegExp(`<form[^>]*action="[^"]*${accion}"[^>]*>([\\s\\S]*?)</form>`).exec(html)?.[1] ?? null;
const textoPlano = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
const botonDeshabilitado = (html: string, texto: string): boolean =>
  new RegExp(`<button(?=[^>]*\\sdisabled(?:=""|\\s|>))[^>]*>${texto}`).test(html);
const idsDeVersiones = (html: string) =>
  [...html.matchAll(new RegExp(`href="${A}/declaracion/versiones/(${UUID_RE})"`, 'g'))]
    .map((m) => m[1]!)
    .filter((v, i, a) => a.indexOf(v) === i);

/** Filas de la tabla de la declaración con su entrada y si les falta el motivo. */
const filasDeclaracion = (html: string) =>
  html
    .split('<tr')
    .filter((f) => f.includes('class="font-mono"'))
    .map((f) => f.split('</tr>')[0] ?? f)
    .map((f) => ({
      id: /class="font-mono">([^<]+)</.exec(f)?.[1] ?? '',
      porDecidir: f.includes('>Por decidir<'),
      sinMotivo: f.includes('>Sin motivo<'),
      entrada: /name="entrada" value="([^"]+)"/.exec(f)?.[1] ?? null,
      texto: f,
    }));
const formsEvaluar = (html: string) =>
  [...html.matchAll(/<form[^>]*action="\/e\/empresa-a\/diagnostico\/evaluar"[^>]*>([\s\S]*?)<\/form>/g)].map((m) => ({
    libreriaCodigo: campo(m[1]!, 'libreriaCodigo') ?? '',
    idEstable: campo(m[1]!, 'idEstable') ?? '',
    version: campo(m[1]!, 'version'),
  }));

/** Los riesgos de la lista: el id (del enlace), el código y el texto de la fila que lleva la marca de esta ejecución. */
const riesgoDeLaLista = (html: string, titulo: string) => {
  // Solo hasta el cierre de la fila: la última arrastraría el resto de la página.
  const fila = html.split('<tr').map((f) => f.split('</tr>')[0] ?? f).find((f) => f.includes(titulo));
  if (!fila) return null;
  return {
    id: new RegExp(`/e/empresa-a/riesgos/(${UUID_RE})`).exec(fila)?.[1] ?? '',
    codigo: /R-\d{3,6}/.exec(fila)?.[0] ?? '',
    texto: textoPlano(fila),
  };
};

const creados = { motivos: 0, riesgos: [] as string[], control: null as string | null };
let referenciaCreada = false;

try {
  const sesion = {
    adminA: await iniciarSesionWeb(entorno, 'admin-a', `${A}/riesgos`),
    colabA: await iniciarSesionWeb(entorno, 'colab-a', `${A}/riesgos`),
    adminB: await iniciarSesionWeb(entorno, 'admin-b', `${B}/riesgos`),
  };
  const ver = (quien: keyof typeof sesion, ruta: string) => paginaWeb(entorno, ruta, sesion[quien]);
  const enviar = (
    quien: keyof typeof sesion,
    ruta: string,
    o: { origen?: string | null; metodo?: string; cuerpo?: Record<string, string> } = {},
  ) => enviarWeb(entorno, ruta, sesion[quien], o);
  const bajar = (quien: keyof typeof sesion, ruta: string) => descargarWeb(entorno, ruta, sesion[quien]);

  // ---- Lectura, permisos y aislamiento antes de escribir nada
  const lista0 = await ver('adminA', `${A}/riesgos`);
  comprobar(
    'el administrador abre Riesgos: 200 y sin caché',
    lista0.estado === 200 && /no-store/.test(lista0.cabeceras.get('cache-control') ?? ''),
    `respuesta ${lista0.estado}`,
  );
  comprobar(
    'la navegación ofrece «Riesgos» como página actual',
    /href="\/e\/empresa-a\/riesgos"[^>]*aria-current="page"/.test(lista0.texto) ||
      /aria-current="page"[^>]*href="\/e\/empresa-a\/riesgos"/.test(lista0.texto),
  );
  comprobar(
    'el administrador ve el formulario de creación, por POST y sin campos de empresa, nivel ni código',
    /<form[^>]*action="\/e\/empresa-a\/riesgos\/crear"/.test(lista0.texto) &&
      !/name="(empresa|empresaId|nivel|codigo|estado)"/.test(formulario(lista0.texto, '/riesgos/crear') ?? ''),
  );
  const responsable = /<select[^>]*id="nuevo-responsable"[\s\S]*?<\/select>/.exec(lista0.texto)?.[0];
  const personaId = responsable ? [...responsable.matchAll(/<option value="([0-9a-f-]{36})"/g)][0]?.[1] : undefined;
  comprobar('el formulario ofrece personas de la empresa como responsables', !!personaId);
  const colab0 = await ver('colabA', `${A}/riesgos`);
  comprobar(
    'el colaborador ve Riesgos pero NO el formulario de creación',
    colab0.estado === 200 && !colab0.texto.includes('/riesgos/crear') && colab0.texto.includes('Solo el administrador SIG'),
  );
  comprobar('AISLAMIENTO: la sesión de B pidiendo los riesgos de A recibe 404', (await ver('adminB', `${A}/riesgos`)).estado === 404);
  comprobar('la empresa B abre sus propios riesgos', (await ver('adminB', `${B}/riesgos`)).estado === 200);

  const datos = {
    titulo: `${MARCA} Pérdida de portátiles`,
    descripcion: 'Descripción de prueba',
    probabilidad: '3',
    impacto: '4',
    decision: 'mitigar',
    responsableId: '',
  };
  const sinPermiso = await enviar('colabA', `${A}/riesgos/crear`, { cuerpo: datos });
  comprobar(
    'un colaborador que envía «crear» por otra vía recibe «sin permiso» (lo decide la API)',
    sinPermiso.estado === 303 && sinPermiso.parametros.get('aviso') === 'sin_permiso',
    sinPermiso.destino ?? '',
  );
  for (const [origen, nombre] of [
    [null, 'sin Origin'],
    ['null', 'con Origin «null»'],
    ['https://evil.example', 'con Origin de otro sitio'],
  ] as const) {
    comprobar(`crear ${nombre}: 403`, (await enviar('adminA', `${A}/riesgos/crear`, { origen, cuerpo: datos })).estado === 403);
  }
  comprobar(
    'un GET a la ruta de crear no hace nada (405)',
    (await enviar('adminA', `${A}/riesgos/crear`, { metodo: 'GET' })).estado === 405,
  );
  comprobar(
    'AISLAMIENTO: B enviando «crear» a la ruta de A recibe 404',
    (await enviar('adminB', `${A}/riesgos/crear`, { cuerpo: datos })).estado === 404,
  );
  comprobar(
    'sin sesión, crear lleva a ingresar',
    await (async () => {
      const r = await enviarWeb(entorno, `${A}/riesgos/crear`, new Map(), { cuerpo: datos });
      return r.estado === 303 && (r.destino ?? '').startsWith('/auth/login');
    })(),
  );

  // ---- Crear (y lo que se rechaza)
  const malo1 = await enviar('adminA', `${A}/riesgos/crear`, { cuerpo: { ...datos, probabilidad: '9' } });
  comprobar(
    'una probabilidad fuera de 1 a 5 se rechaza («no_valido») y no se crea nada',
    malo1.estado === 303 && malo1.parametros.get('aviso') === 'no_valido',
  );
  const malo2 = await enviar('adminA', `${A}/riesgos/crear`, { cuerpo: { ...datos, decision: 'aceptar' } });
  comprobar(
    '«aceptar» sin responsable lo rechaza la API («no_valido»)',
    malo2.estado === 303 && malo2.parametros.get('aviso') === 'no_valido',
  );
  const c1 = await enviar('adminA', `${A}/riesgos/crear`, { cuerpo: datos });
  comprobar(
    'crear un riesgo: 303 con aviso «riesgo_creado»',
    c1.estado === 303 && c1.parametros.get('aviso') === 'riesgo_creado',
    `${c1.estado} ${c1.destino ?? ''}`,
  );
  const lista1 = await ver('adminA', `${A}/riesgos`);
  const r1 = riesgoDeLaLista(lista1.texto, datos.titulo);
  if (!r1 || !r1.id) throw new Error('No se encontró el riesgo recién creado en la lista');
  creados.riesgos.push(r1.id);
  comprobar(
    `aparece en la lista con su código correlativo (${r1.codigo}) y su nivel en palabras`,
    /^R-\d{3,6}$/.test(r1.codigo) && r1.texto.includes('Alto (3 × 4 = 12)'),
    r1.texto.slice(0, 200),
  );
  comprobar(
    'un «mitigar» sin ningún control ni tratamiento previsto se señala',
    r1.texto.includes('Mitigar sin ningún control ni tratamiento previsto'),
  );
  if (personaId) {
    const c2 = await enviar('adminA', `${A}/riesgos/crear`, {
      cuerpo: {
        ...datos,
        titulo: `${MARCA} Fuga de información`,
        decision: 'aceptar',
        probabilidad: '2',
        impacto: '2',
        responsableId: personaId,
      },
    });
    comprobar('«aceptar» CON responsable se crea', c2.estado === 303 && c2.parametros.get('aviso') === 'riesgo_creado');
    const r2 = riesgoDeLaLista((await ver('adminA', `${A}/riesgos`)).texto, `${MARCA} Fuga de información`);
    if (r2?.id) creados.riesgos.push(r2.id);
    comprobar(
      'el segundo riesgo tiene el código siguiente y no se señala como sin tratamiento (no se mitiga)',
      !!r2 && r2.codigo !== r1.codigo && !r2.texto.includes('Mitigar sin ningún control'),
    );
  }

  // ---- Detalle, aislamiento y cambios con versión
  const d1 = await ver('adminA', `${A}/riesgos/${r1.id}`);
  comprobar(
    'el detalle se abre: 200, sin caché, con su código y su nivel',
    d1.estado === 200 &&
      /no-store/.test(d1.cabeceras.get('cache-control') ?? '') &&
      d1.texto.includes(r1.codigo) &&
      d1.texto.includes('Alto (3 × 4 = 12)'),
  );
  comprobar(
    'AISLAMIENTO: B pidiendo el detalle por la ruta de A recibe 404',
    (await ver('adminB', `${A}/riesgos/${r1.id}`)).estado === 404,
  );
  comprobar(
    'AISLAMIENTO: B pidiendo el riesgo de A por SU ruta recibe 404 (igual que uno inexistente)',
    (await ver('adminB', `${B}/riesgos/${r1.id}`)).estado === 404 && (await ver('adminB', `${B}/riesgos/${ID_FALSO}`)).estado === 404,
  );
  comprobar('un identificador que no es UUID es 404', (await ver('adminA', `${A}/riesgos/no-es-uuid`)).estado === 404);
  const dColab = await ver('colabA', `${A}/riesgos/${r1.id}`);
  comprobar(
    'el colaborador ve el detalle sin ninguna acción',
    dColab.estado === 200 &&
      !dColab.texto.includes('/riesgos/cambiar') &&
      !dColab.texto.includes('/riesgos/retirar') &&
      !dColab.texto.includes('/riesgos/vincular'),
  );
  comprobar(
    'el aviso previo al retiro dice que no deja controles sin motivo (aún no tiene vínculos)',
    d1.texto.includes('no deja ningún control del Anexo A sin motivo'),
  );

  const formCambiar = formulario(d1.texto, '/riesgos/cambiar');
  const version1 = formCambiar ? campo(formCambiar, 'version') : null;
  const cambio = {
    riesgoId: r1.id,
    version: version1 ?? '1',
    titulo: datos.titulo,
    descripcion: datos.descripcion,
    probabilidad: '5',
    impacto: '5',
    decision: 'mitigar',
    responsableId: '',
  };
  const ch = await enviar('adminA', `${A}/riesgos/cambiar`, { cuerpo: cambio });
  comprobar(
    'cambiar con la versión que se vio: «guardado» y vuelve al detalle',
    ch.estado === 303 && ch.parametros.get('aviso') === 'guardado' && ch.destino?.startsWith(`${A}/riesgos/${r1.id}`) === true,
    ch.destino ?? '',
  );
  comprobar(
    'el nivel se recalcula y se muestra con palabras («Crítico (5 × 5 = 25)»)',
    (await ver('adminA', `${A}/riesgos/${r1.id}`)).texto.includes('Crítico (5 × 5 = 25)'),
  );
  const viejo = await enviar('adminA', `${A}/riesgos/cambiar`, { cuerpo: { ...cambio, impacto: '1' } });
  comprobar(
    'cambiar con una versión vieja: «conflicto» («otra persona lo cambió antes») y no pisa nada',
    viejo.estado === 303 &&
      viejo.parametros.get('aviso') === 'conflicto' &&
      (await ver('adminA', `${A}/riesgos/${r1.id}`)).texto.includes('Crítico (5 × 5 = 25)'),
  );
  comprobar(
    'AISLAMIENTO: B cambiando el riesgo de A recibe 404 y no cambia nada',
    (await enviar('adminB', `${A}/riesgos/cambiar`, { cuerpo: cambio })).estado === 404,
  );

  // ---- Vínculos: con un control de la empresa y con un control del Anexo A (tratamiento previsto)
  const codigoControl = `RV-${Date.now().toString(36).slice(-7)}`;
  const cc = await enviar('adminA', `${A}/controles/crear`, {
    cuerpo: { codigo: codigoControl, nombre: `${MARCA} Cifrado de discos`, descripcion: '' },
  });
  comprobar('se crea un control de prueba para vincular', cc.estado === 303 && cc.parametros.get('aviso') === 'creado');
  const idControl = new RegExp(`${A}/controles/(${UUID_RE})[^>]*>[\\s\\S]{0,400}?`).exec(
    (await ver('adminA', `${A}/controles`)).texto.split('<tr').find((f) => f.includes(codigoControl)) ?? '',
  )?.[1];
  if (!idControl) throw new Error('No se encontró el control de prueba');
  creados.control = idControl;
  const v1 = await enviar('adminA', `${A}/riesgos/vincular`, { cuerpo: { riesgoId: r1.id, controlId: idControl } });
  comprobar(
    'vincular el riesgo con el control: «vinculado»',
    v1.estado === 303 && v1.parametros.get('aviso') === 'vinculado',
    v1.destino ?? '',
  );
  comprobar(
    'repetir el vínculo no es un error («sin_cambios»)',
    (await enviar('adminA', `${A}/riesgos/vincular`, { cuerpo: { riesgoId: r1.id, controlId: idControl } })).parametros.get('aviso') ===
      'sin_cambios',
  );
  const d2 = await ver('adminA', `${A}/riesgos/${r1.id}`);
  comprobar(
    'el detalle muestra el control que lo trata',
    d2.texto.includes(codigoControl) && d2.texto.includes(`${MARCA} Cifrado de discos`),
  );
  const l2 = riesgoDeLaLista((await ver('adminA', `${A}/riesgos`)).texto, datos.titulo);
  comprobar(
    'la lista cuenta el control y ya no lo señala como «sin tratamiento»',
    !!l2 && l2.texto.includes('1 control') && !l2.texto.includes('Mitigar sin ningún control'),
  );
  comprobar(
    'AISLAMIENTO: B no puede vincular el riesgo de A (404) ni ver el control de A',
    (await enviar('adminB', `${A}/riesgos/vincular`, { cuerpo: { riesgoId: r1.id, controlId: idControl } })).estado === 404,
  );
  const q1 = await enviar('adminA', `${A}/riesgos/desvincular`, { cuerpo: { riesgoId: r1.id, controlId: idControl } });
  comprobar(
    'quitar el vínculo: «desvinculado»; repetirlo da «no_encontrado»',
    q1.parametros.get('aviso') === 'desvinculado' &&
      (await enviar('adminA', `${A}/riesgos/desvincular`, { cuerpo: { riesgoId: r1.id, controlId: idControl } })).parametros.get(
        'aviso',
      ) === 'no_encontrado',
  );

  // ---- La Declaración: el control del Anexo A que se tratará como «tratamiento previsto» y los que necesitarán motivo
  const antesVersiones = idsDeVersiones((await ver('adminA', `${A}/declaracion`)).texto);
  let decl = await ver('adminA', `${A}/declaracion`);
  if (decl.texto.includes('No hay controles del Anexo A'))
    throw new Error('A no tiene el Anexo A de 27001 adoptado: ejecuta pnpm libraries:load y pnpm web:verify-listado primero');
  const pendientes = filasDeclaracion(decl.texto).filter((f) => f.porDecidir);
  if (pendientes.length > 0) {
    const forms = formsEvaluar((await ver('adminA', `${A}/diagnostico`)).texto);
    for (const f of pendientes) {
      const form = forms.find((x) => x.idEstable === f.id && !x.version);
      if (form)
        await enviar('adminA', `${A}/diagnostico/evaluar`, {
          cuerpo: {
            libreriaCodigo: form.libreriaCodigo,
            idEstable: form.idEstable,
            estado: 'parcial',
            comentario: `${MARCA} para poder aprobar`,
          },
        });
      await esperar(400);
    }
    decl = await ver('adminA', `${A}/declaracion`);
    aviso(`se evaluaron ${pendientes.length} controles por decidir como «Parcial»`);
  }
  const sinMotivo = filasDeclaracion(decl.texto).filter((f) => f.sinMotivo && f.entrada);
  aviso(`${sinMotivo.length} control(es) que aplican y todavía sin motivo de inclusión`);
  if (sinMotivo.length < 2)
    throw new Error('Se necesitan al menos 2 controles sin motivo para la comprobación; ya tienen motivos registrados por otra vía');
  const [objetivo, ...resto] = sinMotivo as [(typeof sinMotivo)[number], ...(typeof sinMotivo)[number][]];
  comprobar(
    'SIN MOTIVO NO SE PUEDE APROBAR: la pantalla lo avisa y «Aprobar» queda deshabilitado',
    decl.texto.includes('Faltan motivos de inclusión') && botonDeshabilitado(decl.texto, 'Aprobar la declaración'),
  );
  const rechazo = await enviar('adminA', `${A}/declaracion/aprobar`);
  comprobar(
    'aprobar de todos modos (por otra vía): «declaracion_no_aprobada» y ninguna versión nueva',
    rechazo.parametros.get('aviso') === 'declaracion_no_aprobada' &&
      idsDeVersiones((await ver('adminA', `${A}/declaracion`)).texto).length === antesVersiones.length,
  );

  // El riesgo trata el control del Anexo A como «tratamiento previsto»: cuenta como motivo «riesgo» y se distingue
  const dPrev = await ver('adminA', `${A}/riesgos/${r1.id}`);
  const opciones = [
    ...(/<select[^>]*id="prever-entrada"[\s\S]*?<\/select>/.exec(dPrev.texto)?.[0] ?? '').matchAll(/<option value="([^"]+\|[^"]+)"/g),
  ].map((m) => m[1]!);
  comprobar(
    'el detalle ofrece controles del Anexo A para prever el tratamiento',
    opciones.includes(objetivo.entrada!),
    `${opciones.length} opciones`,
  );
  const pv = await enviar('adminA', `${A}/riesgos/prever`, { cuerpo: { riesgoId: r1.id, entrada: objetivo.entrada! } });
  comprobar(
    `prever el tratamiento con ${objetivo.id}: «tratamiento_previsto»; repetirlo: «sin_cambios»`,
    pv.parametros.get('aviso') === 'tratamiento_previsto' &&
      (await enviar('adminA', `${A}/riesgos/prever`, { cuerpo: { riesgoId: r1.id, entrada: objetivo.entrada! } })).parametros.get(
        'aviso',
      ) === 'sin_cambios',
  );
  const noControl = await enviar('adminA', `${A}/riesgos/prever`, { cuerpo: { riesgoId: r1.id, entrada: 'ejemplo-ha|ha-4.1' } });
  comprobar(
    'una entrada que no es un control del Anexo A adoptado se rechaza («no_encontrado»)',
    noControl.parametros.get('aviso') === 'no_encontrado',
  );
  comprobar(
    'AISLAMIENTO: B no puede prever tratamiento en el riesgo de A (404)',
    (await enviar('adminB', `${A}/riesgos/prever`, { cuerpo: { riesgoId: r1.id, entrada: objetivo.entrada! } })).estado === 404,
  );
  decl = await ver('adminA', `${A}/declaracion`);
  const filaObjetivo = filasDeclaracion(decl.texto).find((f) => f.id === objetivo.id);
  comprobar(
    'la fila muestra el riesgo con su vía «tratamiento previsto, sin control de la empresa», y ya no dice «Sin motivo»',
    !!filaObjetivo &&
      !filaObjetivo.sinMotivo &&
      textoPlano(filaObjetivo.texto).includes(`${r1.codigo} · ${datos.titulo}`) &&
      textoPlano(filaObjetivo.texto).includes('tratamiento previsto, sin control de la empresa'),
  );
  comprobar(
    'la pantalla advierte (sin bloquear) que hay riesgos «mitigar» sin la referencia al plan de tratamiento',
    decl.texto.includes('no se registró la referencia al plan de tratamiento'),
  );

  // ---- Referencias al tratamiento
  const ref = {
    tipo: 'plan',
    titulo: `${MARCA} Plan de tratamiento`,
    versionDoc: '1.0',
    fecha: '2026-11-01',
    ubicacion: `${MARCA} SIG-PL-004`,
  };
  const rf = await enviar('adminA', `${A}/declaracion/referencia/guardar`, { cuerpo: ref });
  referenciaCreada = rf.parametros.get('aviso') === 'referencia_guardada';
  comprobar('registrar la referencia al plan de tratamiento: «referencia_guardada»', referenciaCreada, rf.destino ?? '');
  decl = await ver('adminA', `${A}/declaracion`);
  comprobar(
    'la pantalla la muestra y la advertencia del plan desaparece',
    textoPlano(decl.texto).includes(`${MARCA} Plan de tratamiento · versión 1.0 · 2026-11-01`) &&
      !decl.texto.includes('no se registró la referencia al plan de tratamiento'),
  );
  const formRef = [...decl.texto.matchAll(/<form[^>]*action="\/e\/empresa-a\/declaracion\/referencia\/guardar"[^>]*>([\s\S]*?)<\/form>/g)]
    .map((m) => m[1]!)
    .find((f) => f.includes(MARCA) && campo(f, 'version'));
  const versionRef = formRef ? campo(formRef, 'version') : null;
  const rf2 = await enviar('adminA', `${A}/declaracion/referencia/guardar`, {
    cuerpo: { ...ref, versionDoc: '1.1', version: versionRef ?? '1' },
  });
  comprobar(
    'cambiar la referencia con la versión vista: «referencia_guardada»; con la vieja: «conflicto»',
    rf2.parametros.get('aviso') === 'referencia_guardada' &&
      (
        await enviar('adminA', `${A}/declaracion/referencia/guardar`, { cuerpo: { ...ref, versionDoc: '1.2', version: versionRef ?? '1' } })
      ).parametros.get('aviso') === 'conflicto',
  );
  comprobar(
    'el colaborador ve la referencia pero no puede cambiarla',
    await (async () => {
      const p = await ver('colabA', `${A}/declaracion`);
      return (
        p.estado === 200 &&
        textoPlano(p.texto).includes(`${MARCA} Plan de tratamiento`) &&
        !p.texto.includes('/declaracion/referencia/guardar')
      );
    })(),
  );
  comprobar(
    'un colaborador que intenta guardar una referencia por otra vía recibe «sin permiso»',
    (await enviar('colabA', `${A}/declaracion/referencia/guardar`, { cuerpo: ref })).parametros.get('aviso') === 'sin_permiso',
  );
  comprobar(
    'AISLAMIENTO: B guardando una referencia por la ruta de A recibe 404',
    (await enviar('adminB', `${A}/declaracion/referencia/guardar`, { cuerpo: ref })).estado === 404,
  );

  // ---- Motivos en el resto de los controles (despacio: un motivo por control y 120 peticiones por minuto como máximo)
  let registrados = 0;
  for (const f of resto) {
    const m = await enviar('adminA', `${A}/declaracion/motivo/guardar`, {
      cuerpo: { entrada: f.entrada!, tipo: 'negocio', nota: `${MARCA} necesidad del negocio` },
    });
    if (m.estado === 303 && m.parametros.get('aviso') === 'motivo_guardado') registrados += 1;
    await esperar(900);
  }
  creados.motivos = registrados;
  comprobar(
    `se registró un motivo en cada uno de los otros ${resto.length} controles`,
    registrados === resto.length,
    `${registrados} de ${resto.length}`,
  );
  const sinNota = await enviar('adminA', `${A}/declaracion/motivo/guardar`, {
    cuerpo: { entrada: objetivo.entrada!, tipo: 'legal', nota: '   ' },
  });
  comprobar('un motivo sin nota se rechaza («no_valido»)', sinNota.parametros.get('aviso') === 'no_valido');
  const colabMotivo = await enviar('colabA', `${A}/declaracion/motivo/guardar`, {
    cuerpo: { entrada: objetivo.entrada!, tipo: 'legal', nota: 'x' },
  });
  comprobar(
    'un colaborador que intenta registrar un motivo por otra vía recibe «sin permiso»',
    colabMotivo.parametros.get('aviso') === 'sin_permiso',
  );
  decl = await ver('adminA', `${A}/declaracion`);
  comprobar(
    'con todos los motivos (o un riesgo que los sostiene) ya no faltan y «Aprobar» se habilita',
    !decl.texto.includes('Faltan motivos de inclusión') && !botonDeshabilitado(decl.texto, 'Aprobar la declaración'),
  );

  // ---- El borrador en Word ya lleva la justificación
  const w0 = await bajar('adminA', `${A}/declaracion/documento`);
  const xml0 = textoDelDocx(w0.bytes) ?? '';
  comprobar(
    'el Word del borrador lleva la sección «Tratamiento de riesgos», el riesgo, la referencia y el rótulo de preliminar',
    w0.estado === 200 &&
      xml0.includes('Tratamiento de riesgos') &&
      xml0.includes(r1.codigo) &&
      xml0.includes(`${MARCA} Plan de tratamiento`) &&
      xml0.includes('DOCUMENTO PRELIMINAR'),
  );
  comprobar(
    'lleva los avisos fijos de lo que no cubre (riesgo residual, controles adicionales, activos)',
    /no registra el riesgo residual/.test(xml0) &&
      /no incluye controles adicionales/.test(xml0) &&
      /no contempla activos de información/.test(xml0),
  );
  comprobar(
    'imprime la escala del nivel y dice que es el método por omisión, no el criterio de la empresa',
    xml0.includes('Crítico: 16 a 25') && /no es el criterio de aceptación de la empresa/.test(xml0),
  );
  comprobar(
    'la fila del control con tratamiento previsto lo distingue y no dice «Sin motivo»',
    xml0.includes('Tratamiento previsto, sin control de la empresa') && !xml0.includes('Sin motivo'),
  );

  // ---- Aprobar: la versión congela la justificación
  const ap = await enviar('adminA', `${A}/declaracion/aprobar`);
  comprobar(
    'aprobar: «declaracion_aprobada»',
    ap.estado === 303 && ap.parametros.get('aviso') === 'declaracion_aprobada',
    `${ap.estado} ${ap.destino ?? ''}`,
  );
  const despues = idsDeVersiones((await ver('adminA', ap.destino ?? `${A}/declaracion`)).texto);
  const nueva = despues.find((id) => !antesVersiones.includes(id));
  comprobar('aparece UNA versión nueva en el historial', despues.length === antesVersiones.length + 1 && !!nueva);
  if (!nueva) throw new Error('No se encontró la versión recién aprobada');
  const vp = await ver('colabA', `${A}/declaracion/versiones/${nueva}`);
  const vTexto = textoPlano(vp.texto);
  comprobar(
    'la versión muestra lo que se congeló: el riesgo, su nivel, el motivo con su nota y la referencia',
    vp.estado === 200 &&
      vTexto.includes(`${r1.codigo} · ${datos.titulo}`) &&
      vTexto.includes('Crítico (5 × 5 = 25)') &&
      vTexto.includes(`${MARCA} necesidad del negocio`) &&
      vTexto.includes(`${MARCA} Plan de tratamiento · versión 1.1`) &&
      vTexto.includes('Crítico: 16 a 25'),
  );
  const wv = await bajar('colabA', `${A}/declaracion/versiones/${nueva}/documento`);
  const xmlv = textoDelDocx(wv.bytes) ?? '';
  comprobar(
    'el Word de la versión lleva la justificación y NO el rótulo de preliminar',
    wv.estado === 200 &&
      xmlv.includes('Tratamiento de riesgos') &&
      xmlv.includes(r1.codigo) &&
      !xmlv.includes('PRELIMINAR') &&
      /Versión \d+, aprobada el/.test(xmlv),
  );
  comprobar(
    'AISLAMIENTO: B no puede abrir la versión de A ni su Word',
    (await ver('adminB', `${A}/declaracion/versiones/${nueva}`)).estado === 404 &&
      (await bajar('adminB', `${A}/declaracion/versiones/${nueva}/documento`)).estado === 404,
  );

  // ---- Cambiar un riesgo después NO altera la versión aprobada
  const dAhora = await ver('adminA', `${A}/riesgos/${r1.id}`);
  const vAhora = campo(formulario(dAhora.texto, '/riesgos/cambiar') ?? '', 'version') ?? '1';
  const tituloNuevo = `${MARCA} OTRO-TITULO`;
  const ch2 = await enviar('adminA', `${A}/riesgos/cambiar`, {
    cuerpo: {
      riesgoId: r1.id,
      version: vAhora,
      titulo: tituloNuevo,
      descripcion: '',
      probabilidad: '1',
      impacto: '1',
      decision: 'mitigar',
      responsableId: '',
    },
  });
  comprobar('después de aprobar se cambia el riesgo (título y nivel)', ch2.parametros.get('aviso') === 'guardado');
  const vp2 = textoPlano((await ver('adminA', `${A}/declaracion/versiones/${nueva}`)).texto);
  comprobar(
    'LA VERSIÓN APROBADA NO CAMBIÓ: sigue con el título y el nivel de cuando se aprobó',
    vp2.includes(`${r1.codigo} · ${datos.titulo}`) && vp2.includes('Crítico (5 × 5 = 25)') && !vp2.includes('OTRO-TITULO'),
  );
  const borrador = textoPlano((await ver('adminA', `${A}/declaracion`)).texto);
  comprobar('el borrador de hoy sí refleja el cambio', borrador.includes('OTRO-TITULO'));
  const xmlv2 = textoDelDocx((await bajar('adminA', `${A}/declaracion/versiones/${nueva}/documento`)).bytes) ?? '';
  comprobar(
    'el Word de la versión tampoco cambió (sale de la copia congelada)',
    xmlv2.includes(datos.titulo) && !xmlv2.includes('OTRO-TITULO'),
  );

  // ---- Retirar el riesgo: el aviso previo dice qué controles quedarían sin motivo
  const dRet = await ver('adminA', `${A}/riesgos/${r1.id}`);
  const dRetTexto = textoPlano(dRet.texto);
  comprobar(
    `AVISO PREVIO: antes de retirar, el detalle dice que ${objetivo.id} quedaría sin motivo`,
    dRetTexto.includes('quedará sin motivo') &&
      dRetTexto.includes(objetivo.id) &&
      dRetTexto.includes('Sin motivo no se podrá aprobar la Declaración'),
  );
  comprobar(
    'el aviso aparece ANTES del botón de retirar',
    dRet.texto.indexOf('quedará sin motivo') > -1 && dRet.texto.indexOf('quedará sin motivo') < dRet.texto.indexOf('/riesgos/retirar'),
  );
  const retiroColab = await enviar('colabA', `${A}/riesgos/retirar`, { cuerpo: { riesgoId: r1.id, version: '1' } });
  comprobar('un colaborador que intenta retirar por otra vía recibe «sin permiso»', retiroColab.parametros.get('aviso') === 'sin_permiso');
  comprobar(
    'AISLAMIENTO: B retirando el riesgo de A recibe 404',
    (await enviar('adminB', `${A}/riesgos/retirar`, { cuerpo: { riesgoId: r1.id, version: '1' } })).estado === 404,
  );
  const vRet = campo(formulario(dRet.texto, '/riesgos/retirar') ?? '', 'version') ?? '1';
  const rt = await enviar('adminA', `${A}/riesgos/retirar`, { cuerpo: { riesgoId: r1.id, version: vRet } });
  comprobar('retirar el riesgo: «riesgo_retirado» (no se borra)', rt.parametros.get('aviso') === 'riesgo_retirado');
  const retirado = await ver('adminA', `${A}/riesgos/${r1.id}`);
  comprobar(
    'el riesgo retirado sigue abierto, marcado y sin acciones',
    retirado.estado === 200 && retirado.texto.includes('Este riesgo está retirado') && !retirado.texto.includes('/riesgos/cambiar'),
  );
  comprobar(
    'la lista no trae los retirados salvo que se pidan',
    !riesgoDeLaLista((await ver('adminA', `${A}/riesgos`)).texto, datos.titulo) &&
      !!riesgoDeLaLista((await ver('adminA', `${A}/riesgos?retirados=true`)).texto, tituloNuevo),
  );
  decl = await ver('adminA', `${A}/declaracion`);
  comprobar(
    `al retirar el único riesgo que sostenía ${objetivo.id}, vuelve a faltar su motivo y «Aprobar» se deshabilita`,
    decl.texto.includes('Faltan motivos de inclusión') && botonDeshabilitado(decl.texto, 'Aprobar la declaración'),
  );
  const noAprobada = await enviar('adminA', `${A}/declaracion/aprobar`);
  comprobar(
    'aprobar de todos modos: «declaracion_no_aprobada»; la versión ya aprobada no cambió',
    noAprobada.parametros.get('aviso') === 'declaracion_no_aprobada' &&
      textoPlano((await ver('adminA', `${A}/declaracion/versiones/${nueva}`)).texto).includes(`${r1.codigo} · ${datos.titulo}`),
  );
  const m2 = await enviar('adminA', `${A}/declaracion/motivo/guardar`, {
    cuerpo: { entrada: objetivo.entrada!, tipo: 'negocio', nota: `${MARCA} necesidad del negocio` },
  });
  creados.motivos += m2.parametros.get('aviso') === 'motivo_guardado' ? 1 : 0;
  const ap2 = await enviar('adminA', `${A}/declaracion/aprobar`);
  comprobar(
    'con un motivo registrado se puede aprobar otra vez (versión siguiente)',
    m2.parametros.get('aviso') === 'motivo_guardado' && ap2.parametros.get('aviso') === 'declaracion_aprobada',
  );
} catch (error) {
  fallos += 1;
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
}

// ---- Limpieza: motivos y referencia QUITADOS; vínculos quitados; riesgos y control RETIRADOS (nada de esto se borra)
try {
  const admin = await iniciarSesionWeb(entorno, 'admin-a', `${A}/riesgos`);
  const verA = (ruta: string) => paginaWeb(entorno, ruta, admin);
  const decl = await verA(`${A}/declaracion`);
  let quitados = 0;
  for (const fila of decl.texto.split('<tr').filter((f) => f.includes('class="font-mono"'))) {
    for (const m of fila.matchAll(/<form[^>]*action="\/e\/empresa-a\/declaracion\/motivo\/guardar"[^>]*>([\s\S]*?)<\/form>/g)) {
      const version = campo(m[1]!, 'version');
      if (!version || !m[1]!.includes(MARCA)) continue;
      const q = await enviarWeb(entorno, `${A}/declaracion/motivo/quitar`, admin, {
        cuerpo: { entrada: campo(m[1]!, 'entrada') ?? '', tipo: campo(m[1]!, 'tipo') ?? '', version },
      });
      if (q.estado === 303 && q.parametros.get('aviso') === 'motivo_quitado') quitados += 1;
      await esperar(900);
    }
  }
  comprobar(
    `limpieza: se quitaron los ${creados.motivos} motivos de prueba`,
    quitados === creados.motivos,
    `${quitados} de ${creados.motivos}`,
  );
  if (referenciaCreada) {
    const formRef = [...decl.texto.matchAll(/<form[^>]*action="\/e\/empresa-a\/declaracion\/referencia\/guardar"[^>]*>([\s\S]*?)<\/form>/g)]
      .map((m) => m[1]!)
      .find((f) => f.includes(MARCA) && campo(f, 'version'));
    const q = await enviarWeb(entorno, `${A}/declaracion/referencia/quitar`, admin, {
      cuerpo: { tipo: 'plan', version: formRef ? (campo(formRef, 'version') ?? '') : '' },
    });
    comprobar('limpieza: se quitó la referencia de prueba', q.parametros.get('aviso') === 'referencia_quitada', q.destino ?? '');
  }
  for (const id of creados.riesgos) {
    const d = await verA(`${A}/riesgos/${id}`);
    const f = formulario(d.texto, '/riesgos/retirar');
    if (!f) continue; // ya retirado
    const q = await enviarWeb(entorno, `${A}/riesgos/retirar`, admin, { cuerpo: { riesgoId: id, version: campo(f, 'version') ?? '' } });
    comprobar(`limpieza: se retiró el riesgo ${id.slice(0, 8)}…`, q.parametros.get('aviso') === 'riesgo_retirado');
  }
  if (creados.control) {
    const pagina = await verA(`${A}/controles`);
    const fila = pagina.texto.split('<tr').find((f) => f.includes(creados.control!) && f.includes('/controles/retirar'));
    const f = fila ? formulario(fila, '/controles/retirar') : null;
    if (f) {
      const q = await enviarWeb(entorno, `${A}/controles/retirar`, admin, {
        cuerpo: { id: creados.control, version: campo(f, 'version') ?? '' },
      });
      comprobar('limpieza: se retiró el control de prueba', q.parametros.get('aviso') === 'retirado');
    }
  }
} catch (error) {
  fallos += 1;
  console.error(`✖ limpieza: ${error instanceof Error ? error.message : String(error)}`);
}
if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exitCode = 1;
} else
  console.log(
    '\nTodo correcto: los riesgos y la Declaración justificada funcionan de punta a punta, no se aprueba sin motivo, la versión aprobada no cambia y se respetan permisos y aislamiento.',
  );
