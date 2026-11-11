import { describe, expect, it } from 'vitest';
import { AgregarMapeoUseCase, CambiarControlUseCase, CrearControlUseCase, ListarControlesUseCase, QuitarMapeoUseCase, RetirarControlUseCase } from './controles.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { A, ADMIN, B, COLAB, EstadoFalso, crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, entradas } from './prueba/fakes.js';

const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const montar = () => {
  const estado = new EstadoFalso();
  estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
  estado.catalogoPorEmpresa.set(B, [entradas.politicas]);
  estado.conceder(ADMIN, A, 'controles.ver', 'controles.gestionar');
  estado.conceder(COLAB, A, 'controles.ver');
  estado.conceder(ADMIN_B, B, 'controles.ver', 'controles.gestionar');
  let t = 0;
  let n = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 10, 12, 0, t++));
  const nuevoId = () => `cccccccc-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  const cat = crearCatalogoFalso(estado);
  return {
    estado,
    crear: new CrearControlUseCase(u, aut, reloj, nuevoId),
    cambiar: new CambiarControlUseCase(u, aut, reloj),
    retirar: new RetirarControlUseCase(u, aut, reloj),
    agregar: new AgregarMapeoUseCase(u, aut, cat, reloj),
    quitar: new QuitarMapeoUseCase(u, aut),
    listar: new ListarControlesUseCase(u, aut, cat),
  };
};
const yo = { empresaId: A, usuarioId: ADMIN };
const nuevo = { codigo: 'C-001', nombre: 'Política de contraseñas', descripcion: 'DESCRIPCION-PRIVADA' };
const POL = { libreriaCodigo: entradas.politicas.libreriaCodigo, idEstable: entradas.politicas.idEstable };
const CTX = { libreriaCodigo: entradas.contexto.libreriaCodigo, idEstable: entradas.contexto.idEstable };

describe('crear un control', () => {
  it('lo crea vigente, versión 1, y registra el hecho SIN el nombre ni la descripción', async () => {
    const { crear, estado } = montar();
    const c = await crear.ejecutar({ ...yo, ...nuevo });
    expect(c).toMatchObject({ codigo: 'C-001', nombre: 'Política de contraseñas', estado: 'vigente', version: 1 });
    expect(estado.eventos).toEqual([expect.objectContaining({ accion: 'control.creado', objeto: 'control:C-001', resultado: 'ok' })]);
    expect(JSON.stringify(estado.eventos)).not.toMatch(/DESCRIPCION-PRIVADA|contraseñas/);
  });

  it('solo quien gestiona: el colaborador recibe 403, y el permiso se decide antes que la forma', async () => {
    const { crear, estado } = montar();
    await expect(crear.ejecutar({ ...yo, usuarioId: COLAB, ...nuevo })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(crear.ejecutar({ ...yo, usuarioId: COLAB, codigo: 7 as never, nombre: '' })).rejects.toBeInstanceOf(SinPermisoError);
    expect(estado.controles.size).toBe(0);
  });

  it('un dato inválido es parámetro inválido y no escribe nada', async () => {
    const { crear, estado } = montar();
    for (const malo of [{ codigo: 'C 1' }, { nombre: '   ' }, { descripcion: 'x'.repeat(1001) }, { responsableId: 'x' }]) {
      await expect(crear.ejecutar({ ...yo, ...nuevo, ...malo })).rejects.toBeInstanceOf(ParametroInvalidoError);
    }
    expect(estado.controles.size).toBe(0);
    expect(estado.eventos).toEqual([]);
  });

  it('el código no se repite en la empresa (ni con uno retirado), pero otra empresa puede usar el mismo', async () => {
    const { crear, retirar, estado } = montar();
    const c = await crear.ejecutar({ ...yo, ...nuevo });
    await expect(crear.ejecutar({ ...yo, ...nuevo, nombre: 'Otro' })).rejects.toMatchObject({ motivo: 'codigo_repetido' });
    await retirar.ejecutar({ ...yo, id: c.id, versionEsperada: 1 });
    await expect(crear.ejecutar({ ...yo, ...nuevo, nombre: 'Otro' })).rejects.toBeInstanceOf(ConflictoError);
    await expect(crear.ejecutar({ empresaId: B, usuarioId: ADMIN_B, ...nuevo })).resolves.toMatchObject({ codigo: 'C-001' });
    expect(estado.controles.size).toBe(2);
  });

  it('si falla la bitácora, el control no queda creado', async () => {
    const { crear, estado } = montar();
    estado.fallarBitacora = true;
    await expect(crear.ejecutar({ ...yo, ...nuevo })).rejects.toThrow('bitácora no disponible');
    expect(estado.controles.size).toBe(0);
  });
});

describe('cambiar un control', () => {
  const creado = async () => {
    const m = montar();
    const c = await m.crear.ejecutar({ ...yo, ...nuevo });
    m.estado.eventos = [];
    return { ...m, c };
  };

  it('cambia, sube la versión y registra el hecho sin texto', async () => {
    const { cambiar, c, estado } = await creado();
    const r = await cambiar.ejecutar({ ...yo, id: c.id, versionEsperada: 1, nombre: 'Gestión de contraseñas', descripcion: null });
    expect(r).toMatchObject({ nombre: 'Gestión de contraseñas', descripcion: null, version: 2 });
    expect(estado.eventos).toEqual([expect.objectContaining({ accion: 'control.cambiado', objeto: 'control:C-001' })]);
    expect(JSON.stringify(estado.eventos)).not.toContain('Gestión');
  });

  it('sin cambios no escribe, no sube la versión ni registra', async () => {
    const { cambiar, c, estado } = await creado();
    const r = await cambiar.ejecutar({ ...yo, id: c.id, versionEsperada: 1, nombre: nuevo.nombre });
    expect(r.version).toBe(1);
    expect(estado.eventos).toEqual([]);
  });

  it('con una versión vieja hay conflicto y no se pisa lo guardado', async () => {
    const { cambiar, c } = await creado();
    await cambiar.ejecutar({ ...yo, id: c.id, versionEsperada: 1, nombre: 'Primero' });
    await expect(cambiar.ejecutar({ ...yo, id: c.id, versionEsperada: 1, nombre: 'Segundo' })).rejects.toBeInstanceOf(ConflictoDeVersionError);
  });

  it('si otra persona escribe en medio (carrera) también hay conflicto', async () => {
    const { cambiar, c, estado } = await creado();
    estado.carrera = true;
    await expect(cambiar.ejecutar({ ...yo, id: c.id, versionEsperada: 1, nombre: 'Otro' })).rejects.toBeInstanceOf(ConflictoDeVersionError);
  });

  it('un control retirado no se cambia (conflicto)', async () => {
    const { cambiar, retirar, c } = await creado();
    await retirar.ejecutar({ ...yo, id: c.id, versionEsperada: 1 });
    await expect(cambiar.ejecutar({ ...yo, id: c.id, versionEsperada: 2, nombre: 'Otro' })).rejects.toMatchObject({ motivo: 'retirado' });
  });

  it('orden: permiso → forma → existencia. Un control de otra empresa es 404, igual que uno inexistente', async () => {
    const { cambiar, c } = await creado();
    await expect(cambiar.ejecutar({ ...yo, usuarioId: COLAB, id: 'x', nombre: 'a' })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(cambiar.ejecutar({ ...yo, id: 'x', versionEsperada: 1 })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(cambiar.ejecutar({ ...yo, id: c.id, versionEsperada: 0 })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(cambiar.ejecutar({ ...yo, id: c.id, nombre: 'a' })).rejects.toBeInstanceOf(ParametroInvalidoError); // la versión es obligatoria
    await expect(cambiar.ejecutar({ ...yo, id: c.id, versionEsperada: 1, nombre: '' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(cambiar.ejecutar({ empresaId: B, usuarioId: ADMIN_B, id: c.id, versionEsperada: 1, nombre: 'intruso' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(cambiar.ejecutar({ ...yo, id: 'dddddddd-0000-4000-8000-000000000000', versionEsperada: 1, nombre: 'a' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
});

describe('retirar un control', () => {
  it('lo retira, sube la versión y registra el hecho; retirar otra vez es un conflicto', async () => {
    const { crear, retirar, estado } = montar();
    const c = await crear.ejecutar({ ...yo, ...nuevo });
    estado.eventos = [];
    expect(await retirar.ejecutar({ ...yo, id: c.id, versionEsperada: 1 })).toMatchObject({ estado: 'retirado', version: 2 });
    expect(estado.eventos).toEqual([expect.objectContaining({ accion: 'control.retirado', objeto: 'control:C-001' })]);
    await expect(retirar.ejecutar({ ...yo, id: c.id, versionEsperada: 2 })).rejects.toMatchObject({ motivo: 'ya_retirado' });
  });

  it('exige permiso, versión vigente y que el control sea de la empresa', async () => {
    const { crear, retirar } = montar();
    const c = await crear.ejecutar({ ...yo, ...nuevo });
    await expect(retirar.ejecutar({ ...yo, usuarioId: COLAB, id: c.id, versionEsperada: 1 })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(retirar.ejecutar({ ...yo, id: c.id, versionEsperada: 5 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    await expect(retirar.ejecutar({ empresaId: B, usuarioId: ADMIN_B, id: c.id, versionEsperada: 1 })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
});

describe('mapeos', () => {
  const con = async () => {
    const m = montar();
    const c = await m.crear.ejecutar({ ...yo, ...nuevo });
    m.estado.eventos = [];
    return { ...m, c };
  };

  it('relaciona el control con una entrada adoptada y registra el hecho con el id estable', async () => {
    const { agregar, c, estado } = await con();
    expect(await agregar.ejecutar({ ...yo, controlId: c.id, ...POL })).toEqual({ creado: true });
    expect(estado.eventos).toEqual([expect.objectContaining({ accion: 'mapeo.creado', objeto: 'mapeo:C-001.a27-5-1' })]);
  });

  it('repetir el mismo mapeo no es un error: no crea ni registra de nuevo', async () => {
    const { agregar, c, estado } = await con();
    await agregar.ejecutar({ ...yo, controlId: c.id, ...POL });
    estado.eventos = [];
    expect(await agregar.ejecutar({ ...yo, controlId: c.id, ...POL })).toEqual({ creado: false });
    expect(estado.eventos).toEqual([]);
    expect(estado.mapeos.size).toBe(1);
  });

  it('una entrada que la empresa no adoptó (o de otra empresa) y un control ajeno son 404 indistinguibles', async () => {
    const { agregar, c, estado } = await con();
    estado.catalogoPorEmpresa.set(A, [entradas.contexto]); // A ya no tiene el Anexo A
    await expect(agregar.ejecutar({ ...yo, controlId: c.id, ...POL })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(agregar.ejecutar({ ...yo, controlId: c.id, libreriaCodigo: 'otra-libreria', idEstable: 'x-1' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(agregar.ejecutar({ empresaId: B, usuarioId: ADMIN_B, controlId: c.id, ...POL })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect(estado.mapeos.size).toBe(0);
  });

  it('un control retirado no recibe mapeos y hay un tope por control', async () => {
    const { agregar, retirar, c, estado } = await con();
    const muchas = Array.from({ length: 51 }, (_v, i) => ({ ...entradas.politicas, idEstable: `a27-9-${i}`, orden: i }));
    estado.catalogoPorEmpresa.set(A, muchas);
    for (let i = 0; i < 50; i++) await agregar.ejecutar({ ...yo, controlId: c.id, libreriaCodigo: entradas.politicas.libreriaCodigo, idEstable: `a27-9-${i}` });
    await expect(agregar.ejecutar({ ...yo, controlId: c.id, libreriaCodigo: entradas.politicas.libreriaCodigo, idEstable: 'a27-9-50' })).rejects.toMatchObject({ motivo: 'tope_de_mapeos' });
    await retirar.ejecutar({ ...yo, id: c.id, versionEsperada: 1 });
    await expect(agregar.ejecutar({ ...yo, controlId: c.id, libreriaCodigo: entradas.politicas.libreriaCodigo, idEstable: 'a27-9-1' })).rejects.toMatchObject({ motivo: 'retirado' });
  });

  it('permiso → forma → existencia', async () => {
    const { agregar, c } = await con();
    await expect(agregar.ejecutar({ ...yo, usuarioId: COLAB, controlId: 'x', libreriaCodigo: 'X', idEstable: '..' })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(agregar.ejecutar({ ...yo, controlId: 'x', ...POL })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(agregar.ejecutar({ ...yo, controlId: c.id, libreriaCodigo: 'X', idEstable: POL.idEstable })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(agregar.ejecutar({ ...yo, controlId: c.id, libreriaCodigo: POL.libreriaCodigo, idEstable: '../x' })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('quitar un mapeo lo borra y lo registra; quitar uno que no existe es 404; un control retirado no cambia', async () => {
    const { agregar, quitar, retirar, c, estado } = await con();
    await agregar.ejecutar({ ...yo, controlId: c.id, ...POL });
    await agregar.ejecutar({ ...yo, controlId: c.id, ...CTX });
    estado.eventos = [];
    await quitar.ejecutar({ ...yo, controlId: c.id, ...POL });
    expect(estado.mapeos.size).toBe(1);
    expect(estado.eventos).toEqual([expect.objectContaining({ accion: 'mapeo.eliminado', objeto: 'mapeo:C-001.a27-5-1' })]);
    await expect(quitar.ejecutar({ ...yo, controlId: c.id, ...POL })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await retirar.ejecutar({ ...yo, id: c.id, versionEsperada: 1 });
    await expect(quitar.ejecutar({ ...yo, controlId: c.id, ...CTX })).rejects.toMatchObject({ motivo: 'retirado' });
  });

  it('quitar no exige que la entrada siga adoptada y exige permiso; el control de otra empresa es 404', async () => {
    const { agregar, quitar, c, estado } = await con();
    await agregar.ejecutar({ ...yo, controlId: c.id, ...POL });
    estado.catalogoPorEmpresa.set(A, []);
    await expect(quitar.ejecutar({ ...yo, usuarioId: COLAB, controlId: c.id, ...POL })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(quitar.ejecutar({ empresaId: B, usuarioId: ADMIN_B, controlId: c.id, ...POL })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await quitar.ejecutar({ ...yo, controlId: c.id, ...POL });
    expect(estado.mapeos.size).toBe(0);
  });

  it('si falla la bitácora, el mapeo no queda ni se pierde el anterior', async () => {
    const { agregar, quitar, c, estado } = await con();
    await agregar.ejecutar({ ...yo, controlId: c.id, ...POL });
    estado.fallarBitacora = true;
    await expect(agregar.ejecutar({ ...yo, controlId: c.id, ...CTX })).rejects.toThrow('bitácora no disponible');
    await expect(quitar.ejecutar({ ...yo, controlId: c.id, ...POL })).rejects.toThrow('bitácora no disponible');
    expect(estado.mapeos.size).toBe(1);
  });
});

describe('marco de controles unificado', () => {
  const marco = async () => {
    const m = montar();
    const c1 = await m.crear.ejecutar({ ...yo, ...nuevo });
    const c2 = await m.crear.ejecutar({ ...yo, codigo: 'C-002', nombre: 'Revisión de accesos' });
    await m.crear.ejecutar({ ...yo, codigo: 'C-003', nombre: 'Sin mapeos' });
    await m.agregar.ejecutar({ ...yo, controlId: c1.id, ...CTX }); // cláusula común: ISO 9001 y ISO/IEC 27001
    await m.agregar.ejecutar({ ...yo, controlId: c1.id, ...POL }); // solo 27001
    await m.agregar.ejecutar({ ...yo, controlId: c2.id, ...POL });
    return { ...m, c1, c2 };
  };

  it('cada control trae sus entradas y las normas que alcanza (una medida, varias normas)', async () => {
    const { listar } = await marco();
    const r = await listar.ejecutar({ ...yo, usuarioId: COLAB });
    expect(r.normas).toEqual(['ISO 9001', 'ISO/IEC 27001']);
    expect(r.controles.map((c) => [c.codigo, c.normas])).toEqual([['C-001', ['ISO 9001', 'ISO/IEC 27001']], ['C-002', ['ISO/IEC 27001']], ['C-003', []]]);
    const c1 = r.controles[0]!;
    expect(c1.mapeos.map((m) => m.idEstable).sort()).toEqual(['a27-5-1', 'ha-4.1']);
    expect(c1.mapeos.find((m) => m.idEstable === 'ha-4.1')?.entrada).toMatchObject({ tipo: 'clausula', titulo: 'Contexto' });
  });

  it('filtra por norma', async () => {
    const { listar } = await marco();
    expect((await listar.ejecutar({ ...yo, norma: 'ISO 9001' })).controles.map((c) => c.codigo)).toEqual(['C-001']);
    expect((await listar.ejecutar({ ...yo, norma: 'ISO/IEC 27001' })).controles.map((c) => c.codigo)).toEqual(['C-001', 'C-002']);
    expect((await listar.ejecutar({ ...yo, norma: 'ISO 42001' })).controles).toEqual([]);
  });

  it('los retirados solo salen si se piden', async () => {
    const { listar, retirar, c2 } = await marco();
    await retirar.ejecutar({ ...yo, id: c2.id, versionEsperada: 1 });
    expect((await listar.ejecutar(yo)).controles.map((c) => c.codigo)).toEqual(['C-001', 'C-003']);
    expect((await listar.ejecutar({ ...yo, incluirRetirados: true })).controles.map((c) => [c.codigo, c.estado])).toEqual([['C-001', 'vigente'], ['C-002', 'retirado'], ['C-003', 'vigente']]);
  });

  it('un mapeo a una entrada que ya no está adoptada se muestra sin detalle y no suma normas', async () => {
    const { listar, estado } = await marco();
    estado.catalogoPorEmpresa.set(A, [entradas.contexto]); // el Anexo A ya no está adoptado
    const r = await listar.ejecutar(yo);
    const c2 = r.controles.find((c) => c.codigo === 'C-002')!;
    expect(c2.mapeos).toEqual([{ libreriaCodigo: POL.libreriaCodigo, idEstable: POL.idEstable, entrada: null }]);
    expect(c2.normas).toEqual([]);
  });

  it('exige permiso, valida la forma y no mezcla empresas', async () => {
    const { listar, estado } = await marco();
    await expect(listar.ejecutar({ ...yo, usuarioId: '99999999-9999-4999-8999-999999999999' })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(listar.ejecutar({ ...yo, norma: '<script>' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(listar.ejecutar({ ...yo, incluirRetirados: 'si' as never })).rejects.toBeInstanceOf(ParametroInvalidoError);
    expect((await listar.ejecutar({ empresaId: B, usuarioId: ADMIN_B })).controles).toEqual([]);
    expect(estado.controles.size).toBe(3);
  });
});
