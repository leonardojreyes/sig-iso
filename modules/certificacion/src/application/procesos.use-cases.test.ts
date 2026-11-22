import { describe, expect, it } from 'vitest';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { A, ADMIN, B, COLAB, EstadoFalso, crearAutorizacionFalsa, crearUnidadFalsa } from './prueba/index.js';
import {
  ActualizarProcesoUseCase,
  AgregarRelacionUseCase,
  CrearGestionSigUseCase,
  CrearProcesoUseCase,
  ListarProcesosUseCase,
  ListarRelacionesUseCase,
  QuitarRelacionUseCase,
  RetirarProcesoUseCase,
} from './procesos.use-cases.js';

const ADMIN2 = '33333333-3333-4333-8333-3333333333e3';
const RETIRADO = '44444444-4444-4444-8444-4444444444f4';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const ESCRIBE = ['auditoria.ver', 'auditoria.planificar', 'auditoria.ejecutar', 'auditoria.aprobar', 'auditoria.gestionar'] as const;

const montar = () => {
  const estado = new EstadoFalso();
  estado.conceder(ADMIN, A, ...ESCRIBE);
  estado.conceder(ADMIN2, A, ...ESCRIBE);
  estado.conceder(COLAB, A, 'auditoria.ver');
  estado.conceder(ADMIN_B, B, ...ESCRIBE);
  estado.documentosEstado.personas.set(A, [
    { id: ADMIN, nombre: 'Ana Admin', rol: 'administrador_sig', activa: true },
    { id: ADMIN2, nombre: 'Beto Admin', rol: 'administrador_sig', activa: true },
    { id: COLAB, nombre: 'Carla Colaboradora', rol: 'colaborador', activa: true },
    { id: RETIRADO, nombre: 'Dario Retirado', rol: null, activa: false },
  ]);
  estado.documentosEstado.personas.set(B, [{ id: ADMIN_B, nombre: 'Admin B', rol: 'administrador_sig', activa: true }]);
  let t = 0;
  let n = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 19, 15, 0, t++));
  const nuevoId = () => `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  return {
    estado,
    listar: new ListarProcesosUseCase(u, aut),
    crear: new CrearProcesoUseCase(u, aut, reloj, nuevoId),
    gestionSig: new CrearGestionSigUseCase(u, aut, reloj, nuevoId),
    actualizar: new ActualizarProcesoUseCase(u, aut, reloj),
    retirar: new RetirarProcesoUseCase(u, aut, reloj),
    relaciones: new ListarRelacionesUseCase(u, aut),
    agregar: new AgregarRelacionUseCase(u, aut, reloj),
    quitar: new QuitarRelacionUseCase(u, aut),
  };
};
const e = (usuarioId = ADMIN, empresaId: string = A) => ({ empresaId, usuarioId });
const acciones = (estado: EstadoFalso): string[] => estado.eventos.map((x) => x.accion);

describe('crear un proceso', () => {
  it('crea con código correlativo, deja a la dueña como relación «dueña» y lo registra en la bitácora sin texto libre', async () => {
    const m = montar();
    const p = await m.crear.ejecutar({ ...e(), nombre: ' Compras ', descripcion: 'Compra de bienes', duenaId: COLAB });
    expect(p).toMatchObject({
      codigo: 'PR-001',
      nombre: 'Compras',
      importancia: 'media',
      frecuencia: 'anual',
      transversal: false,
      estado: 'vigente',
      personasRelacionadas: 1,
      avisos: [],
    });
    expect((await m.crear.ejecutar({ ...e(), nombre: 'Ventas', duenaId: ADMIN })).codigo).toBe('PR-002');
    expect(acciones(m.estado)).toEqual(['proceso.creado', 'relacion.creada', 'proceso.creado', 'relacion.creada']);
    expect(m.estado.eventos[0]).toMatchObject({ objeto: 'proceso:PR-001' });
    expect(JSON.stringify(m.estado.eventos)).not.toContain('Compras');
    expect(JSON.stringify(m.estado.eventos)).not.toContain('Compra de bienes');
  });

  it('el permiso se decide antes de mirar el cuerpo (403 antes que 400)', async () => {
    const m = montar();
    await expect(m.crear.ejecutar({ ...e(COLAB), nombre: '' })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.crear.ejecutar({ ...e(SIN_PERMISOS), nombre: 'x', duenaId: ADMIN })).rejects.toBeInstanceOf(SinPermisoError);
    expect(m.estado.eventos).toEqual([]);
  });

  it('rechaza datos mal formados (400) y una dueña inexistente, retirada o de otra empresa', async () => {
    const m = montar();
    for (const mal of [
      { nombre: '', duenaId: ADMIN },
      { nombre: 'x'.repeat(121), duenaId: ADMIN },
      { nombre: 'ok', duenaId: 'no-es-uuid' },
      { nombre: 'ok', duenaId: ADMIN, importancia: 'enorme' },
      { nombre: 'ok', duenaId: ADMIN, frecuencia: 'mensual' },
      { nombre: 'ok', duenaId: RETIRADO },
      { nombre: 'ok', duenaId: ADMIN_B },
    ])
      await expect(m.crear.ejecutar({ ...e(), ...mal }), JSON.stringify(mal)).rejects.toBeInstanceOf(ParametroInvalidoError);
    expect((await m.listar.ejecutar(e())).procesos).toEqual([]);
  });

  it('si la bitácora falla, no queda nada (misma transacción)', async () => {
    const m = montar();
    m.estado.fallarBitacora = true;
    await expect(m.crear.ejecutar({ ...e(), nombre: 'Compras', duenaId: ADMIN })).rejects.toThrow();
    m.estado.fallarBitacora = false;
    expect((await m.listar.ejecutar(e())).procesos).toEqual([]);
    expect(m.estado.auditoriaEstado.relaciones.size).toBe(0);
  });
});

describe('«Gestión del SIG»', () => {
  it('se crea con un botón, con quien llama como dueña, y solo puede haber uno vigente', async () => {
    const m = montar();
    const p = await m.gestionSig.ejecutar(e());
    expect(p).toMatchObject({ nombre: 'Gestión del SIG', transversal: true, importancia: 'alta', duenaId: ADMIN });
    await expect(m.gestionSig.ejecutar(e(ADMIN2))).rejects.toBeInstanceOf(ConflictoError);
    expect((await m.listar.ejecutar(e())).gestionSigVigente).toBe(true);
    await expect(m.gestionSig.ejecutar(e(COLAB))).rejects.toBeInstanceOf(SinPermisoError);
  });

  it('retirada, se puede volver a crear', async () => {
    const m = montar();
    const p = await m.gestionSig.ejecutar(e());
    await m.retirar.ejecutar({ ...e(), id: p.id });
    expect((await m.listar.ejecutar(e())).gestionSigVigente).toBe(false);
    expect((await m.gestionSig.ejecutar(e(ADMIN2))).codigo).toBe('PR-002');
  });
});

describe('lista de procesos', () => {
  it('cualquiera con «auditoria.ver» la ve, con los avisos de sin relaciones o dueña dada de baja', async () => {
    const m = montar();
    const p = await m.crear.ejecutar({ ...e(), nombre: 'Compras', duenaId: ADMIN });
    await m.quitar.ejecutar({ ...e(), id: p.id, personaId: ADMIN, relacion: 'duena' }).catch(() => undefined); // la dueña vigente no se quita
    expect((await m.listar.ejecutar(e(COLAB))).procesos[0]).toMatchObject({ personasRelacionadas: 1, avisos: [] });
    // la dueña pasa a estar dada de baja
    m.estado.documentosEstado.personas.set(A, [
      { id: ADMIN, nombre: 'Ana', rol: null, activa: false },
      { id: COLAB, nombre: 'Carla', rol: 'colaborador', activa: true },
    ]);
    expect((await m.listar.ejecutar(e(COLAB))).procesos[0]?.avisos).toEqual(['duena_inactiva']);
    // sin relaciones
    m.estado.auditoriaEstado.relaciones.clear();
    expect((await m.listar.ejecutar(e(COLAB))).procesos[0]?.avisos).toEqual(['sin_relaciones', 'duena_inactiva']);
    await expect(m.listar.ejecutar(e(SIN_PERMISOS))).rejects.toBeInstanceOf(SinPermisoError);
  });

  it('un proceso retirado no muestra avisos', async () => {
    const m = montar();
    const p = await m.crear.ejecutar({ ...e(), nombre: 'Compras', duenaId: ADMIN });
    await m.retirar.ejecutar({ ...e(), id: p.id });
    expect((await m.listar.ejecutar(e())).procesos[0]).toMatchObject({ estado: 'retirado', avisos: [] });
  });
});

describe('cambiar y retirar', () => {
  it('cambia con concurrencia optimista y registra solo el hecho', async () => {
    const m = montar();
    const p = await m.crear.ejecutar({ ...e(), nombre: 'Compras', duenaId: ADMIN });
    const c = await m.actualizar.ejecutar({
      ...e(),
      id: p.id,
      versionEsperada: 1,
      nombre: 'Compras y logística',
      importancia: 'alta',
      cambioRelevante: 'incidente',
    });
    expect(c).toMatchObject({ nombre: 'Compras y logística', importancia: 'alta', cambioRelevante: 'incidente', version: 2 });
    await expect(m.actualizar.ejecutar({ ...e(), id: p.id, versionEsperada: 1, nombre: 'otro' })).rejects.toBeInstanceOf(
      ConflictoDeVersionError,
    );
    expect(acciones(m.estado).at(-1)).toBe('proceso.cambiado');
    expect(JSON.stringify(m.estado.eventos)).not.toContain('logística');
    // quitar la marca
    expect((await m.actualizar.ejecutar({ ...e(), id: p.id, versionEsperada: 2, cambioRelevante: null })).cambioRelevante).toBeNull();
  });

  it('cambiar de dueña agrega su relación «dueña»; sin cambios o sin versión es 400', async () => {
    const m = montar();
    const p = await m.crear.ejecutar({ ...e(), nombre: 'Compras', duenaId: ADMIN });
    const c = await m.actualizar.ejecutar({ ...e(), id: p.id, versionEsperada: 1, duenaId: COLAB });
    expect(c.duenaId).toBe(COLAB);
    expect((await m.relaciones.ejecutar({ ...e(), id: p.id })).map((r) => r.personaId).sort()).toEqual([ADMIN, COLAB].sort());
    await expect(m.actualizar.ejecutar({ ...e(), id: p.id, versionEsperada: 2 })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.actualizar.ejecutar({ ...e(), id: p.id, nombre: 'x' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.actualizar.ejecutar({ ...e(), id: p.id, versionEsperada: 2, duenaId: RETIRADO })).rejects.toBeInstanceOf(
      ParametroInvalidoError,
    );
  });

  it('retirar deja el proceso sin cambios posteriores y un segundo retiro es 409', async () => {
    const m = montar();
    const p = await m.crear.ejecutar({ ...e(), nombre: 'Compras', duenaId: ADMIN });
    await m.retirar.ejecutar({ ...e(), id: p.id });
    await expect(m.retirar.ejecutar({ ...e(), id: p.id })).rejects.toBeInstanceOf(ConflictoError);
    await expect(m.actualizar.ejecutar({ ...e(), id: p.id, versionEsperada: 2, nombre: 'x' })).rejects.toBeInstanceOf(ConflictoError);
    expect(acciones(m.estado)).toContain('proceso.retirado');
  });

  it('un identificador inexistente o de otra empresa es 404 indistinguible; el permiso va primero', async () => {
    const m = montar();
    const p = await m.crear.ejecutar({ ...e(), nombre: 'Compras', duenaId: ADMIN });
    const inexistente = '00000000-0000-4000-8000-000000000000';
    await expect(m.retirar.ejecutar({ ...e(), id: inexistente })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.retirar.ejecutar({ ...e(ADMIN_B, B), id: p.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.actualizar.ejecutar({ ...e(ADMIN_B, B), id: p.id, versionEsperada: 1, nombre: 'intruso' })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    await expect(m.retirar.ejecutar({ ...e(COLAB), id: inexistente })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.retirar.ejecutar({ ...e(), id: 'no-uuid' })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });
});

describe('relaciones persona–proceso', () => {
  const con = async () => {
    const m = montar();
    const p = await m.crear.ejecutar({ ...e(), nombre: 'Compras', duenaId: ADMIN });
    return { m, p };
  };

  it('agrega (201) y es idempotente (200); registra la persona y el tipo, nunca un nombre', async () => {
    const { m, p } = await con();
    const r1 = await m.agregar.ejecutar({ ...e(), id: p.id, personaId: COLAB, relacion: 'participa' });
    expect(r1).toEqual({ creada: true, relacion: { procesoId: p.id, personaId: COLAB, relacion: 'participa' } });
    expect((await m.agregar.ejecutar({ ...e(), id: p.id, personaId: COLAB, relacion: 'participa' })).creada).toBe(false);
    const ev = m.estado.eventos.filter((x) => x.accion === 'relacion.creada');
    expect(ev).toHaveLength(2); // la de la dueña y esta
    expect(JSON.stringify(ev)).not.toContain('Carla');
    // varias relaciones de la misma persona con el mismo proceso
    expect((await m.agregar.ejecutar({ ...e(), id: p.id, personaId: COLAB, relacion: 'supervisa' })).creada).toBe(true);
  });

  it('rechaza una persona inexistente, dada de baja o de otra empresa y un tipo inventado (400); un proceso retirado es 409', async () => {
    const { m, p } = await con();
    for (const personaId of [RETIRADO, ADMIN_B, 'no-uuid', '00000000-0000-4000-8000-000000000000'])
      await expect(m.agregar.ejecutar({ ...e(), id: p.id, personaId, relacion: 'participa' }), personaId).rejects.toBeInstanceOf(
        ParametroInvalidoError,
      );
    await expect(m.agregar.ejecutar({ ...e(), id: p.id, personaId: COLAB, relacion: 'jefa' })).rejects.toBeInstanceOf(
      ParametroInvalidoError,
    );
    await m.retirar.ejecutar({ ...e(), id: p.id });
    await expect(m.agregar.ejecutar({ ...e(), id: p.id, personaId: COLAB, relacion: 'participa' })).rejects.toBeInstanceOf(ConflictoError);
  });

  it('solo el administrador SIG las cambia; el colaborador las consulta', async () => {
    const { m, p } = await con();
    await expect(m.agregar.ejecutar({ ...e(COLAB), id: p.id, personaId: COLAB, relacion: 'participa' })).rejects.toBeInstanceOf(
      SinPermisoError,
    );
    await expect(m.quitar.ejecutar({ ...e(COLAB), id: p.id, personaId: ADMIN, relacion: 'duena' })).rejects.toBeInstanceOf(SinPermisoError);
    expect(await m.relaciones.ejecutar({ ...e(COLAB), id: p.id })).toHaveLength(1);
  });

  it('quita con rastro; la dueña vigente conserva su relación y quitar lo que no existe es 404', async () => {
    const { m, p } = await con();
    await m.agregar.ejecutar({ ...e(), id: p.id, personaId: COLAB, relacion: 'diseno' });
    await m.quitar.ejecutar({ ...e(), id: p.id, personaId: COLAB, relacion: 'diseno' });
    expect(acciones(m.estado).at(-1)).toBe('relacion.eliminada');
    await expect(m.quitar.ejecutar({ ...e(), id: p.id, personaId: COLAB, relacion: 'diseno' })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    await expect(m.quitar.ejecutar({ ...e(), id: p.id, personaId: ADMIN, relacion: 'duena' })).rejects.toBeInstanceOf(ConflictoError);
  });

  it('las relaciones de otra empresa no se ven ni se tocan', async () => {
    const { m, p } = await con();
    await expect(m.relaciones.ejecutar({ ...e(ADMIN_B, B), id: p.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.agregar.ejecutar({ ...e(ADMIN_B, B), id: p.id, personaId: ADMIN_B, relacion: 'participa' })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    await expect(m.quitar.ejecutar({ ...e(ADMIN_B, B), id: p.id, personaId: ADMIN, relacion: 'duena' })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    expect((await m.listar.ejecutar(e(ADMIN_B, B))).procesos).toEqual([]);
  });
});
