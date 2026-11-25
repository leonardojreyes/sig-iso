// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { ACCIONES_AUDITORIA, NOMBRES_ACCIONES_AUDITORIA, escribirAuditoria } from './escribir';

// Auditoría interna desde la web (ADR 040): la web no decide nada; reenvía a la API con el token y una lista cerrada de campos.
const config = leerConfiguracion({
  OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'),
  SESSION_SEALING_KEY: randomBytes(32).toString('base64url'),
});
const AHORA = new Date('2026-11-19T10:00:00Z');
const ID = 'dddddddd-1111-4111-8111-111111111111';
const PERSONA = '22222222-2222-4222-8222-222222222222';
const PROCESO = '33333333-3333-4333-8333-333333333333';
const FILA = '44444444-4444-4444-8444-444444444444';
const callbackOk = (): Extract<ResultadoCallback, { ok: true }> => ({
  ok: true,
  tokens: { acceso: 'acceso-inicial', refresco: 'refresco-0', id: 'id.token.firmado' },
  identidad: { sub: '5eed0001-0000-4000-8000-0000000000a1', sid: 'sesion-kc-1' },
  retorno: '/',
  limpiarCookie: 'sig-oidc=; Max-Age=0',
});

type Llamada = { metodo: string; ruta: string; autorizacion: string | null; cuerpo: unknown };
const montar = async (estadoApi: number = 200) => {
  const llamadas: Llamada[] = [];
  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    if (url.startsWith(`${config.apiUrl}/sesion/`)) return new Response(null, { status: 204 });
    if (url.startsWith(config.apiUrl)) {
      const cuerpo = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      llamadas.push({
        metodo: init.method ?? 'GET',
        ruta: url.replace(config.apiUrl, ''),
        autorizacion: new Headers(init.headers).get('authorization'),
        cuerpo,
      });
      return new Response(estadoApi === 204 ? null : '{}', { status: estadoApi });
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  const deps = { config, ahora: () => AHORA, fetchFn, almacen: new AlmacenAcceso() };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!
    .split(';')[0]!;
  const enviar = (
    accion: string,
    campos: Record<string, string | string[] | undefined>,
    o: { metodo?: string; origen?: string | null; cookie?: string | null; slug?: string; verificado?: string | null; id?: string } = {},
  ) => {
    const { metodo = 'POST', origen = config.origen, cookie: c = cookie, slug = 'empresa-a', verificado = 'empresa-a', id } = o;
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(campos)) if (v !== undefined) for (const x of Array.isArray(v) ? v : [v]) p.append(k, x);
    const peticion = new Request(`${config.origen}/e/${slug}/auditoria/escribir/${accion}`, {
      method: metodo,
      headers: {
        ...(metodo === 'GET' ? {} : { 'content-type': 'application/x-www-form-urlencoded' }),
        ...(origen === null ? {} : { origin: origen }),
        ...(c ? { cookie: c } : {}),
      },
      ...(metodo === 'GET' ? {} : { body: p }),
    });
    return escribirAuditoria(peticion, { slugDeLaDireccion: slug, slugVerificado: verificado, deps, ...(id ? { id } : {}) }, accion);
  };
  llamadas.length = 0;
  return { llamadas, enviar };
};
const destino = (r: Response): URL => new URL(r.headers.get('location')!);
const aviso = (r: Response) => destino(r).searchParams.get('aviso');

