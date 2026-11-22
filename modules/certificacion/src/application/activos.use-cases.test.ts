import { describe, expect, it } from 'vitest';
import { Riesgo } from '../domain/riesgo.js';
import {
  ACTIVOS_POR_RIESGO_MAX,
  ActivosDeUnRiesgoUseCase,
  AvisoRetiroActivoUseCase,
  CambiarActivoUseCase,
  CrearActivoUseCase,
  DesligarActivoUseCase,
  LigarActivoUseCase,
  ListarActivosUseCase,
  ObtenerActivoUseCase,
  RetirarActivoUseCase,
  TOPE_ACTIVOS,
} from './activos.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { A, ADMIN, B, COLAB, EstadoFalso, crearAutorizacionFalsa, crearUnidadFalsa } from './prueba/fakes.js';

const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const RESP = '88888888-8888-4888-8888-888888888888';
const BAJA = '99999999-9999-4999-8999-999999999999';
const DE_B = '77777777-7777-4777-8777-777777777777';
const persona = (id: string, activa = true) => ({ id, nombre: 'Persona ' + id.slice(0, 2), rol: activa ? 'colaborador' : null, activa });

const montar = () => {
  const estado = new EstadoFalso();
  estado.conceder(ADMIN, A, 'activos.ver', 'activos.gestionar');
  estado.conceder(COLAB, A, 'activos.ver');
  estado.conceder(ADMIN_B, B, 'activos.ver', 'activos.gestionar');
  estado.documentosEstado.personas.set(A, [persona(ADMIN), persona(COLAB), persona(RESP), persona(BAJA, false)]);
  estado.documentosEstado.personas.set(B, [persona(ADMIN_B), persona(DE_B)]);
  let t = 0;
  let n = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 22, 12, 0, t++));
  const nuevoId = () => `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  const riesgo = (empresaId: typeof A, k: number, extra: Partial<{ p: number; i: number; estado: 'vigente' | 'retirado' }> = {}) => {
    const r0 = Riesgo.crear({ id: `dddddddd-0000-4000-8000-${String(k).padStart(12, '0')}`, empresaId, codigo: `R-${String(k).padStart(3, '0')}`, titulo: `Riesgo ${k}`, probabilidad: extra.p ?? 2, impacto: extra.i ?? 2, decision: 'mitigar' });
    const r = extra.estado === 'retirado' ? r0.retirar() : r0;
    estado.riesgos.set(r.id, r);
    return r;
  };
  return {
    estado,
    riesgo,
    crear: new CrearActivoUseCase(u, aut, reloj, nuevoId),
    cambiar: new CambiarActivoUseCase(u, aut, reloj),
    retirar: new RetirarActivoUseCase(u, aut, reloj),
    aviso: new AvisoRetiroActivoUseCase(u, aut),
    listar: new ListarActivosUseCase(u, aut),
    obtener: new ObtenerActivoUseCase(u, aut),
    deRiesgo: new ActivosDeUnRiesgoUseCase(u, aut),
    ligar: new LigarActivoUseCase(u, aut, reloj),
    desligar: new DesligarActivoUseCase(u, aut),
  };
};
const yo = { empresaId: A, usuarioId: ADMIN };
const nuevo = { nombre: 'Base de clientes', descripcion: 'DESCRIPCION-PRIVADA', tipo: 'informacion' as const, clasificacion: 'confidencial' as const, responsableId: RESP };

describe('crear un activo', () => {
  it('lo crea con código correlativo y registra el hecho SIN nombre, texto ni responsable', async () => {
    const { crear, estado } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    expect(a).toMatchObject({ codigo: 'A-001', estado: 'vigente', version: 1, responsableId: RESP, tipo: 'informacion', clasificacion: 'confidencial' });
    expect(estado.eventos).toEqual([expect.objectContaining({ accion: 'activo.creado', objeto: 'activo:A-001', resultado: 'ok' })]);
    expect(JSON.stringify(estado.eventos)).not.toMatch(/DESCRIPCION-PRIVADA|clientes|confidencial|8888/);
  });
  it('el código sigue la secuencia y no se reutiliza al retirar; cada empresa lleva la suya', async () => {
    const { crear, retirar } = montar();
    const a1 = await crear.ejecutar({ ...yo, ...nuevo });
    await retirar.ejecutar({ ...yo, id: a1.id, versionEsperada: 1 });
    expect((await crear.ejecutar({ ...yo, ...nuevo })).codigo).toBe('A-002');
    expect((await crear.ejecutar({ empresaId: B, usuarioId: ADMIN_B, ...nuevo, responsableId: DE_B })).codigo).toBe('A-001');
  });
  it('solo quien gestiona: el colaborador recibe 403, y el permiso se decide antes que la forma', async () => {
    const { crear, estado } = montar();
    await expect(crear.ejecutar({ ...yo, usuarioId: COLAB, ...nuevo })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(crear.ejecutar({ ...yo, usuarioId: COLAB, ...nuevo, nombre: 7 as never, tipo: 'x' as never })).rejects.toBeInstanceOf(SinPermisoError);
    expect(estado.riesgosEstado.activos.size).toBe(0);
  });
  it.each([
    ['nombre vacío', { nombre: '' }],
    ['tipo fuera de la lista', { tipo: 'otro' as never }],
    ['clasificación fuera de la lista', { clasificacion: 'secreta' as never }],
    ['responsable sin forma de UUID', { responsableId: 'x' }],
  ])('rechaza con 400: %s', async (_t, cambio) => {
    const { crear, estado } = montar();
    await expect(crear.ejecutar({ ...yo, ...nuevo, ...cambio })).rejects.toBeInstanceOf(ParametroInvalidoError);
    expect(estado.riesgosEstado.activos.size).toBe(0);
  });
  it('el responsable debe ser una persona ACTIVA de la empresa: uno dado de baja, de otra empresa o inexistente se rechaza igual', async () => {
    const { crear, estado } = montar();
    for (const responsableId of [BAJA, DE_B, '55555555-5555-4555-8555-555555555555'])
      await expect(crear.ejecutar({ ...yo, ...nuevo, responsableId })).rejects.toBeInstanceOf(ParametroInvalidoError);
    expect(estado.riesgosEstado.activos.size).toBe(0);
    expect(estado.eventos).toEqual([]);
  });
  it('si la bitácora falla, el activo no queda', async () => {
    const { crear, estado } = montar();
    estado.fallarBitacora = true;
    await expect(crear.ejecutar({ ...yo, ...nuevo })).rejects.toThrow('bitácora');
    expect(estado.riesgosEstado.activos.size).toBe(0);
  });
  it('una carrera por el correlativo se agota con 409 y no deja nada', async () => {
    const { crear, estado } = montar();
    estado.riesgosEstado.carrera = true;
    await expect(crear.ejecutar({ ...yo, ...nuevo })).rejects.toBeInstanceOf(ConflictoError);
    expect(estado.riesgosEstado.activos.size).toBe(0);
  });
  it('el tope de activos se aplica al crear', async () => {
    const { crear, estado } = montar();
    for (let i = 0; i < TOPE_ACTIVOS; i++) await crear.ejecutar({ ...yo, ...nuevo });
    await expect(crear.ejecutar({ ...yo, ...nuevo })).rejects.toMatchObject({ motivo: 'tope_de_activos' });
    expect(estado.riesgosEstado.activos.size).toBe(TOPE_ACTIVOS);
  }, 30_000);
});

describe('cambiar y retirar', () => {
  it('cambia con versión esperada, sube la versión y registra sin valores', async () => {
    const { crear, cambiar, estado } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    const b = await cambiar.ejecutar({ ...yo, id: a.id, versionEsperada: 1, nombre: 'NOMBRE-NUEVO', clasificacion: 'restringida', responsableId: COLAB });
    expect(b).toMatchObject({ nombre: 'NOMBRE-NUEVO', clasificacion: 'restringida', responsableId: COLAB, version: 2 });
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'activo.cambiado', objeto: 'activo:A-001' });
    expect(JSON.stringify(estado.eventos)).not.toMatch(/NOMBRE-NUEVO|restringida/);
  });
  it('sin cambios no escribe, no sube versión ni registra', async () => {
    const { crear, cambiar, estado } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    const antes = estado.eventos.length;
    expect(await cambiar.ejecutar({ ...yo, id: a.id, versionEsperada: 1, nombre: a.nombre })).toMatchObject({ version: 1 });
    expect(estado.eventos).toHaveLength(antes);
  });
  it('versión vieja → 409; sin versión esperada → 400; ajeno o inexistente → 404 indistinguible', async () => {
    const { crear, cambiar } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    await cambiar.ejecutar({ ...yo, id: a.id, versionEsperada: 1, nombre: 'otro' });
    await expect(cambiar.ejecutar({ ...yo, id: a.id, versionEsperada: 1, nombre: 'otro2' })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    await expect(cambiar.ejecutar({ ...yo, id: a.id, nombre: 'otro2' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(cambiar.ejecutar({ empresaId: B, usuarioId: ADMIN_B, id: a.id, versionEsperada: 2, nombre: 'x' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(cambiar.ejecutar({ ...yo, id: '12345678-1234-4234-8234-123456789012', versionEsperada: 1, nombre: 'x' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
  it('un responsable nuevo debe estar activo; quien ya lo era y se dio de baja no impide corregir otros datos', async () => {
    const { crear, cambiar, estado } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    await expect(cambiar.ejecutar({ ...yo, id: a.id, versionEsperada: 1, responsableId: BAJA })).rejects.toBeInstanceOf(ParametroInvalidoError);
    estado.documentosEstado.personas.set(A, [persona(ADMIN), persona(RESP, false)]);
    expect(await cambiar.ejecutar({ ...yo, id: a.id, versionEsperada: 1, nombre: 'Nuevo nombre' })).toMatchObject({ version: 2, responsableId: RESP });
  });
  it('retirar: conserva el activo con estado retirado, la versión sube y ya no se cambia ni se retira de nuevo (409)', async () => {
    const { crear, cambiar, retirar, estado } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    const r = await retirar.ejecutar({ ...yo, id: a.id, versionEsperada: 1 });
    expect(r).toMatchObject({ estado: 'retirado', version: 2 });
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'activo.retirado', objeto: 'activo:A-001' });
    await expect(cambiar.ejecutar({ ...yo, id: a.id, versionEsperada: 2, nombre: 'x' })).rejects.toBeInstanceOf(ConflictoError);
    await expect(retirar.ejecutar({ ...yo, id: a.id, versionEsperada: 2 })).rejects.toBeInstanceOf(ConflictoError);
  });
  it('el colaborador no cambia ni retira (403)', async () => {
    const { crear, cambiar, retirar, aviso } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    const c = { empresaId: A, usuarioId: COLAB, id: a.id, versionEsperada: 1 };
    await expect(cambiar.ejecutar({ ...c, nombre: 'x' })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(retirar.ejecutar(c)).rejects.toBeInstanceOf(SinPermisoError);
    await expect(aviso.ejecutar(c)).rejects.toBeInstanceOf(SinPermisoError);
  });
});

describe('ligar y desligar activos y riesgos', () => {
  it('liga, es idempotente, registra el vínculo y no repite el hecho', async () => {
    const { crear, ligar, riesgo, estado } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    const r = riesgo(A, 1);
    expect(await ligar.ejecutar({ ...yo, riesgoId: r.id, activoId: a.id })).toEqual({ creado: true });
    expect(await ligar.ejecutar({ ...yo, riesgoId: r.id, activoId: a.id })).toEqual({ creado: false });
    expect(estado.eventos.filter((e) => e.accion === 'activo.ligado')).toEqual([expect.objectContaining({ objeto: 'vinculo:R-001.A-001' })]);
  });
  it('no se liga un activo ni un riesgo retirado (409); uno de otra empresa o inexistente es 404', async () => {
    const { crear, ligar, retirar, riesgo } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    const a2 = await crear.ejecutar({ ...yo, ...nuevo });
    const r = riesgo(A, 1);
    const rRetirado = riesgo(A, 2, { estado: 'retirado' });
    await retirar.ejecutar({ ...yo, id: a2.id, versionEsperada: 1 });
    await expect(ligar.ejecutar({ ...yo, riesgoId: r.id, activoId: a2.id })).rejects.toMatchObject({ motivo: 'activo_retirado' });
    await expect(ligar.ejecutar({ ...yo, riesgoId: rRetirado.id, activoId: a.id })).rejects.toMatchObject({ motivo: 'riesgo_retirado' });
    await expect(ligar.ejecutar({ empresaId: B, usuarioId: ADMIN_B, riesgoId: riesgo(B, 1).id, activoId: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(ligar.ejecutar({ ...yo, riesgoId: '12345678-1234-4234-8234-123456789012', activoId: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
  it('desliga y registra; desligar lo que no existe es 404; el colaborador no liga ni desliga', async () => {
    const { crear, ligar, desligar, riesgo, estado } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    const r = riesgo(A, 1);
    await expect(desligar.ejecutar({ ...yo, riesgoId: r.id, activoId: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await ligar.ejecutar({ ...yo, riesgoId: r.id, activoId: a.id });
    await expect(ligar.ejecutar({ empresaId: A, usuarioId: COLAB, riesgoId: r.id, activoId: a.id })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(desligar.ejecutar({ empresaId: A, usuarioId: COLAB, riesgoId: r.id, activoId: a.id })).rejects.toBeInstanceOf(SinPermisoError);
    await desligar.ejecutar({ ...yo, riesgoId: r.id, activoId: a.id });
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'activo.desligado', objeto: 'vinculo:R-001.A-001' });
    expect(estado.riesgosEstado.ligasActivo.size).toBe(0);
  });
  it('se puede desligar un activo ya retirado', async () => {
    const { crear, ligar, desligar, retirar, riesgo } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    const r = riesgo(A, 1);
    await ligar.ejecutar({ ...yo, riesgoId: r.id, activoId: a.id });
    await retirar.ejecutar({ ...yo, id: a.id, versionEsperada: 1 });
    await expect(desligar.ejecutar({ ...yo, riesgoId: r.id, activoId: a.id })).resolves.toBeUndefined();
  });
  it('el tope de activos por riesgo es 50', async () => {
    const { crear, ligar, riesgo } = montar();
    const r = riesgo(A, 1);
    for (let i = 0; i < ACTIVOS_POR_RIESGO_MAX; i++) await ligar.ejecutar({ ...yo, riesgoId: r.id, activoId: (await crear.ejecutar({ ...yo, ...nuevo })).id });
    const uno = await crear.ejecutar({ ...yo, ...nuevo });
    await expect(ligar.ejecutar({ ...yo, riesgoId: r.id, activoId: uno.id })).rejects.toMatchObject({ motivo: 'tope_de_activos' });
  });
  it('si la bitácora falla, la liga no queda', async () => {
    const { crear, ligar, riesgo, estado } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    const r = riesgo(A, 1);
    estado.fallarBitacora = true;
    await expect(ligar.ejecutar({ ...yo, riesgoId: r.id, activoId: a.id })).rejects.toThrow('bitácora');
    expect(estado.riesgosEstado.ligasActivo.size).toBe(0);
  });
});

describe('aviso previo al retiro (H1.2)', () => {
  it('lista los riesgos vigentes que quedarían sin ningún activo vigente, y solo esos', async () => {
    const { crear, ligar, aviso, riesgo, retirar } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    const otro = await crear.ejecutar({ ...yo, ...nuevo });
    const solo = riesgo(A, 1); // solo con a → quedaría sin activo
    const con2 = riesgo(A, 2); // con a y otro → conserva uno
    const retirado = riesgo(A, 3, { estado: 'retirado' }); // retirado → no cuenta
    const conRetirado = riesgo(A, 4); // con a y un activo retirado → quedaría sin activo vigente
    const muerto = await crear.ejecutar({ ...yo, ...nuevo });
    for (const [r, x] of [[solo, a], [con2, a], [con2, otro], [retirado, a], [conRetirado, a], [conRetirado, muerto]] as const) {
      if (r === retirado) continue; // un riesgo retirado no se puede ligar: se siembra directo abajo
      await ligar.ejecutar({ ...yo, riesgoId: r.id, activoId: x.id });
    }
    await retirar.ejecutar({ ...yo, id: muerto.id, versionEsperada: 1 });
    const r = await aviso.ejecutar({ ...yo, id: a.id });
    expect(r.codigo).toBe('A-001');
    expect(r.riesgosSinActivo.map((x) => x.codigo)).toEqual(['R-001', 'R-004']);
  });
  it('no cambia nada, y un activo ya retirado o ajeno: sin aviso / 404', async () => {
    const { crear, aviso, retirar, estado } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    const antes = estado.eventos.length;
    await aviso.ejecutar({ ...yo, id: a.id });
    expect(estado.eventos).toHaveLength(antes);
    await retirar.ejecutar({ ...yo, id: a.id, versionEsperada: 1 });
    expect((await aviso.ejecutar({ ...yo, id: a.id })).riesgosSinActivo).toEqual([]);
    await expect(aviso.ejecutar({ empresaId: B, usuarioId: ADMIN_B, id: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
});

describe('listar y consultar', () => {
  it('lista vigentes con conteo de riesgos vigentes y la marca «sin riesgos»; el colaborador consulta', async () => {
    const { crear, ligar, listar, riesgo, retirar } = montar();
    const a1 = await crear.ejecutar({ ...yo, ...nuevo });
    const a2 = await crear.ejecutar({ ...yo, ...nuevo, tipo: 'persona', clasificacion: 'interna' });
    const a3 = await crear.ejecutar({ ...yo, ...nuevo });
    await retirar.ejecutar({ ...yo, id: a3.id, versionEsperada: 1 });
    await ligar.ejecutar({ ...yo, riesgoId: riesgo(A, 1).id, activoId: a1.id });
    const f = await listar.ejecutar({ empresaId: A, usuarioId: COLAB });
    expect(f.map((x) => [x.codigo, x.riesgos, x.sinRiesgos])).toEqual([['A-001', 1, false], ['A-002', 0, true]]);
    expect((await listar.ejecutar({ ...yo, incluirRetirados: true })).map((x) => [x.codigo, x.sinRiesgos])).toEqual([['A-001', false], ['A-002', true], ['A-003', false]]);
    expect((await listar.ejecutar({ ...yo, tipo: 'persona' })).map((x) => x.id)).toEqual([a2.id]);
    expect((await listar.ejecutar({ ...yo, clasificacion: 'confidencial' })).map((x) => x.codigo)).toEqual(['A-001']);
    expect((await listar.ejecutar({ ...yo, responsableId: COLAB })).length).toBe(0);
  });
  it('un riesgo retirado no cuenta como riesgo del activo', async () => {
    const { crear, listar, estado, riesgo } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    const r = riesgo(A, 1, { estado: 'retirado' });
    await estado.riesgosEstado.ligasActivo.add(`${A}|${r.id}|${a.id}`);
    expect((await listar.ejecutar(yo))[0]).toMatchObject({ riesgos: 0, sinRiesgos: true });
  });
  it('valida los filtros (400) después del permiso; el aislamiento: B no ve lo de A', async () => {
    const { crear, listar } = montar();
    await crear.ejecutar({ ...yo, ...nuevo });
    await expect(listar.ejecutar({ ...yo, tipo: 'x' as never })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(listar.ejecutar({ ...yo, clasificacion: 'x' as never })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(listar.ejecutar({ ...yo, responsableId: 'x' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(listar.ejecutar({ ...yo, usuarioId: '12345678-1234-4234-8234-123456789012' })).rejects.toBeInstanceOf(SinPermisoError);
    expect(await listar.ejecutar({ empresaId: B, usuarioId: ADMIN_B })).toEqual([]);
  });
  it('el detalle trae los riesgos y el nivel del riesgo vigente más alto; ajeno → 404', async () => {
    const { crear, ligar, obtener, riesgo } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    expect((await obtener.ejecutar({ ...yo, id: a.id })).nivelMasAlto).toBeNull();
    await ligar.ejecutar({ ...yo, riesgoId: riesgo(A, 1, { p: 2, i: 2 }).id, activoId: a.id });
    await ligar.ejecutar({ ...yo, riesgoId: riesgo(A, 2, { p: 4, i: 5 }).id, activoId: a.id });
    const d = await obtener.ejecutar({ empresaId: A, usuarioId: COLAB, id: a.id });
    expect(d.riesgos.map((r) => r.codigo)).toEqual(['R-001', 'R-002']);
    expect(d.nivelMasAlto).toBe('critico');
    await expect(obtener.ejecutar({ empresaId: B, usuarioId: ADMIN_B, id: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
  it('los activos de un riesgo (H1.3); un riesgo de otra empresa es 404', async () => {
    const { crear, ligar, deRiesgo, riesgo } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    await crear.ejecutar({ ...yo, ...nuevo });
    const r = riesgo(A, 1);
    await ligar.ejecutar({ ...yo, riesgoId: r.id, activoId: a.id });
    expect((await deRiesgo.ejecutar({ empresaId: A, usuarioId: COLAB, riesgoId: r.id })).map((x) => x.codigo)).toEqual(['A-001']);
    await expect(deRiesgo.ejecutar({ empresaId: B, usuarioId: ADMIN_B, riesgoId: r.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
});
