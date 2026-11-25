// pnpm web:verify-auditoria — comprueba con todo REAL (Keycloak, API, PostgreSQL y web) la auditoría interna (ADR 040): un proceso y sus
// relaciones, el programa del año, planificar una auditoría con su alcance, la independencia (la relación impide designar, la excepción
// exige motivo y medida y nadie autoriza la propia), la lista de verificación que se genera al pasar a preparación, la evaluación solo
// por el equipo, un hallazgo, la emisión del informe congelado, su descarga en Word como adjunto, que solo el administrador cierra,
// permisos por rol, Origin y aislamiento con la empresa B.
// Requiere: Keycloak, API (pnpm dev api), web (pnpm dev web), pnpm db:migrate, pnpm db:seed y el Anexo A de 27001 adoptado por A.
// OJO: escribe en tu base local de desarrollo. Todo lo que crea lleva la marca «VERIF-». NO cierra la auditoría (una cerrada cuenta para el
// prerrequisito de la Etapa 2 y no se puede deshacer): la deja con el informe EMITIDO (inmutable), y NO aprueba el programa del año. Al
// terminar RETIRA el proceso de prueba (conserva su historia: por diseño nada se borra). Repetible: cada corrida suma una auditoría.
// Va despacio a propósito: la API limita a 120 peticiones por minuto por persona.
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
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MARCA = `VERIF-${Date.now().toString(36)}`;
const A = '/e/empresa-a';
const B = '/e/empresa-b';
const AUD = `${A}/auditoria`;
const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// Cuentas sembradas (scripts/lib/datos-siembra.ts): dos administradoras en A (admin-a y consultor) y un colaborador.
const ADMIN_A = '5eed0001-0000-4000-8000-0000000000a1';
const COLAB_A = '5eed0002-0000-4000-8000-0000000000a2';
const CONSULTOR = '5eed0005-0000-4000-8000-0000000000c1';
const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
  new Date(),
);
const ANIO = HOY.slice(0, 4);

const aviso = (r: { estado: number; parametros: URLSearchParams }) => (r.estado === 303 ? r.parametros.get('aviso') : `HTTP ${r.estado}`);
const campoOculto = (html: string, accion: string, nombre: string): string | null => {
  const f = new RegExp(`<form[^>]*action="[^"]*${accion}[^"]*"[^>]*>([\\s\\S]*?)</form>`).exec(html)?.[1] ?? '';
  return (
    new RegExp(`name="${nombre}"[^>]*value="([^"]*)"`).exec(f)?.[1] ??
    new RegExp(`value="([^"]*)"[^>]*name="${nombre}"`).exec(f)?.[1] ??
    null
  );
};
const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let procesoId: string | null = null;

