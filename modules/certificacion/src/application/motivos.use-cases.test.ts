import { describe, expect, it } from 'vitest';
import { ConflictoDeVersionError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { MotivoInclusion } from '../domain/motivo-inclusion.js';
import { GuardarReferenciaUseCase, TOPE_MOTIVOS, ListarMotivosUseCase, ListarReferenciasUseCase, QuitarMotivoUseCase, QuitarReferenciaUseCase, RegistrarMotivoUseCase } from './motivos.use-cases.js';
import { A, ADMIN, B, COLAB, EstadoFalso, crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, entradas } from './prueba/fakes.js';

const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const OTRO = '77777777-7777-4777-8777-777777777777';
const montar = () => {
  const estado = new EstadoFalso();
  estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
  estado.catalogoPorEmpresa.set(B, [entradas.politicas]);
  estado.conceder(ADMIN, A, 'declaracion.ver', 'declaracion.justificar');
  estado.conceder(COLAB, A, 'declaracion.ver');
  estado.conceder(ADMIN_B, B, 'declaracion.ver', 'declaracion.justificar');
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 17, 12, 0, t++));
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  const cat = crearCatalogoFalso(estado);
  return {
    estado,
    registrar: new RegistrarMotivoUseCase(u, aut, cat, reloj),
    quitar: new QuitarMotivoUseCase(u, aut),
    listar: new ListarMotivosUseCase(u, aut),
    guardarRef: new GuardarReferenciaUseCase(u, aut, reloj),
    quitarRef: new QuitarReferenciaUseCase(u, aut),
    listarRef: new ListarReferenciasUseCase(u, aut),
  };
};
const yo = { empresaId: A, usuarioId: ADMIN };
const yoB = { empresaId: B, usuarioId: ADMIN_B };
const POL = { libreriaCodigo: entradas.politicas.libreriaCodigo, idEstable: entradas.politicas.idEstable };
const motivo = { ...POL, tipo: 'legal' as const, nota: 'NOTA-PRIVADA: Ley de datos' };
const ref = { tipo: 'plan' as const, titulo: 'TITULO-PRIVADO Plan 2026', versionDoc: '1.0', fecha: '2026-11-01', ubicacion: 'UBICACION-PRIVADA SIG-PL-004' };