describe('lista cerrada de acciones', () => {
  it('un nombre desconocido (también los de Object.prototype) responde 404 sin llamar a la API', async () => {
    const { enviar, llamadas } = await montar();
    for (const accion of ['no_existe', 'constructor', '__proto__', 'toString', 'hasOwnProperty', ''])
      expect((await enviar(accion, {}, { id: ID })).status, accion).toBe(404);
    expect(llamadas).toEqual([]);
  });

  it('cada acción va a una ruta de la auditoría interna y con un método cerrado', () => {
    for (const nombre of NOMBRES_ACCIONES_AUDITORIA) {
      const a = ACCIONES_AUDITORIA[nombre]!;
      const ruta = a.rutaApi(new FormData(), a.conId ? ID : null);
      expect(ruta, nombre).toMatch(/^\/(procesos|programas|auditorias)(\/|$)/);
      expect(['PUT', 'POST']).toContain(a.metodoApi);
      expect(a.volverA(null, a.conId ? ID : null), nombre).toMatch(/^auditoria(\/|$)/);
    }
    expect(NOMBRES_ACCIONES_AUDITORIA).toHaveLength(27);
  });

  it('una acción que lleva recurso exige un UUID en la dirección; sin él, 404', async () => {
    const { enviar, llamadas } = await montar();
    expect((await enviar('proceso_cambiar', { version: '1' })).status).toBe(404);
    expect((await enviar('proceso_cambiar', { version: '1' }, { id: 'no-es-uuid' })).status).toBe(404);
    expect(llamadas).toEqual([]);
  });
});

describe('protección del formulario', () => {
  it('solo POST: un GET responde 405; sin Origin propio, se rechaza; con otra empresa en la dirección, 404', async () => {
    const { enviar, llamadas } = await montar();
    expect((await enviar('proceso_crear', {}, { metodo: 'GET' })).status).toBe(405);
    expect(
      (await enviar('proceso_crear', { nombre: 'x', duenaId: PERSONA }, { origen: 'https://otro.example' })).status,
    ).toBeGreaterThanOrEqual(400);
    expect((await enviar('proceso_crear', { nombre: 'x', duenaId: PERSONA }, { origen: null })).status).toBeGreaterThanOrEqual(400);
    expect((await enviar('proceso_crear', { nombre: 'x', duenaId: PERSONA }, { slug: 'empresa-b' })).status).toBe(404);
    expect(llamadas).toEqual([]);
  });

  it('sin sesión se manda a ingresar y no se llama a la API', async () => {
    const { enviar, llamadas } = await montar();
    const r = await enviar('proceso_crear', { nombre: 'x', duenaId: PERSONA }, { cookie: null });
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/auth/login');
    expect(llamadas).toEqual([]);
  });

  it('la respuesta de la API se traduce a un aviso de lista cerrada (403, 404, 409)', async () => {
    for (const [estado, esperado] of [
      [403, 'sin_permiso'],
      [404, 'no_encontrado'],
      [409, 'conflicto'],
    ] as const) {
      const { enviar } = await montar(estado);
      expect(aviso(await enviar('proceso_retirar', {}, { id: ID })), String(estado)).toBe(esperado);
    }
  });
});

