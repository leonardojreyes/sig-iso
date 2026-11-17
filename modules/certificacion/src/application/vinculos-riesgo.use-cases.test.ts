import { describe, expect, it } from 'vitest';
import { Control } from '../domain/control.js';
import { ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { A, ADMIN, B, COLAB, EstadoFalso, crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, entradas } from './prueba/fakes.js';
import { CrearControlUseCase, RetirarControlUseCase } from './controles.use-cases.js';
import { CrearRiesgoUseCase, ListarRiesgosUseCase, ObtenerRiesgoUseCase, RetirarRiesgoUseCase } from './riesgos.use-cases.js';
import { DesvincularRiesgoControlUseCase, PreverTratamientoUseCase, QuitarTratamientoPrevistoUseCase, RiesgosDeUnControlUseCase, VINCULOS_POR_RIESGO_MAX, VincularRiesgoControlUseCase } from './vinculos-riesgo.use-cases.js';

const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const montar = () => {
  const estado = new EstadoFalso();
  estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
  estado.catalogoPorEmpresa.set(B, [entradas.politicas]);
  estado.conceder(ADMIN, A, 'riesgos.ver', 'riesgos.gestionar', 'controles.ver', 'controles.gestionar');
  estado.conceder(COLAB, A, 'riesgos.ver', 'controles.ver');
  estado.conceder(ADMIN_B, B, 'riesgos.ver', 'riesgos.gestionar', 'controles.ver', 'controles.gestionar');
  let t = 0;
  let n = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 17, 12, 0, t++));
  const nuevoId = () => `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  const cat = crearCatalogoFalso(estado);
  return {
    estado,
    crearRiesgo: new CrearRiesgoUseCase(u, aut, reloj, nuevoId),
    retirarRiesgo: new RetirarRiesgoUseCase(u, aut, reloj),
    crearControl: new CrearControlUseCase(u, aut, reloj, nuevoId),
    retirarControl: new RetirarControlUseCase(u, aut, reloj),
    vincular: new VincularRiesgoControlUseCase(u, aut, reloj),
    desvincular: new DesvincularRiesgoControlUseCase(u, aut),
    preverTratamiento: new PreverTratamientoUseCase(u, aut, cat, reloj),
    quitarPrevisto: new QuitarTratamientoPrevistoUseCase(u, aut),
    deControl: new RiesgosDeUnControlUseCase(u, aut),
    listar: new ListarRiesgosUseCase(u, aut),
    obtener: new ObtenerRiesgoUseCase(u, aut, cat),
  };
};
const yo = { empresaId: A, usuarioId: ADMIN };
const yoB = { empresaId: B, usuarioId: ADMIN_B };
const riesgo = { titulo: 'Pérdida de portátiles', probabilidad: 3, impacto: 4, decision: 'mitigar' as const };
const POL = { libreriaCodigo: entradas.politicas.libreriaCodigo, idEstable: entradas.politicas.idEstable };
const CTX = { libreriaCodigo: entradas.contexto.libreriaCodigo, idEstable: entradas.contexto.idEstable };

const escenario = async () => {
  const m = montar();
  const r = await m.crearRiesgo.ejecutar({ ...yo, ...riesgo });
  const c = await m.crearControl.ejecutar({ ...yo, codigo: 'C-001', nombre: 'Cifrado de discos' });
  return { ...m, r, c };
};

describe('vincular un riesgo con un control de la empresa', () => {
  it('lo vincula, registra el hecho solo con los códigos y repetirlo no es un error', async () => {
    const { vincular, estado, r, c } = await escenario();
    expect(await vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id })).toEqual({ creado: true });
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'vinculo.creado', objeto: 'vinculo:R-001.C-001', resultado: 'ok' });
    const hechos = estado.eventos.length;
    expect(await vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id })).toEqual({ creado: false });
    expect(estado.eventos).toHaveLength(hechos);
    expect(estado.vinculosControl.size).toBe(1);
  });

  it('un control puede tratar varios riesgos y un riesgo varios controles', async () => {
    const { vincular, crearRiesgo, crearControl, r, c, estado } = await escenario();
    const r2 = await crearRiesgo.ejecutar({ ...yo, ...riesgo, titulo: 'Fuga' });
    const c2 = await crearControl.ejecutar({ ...yo, codigo: 'C-002', nombre: 'Copias' });
    for (const [rid, cid] of [[r.id, c.id], [r2.id, c.id], [r.id, c2.id]] as const) await vincular.ejecutar({ ...yo, riesgoId: rid, controlId: cid });
    expect(estado.vinculosControl.size).toBe(3);
  });

  it('solo quien gestiona; el permiso se decide antes que la forma', async () => {
    const { vincular, r, c } = await escenario();
    await expect(vincular.ejecutar({ ...yo, usuarioId: COLAB, riesgoId: r.id, controlId: c.id })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(vincular.ejecutar({ ...yo, usuarioId: COLAB, riesgoId: 'x', controlId: 'y' })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(vincular.ejecutar({ ...yo, riesgoId: 'x', controlId: c.id })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: 'y' })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('no vincula un riesgo retirado ni un control retirado', async () => {
    const { vincular, retirarRiesgo, retirarControl, crearRiesgo, crearControl, r, c, estado } = await escenario();
    await retirarControl.ejecutar({ ...yo, id: c.id, versionEsperada: 1 });
    await expect(vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id })).rejects.toMatchObject({ motivo: 'control_retirado' });
    const r2 = await crearRiesgo.ejecutar({ ...yo, ...riesgo });
    const c2 = await crearControl.ejecutar({ ...yo, codigo: 'C-002', nombre: 'Copias' });
    await retirarRiesgo.ejecutar({ ...yo, id: r2.id, versionEsperada: 1 });
    await expect(vincular.ejecutar({ ...yo, riesgoId: r2.id, controlId: c2.id })).rejects.toMatchObject({ motivo: 'riesgo_retirado' });
    expect(estado.vinculosControl.size).toBe(0);
  });

  it('un riesgo o un control de otra empresa es 404, igual que uno inexistente', async () => {
    const { vincular, crearRiesgo, crearControl, r, c, estado } = await escenario();
    const rB = await crearRiesgo.ejecutar({ ...yoB, ...riesgo });
    const cB = await crearControl.ejecutar({ ...yoB, codigo: 'C-001', nombre: 'Del B' });
    await expect(vincular.ejecutar({ ...yo, riesgoId: rB.id, controlId: c.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: cB.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: 'eeeeeeee-9999-4999-8999-999999999999' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect(estado.vinculosControl.size).toBe(0);
  });

  it('tiene un tope de vínculos por riesgo', async () => {
    const { vincular, preverTratamiento, r, estado } = await escenario();
    for (let i = 0; i < VINCULOS_POR_RIESGO_MAX; i++) estado.vinculosEntrada.set(`${A}|${r.id}|lib|x${i}`, ADMIN);
    await expect(preverTratamiento.ejecutar({ ...yo, riesgoId: r.id, ...POL })).rejects.toMatchObject({ motivo: 'tope_de_vinculos' });
    const c = [...estado.controles.values()][0] as Control;
    await expect(vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id })).rejects.toBeInstanceOf(ConflictoError);
  });

  it('si falla la bitácora no queda el vínculo', async () => {
    const { vincular, r, c, estado } = await escenario();
    estado.fallarBitacora = true;
    await expect(vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id })).rejects.toThrow();
    expect(estado.vinculosControl.size).toBe(0);
  });
});

describe('desvincular un riesgo de un control de la empresa', () => {
  it('quita el vínculo y lo registra; si no existía es 404', async () => {
    const { vincular, desvincular, r, c, estado } = await escenario();
    await vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id });
    await desvincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id });
    expect(estado.vinculosControl.size).toBe(0);
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'vinculo.eliminado', objeto: 'vinculo:R-001.C-001' });
    await expect(desvincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });

  it('permite quitar el vínculo con un control ya retirado, pero no el de un riesgo retirado', async () => {
    const { vincular, desvincular, retirarControl, retirarRiesgo, r, c } = await escenario();
    await vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id });
    await retirarControl.ejecutar({ ...yo, id: c.id, versionEsperada: 1 });
    await expect(desvincular.ejecutar({ ...yo, usuarioId: COLAB, riesgoId: r.id, controlId: c.id })).rejects.toBeInstanceOf(SinPermisoError);
    await desvincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id });
    await retirarRiesgo.ejecutar({ ...yo, id: r.id, versionEsperada: 1 });
    await expect(desvincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id })).rejects.toMatchObject({ motivo: 'riesgo_retirado' });
  });
});

describe('tratamiento previsto (control del Anexo A sin control propio)', () => {
  it('vincula un control del Anexo A adoptado, lo registra con el id estable y repetirlo no es un error', async () => {
    const { preverTratamiento, r, estado } = await escenario();
    expect(await preverTratamiento.ejecutar({ ...yo, riesgoId: r.id, ...POL })).toEqual({ creado: true });
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'vinculo.creado', objeto: `vinculo:R-001.${POL.idEstable}` });
    expect(await preverTratamiento.ejecutar({ ...yo, riesgoId: r.id, ...POL })).toEqual({ creado: false });
    expect(estado.vinculosEntrada.size).toBe(1);
  });

  it('solo controles de las librerías adoptadas: una cláusula, una entrada ajena o inexistente son 404', async () => {
    const { preverTratamiento, crearRiesgo, r, estado } = await escenario();
    await expect(preverTratamiento.ejecutar({ ...yo, riesgoId: r.id, ...CTX })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(preverTratamiento.ejecutar({ ...yo, riesgoId: r.id, libreriaCodigo: 'otra', idEstable: 'zz-1' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    // `roles` no está adoptado por B
    const rB = await crearRiesgo.ejecutar({ ...yoB, ...riesgo });
    await expect(preverTratamiento.ejecutar({ ...yoB, riesgoId: rB.id, libreriaCodigo: entradas.roles.libreriaCodigo, idEstable: entradas.roles.idEstable })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect(estado.vinculosEntrada.size).toBe(0);
  });

  it('valida la forma, el permiso, que el riesgo exista en la empresa y que esté vigente', async () => {
    const { preverTratamiento, retirarRiesgo, crearRiesgo, r } = await escenario();
    await expect(preverTratamiento.ejecutar({ ...yo, usuarioId: COLAB, riesgoId: 'x', libreriaCodigo: 'MAL', idEstable: 'MAL' })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(preverTratamiento.ejecutar({ ...yo, riesgoId: r.id, libreriaCodigo: 'MAL CODIGO', idEstable: POL.idEstable })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(preverTratamiento.ejecutar({ ...yo, riesgoId: 'x', ...POL })).rejects.toBeInstanceOf(ParametroInvalidoError);
    const rB = await crearRiesgo.ejecutar({ ...yoB, ...riesgo });
    await expect(preverTratamiento.ejecutar({ ...yo, riesgoId: rB.id, ...POL })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await retirarRiesgo.ejecutar({ ...yo, id: r.id, versionEsperada: 1 });
    await expect(preverTratamiento.ejecutar({ ...yo, riesgoId: r.id, ...POL })).rejects.toMatchObject({ motivo: 'riesgo_retirado' });
  });

  it('se quita con rastro, también si la entrada ya no está adoptada; sin vínculo es 404', async () => {
    const { preverTratamiento, quitarPrevisto, r, estado } = await escenario();
    await preverTratamiento.ejecutar({ ...yo, riesgoId: r.id, ...POL });
    estado.catalogoPorEmpresa.set(A, []); // la librería dejó de estar adoptada
    await quitarPrevisto.ejecutar({ ...yo, riesgoId: r.id, ...POL });
    expect(estado.vinculosEntrada.size).toBe(0);
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'vinculo.eliminado' });
    await expect(quitarPrevisto.ejecutar({ ...yo, riesgoId: r.id, ...POL })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(quitarPrevisto.ejecutar({ ...yo, usuarioId: COLAB, riesgoId: r.id, ...POL })).rejects.toBeInstanceOf(SinPermisoError);
  });
});

describe('ver los vínculos (H2.4 y H2.5)', () => {
  it('el riesgo muestra los controles que lo tratan (marcando los retirados) y los tratamientos previstos con su título', async () => {
    const { vincular, preverTratamiento, retirarControl, crearControl, obtener, r, c } = await escenario();
    const c2 = await crearControl.ejecutar({ ...yo, codigo: 'C-002', nombre: 'Copias' });
    await vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id });
    await vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c2.id });
    await preverTratamiento.ejecutar({ ...yo, riesgoId: r.id, ...POL });
    await retirarControl.ejecutar({ ...yo, id: c2.id, versionEsperada: 1 });
    const d = await obtener.ejecutar({ ...yo, usuarioId: COLAB, id: r.id });
    expect(d.controles.map((x) => [x.codigo, x.estado])).toEqual([['C-001', 'vigente'], ['C-002', 'retirado']]);
    expect(d.tratamientosPrevistos).toEqual([{ ...POL, titulo: 'Políticas de seguridad' }]);
  });

  it('un tratamiento previsto cuya entrada ya no está adoptada se muestra sin título', async () => {
    const { preverTratamiento, obtener, r, estado } = await escenario();
    await preverTratamiento.ejecutar({ ...yo, riesgoId: r.id, ...POL });
    estado.catalogoPorEmpresa.set(A, []);
    expect((await obtener.ejecutar({ ...yo, id: r.id })).tratamientosPrevistos).toEqual([{ ...POL, titulo: null }]);
  });

  it('el control muestra los riesgos vigentes que trata; uno ajeno es 404 y sin permiso 403', async () => {
    const { vincular, retirarRiesgo, crearRiesgo, deControl, crearControl, r, c } = await escenario();
    const r2 = await crearRiesgo.ejecutar({ ...yo, ...riesgo, titulo: 'Fuga' });
    await vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id });
    await vincular.ejecutar({ ...yo, riesgoId: r2.id, controlId: c.id });
    await retirarRiesgo.ejecutar({ ...yo, id: r2.id, versionEsperada: 1 });
    expect((await deControl.ejecutar({ ...yo, usuarioId: COLAB, controlId: c.id })).map((x) => x.codigo)).toEqual(['R-001']);
    const cB = await crearControl.ejecutar({ ...yoB, codigo: 'C-001', nombre: 'Del B' });
    await expect(deControl.ejecutar({ ...yo, controlId: cB.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(deControl.ejecutar({ ...yo, usuarioId: '77777777-7777-4777-8777-777777777777', controlId: c.id })).rejects.toBeInstanceOf(SinPermisoError);
  });

  it('la lista señala los «mitigar» sin ningún control vigente ni tratamiento previsto', async () => {
    const { vincular, preverTratamiento, retirarControl, crearRiesgo, crearControl, listar, r, c } = await escenario();
    const r2 = await crearRiesgo.ejecutar({ ...yo, ...riesgo, titulo: 'Con previsto' });
    const r3 = await crearRiesgo.ejecutar({ ...yo, ...riesgo, titulo: 'Aceptado', decision: 'aceptar', responsableId: ADMIN });
    const r4 = await crearRiesgo.ejecutar({ ...yo, ...riesgo, titulo: 'Solo control retirado' });
    const c2 = await crearControl.ejecutar({ ...yo, codigo: 'C-002', nombre: 'Copias' });
    await vincular.ejecutar({ ...yo, riesgoId: r.id, controlId: c.id });
    await preverTratamiento.ejecutar({ ...yo, riesgoId: r2.id, ...POL });
    await vincular.ejecutar({ ...yo, riesgoId: r4.id, controlId: c2.id });
    await retirarControl.ejecutar({ ...yo, id: c2.id, versionEsperada: 1 });
    const filas = await listar.ejecutar({ ...yo, usuarioId: COLAB });
    expect(filas.map((f) => [f.codigo, f.controles, f.tratamientosPrevistos, f.sinTratamiento])).toEqual([
      ['R-001', 1, 0, false],
      ['R-002', 0, 1, false],
      ['R-003', 0, 0, false], // aceptado: no exige control
      ['R-004', 0, 0, true], // su único control está retirado
    ]);
    expect(r3.decision).toBe('aceptar');
  });
});