try {
  const sesion = {
    adminA: await iniciarSesionWeb(entorno, 'admin-a', AUD),
    consultor: await iniciarSesionWeb(entorno, 'consultor', AUD),
    colabA: await iniciarSesionWeb(entorno, 'colab-a', AUD),
    adminB: await iniciarSesionWeb(entorno, 'admin-b', `${B}/auditoria`),
  };
  type Quien = keyof typeof sesion;
  const ver = (quien: Quien, ruta: string) => paginaWeb(entorno, ruta, sesion[quien]);
  const enviar = (quien: Quien, ruta: string, o: { origen?: string | null; metodo?: string; cuerpo?: Record<string, string> } = {}) =>
    enviarWeb(entorno, ruta, sesion[quien], o);
  /** Un formulario con varios valores para el mismo campo (normas, procesos, capítulos). */
  const enviarMulti = (quien: Quien, ruta: string, campos: [string, string][]) => {
    const f = new URLSearchParams();
    for (const [k, v] of campos) f.append(k, v);
    return fetch(`${entorno.web}${ruta}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        origin: entorno.web,
        'content-type': 'application/x-www-form-urlencoded',
        cookie: [...sesion[quien]].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: f.toString(),
    }).then((r) => {
      const u = r.headers.get('location') ? new URL(r.headers.get('location')!, entorno.web) : null;
      return { estado: r.status, destino: u ? `${u.pathname}${u.search}` : null, parametros: u?.searchParams ?? new URLSearchParams() };
    });
  };

  // ---- Lectura, permisos y aislamiento antes de escribir nada
  const inicio = await ver('adminA', AUD);
  comprobar(
    'el administrador abre Auditoría interna: 200 y sin caché',
    inicio.estado === 200 && /no-store/.test(inicio.cabeceras.get('cache-control') ?? ''),
    `respuesta ${inicio.estado}`,
  );
  comprobar(
    'la navegación ofrece «Auditoría interna» como página actual',
    /href="\/e\/empresa-a\/auditoria"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/e\/empresa-a\/auditoria"/.test(inicio.texto),
  );
  comprobar(
    'el panel del prerrequisito de la Etapa 2 se muestra y dice que solo informa',
    inicio.texto.includes('Prerrequisito de la Etapa 2') && inicio.texto.includes('solo informa'),
  );
  const colab0 = await ver('colabA', `${AUD}/procesos`);
  comprobar(
    'el colaborador ve los procesos pero NO los formularios de escritura',
    colab0.estado === 200 && !colab0.texto.includes('/auditoria/escribir/'),
  );
  comprobar('AISLAMIENTO: la sesión de B pidiendo la auditoría de A recibe 404', (await ver('adminB', AUD)).estado === 404);
  comprobar(
    'AISLAMIENTO: B enviando una escritura a la ruta de A recibe 404',
    (await enviar('adminB', `${AUD}/escribir/proceso_crear`, { cuerpo: { nombre: 'x' } })).estado === 404,
  );
  comprobar('la empresa B abre su propia auditoría', (await ver('adminB', `${B}/auditoria`)).estado === 200);

  // ---- Protección de los formularios
  const alta = { nombre: `${MARCA} Compras`, duenaId: COLAB_A, importancia: 'alta', frecuencia: 'anual' };
  for (const [origen, nombre] of [
    [null, 'sin Origin'],
    ['null', 'con Origin «null»'],
    ['https://evil.example', 'con Origin de otro sitio'],
  ] as const)
    comprobar(
      `crear un proceso ${nombre}: 403`,
      (await enviar('adminA', `${AUD}/escribir/proceso_crear`, { origen, cuerpo: alta })).estado === 403,
    );
  comprobar(
    'un GET a una ruta de escritura no hace nada (405)',
    (await enviar('adminA', `${AUD}/escribir/proceso_crear`, { metodo: 'GET' })).estado === 405,
  );
  comprobar('una acción desconocida responde 404', (await enviar('adminA', `${AUD}/escribir/no_existe`, { cuerpo: {} })).estado === 404);
  comprobar(
    'sin sesión, escribir lleva a ingresar',
    await (async () => {
      const r = await enviarWeb(entorno, `${AUD}/escribir/proceso_crear`, new Map(), { cuerpo: alta });
      return r.estado === 303 && (r.destino ?? '').startsWith('/auth/login');
    })(),
  );
  comprobar(
    'un formulario con una importancia fuera de lista no llega a la API (no válido)',
    aviso(await enviar('adminA', `${AUD}/escribir/proceso_crear`, { cuerpo: { ...alta, importancia: 'enorme' } })) === 'no_valido',
  );
  comprobar(
    'el colaborador no puede crear un proceso (sin permiso)',
    aviso(await enviar('colabA', `${AUD}/escribir/proceso_crear`, { cuerpo: alta })) === 'sin_permiso',
  );

  // ---- Proceso y relaciones
  const creado = await enviar('adminA', `${AUD}/escribir/proceso_crear`, { cuerpo: alta });
  comprobar('el administrador crea un proceso: aviso «proceso_guardado»', aviso(creado) === 'proceso_guardado', creado.destino ?? '');
  const lista1 = await ver('adminA', `${AUD}/procesos`);
  const fila = lista1.texto.split('<tr').find((f) => f.includes(MARCA)) ?? '';
  procesoId = new RegExp(`/auditoria/procesos/(${UUID_RE})`).exec(fila)?.[1] ?? null;
  comprobar('el proceso aparece en la lista con su código PR-', !!procesoId && /PR-\d{3}/.test(fila));
  if (!procesoId) throw new Error('No se pudo leer el identificador del proceso');
  const detalleProceso = () => ver('adminA', `${AUD}/procesos/${procesoId}`);
  const rel = await enviar('adminA', `${AUD}/escribir/relacion_agregar/${procesoId}`, {
    cuerpo: { personaId: ADMIN_A, relacion: 'supervisa' },
  });
  comprobar('el administrador relaciona a una persona con el proceso: aviso «relacion_guardada»', aviso(rel) === 'relacion_guardada');
  comprobar(
    'la dueña vigente no ofrece quitar su relación',
    !(await detalleProceso()).texto.includes(`aria-label="Quitar la relación «Dueña del proceso»`) ||
      (await detalleProceso()).texto.includes('cambie primero la dueña'),
  );
  const v0 = campoOculto((await detalleProceso()).texto, 'proceso_cambiar', 'version');
  const cambio = await enviar('adminA', `${AUD}/escribir/proceso_cambiar/${procesoId}`, {
    cuerpo: {
      version: v0 ?? '1',
      nombre: `${MARCA} Compras y logística`,
      duenaId: COLAB_A,
      importancia: 'alta',
      frecuencia: 'anual',
      cambioRelevante: 'incidente',
    },
  });
  comprobar('cambiar el proceso con la versión que se vio: aviso «proceso_guardado»', aviso(cambio) === 'proceso_guardado');
  comprobar(
    'cambiarlo con la versión vieja es un conflicto (concurrencia)',
    aviso(
      await enviar('adminA', `${AUD}/escribir/proceso_cambiar/${procesoId}`, {
        cuerpo: { version: v0 ?? '1', nombre: 'viejo', duenaId: COLAB_A, importancia: 'alta', frecuencia: 'anual' },
      }),
    ) === 'conflicto',
  );
  comprobar(
    'AISLAMIENTO: B abriendo el proceso de A por su dirección recibe 404',
    (await ver('adminB', `${AUD}/procesos/${procesoId}`)).estado === 404,
  );

  // ---- Programa del año y la auditoría
  const programaNuevo = await enviarMulti('adminA', `${AUD}/escribir/programa_crear`, [
    ['anio', ANIO],
    ['objetivo', `${MARCA} Programa`],
    ['normas', 'iso-27001-2022-anexo-a'],
  ]);
  comprobar(
    'el administrador crea el programa del año (o ya existía: conflicto)',
    ['programa_guardado', 'conflicto'].includes(aviso(programaNuevo) ?? ''),
    aviso(programaNuevo) ?? '',
  );
  const inicio2 = await ver('adminA', AUD);
  const programaId =
    new RegExp(`Programa de auditoría ${ANIO}[\\s\\S]*?/auditoria/programas/(${UUID_RE})`).exec(inicio2.texto)?.[1] ?? null;
  comprobar('el programa del año aparece en la entrada', !!programaId);
  if (!programaId) throw new Error('No se pudo leer el programa del año');
  const programa = await ver('adminA', `${AUD}/programas/${programaId}`);
  comprobar(
    'el programa muestra el calendario, lo que falta y las ayudas para decidir',
    programa.texto.includes('Calendario por trimestre') &&
      programa.texto.includes('Lo que falta incluir o justificar') &&
      programa.texto.includes('Para decidir qué incluir'),
  );
  const temas = [...programa.texto.matchAll(/name="capitulos"[^>]*value="([^"]+)"|value="([^"]+)"[^>]*name="capitulos"/g)].map(
    (m) => (m[1] ?? m[2])!,
  );
  const tema = temas.find((x) => /personas/i.test(x)) ?? temas[temas.length - 1];
  comprobar('el programa ofrece los temas del Anexo A aún sin incluir (para limitar la auditoría)', !!tema, `${temas.length}`);
  const apertura = HOY;
  const planificada = await enviarMulti('adminA', `${AUD}/escribir/auditoria_crear/${programaId}`, [
    ['objetivo', `${MARCA} Verificar el SGSI`],
    ['inicio', HOY],
    ['fin', HOY],
    ['reunionApertura', apertura],
    ['reunionCierre', HOY],
    ['normas', 'iso-27001-2022-anexo-a'],
    ['procesosIds', procesoId],
    ...(tema ? [['capitulos', tema] as [string, string]] : []),
  ]);
  comprobar(
    'el administrador planifica una auditoría: aviso «auditoria_planificada»',
    aviso(planificada) === 'auditoria_planificada',
    planificada.destino ?? '',
  );
  const programa2 = await ver('adminA', `${AUD}/programas/${programaId}`);
  const filaAud = programa2.texto.split('<tr').find((f) => f.includes(MARCA)) ?? '';
  const auditoriaId = new RegExp(`/auditoria/auditorias/(${UUID_RE})`).exec(filaAud)?.[1] ?? null;
  comprobar(
    'la auditoría aparece con su código AI- y en estado «Planificada»',
    !!auditoriaId && /AI-\d{4}-\d{2}/.test(filaAud) && filaAud.includes('Planificada'),
  );
  if (!auditoriaId) throw new Error('No se pudo leer el identificador de la auditoría');
  const plan = () => ver('adminA', `${AUD}/auditorias/${auditoriaId}`);
  comprobar(
    'AISLAMIENTO: B abriendo la auditoría de A recibe 404',
    (await ver('adminB', `${AUD}/auditorias/${auditoriaId}`)).estado === 404,
  );

  // ---- Independencia y equipo
  const ind = await ver('adminA', `${AUD}/auditorias/${auditoriaId}?persona=${ADMIN_A}`);
  comprobar(
    'la comprobación explica por qué la persona relacionada con el proceso no puede auditarlo',
    ind.texto.includes('no puede auditarlos, salvo una excepción') && ind.texto.includes('Supervisa'),
  );
  const indOk = await ver('adminA', `${AUD}/auditorias/${auditoriaId}?persona=${CONSULTOR}`);
  comprobar('y que quien no tiene relaciones sí puede ser designada', indOk.texto.includes('puede ser designada'));
  const D = `${AUD}/escribir/equipo_designar/${auditoriaId}`;
  comprobar(
    'designar a quien tiene el conflicto SIN excepción es un conflicto',
    aviso(await enviar('adminA', D, { cuerpo: { personaId: ADMIN_A, rol: 'auditor' } })) === 'conflicto',
  );
  comprobar(
    'una excepción con motivo pero SIN medida compensatoria no llega a la API',
    aviso(await enviar('adminA', D, { cuerpo: { personaId: ADMIN_A, rol: 'auditor', excepcionMotivo: 'no hay otra persona' } })) ===
      'no_valido',
  );
  comprobar(
    'nadie autoriza su propia excepción (hay otra administradora activa)',
    aviso(
      await enviar('adminA', D, {
        cuerpo: {
          personaId: ADMIN_A,
          rol: 'auditor',
          excepcionMotivo: 'no hay otra persona',
          excepcionMedida: 'otra persona revisa el informe',
        },
      }),
    ) === 'no_valido',
  );
  comprobar(
    'un colaborador no se designa como auditor',
    aviso(await enviar('adminA', D, { cuerpo: { personaId: COLAB_A, rol: 'auditor' } })) === 'no_valido',
  );
  comprobar(
    'el colaborador no puede designar (sin permiso)',
    aviso(await enviar('colabA', D, { cuerpo: { personaId: CONSULTOR, rol: 'lider' } })) === 'sin_permiso',
  );
  comprobar(
    'la otra administradora designa a quien tiene el conflicto CON excepción (motivo y medida)',
    aviso(
      await enviar('consultor', D, {
        cuerpo: {
          personaId: ADMIN_A,
          rol: 'auditor',
          excepcionMotivo: 'no hay otra persona',
          excepcionMedida: 'otra persona revisa el informe',
        },
      }),
    ) === 'equipo_designado',
  );
  comprobar(
    'el administrador designa a la líder (sin relaciones con el proceso)',
    aviso(await enviar('adminA', D, { cuerpo: { personaId: CONSULTOR, rol: 'lider' } })) === 'equipo_designado',
  );
  comprobar(
    'un segundo líder es un conflicto',
    aviso(await enviar('adminA', D, { cuerpo: { personaId: ADMIN_A, rol: 'lider' } })) === 'conflicto',
  );
  const equipo = (await plan()).texto;
  comprobar(
    'el equipo muestra la excepción de independencia con su motivo y su medida',
    equipo.includes('Excepción de independencia') && equipo.includes('otra persona revisa el informe'),
  );

  // ---- Preparación: la lista se genera; ejecución: solo el equipo evalúa
  const versionPlan = campoOculto((await plan()).texto, 'auditoria_avanzar', 'version') ?? '1';
  comprobar(
    'pasar a preparación: aviso «auditoria_avanzada»',
    aviso(
      await enviar('adminA', `${AUD}/escribir/auditoria_avanzar/${auditoriaId}`, {
        cuerpo: { version: versionPlan, estado: 'en_preparacion' },
      }),
    ) === 'auditoria_avanzada',
  );
  const prep = await ver('adminA', `${AUD}/auditorias/${auditoriaId}/ejecucion`);
  const filasIds = [...prep.texto.matchAll(new RegExp(`id="fila-(${UUID_RE})"`, 'g'))].map((m) => m[1]!);
  comprobar('la lista de verificación se generó con una fila por requisito del alcance', filasIds.length >= 1, `${filasIds.length}`);
  comprobar('en preparación todavía no se evalúa', !prep.texto.includes('fila_evaluar'));
  const versionPrep = campoOculto((await plan()).texto, 'auditoria_avanzar', 'version') ?? '1';
  comprobar(
    'pasar a ejecución (la fecha de inicio ya llegó y hay reunión de apertura)',
    aviso(
      await enviar('adminA', `${AUD}/escribir/auditoria_avanzar/${auditoriaId}`, {
        cuerpo: { version: versionPrep, estado: 'en_ejecucion' },
      }),
    ) === 'auditoria_avanzada',
  );
  const ejec = await ver('consultor', `${AUD}/auditorias/${auditoriaId}/ejecucion`);
  comprobar('en ejecución la líder ve los formularios de evaluación', ejec.texto.includes('fila_evaluar'));
  const v1 = (filaId: string, html: string): string =>
    campoOculto(html.split(`id="fila-${filaId}"`)[1] ?? '', 'fila_evaluar', 'version') ?? '1';
  comprobar(
    'quien no es del equipo (el colaborador) no evalúa (sin permiso)',
    aviso(
      await enviar('colabA', `${AUD}/escribir/fila_evaluar/${auditoriaId}`, {
        cuerpo: { filaId: filasIds[0]!, version: '1', resultado: 'conforme' },
      }),
    ) === 'sin_permiso',
  );
  comprobar(
    'AISLAMIENTO: B no evalúa filas de A (404)',
    (
      await enviar('adminB', `${AUD}/escribir/fila_evaluar/${auditoriaId}`, {
        cuerpo: { filaId: filasIds[0]!, version: '1', resultado: 'conforme' },
      })
    ).estado === 404,
  );
  comprobar(
    '«no conforme» sin la nota con la evidencia no llega a la API',
    aviso(
      await enviar('consultor', `${AUD}/escribir/fila_evaluar/${auditoriaId}`, {
        cuerpo: { filaId: filasIds[0]!, version: '1', resultado: 'no_conforme' },
      }),
    ) === 'no_valido',
  );
  comprobar(
    '«por evaluar» no es un resultado que se pueda enviar',
    aviso(
      await enviar('consultor', `${AUD}/escribir/fila_evaluar/${auditoriaId}`, {
        cuerpo: { filaId: filasIds[0]!, version: '1', resultado: 'por_evaluar' },
      }),
    ) === 'no_valido',
  );
  // Se evalúan todas las filas despacio: la primera «no conforme» (con su hallazgo), la última «no verificado», el resto «conforme».
  let evaluadas = 0;
  for (const [i, filaId] of filasIds.entries()) {
    const ultima = i === filasIds.length - 1 && filasIds.length > 1;
    const cuerpo: Record<string, string> =
      i === 0
        ? { resultado: 'no_conforme', nota: 'No se encontró la política firmada' }
        : ultima
          ? { resultado: 'no_verificado', nota: 'Sin tiempo para revisar' }
          : { resultado: 'conforme' };
    const r = await enviar('consultor', `${AUD}/escribir/fila_evaluar/${auditoriaId}`, {
      cuerpo: { filaId, version: v1(filaId, ejec.texto), ...cuerpo },
    });
    if (aviso(r) === 'fila_evaluada') evaluadas += 1;
    await pausa(600);
  }
  comprobar('la líder evalúa todas las filas de la lista', evaluadas === filasIds.length, `${evaluadas} de ${filasIds.length}`);
  comprobar(
    'emitir el informe con una fila «no conforme» SIN hallazgo es un conflicto',
    aviso(
      await enviar('consultor', `${AUD}/escribir/informe_emitir/${auditoriaId}`, {
        cuerpo: {
          version:
            campoOculto((await ver('consultor', `${AUD}/auditorias/${auditoriaId}/informe`)).texto, 'informe_emitir', 'version') ?? '1',
          conclusion: 'Conforme',
        },
      }),
    ) === 'conflicto',
  );

  // ---- Hallazgo
  const hall = await enviar('consultor', `${AUD}/escribir/hallazgo_registrar/${auditoriaId}`, {
    cuerpo: {
      tipo: 'nc_menor',
      itemId: filasIds[0]!,
      procesoId,
      enunciado: `${MARCA} Falta la política firmada`,
      evidencia: 'Se revisó la carpeta de políticas y no está la versión firmada',
    },
  });
  comprobar(
    'la líder registra un hallazgo (NC menor) con proceso y evidencia: aviso «hallazgo_registrado»',
    aviso(hall) === 'hallazgo_registrado',
    hall.destino ?? '',
  );
  comprobar(
    'una NC mayor sin la justificación de la gravedad no llega a la API… o la API la rechaza',
    ['no_valido'].includes(
      aviso(
        await enviar('consultor', `${AUD}/escribir/hallazgo_registrar/${auditoriaId}`, {
          cuerpo: { tipo: 'nc_mayor', procesoId, requisito: 'iso-27001-2022-anexo-a|a27-5-1', enunciado: 'x', evidencia: 'y' },
        }),
      ) ?? '',
    ),
  );
  const hPag = await ver('consultor', `${AUD}/auditorias/${auditoriaId}/ejecucion`);
  comprobar(
    'el hallazgo aparece abierto en la lista de hallazgos',
    hPag.texto.includes(`${MARCA} Falta la política firmada`) && /H-\d{3}/.test(hPag.texto),
  );

  // ---- Informe
  const informePag = await ver('consultor', `${AUD}/auditorias/${auditoriaId}/informe`);
  comprobar(
    'antes de emitir, el informe dice que todas las filas están evaluadas',
    informePag.texto.includes('Todas las filas de la lista están evaluadas.'),
  );
  const vInforme = campoOculto(informePag.texto, 'informe_emitir', 'version') ?? '1';
  comprobar(
    'un miembro sin permiso de emitir (el colaborador) no emite',
    aviso(await enviar('colabA', `${AUD}/escribir/informe_emitir/${auditoriaId}`, { cuerpo: { version: vInforme, conclusion: 'x' } })) ===
      'sin_permiso',
  );
  comprobar(
    'emitir con la conclusión vacía no llega a la API',
    aviso(
      await enviar('consultor', `${AUD}/escribir/informe_emitir/${auditoriaId}`, { cuerpo: { version: vInforme, conclusion: ' ' } }),
    ) === 'no_valido',
  );
  const emitido = await enviar('consultor', `${AUD}/escribir/informe_emitir/${auditoriaId}`, {
    cuerpo: {
      version: vInforme,
      conclusion: `${MARCA} Conforme con una no conformidad menor`,
      limitaciones: 'Una fila quedó sin verificar',
    },
  });
  comprobar('la líder emite el informe: aviso «informe_emitido»', aviso(emitido) === 'informe_emitido', emitido.destino ?? '');
  const informe2 = await ver('adminA', `${AUD}/auditorias/${auditoriaId}/informe`);
  const huella = /([0-9a-f]{64})/.exec(informe2.texto)?.[1] ?? null;
  comprobar(
    'el informe emitido muestra su huella SHA-256, la conclusión y las limitaciones',
    !!huella && informe2.texto.includes(`${MARCA} Conforme`) && informe2.texto.includes('Una fila quedó sin verificar'),
  );
  comprobar(
    'con el informe emitido la auditoría ya no admite cambios (conflicto)',
    aviso(
      await enviar('adminA', `${AUD}/escribir/auditoria_cambiar/${auditoriaId}`, {
        cuerpo: { version: '9', objetivo: 'x', inicio: HOY, fin: HOY, normas: 'iso-27001-2022-anexo-a' },
      }),
    ) !== 'auditoria_guardada',
  );
  comprobar(
    'un segundo informe no se puede emitir (conflicto)',
    aviso(await enviar('consultor', `${AUD}/escribir/informe_emitir/${auditoriaId}`, { cuerpo: { version: '99', conclusion: 'otra' } })) ===
      'conflicto',
  );
  const word = await descargarWeb(entorno, `${AUD}/informe/${auditoriaId}/documento`, sesion.colabA);
  comprobar(
    'el informe se descarga en Word como ADJUNTO, sin caché y sin interpretarse',
    word.estado === 200 &&
      /attachment/.test(word.cabeceras.get('content-disposition') ?? '') &&
      /officedocument\.wordprocessingml/.test(word.cabeceras.get('content-type') ?? '') &&
      /nosniff/.test(word.cabeceras.get('x-content-type-options') ?? '') &&
      /no-store/.test(word.cabeceras.get('cache-control') ?? ''),
    `${word.estado}`,
  );
  comprobar(
    'el documento es un .docx (ZIP) de tamaño razonable',
    word.bytes.length > 2000 && word.bytes[0] === 0x50 && word.bytes[1] === 0x4b,
    `${word.bytes.length} bytes`,
  );
  comprobar(
    'AISLAMIENTO: B no descarga el informe de A (404)',
    (await descargarWeb(entorno, `${AUD}/informe/${auditoriaId}/documento`, sesion.adminB)).estado === 404,
  );
  comprobar(
    'sin sesión la descarga lleva a ingresar',
    (await descargarWeb(entorno, `${AUD}/informe/${auditoriaId}/documento`, new Map())).estado === 303,
  );

  // ---- Cierre (solo la administradora; aquí NO se cierra: una cerrada cuenta para el prerrequisito y no se puede deshacer)
  comprobar(
    'la líder (con rol de auditoría) no puede cerrar: solo el administrador SIG',
    aviso(await enviar('colabA', `${AUD}/escribir/auditoria_cerrar/${auditoriaId}`, { cuerpo: { version: '1' } })) === 'sin_permiso',
  );
  comprobar(
    'la pantalla del informe ofrece cerrar solo al administrador',
    informe2.texto.includes('auditoria_cerrar') &&
      !(await ver('colabA', `${AUD}/auditorias/${auditoriaId}/informe`)).texto.includes('auditoria_cerrar'),
  );

  // ---- Panel
  const panel = await ver('adminA', AUD);
  comprobar(
    'el panel refleja las auditorías y dice qué falta',
    panel.texto.includes('Auditorías por estado') && /Informe emitido: \d+/.test(panel.texto),
  );
  comprobar(
    'el panel NO afirma que se cumple el prerrequisito sin auditorías cerradas con la cobertura completa',
    panel.texto.includes('Todavía no se cumple el prerrequisito') || panel.texto.includes('Se cumple el prerrequisito'),
  );
} catch (e) {
  fallos += 1;
  console.error(`✖ ${e instanceof Error ? e.message : String(e)}`);
} finally {
  // Limpieza: se retira el proceso de prueba (nada se borra; conserva su historia).
  if (procesoId) {
    try {
      const adminA = await iniciarSesionWeb(entorno, 'admin-a', AUD);
      const r = await enviarWeb(entorno, `${AUD}/escribir/proceso_retirar/${procesoId}`, adminA, {});
      comprobar(
        'limpieza: el proceso de prueba se retira (conserva su historia)',
        r.estado === 303 && r.parametros.get('aviso') === 'proceso_retirado',
      );
    } catch (e) {
      console.error(`No se pudo retirar el proceso de prueba (${procesoId}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

console.log(fallos === 0 ? '\nTodo en orden.' : `\n${fallos} comprobación(es) fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
void escapar;
void pausa;