describe('procesos y relaciones', () => {
  it('crear manda SOLO los campos conocidos y vuelve a la lista de procesos', async () => {
    const { enviar, llamadas } = await montar(201);
    const r = await enviar('proceso_crear', {
      nombre: ' Compras ',
      descripcion: '  ',
      duenaId: PERSONA.toUpperCase(),
      importancia: 'alta',
      frecuencia: 'semestral',
      empresaId: 'otra',
      codigo: 'PR-999',
      transversal: 'true',
    });
    expect(destino(r).pathname).toBe('/e/empresa-a/auditoria/procesos');
    expect(aviso(r)).toBe('proceso_guardado');
    expect(llamadas).toEqual([
      {
        metodo: 'POST',
        ruta: '/procesos',
        autorizacion: 'Bearer acceso-inicial',
        cuerpo: { nombre: 'Compras', duenaId: PERSONA, importancia: 'alta', frecuencia: 'semestral' },
      },
    ]);
  });

  it('un formulario sin lo mínimo o con valores fuera de lista no llega a la API', async () => {
    const { enviar, llamadas } = await montar(201);
    for (const mal of [
      { nombre: ' ' },
      { duenaId: 'x' },
      { importancia: 'enorme' },
      { frecuencia: 'mensual' },
      { nombre: 'x'.repeat(121) },
      { descripcion: 'x'.repeat(301) },
    ]) {
      expect(aviso(await enviar('proceso_crear', { nombre: 'Compras', duenaId: PERSONA, ...mal })), JSON.stringify(mal)).toBe('no_valido');
    }
    expect(llamadas).toEqual([]);
  });

  it('cambiar manda la versión que se vio; lo vacío borra la descripción y la marca', async () => {
    const { enviar, llamadas } = await montar(200);
    const r = await enviar(
      'proceso_cambiar',
      { version: '3', nombre: 'Compras', descripcion: '', duenaId: PERSONA, importancia: 'baja', frecuencia: 'anual', cambioRelevante: '' },
      { id: ID },
    );
    expect(aviso(r)).toBe('proceso_guardado');
    expect(llamadas).toEqual([
      {
        metodo: 'PUT',
        ruta: `/procesos/${ID}`,
        autorizacion: 'Bearer acceso-inicial',
        cuerpo: {
          versionEsperada: 3,
          nombre: 'Compras',
          descripcion: null,
          duenaId: PERSONA,
          importancia: 'baja',
          frecuencia: 'anual',
          cambioRelevante: null,
        },
      },
    ]);
    const x = await montar(200);
    await x.enviar(
      'proceso_cambiar',
      { version: '3', nombre: 'Compras', duenaId: PERSONA, importancia: 'baja', frecuencia: 'anual', cambioRelevante: 'incidente' },
      { id: ID },
    );
    expect(x.llamadas[0]?.cuerpo).toMatchObject({ cambioRelevante: 'incidente' });
    const y = await montar(200);
    expect(
      aviso(
        await y.enviar(
          'proceso_cambiar',
          { version: '0', nombre: 'x', duenaId: PERSONA, importancia: 'baja', frecuencia: 'anual' },
          { id: ID },
        ),
      ),
    ).toBe('no_valido');
    expect(
      aviso(
        await y.enviar(
          'proceso_cambiar',
          { version: '1', nombre: 'x', duenaId: PERSONA, importancia: 'baja', frecuencia: 'anual', cambioRelevante: 'otro' },
          { id: ID },
        ),
      ),
    ).toBe('no_valido');
    expect(y.llamadas).toEqual([]);
  });

  it('retirar y «Gestión del SIG» no llevan cuerpo; las relaciones mandan la persona y el tipo', async () => {
    const { enviar, llamadas } = await montar(204);
    expect(aviso(await enviar('proceso_retirar', {}, { id: ID }))).toBe('proceso_retirado');
    expect(aviso(await enviar('proceso_gestion_sig', {}))).toBe('proceso_guardado');
    expect(aviso(await enviar('relacion_agregar', { personaId: PERSONA, relacion: 'supervisa' }, { id: ID }))).toBe('relacion_guardada');
    expect(aviso(await enviar('relacion_quitar', { personaId: PERSONA, relacion: 'supervisa' }, { id: ID }))).toBe('relacion_quitada');
    expect(aviso(await enviar('relacion_agregar', { personaId: PERSONA, relacion: 'jefa' }, { id: ID }))).toBe('no_valido');
    expect(llamadas.map((l) => `${l.metodo} ${l.ruta}`)).toEqual([
      `POST /procesos/${ID}/retiro`,
      'POST /procesos/gestion-sig',
      `POST /procesos/${ID}/relaciones`,
      `POST /procesos/${ID}/relaciones/eliminacion`,
    ]);
    expect(llamadas[0]?.cuerpo).toBeNull();
    expect(llamadas[2]?.cuerpo).toEqual({ personaId: PERSONA, relacion: 'supervisa' });
  });
});

