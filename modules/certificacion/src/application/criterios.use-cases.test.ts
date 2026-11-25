import { describe, expect, it } from 'vitest';
import { Riesgo } from '../domain/riesgo.js';
import { ConflictoDeVersionError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { GuardarCriteriosUseCase, ObtenerCriteriosUseCase } from './criterios.use-cases.js';
import { A, ADMIN, B, COLAB, EstadoFalso, crearAutorizacionFalsa, crearUnidadFalsa } from './prueba/fakes.js';

const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN = '99999999-9999-4999-8999-999999999999';
const cinco = (p: string) => [`${p}1`, `${p}2`, `${p}3`, `${p}4`, `${p}5`];
const datos = { probabilidad: cinco('PROB-PRIVADA'), impacto: cinco('IMP-PRIVADO'), nivelAceptacion: 'medio' };

const montar = () => {
  const estado = new EstadoFalso();
  estado.conceder(ADMIN, A, 'criterios.ver', 'criterios.gestionar');
  estado.conceder(COLAB, A, 'criterios.ver');
  estado.conceder(ADMIN_B, B, 'criterios.ver', 'criterios.gestionar');
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 25, 12, 0, t++));
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  const riesgo = (empresaId: typeof A, k: number, p: number, i: number, retirado = false) => {
    const r0 = Riesgo.crear({ id: `dddddddd-0000-4000-8000-${String(k).padStart(12, '0')}`, empresaId, codigo: `R-${String(k).padStart(3, '0')}`, titulo: `Riesgo ${k}`, probabilidad: p, impacto: i, decision: 'mitigar' });
    estado.riesgos.set(r0.id, retirado ? r0.retirar() : r0);
  };
  return { estado, riesgo, obtener: new ObtenerCriteriosUseCase(u, aut), guardar: new GuardarCriteriosUseCase(u, aut, reloj) };
};
const yo = { empresaId: A, usuarioId: ADMIN };

