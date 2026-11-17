import { describe, expect, it } from 'vitest';
import { validarPersonas } from './validadores';

const ID = '8f3a2c1e-5b7d-4e90-9a12-3c4d5e6f7a8b';
const buena = () => ({
  personas: [
    { id: ID, nombre: 'Laura Mena', correo: 'laura.mena@example.test', rol: 'administrador_sig', bajaEn: null, version: 3 },
    { id: '9f3a2c1e-5b7d-4e90-9a12-3c4d5e6f7a8b', nombre: 'Pedro Soto', correo: 'pedro@example.test', rol: null, bajaEn: '2026-11-16T15:00:00.000Z', version: 2 },
  ],
  solicitudes: [{ id: 'af3a2c1e-5b7d-4e90-9a12-3c4d5e6f7a8b', usuarioId: 'bf3a2c1e-5b7d-4e90-9a12-3c4d5e6f7a8b', codigo: 'K7F2-9QXM', creadaEn: '2026-11-16T15:00:00.000Z', venceEn: '2026-11-23T15:00:00.000Z' }],
});

describe('validarPersonas (GET /personas)', () => {
  it('acepta la forma exacta del contrato, con personas dadas de baja (rol nulo y fecha)', () => {
    expect(validarPersonas(buena())).toEqual(buena());
  });

  it.each([
    ['no es un objeto', null],
    ['una lista', []],
    ['sin solicitudes', { personas: [] }],
    ['con un campo de más', { ...buena(), extra: 1 }],
  ])('rechaza una respuesta que %s', (_c, cuerpo) => {
    expect(validarPersonas(cuerpo)).toBeNull();
  });

  it.each([
    ['rol inventado', (b: ReturnType<typeof buena>) => void (b.personas[0]!.rol = 'jefe')],
    ['rol vacío', (b: ReturnType<typeof buena>) => void (b.personas[0]!.rol = '' as never)],
    ['correo sin arroba', (b: ReturnType<typeof buena>) => void (b.personas[0]!.correo = 'laura')],
    ['nombre vacío', (b: ReturnType<typeof buena>) => void (b.personas[0]!.nombre = '')],
    ['versión 0', (b: ReturnType<typeof buena>) => void (b.personas[0]!.version = 0)],
    ['versión decimal', (b: ReturnType<typeof buena>) => void (b.personas[0]!.version = 1.5)],
    ['baja que no es fecha', (b: ReturnType<typeof buena>) => void (b.personas[1]!.bajaEn = 'ayer' as never)],
    ['id que no es UUID', (b: ReturnType<typeof buena>) => void (b.personas[0]!.id = 'abc')],
    ['persona con un campo de más', (b: ReturnType<typeof buena>) => void ((b.personas[0] as Record<string, unknown>)['telefono'] = '099')],
    ['código con caracteres ambiguos', (b: ReturnType<typeof buena>) => void (b.solicitudes[0]!.codigo = '0000-0000')],
    ['código en minúsculas', (b: ReturnType<typeof buena>) => void (b.solicitudes[0]!.codigo = 'k7f2-9qxm')],
    ['plazo que no es fecha', (b: ReturnType<typeof buena>) => void (b.solicitudes[0]!.venceEn = 'mañana')],
    ['solicitud con nombre (no debe traerlo)', (b: ReturnType<typeof buena>) => void ((b.solicitudes[0] as Record<string, unknown>)['nombre'] = 'Ana')],
  ])('rechaza %s', (_c, estropear) => {
    const b = buena();
    estropear(b);
    expect(validarPersonas(b)).toBeNull();
  });

  it('rechaza más de 50 solicitudes o más de 1000 personas (el tope del contrato)', () => {
    const b = buena();
    expect(validarPersonas({ ...b, solicitudes: Array.from({ length: 51 }, () => b.solicitudes[0]) })).toBeNull();
    expect(validarPersonas({ ...b, personas: Array.from({ length: 1001 }, () => b.personas[0]) })).toBeNull();
  });
});