describe('registrar un motivo de inclusión', () => {
  it('lo crea con versión 1 y registra el hecho SIN la nota', async () => {
    const { registrar, estado } = montar();
    expect(await registrar.ejecutar({ ...yo, ...motivo })).toMatchObject({ tipo: 'legal', version: 1 });
    expect(estado.eventos).toEqual([expect.objectContaining({ accion: 'motivo.creado', objeto: `motivo:${POL.idEstable}.legal`, resultado: 'ok' })]);
    expect(JSON.stringify(estado.eventos)).not.toMatch(/NOTA-PRIVADA|Ley de datos/);
  });

  it('un control puede tener un motivo de cada tipo', async () => {
    const { registrar, estado } = montar();
    for (const tipo of ['legal', 'contractual', 'negocio', 'otro'] as const) await registrar.ejecutar({ ...yo, ...motivo, tipo });
    expect(estado.motivos.size).toBe(4);
  });

  it('cambia la nota con la versión que la persona vio, sube la versión y registra el cambio', async () => {
    const { registrar, estado } = montar();
    await registrar.ejecutar({ ...yo, ...motivo });
    expect(await registrar.ejecutar({ ...yo, ...motivo, nota: 'Contrato con el cliente', versionEsperada: 1 })).toMatchObject({ nota: 'Contrato con el cliente', version: 2 });
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'motivo.cambiado' });
  });

  it('con la misma nota no escribe, no sube la versión ni registra hecho', async () => {
    const { registrar, estado } = montar();
    await registrar.ejecutar({ ...yo, ...motivo });
    const hechos = estado.eventos.length;
    expect(await registrar.ejecutar({ ...yo, ...motivo, versionEsperada: 1 })).toMatchObject({ version: 1 });
    expect(estado.eventos).toHaveLength(hechos);
  });

  it('«otra persona lo cambió antes»: versión vieja, ya existe sin versión, o ya no existe con versión', async () => {
    const { registrar, quitar } = montar();
    await registrar.ejecutar({ ...yo, ...motivo });
    await registrar.ejecutar({ ...yo, ...motivo, nota: 'Otra nota', versionEsperada: 1 });
    await expect(registrar.ejecutar({ ...yo, ...motivo, nota: 'Mi nota', versionEsperada: 1 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    await expect(registrar.ejecutar({ ...yo, ...motivo, nota: 'Mi nota' })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    await quitar.ejecutar({ ...yo, ...POL, tipo: 'legal', versionEsperada: 2 });
    await expect(registrar.ejecutar({ ...yo, ...motivo, versionEsperada: 2 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
  });

  it('solo quien justifica: el colaborador recibe 403, y el permiso se decide antes que la forma', async () => {
    const { registrar, estado } = montar();
    await expect(registrar.ejecutar({ ...yo, usuarioId: COLAB, ...motivo })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(registrar.ejecutar({ ...yo, usuarioId: COLAB, libreriaCodigo: 1 as never, idEstable: '', tipo: 'x' as never, nota: '' })).rejects.toBeInstanceOf(SinPermisoError);
    expect(estado.motivos.size).toBe(0);
  });

  it('la nota es obligatoria; el tipo «riesgo» no se registra; un dato inválido no escribe nada', async () => {
    const { registrar, estado } = montar();
    for (const malo of [{ nota: '' }, { nota: '   ' }, { nota: 'x'.repeat(501) }, { tipo: 'riesgo' as never }, { idEstable: 'MAL ID' }, { versionEsperada: 0 }, { versionEsperada: 1.5 }]) {
      await expect(registrar.ejecutar({ ...yo, ...motivo, ...malo })).rejects.toBeInstanceOf(ParametroInvalidoError);
    }
    expect(estado.motivos.size).toBe(0);
    expect(estado.eventos).toEqual([]);
  });

  it('solo controles del Anexo A adoptados: una cláusula, una entrada ajena o inexistente son 404', async () => {
    const { registrar, estado } = montar();
    await expect(registrar.ejecutar({ ...yo, ...motivo, libreriaCodigo: entradas.contexto.libreriaCodigo, idEstable: entradas.contexto.idEstable })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(registrar.ejecutar({ ...yo, ...motivo, idEstable: 'zz-1' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(registrar.ejecutar({ ...yoB, ...motivo, idEstable: entradas.roles.idEstable })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect(estado.motivos.size).toBe(0);
  });

  it('si falla la bitácora no queda el motivo, y si dos personas crean a la vez la segunda recibe conflicto', async () => {
    const { registrar, estado } = montar();
    estado.fallarBitacora = true;
    await expect(registrar.ejecutar({ ...yo, ...motivo })).rejects.toThrow();
    expect(estado.motivos.size).toBe(0);
    estado.fallarBitacora = false;
    estado.carrera = true;
    await expect(registrar.ejecutar({ ...yo, ...motivo })).rejects.toBeInstanceOf(ConflictoDeVersionError);
  });
});

describe('quitar y listar motivos', () => {
  it('quita con la versión vista y lo registra; sin versión es 400, versión vieja es conflicto, inexistente 404', async () => {
    const { registrar, quitar, estado } = montar();
    await registrar.ejecutar({ ...yo, ...motivo });
    await expect(quitar.ejecutar({ ...yo, ...POL, tipo: 'legal' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(quitar.ejecutar({ ...yo, ...POL, tipo: 'legal', versionEsperada: 9 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    await expect(quitar.ejecutar({ ...yo, usuarioId: COLAB, ...POL, tipo: 'legal', versionEsperada: 1 })).rejects.toBeInstanceOf(SinPermisoError);
    await quitar.ejecutar({ ...yo, ...POL, tipo: 'legal', versionEsperada: 1 });
    expect(estado.motivos.size).toBe(0);
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'motivo.eliminado', objeto: `motivo:${POL.idEstable}.legal` });
    await expect(quitar.ejecutar({ ...yo, ...POL, tipo: 'legal', versionEsperada: 1 })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });

  it('el colaborador consulta los motivos; cada empresa ve solo los suyos; sin permiso 403', async () => {
    const { registrar, listar } = montar();
    await registrar.ejecutar({ ...yo, ...motivo });
    await registrar.ejecutar({ ...yo, ...motivo, tipo: 'otro', nota: 'Política propia' });
    await registrar.ejecutar({ ...yoB, ...motivo, nota: 'Del B' });
    expect((await listar.ejecutar({ ...yo, usuarioId: COLAB })).map((m) => [m.tipo, m.nota])).toEqual([['legal', 'NOTA-PRIVADA: Ley de datos'], ['otro', 'Política propia']]);
    expect((await listar.ejecutar(yoB)).map((m) => m.nota)).toEqual(['Del B']);
    await expect(listar.ejecutar({ ...yo, usuarioId: OTRO })).rejects.toBeInstanceOf(SinPermisoError);
  });
});

describe('referencias al análisis y al plan de tratamiento', () => {
  it('crea una por tipo, con el objeto de la norma, SIN los datos en la bitácora', async () => {
    const { guardarRef, estado } = montar();
    expect(await guardarRef.ejecutar({ ...yo, ...ref })).toMatchObject({ tipo: 'plan', versionDoc: '1.0', fecha: '2026-11-01', version: 1 });
    await guardarRef.ejecutar({ ...yo, ...ref, tipo: 'analisis' });
    expect(estado.eventos[0]).toMatchObject({ accion: 'referencia.creada', objeto: 'referencia:iso-iec-27001.plan' });
    expect(JSON.stringify(estado.eventos)).not.toMatch(/PRIVAD|SIG-PL-004|2026-11-01/);
    expect(estado.referencias.size).toBe(2);
  });

  it('cambia con la versión vista, sube la versión y sin cambios no escribe', async () => {
    const { guardarRef, estado } = montar();
    await guardarRef.ejecutar({ ...yo, ...ref });
    const hechos = estado.eventos.length;
    expect(await guardarRef.ejecutar({ ...yo, ...ref, versionEsperada: 1 })).toMatchObject({ version: 1 });
    expect(estado.eventos).toHaveLength(hechos);
    expect(await guardarRef.ejecutar({ ...yo, ...ref, versionDoc: '1.1', versionEsperada: 1 })).toMatchObject({ versionDoc: '1.1', version: 2 });
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'referencia.cambiada' });
  });

  it('«otra persona lo cambió antes»: versión vieja o existente sin versión', async () => {
    const { guardarRef } = montar();
    await guardarRef.ejecutar({ ...yo, ...ref });
    await guardarRef.ejecutar({ ...yo, ...ref, titulo: 'Otro', versionEsperada: 1 });
    await expect(guardarRef.ejecutar({ ...yo, ...ref, titulo: 'Mío', versionEsperada: 1 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    await expect(guardarRef.ejecutar({ ...yo, ...ref, titulo: 'Mío' })).rejects.toBeInstanceOf(ConflictoDeVersionError);
  });

  it('permiso antes que forma; datos inválidos son 400 y no escriben', async () => {
    const { guardarRef, estado } = montar();
    await expect(guardarRef.ejecutar({ ...yo, usuarioId: COLAB, ...ref })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(guardarRef.ejecutar({ ...yo, usuarioId: COLAB, ...ref, fecha: 'x' })).rejects.toBeInstanceOf(SinPermisoError);
    for (const malo of [{ tipo: 'otro' as never }, { titulo: '' }, { versionDoc: ' ' }, { fecha: '2026-02-31' }, { ubicacion: 'x'.repeat(201) }]) {
      await expect(guardarRef.ejecutar({ ...yo, ...ref, ...malo })).rejects.toBeInstanceOf(ParametroInvalidoError);
    }
    expect(estado.referencias.size).toBe(0);
  });

  it('se quita con la versión vista; el colaborador y otras empresas solo ven lo que les toca', async () => {
    const { guardarRef, quitarRef, listarRef, estado } = montar();
    await guardarRef.ejecutar({ ...yo, ...ref });
    await guardarRef.ejecutar({ ...yoB, ...ref, titulo: 'Del B' });
    expect((await listarRef.ejecutar({ ...yo, usuarioId: COLAB })).map((r) => r.titulo)).toEqual(['TITULO-PRIVADO Plan 2026']);
    await expect(listarRef.ejecutar({ ...yo, usuarioId: OTRO })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(quitarRef.ejecutar({ ...yo, tipo: 'plan' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(quitarRef.ejecutar({ ...yo, tipo: 'plan', versionEsperada: 3 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    await expect(quitarRef.ejecutar({ ...yo, tipo: 'analisis', versionEsperada: 1 })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await quitarRef.ejecutar({ ...yo, tipo: 'plan', versionEsperada: 1 });
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'referencia.eliminada', objeto: 'referencia:iso-iec-27001.plan' });
    expect(await listarRef.ejecutar(yo)).toEqual([]);
    expect((await listarRef.ejecutar(yoB)).map((r) => r.titulo)).toEqual(['Del B']);
    expect(estado.referencias.size).toBe(1);
  });
});

describe('topes al crear y texto invisible', () => {
  it('no deja pasar el tope de motivos al crear: conflicto y nada nuevo; cambiar uno existente sigue permitido', async () => {
    const { registrar, estado } = montar();
    for (let i = 0; i < TOPE_MOTIVOS; i++) {
      const m = MotivoInclusion.crear({ empresaId: A, libreriaCodigo: 'otra-libreria', idEstable: `x${i}`, tipo: 'otro', nota: 'n' });
      estado.motivos.set(`${A}|otra-libreria|x${i}|otro`, m);
    }
    await expect(registrar.ejecutar({ ...yo, ...motivo })).rejects.toMatchObject({ motivo: 'tope_de_motivos' });
    expect(estado.motivos.size).toBe(TOPE_MOTIVOS);
  });

  it('una nota o una referencia con caracteres invisibles o de dirección se rechaza', async () => {
    const { registrar, guardarRef } = montar();
    for (const malo of ['antes\u202edespués', 'a\u200bb', 'a\ufeffb']) {
      await expect(registrar.ejecutar({ ...yo, ...motivo, nota: malo })).rejects.toBeInstanceOf(ParametroInvalidoError);
      await expect(guardarRef.ejecutar({ ...yo, ...ref, titulo: malo })).rejects.toBeInstanceOf(ParametroInvalidoError);
      await expect(guardarRef.ejecutar({ ...yo, ...ref, ubicacion: malo })).rejects.toBeInstanceOf(ParametroInvalidoError);
    }
  });
});
