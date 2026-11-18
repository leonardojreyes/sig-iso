import { describe, expect, it } from 'vitest';
import { Evaluacion } from '../domain/evaluacion.js';
import { AvisoRetiroRiesgoUseCase } from './aviso-retiro-riesgo.use-case.js';
import { EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { A, ADMIN, B, COLAB, EstadoFalso, crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, entradas } from './prueba/fakes.js';
import { RegistrarMotivoUseCase } from './motivos.use-cases.js';
import { CrearRiesgoUseCase } from './riesgos.use-cases.js';
import { PreverTratamientoUseCase } from './vinculos-riesgo.use-cases.js';

const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const POL = entradas.politicas;
const ROL = entradas.roles;
const montar = () => {
  const estado = new EstadoFalso();
  estado.catalogoPorEmpresa.set(A, [entradas.contexto, POL, ROL]);
  estado.catalogoPorEmpresa.set(B, [POL]);
  estado.conceder(ADMIN, A, 'riesgos.ver', 'riesgos.gestionar', 'declaracion.justificar');
  estado.conceder(COLAB, A, 'riesgos.ver');
  estado.conceder(ADMIN_B, B, 'riesgos.ver', 'riesgos.gestionar');
  let n = 0;
  const reloj = () => new Date('2026-11-17T15:00:00Z');
  const nuevoId = () => `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  const cat = crearCatalogoFalso(estado);
  for (const e of [POL, ROL]) estado.evaluaciones.set(`${A}|${e.libreriaCodigo}|${e.idEstable}`, Evaluacion.crear({ empresaId: A, libreriaCodigo: e.libreriaCodigo, idEstable: e.idEstable, libreriaId: e.libreriaId, estado: 'cumple', comentario: null, version: 1 }));
  return {
    estado,
    crearRiesgo: new CrearRiesgoUseCase(u, aut, reloj, nuevoId),
    prever: new PreverTratamientoUseCase(u, aut, cat, reloj),
    motivo: new RegistrarMotivoUseCase(u, aut, cat, reloj),
    aviso: new AvisoRetiroRiesgoUseCase(u, aut, cat),
  };
};
const yo = { empresaId: A, usuarioId: ADMIN };
const riesgo = { titulo: 'Pérdida de portátiles', probabilidad: 3, impacto: 4, decision: 'mitigar' as const };
const e = (x: typeof POL) => ({ libreriaCodigo: x.libreriaCodigo, idEstable: x.idEstable });

describe('aviso previo al retiro de un riesgo', () => {
  it('lista los controles del Anexo A que aplican y quedarían sin motivo, con su título', async () => {
    const { crearRiesgo, prever, aviso } = montar();
    const r = await crearRiesgo.ejecutar({ ...yo, ...riesgo });
    await prever.ejecutar({ ...yo, riesgoId: r.id, ...e(POL) });
    await prever.ejecutar({ ...yo, riesgoId: r.id, ...e(ROL) });
    expect(await aviso.ejecutar({ ...yo, id: r.id })).toEqual({
      riesgoId: r.id,
      codigo: 'R-001',
      controlesSinMotivo: [
        { ...e(POL), titulo: 'Políticas de seguridad' },
        { ...e(ROL), titulo: 'Roles y responsabilidades' },
      ],
    });
  });

  it('no incluye los que tienen otro riesgo vigente ni los que tienen un motivo registrado', async () => {
    const { crearRiesgo, prever, motivo, aviso } = montar();
    const r1 = await crearRiesgo.ejecutar({ ...yo, ...riesgo });
    const r2 = await crearRiesgo.ejecutar({ ...yo, ...riesgo, titulo: 'Fuga' });
    await prever.ejecutar({ ...yo, riesgoId: r1.id, ...e(POL) });
    await prever.ejecutar({ ...yo, riesgoId: r2.id, ...e(POL) }); // POL lo sostiene también r2
    await prever.ejecutar({ ...yo, riesgoId: r1.id, ...e(ROL) });
    await motivo.ejecutar({ ...yo, ...e(ROL), tipo: 'legal', nota: 'Ley' }); // ROL tiene motivo registrado
    expect((await aviso.ejecutar({ ...yo, id: r1.id })).controlesSinMotivo).toEqual([]);
  });

  it('no cambia nada: ni el riesgo ni la bitácora', async () => {
    const { crearRiesgo, prever, aviso, estado } = montar();
    const r = await crearRiesgo.ejecutar({ ...yo, ...riesgo });
    await prever.ejecutar({ ...yo, riesgoId: r.id, ...e(POL) });
    const hechos = estado.eventos.length;
    await aviso.ejecutar({ ...yo, id: r.id });
    expect(estado.eventos).toHaveLength(hechos);
    expect([...estado.riesgos.values()][0]).toMatchObject({ estado: 'vigente', version: 1 });
  });

  it('solo para quien puede retirar; riesgo ajeno o inexistente es 404; id inválido es 400', async () => {
    const { crearRiesgo, aviso } = montar();
    const r = await crearRiesgo.ejecutar({ ...yo, ...riesgo });
    const rB = await crearRiesgo.ejecutar({ empresaId: B, usuarioId: ADMIN_B, ...riesgo });
    await expect(aviso.ejecutar({ ...yo, usuarioId: COLAB, id: r.id })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(aviso.ejecutar({ ...yo, id: rB.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(aviso.ejecutar({ ...yo, id: 'eeeeeeee-9999-4999-8999-999999999999' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(aviso.ejecutar({ ...yo, id: 'x' })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });
});