describe('programa, auditoría, equipo, lista, hallazgos e informe', () => {
  it('programa: año, objetivo y normas; sin normas o con un año fuera de rango no llega a la API', async () => {
    const { enviar, llamadas } = await montar(201);
    expect(aviso(await enviar('programa_crear', { anio: '2027', objetivo: ' Verificar ', normas: ['iso-27001', 'iso-9001'] }))).toBe(
      'programa_guardado',
    );
    expect(llamadas[0]).toMatchObject({
      ruta: '/programas',
      cuerpo: { anio: 2027, objetivo: 'Verificar', normas: ['iso-27001', 'iso-9001'] },
    });
    for (const mal of [{ anio: '1999' }, { anio: 'dos mil' }, { normas: [] }, { objetivo: '' }])
      expect(aviso(await enviar('programa_crear', { anio: '2027', objetivo: 'x', normas: ['a'], ...mal })), JSON.stringify(mal)).toBe(
        'no_valido',
      );
    expect(llamadas).toHaveLength(1);
  });

  it('motivo de exclusión: un proceso por su id, o un capítulo como «librería|capítulo»', async () => {
    const { enviar, llamadas } = await montar(201);
    await enviar('exclusion_agregar', { tipo: 'proceso', procesoId: PROCESO, motivo: 'auditado el año pasado' }, { id: ID });
    await enviar('exclusion_agregar', { tipo: 'capitulo', capitulo: 'iso-27001|Organizacionales', motivo: 'riesgo bajo' }, { id: ID });
    expect(llamadas.map((l) => l.cuerpo)).toEqual([
      { tipo: 'proceso', procesoId: PROCESO, motivo: 'auditado el año pasado' },
      { tipo: 'capitulo', libreriaCodigo: 'iso-27001', capitulo: 'Organizacionales', motivo: 'riesgo bajo' },
    ]);
    for (const mal of [
      { tipo: 'capitulo', capitulo: 'sin-barra' },
      { tipo: 'proceso', procesoId: 'x' },
      { tipo: 'otro' },
      { tipo: 'proceso', procesoId: PROCESO, motivo: '' },
    ])
      expect(aviso(await enviar('exclusion_agregar', { motivo: 'x', ...mal }, { id: ID })), JSON.stringify(mal)).toBe('no_valido');
  });

  it('planificar una auditoría junta los datos con el alcance (normas, procesos y capítulos) y vuelve al programa', async () => {
    const { enviar, llamadas } = await montar(201);
    const r = await enviar(
      'auditoria_crear',
      {
        objetivo: 'Verificar',
        inicio: '2027-03-01',
        fin: '2027-03-05',
        reunionApertura: '2027-03-01',
        reunionCierre: '',
        normas: ['iso-27001'],
        procesosIds: [PROCESO],
        capitulos: ['iso-27001|9'],
      },
      { id: ID },
    );
    expect(destino(r).pathname).toBe(`/e/empresa-a/auditoria/programas/${ID}`);
    expect(aviso(r)).toBe('auditoria_planificada');
    expect(llamadas[0]).toMatchObject({
      ruta: `/programas/${ID}/auditorias`,
      cuerpo: {
        objetivo: 'Verificar',
        inicio: '2027-03-01',
        fin: '2027-03-05',
        reunionApertura: '2027-03-01',
        normas: ['iso-27001'],
        procesosIds: [PROCESO],
        capitulos: [{ libreriaCodigo: 'iso-27001', capitulo: '9' }],
      },
    });
    expect(llamadas[0]?.cuerpo).not.toHaveProperty('reunionCierre');
    for (const mal of [{ inicio: '2027-02-30' }, { fin: 'mañana' }, { normas: [] }, { procesosIds: ['x'] }, { capitulos: ['sin-barra'] }])
      expect(
        aviso(
          await enviar('auditoria_crear', { objetivo: 'x', inicio: '2027-03-01', fin: '2027-03-05', normas: ['a'], ...mal }, { id: ID }),
        ),
        JSON.stringify(mal),
      ).toBe('no_valido');
  });

  it('cambiar, reprogramar, cancelar y avanzar mandan la versión; el estado destino es de una lista cerrada', async () => {
    const { enviar, llamadas } = await montar(200);
    await enviar(
      'auditoria_cambiar',
      {
        version: '2',
        objetivo: 'Otro',
        inicio: '2027-03-01',
        fin: '2027-03-06',
        reunionApertura: '',
        reunionCierre: '2027-03-06',
        normas: ['a'],
      },
      { id: ID },
    );
    expect(llamadas[0]).toMatchObject({
      metodo: 'PUT',
      ruta: `/auditorias/${ID}`,
      cuerpo: { versionEsperada: 2, reunionApertura: null, reunionCierre: '2027-03-06', normas: ['a'] },
    });
    await enviar(
      'auditoria_reprogramar',
      { version: '3', inicio: '2027-04-01', fin: '2027-04-02', motivo: 'reprogramada', nota: 'vacaciones' },
      { id: ID },
    );
    await enviar('auditoria_cancelar', { version: '4', motivo: 'sin_recursos' }, { id: ID });
    await enviar('auditoria_avanzar', { version: '5', estado: 'en_preparacion' }, { id: ID });
    expect(llamadas.slice(1).map((l) => `${l.ruta.replace(ID, ':id')} ${JSON.stringify(l.cuerpo)}`)).toEqual([
      '/auditorias/:id/reprogramacion {"versionEsperada":3,"inicio":"2027-04-01","fin":"2027-04-02","motivo":"reprogramada","nota":"vacaciones"}',
      '/auditorias/:id/cancelacion {"versionEsperada":4,"motivo":"sin_recursos"}',
      '/auditorias/:id/avance {"versionEsperada":5,"estado":"en_preparacion"}',
    ]);
    expect(aviso(await enviar('auditoria_avanzar', { version: '5', estado: 'cerrada' }, { id: ID }))).toBe('no_valido');
    expect(aviso(await enviar('auditoria_cancelar', { version: '4', motivo: 'porque sí' }, { id: ID }))).toBe('no_valido');
  });

  it('equipo: la excepción de independencia exige motivo Y medida; una sola de las dos no es válida', async () => {
    const { enviar, llamadas } = await montar(201);
    await enviar('equipo_designar', { personaId: PERSONA, rol: 'lider' }, { id: ID });
    await enviar(
      'equipo_designar',
      { personaId: PERSONA, rol: 'auditor', excepcionMotivo: 'no hay otra persona', excepcionMedida: 'otra persona revisa el informe' },
      { id: ID },
    );
    expect(llamadas.map((l) => l.cuerpo)).toEqual([
      { personaId: PERSONA, rol: 'lider' },
      { personaId: PERSONA, rol: 'auditor', excepcion: { motivo: 'no hay otra persona', medida: 'otra persona revisa el informe' } },
    ]);
    for (const mal of [{ excepcionMotivo: 'solo motivo' }, { excepcionMedida: 'solo medida' }, { rol: 'jefe' }, { personaId: 'x' }])
      expect(aviso(await enviar('equipo_designar', { personaId: PERSONA, rol: 'auditor', ...mal }, { id: ID })), JSON.stringify(mal)).toBe(
        'no_valido',
      );
    expect(aviso(await enviar('equipo_quitar', { personaId: PERSONA }, { id: ID }))).toBe('equipo_quitado');
  });

  it('lista: evaluar manda fila, versión, resultado y nota; «por evaluar» no es un resultado que se pueda enviar', async () => {
    const { enviar, llamadas } = await montar(200);
    const r = await enviar('fila_evaluar', { filaId: FILA, version: '1', resultado: 'no_conforme', nota: 'No hay registro' }, { id: ID });
    expect(destino(r).pathname).toBe(`/e/empresa-a/auditoria/auditorias/${ID}/ejecucion`);
    expect(llamadas[0]).toMatchObject({
      metodo: 'PUT',
      ruta: `/auditorias/${ID}/lista/resultado`,
      cuerpo: { filaId: FILA, versionEsperada: 1, resultado: 'no_conforme', nota: 'No hay registro' },
    });
    expect(aviso(await enviar('fila_evaluar', { filaId: FILA, version: '1', resultado: 'por_evaluar' }, { id: ID }))).toBe('no_valido');
    expect(aviso(await enviar('pregunta_agregar', { filaId: FILA, texto: '¿Existe el acta?' }, { id: ID }))).toBe('pregunta_guardada');
    expect(aviso(await enviar('lista_regenerar', {}, { id: ID }))).toBe('lista_regenerada');
  });

  it('hallazgos: el requisito se manda como librería e id estable; la justificación solo si se escribió', async () => {
    const { enviar, llamadas } = await montar(201);
    await enviar(
      'hallazgo_registrar',
      { tipo: 'nc_menor', procesoId: PROCESO, requisito: 'iso-27001|a27-5-1', enunciado: 'Falta la política', evidencia: 'Carpeta vacía' },
      { id: ID },
    );
    await enviar(
      'hallazgo_registrar',
      { tipo: 'nc_mayor', itemId: FILA, procesoId: PROCESO, enunciado: 'x', evidencia: 'y', justificacionGravedad: 'falla el sistema' },
      { id: ID },
    );
    expect(llamadas[0]?.cuerpo).toEqual({
      tipo: 'nc_menor',
      procesoId: PROCESO,
      libreriaCodigo: 'iso-27001',
      idEstable: 'a27-5-1',
      enunciado: 'Falta la política',
      evidencia: 'Carpeta vacía',
    });
    expect(llamadas[1]?.cuerpo).toMatchObject({ tipo: 'nc_mayor', itemId: FILA, justificacionGravedad: 'falla el sistema' });
    for (const mal of [
      { tipo: 'grave' },
      { requisito: 'sin-barra' },
      { enunciado: '' },
      { evidencia: 'x'.repeat(1001) },
      { procesoId: 'x' },
    ])
      expect(
        aviso(await enviar('hallazgo_registrar', { tipo: 'nc_menor', enunciado: 'x', evidencia: 'y', ...mal }, { id: ID })),
        JSON.stringify(mal),
      ).toBe('no_valido');
    await enviar('hallazgo_cambiar', { hallazgoId: FILA, version: '2', tipo: 'nc_menor', enunciado: 'x', evidencia: 'y' }, { id: ID });
    expect(llamadas.at(-1)).toMatchObject({
      metodo: 'PUT',
      ruta: `/auditorias/${ID}/hallazgos`,
      cuerpo: { hallazgoId: FILA, versionEsperada: 2, procesoId: null, justificacionGravedad: null },
    });
    expect(aviso(await enviar('hallazgo_anular', { hallazgoId: FILA, version: '2', motivo: 'duplicado' }, { id: ID }))).toBe(
      'hallazgo_anulado',
    );
    expect(aviso(await enviar('hallazgo_anular', { hallazgoId: FILA, version: '2', motivo: 'porque sí' }, { id: ID }))).toBe('no_valido');
  });

  it('informe y cierre: vuelven a la pantalla del informe y mandan la versión que se vio', async () => {
    const { enviar, llamadas } = await montar(201);
    const r = await enviar('informe_emitir', { version: '4', conclusion: 'Conforme con una NC menor.', limitaciones: '' }, { id: ID });
    expect(destino(r).pathname).toBe(`/e/empresa-a/auditoria/auditorias/${ID}/informe`);
    expect(aviso(r)).toBe('informe_emitido');
    expect(llamadas[0]).toMatchObject({
      ruta: `/auditorias/${ID}/informe`,
      cuerpo: { versionEsperada: 4, conclusion: 'Conforme con una NC menor.' },
    });
    expect(llamadas[0]?.cuerpo).not.toHaveProperty('limitaciones');
    expect(aviso(await enviar('informe_emitir', { version: '4', conclusion: ' ' }, { id: ID }))).toBe('no_valido');
    expect(aviso(await enviar('auditoria_cerrar', { version: '5' }, { id: ID }))).toBe('auditoria_cerrada');
    expect(llamadas.at(-1)).toMatchObject({ ruta: `/auditorias/${ID}/cierre`, cuerpo: { versionEsperada: 5 } });
  });
});