describe('criterios de evaluación', () => {
  it('sin criterios propios rige la escala por omisión, rotulada, sin nivel de aceptación y con la matriz completa', async () => {
    const { obtener } = montar();
    const c = await obtener.ejecutar({ ...yo });
    expect(c).toMatchObject({ origen: 'omision', version: 0, nivelAceptacion: null, creadoEn: null, riesgosVigentes: 0 });
    expect(c.matriz).toHaveLength(25);
  });

  it('guardar crea la versión 1; la matriz cuenta solo los riesgos vigentes por celda', async () => {
    const { guardar, riesgo } = montar();
    riesgo(A, 1, 3, 4);
    riesgo(A, 2, 3, 4);
    riesgo(A, 3, 1, 1, true); // retirado: no cuenta
    riesgo(B, 4, 3, 4); // de otra empresa: no cuenta
    const c = await guardar.ejecutar({ ...yo, ...datos, versionEsperada: 0 });
    expect(c).toMatchObject({ origen: 'empresa', version: 1, nivelAceptacion: 'medio', riesgosVigentes: 2 });
    expect(c.matriz.find((x) => x.probabilidad === 3 && x.impacto === 4)).toMatchObject({ cantidad: 2, puntaje: 12, nivel: 'alto' });
    expect(c.matriz.find((x) => x.probabilidad === 1 && x.impacto === 1)?.cantidad).toBe(0);
  });

  it('cada cambio es una versión nueva y las anteriores se conservan; la bitácora no lleva texto', async () => {
    const { guardar, estado } = montar();
    await guardar.ejecutar({ ...yo, ...datos, versionEsperada: 0 });
    const c2 = await guardar.ejecutar({ ...yo, ...datos, nivelAceptacion: 'alto', versionEsperada: 1 });
    expect(c2).toMatchObject({ version: 2, nivelAceptacion: 'alto' });
    expect([...estado.riesgosEstado.criterios.keys()].sort()).toEqual([`${A}|1`, `${A}|2`]);
    expect(estado.eventos.map((e) => [e.accion, e.objeto])).toEqual([['criterios.cambiados', 'criterios:v1'], ['criterios.cambiados', 'criterios:v2']]);
    expect(JSON.stringify(estado.eventos)).not.toMatch(/PROB-PRIVADA|IMP-PRIVADO|medio|alto/);
  });

  it('guardar exactamente lo mismo no crea una versión ni deja un hecho', async () => {
    const { guardar, estado } = montar();
    await guardar.ejecutar({ ...yo, ...datos, versionEsperada: 0 });
    const igual = await guardar.ejecutar({ ...yo, ...datos, versionEsperada: 1 });
    expect(igual.version).toBe(1);
    expect(estado.riesgosEstado.criterios.size).toBe(1);
    expect(estado.eventos).toHaveLength(1);
  });

  it('exige la versión que la persona vio: otra persona guardó antes → 409 y no se pisa', async () => {
    const { guardar, estado } = montar();
    await guardar.ejecutar({ ...yo, ...datos, versionEsperada: 0 });
    await expect(guardar.ejecutar({ ...yo, ...datos, nivelAceptacion: 'alto', versionEsperada: 0 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    await expect(guardar.ejecutar({ ...yo, ...datos, nivelAceptacion: 'alto', versionEsperada: 5 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    expect(estado.riesgosEstado.criterios.size).toBe(1);
    estado.riesgosEstado.carrera = true; // otra persona insertó la misma versión entre la lectura y la escritura
    await expect(guardar.ejecutar({ ...yo, ...datos, nivelAceptacion: 'alto', versionEsperada: 1 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
  });

  it('valida los datos (400) DESPUÉS del permiso: descripciones, largos, nivel y versión esperada', async () => {
    const { guardar } = montar();
    for (const mal of [{ probabilidad: cinco('a').slice(1) }, { impacto: ['a', 'b', ' ', 'd', 'e'] }, { impacto: ['a', 'b', 'x'.repeat(201), 'd', 'e'] }, { nivelAceptacion: 'enorme' }, { nivelAceptacion: undefined }, { versionEsperada: -1 }, { versionEsperada: '0' }, { versionEsperada: undefined }])
      await expect(guardar.ejecutar({ ...yo, ...datos, versionEsperada: 0, ...mal }), JSON.stringify(mal)).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(guardar.ejecutar({ empresaId: A, usuarioId: SIN, probabilidad: 'x' })).rejects.toBeInstanceOf(SinPermisoError);
  });

  it('el colaborador consulta pero no guarda; sin permiso no se ve ni se guarda', async () => {
    const { guardar, obtener } = montar();
    expect((await obtener.ejecutar({ empresaId: A, usuarioId: COLAB })).origen).toBe('omision');
    await expect(guardar.ejecutar({ empresaId: A, usuarioId: COLAB, ...datos, versionEsperada: 0 })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(obtener.ejecutar({ empresaId: A, usuarioId: SIN })).rejects.toBeInstanceOf(SinPermisoError);
  });

  it('si no se puede registrar en la bitácora, no queda la versión', async () => {
    const { guardar, estado } = montar();
    estado.fallarBitacora = true;
    await expect(guardar.ejecutar({ ...yo, ...datos, versionEsperada: 0 })).rejects.toThrow('bitácora');
    expect(estado.riesgosEstado.criterios.size).toBe(0);
  });

  it('cada empresa tiene los suyos y no ve los de la otra', async () => {
    const { guardar, obtener } = montar();
    await guardar.ejecutar({ ...yo, ...datos, versionEsperada: 0 });
    expect((await obtener.ejecutar({ empresaId: B, usuarioId: ADMIN_B })).origen).toBe('omision');
    const b = await guardar.ejecutar({ empresaId: B, usuarioId: ADMIN_B, ...datos, nivelAceptacion: 'bajo', versionEsperada: 0 });
    expect(b).toMatchObject({ version: 1, nivelAceptacion: 'bajo' });
    expect((await obtener.ejecutar({ ...yo })).nivelAceptacion).toBe('medio');
  });
});
