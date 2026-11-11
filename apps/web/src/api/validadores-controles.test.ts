// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validarMarcoControles } from './validadores';

const UUID = '5eed0001-0000-4000-8000-0000000000a1';
const mapeo = (c: Record<string, unknown> = {}) => ({
  libreriaCodigo: 'iso-27001-2022-anexo-a',
  idEstable: 'a27-5-1',
  entrada: { tipo: 'control', titulo: 'Políticas de seguridad', aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.1' }] },
  ...c,
});
const control = (c: Record<string, unknown> = {}) => ({
  id: UUID, codigo: 'C-001', nombre: 'Política de contraseñas', descripcion: null, responsableId: null, estado: 'vigente', version: 1, mapeos: [mapeo()], normas: ['ISO/IEC 27001'], ...c,
});
const marco = (c: Record<string, unknown> = {}) => ({ controles: [control()], normas: ['ISO/IEC 27001'], ...c });

describe('validarMarcoControles', () => {
  it('acepta la forma exacta del contrato, también con una entrada ya no adoptada', () => {
    expect(validarMarcoControles(marco())?.controles).toHaveLength(1);
    expect(validarMarcoControles(marco({ controles: [control({ mapeos: [mapeo({ entrada: null })], normas: [] })] }))?.controles[0]?.mapeos[0]?.entrada).toBeNull();
    expect(validarMarcoControles({ controles: [], normas: [] })).toEqual({ controles: [], normas: [] });
  });

  it('rechaza entero lo que no cumple: campos de más o de menos, tipos, estado, formas y topes', () => {
    const malos: unknown[] = [
      { ...marco(), extra: 1 }, { controles: [] }, null, [],
      marco({ controles: [{ ...control(), extra: 1 }] }),
      marco({ controles: [control({ codigo: 'C 1' })] }), marco({ controles: [control({ codigo: '' })] }),
      marco({ controles: [control({ nombre: '' })] }), marco({ controles: [control({ id: 'x' })] }),
      marco({ controles: [control({ estado: 'borrado' })] }), marco({ controles: [control({ version: 0 })] }),
      marco({ controles: [control({ descripcion: '' })] }), marco({ controles: [control({ responsableId: 'x' })] }),
      marco({ controles: [control({ mapeos: [mapeo({ idEstable: '../x' })] })] }),
      marco({ controles: [control({ mapeos: [mapeo({ libreriaCodigo: 'ISO' })] })] }),
      marco({ controles: [control({ mapeos: [mapeo({ entrada: { tipo: 'otro', titulo: 'x', aplicaA: [] } })] })] }),
      marco({ controles: [control({ mapeos: [mapeo({ entrada: undefined })] })] }),
      marco({ controles: [control({ mapeos: Array.from({ length: 51 }, () => mapeo()) })] }),
      marco({ controles: Array.from({ length: 501 }, () => control()) }),
      marco({ normas: ['a'.repeat(61)] }),
    ];
    for (const [i, malo] of malos.entries()) expect(validarMarcoControles(malo), `caso ${i}`).toBeNull();
  });
});
