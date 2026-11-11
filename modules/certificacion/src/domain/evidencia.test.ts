import { crearEmpresaId } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { ErrorCertificacion } from './errores.js';
import { Evidencia, type DatosEvidencia } from './evidencia.js';
import { TAMANO_MAX_BYTES } from './tipo-archivo.js';

const EMPRESA = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000e1');
const SHA = 'a'.repeat(64);
const base = (): DatosEvidencia => ({
  id: 'e0000000-1111-4111-8111-111111111111',
  empresaId: EMPRESA,
  controlId: 'cccccccc-1111-4111-8111-111111111111',
  tipo: 'documento',
  titulo: 'Política de contraseñas aprobada',
  fechaHecho: '2026-11-01',
  archivo: { id: 'f0000000-1111-4111-8111-111111111111', nombre: 'politica.pdf', tipo: 'application/pdf', bytes: 1234, sha256: SHA },
});
const con = (cambio: Record<string, unknown>) => ({ ...base(), ...cambio }) as DatosEvidencia;
const conArchivo = (cambio: Record<string, unknown>) => ({ ...base(), archivo: { ...base().archivo, ...cambio } }) as DatosEvidencia;
const falla = (d: DatosEvidencia) => {
  try { Evidencia.crear(d); } catch (e) { return e as ErrorCertificacion; }
  return undefined;
};

describe('Evidencia.crear', () => {
  it('acepta una evidencia mínima: activa, sin vigencia y sin reemplazo', () => {
    const e = Evidencia.crear(base());
    expect(e).toMatchObject({ tipo: 'documento', estado: 'activa', vigenteHasta: null, reemplazaId: null, fechaHecho: '2026-11-01' });
    expect(e.archivo).toMatchObject({ nombre: 'politica.pdf', tipo: 'application/pdf', bytes: 1234, sha256: SHA });
    expect(e.activa).toBe(true);
  });

  it('recorta el título y normaliza los identificadores a minúsculas', () => {
    const e = Evidencia.crear(con({ titulo: '  Acta de revisión  ', id: base().id.toUpperCase(), controlId: base().controlId.toUpperCase() }));
    expect(e.titulo).toBe('Acta de revisión');
    expect(e.id).toBe(base().id);
    expect(e.controlId).toBe(base().controlId);
  });

  it('acepta un registro con vigencia, y una vigencia igual al día del hecho', () => {
    expect(Evidencia.crear(con({ tipo: 'registro', vigenteHasta: '2027-11-01' })).vigenteHasta).toBe('2027-11-01');
    expect(Evidencia.crear(con({ vigenteHasta: '2026-11-01' })).vigenteHasta).toBe('2026-11-01');
  });

  it('acepta justo 25 MB y 1 byte', () => {
    expect(Evidencia.crear(conArchivo({ bytes: TAMANO_MAX_BYTES })).archivo.bytes).toBe(TAMANO_MAX_BYTES);
    expect(Evidencia.crear(conArchivo({ bytes: 1 })).archivo.bytes).toBe(1);
  });

  it.each([
    ['id que no es UUID', con({ id: 'x' }), 'id'],
    ['control que no es UUID', con({ controlId: 'x' }), 'controlId'],
    ['tipo de evidencia desconocido', con({ tipo: 'otro' }), 'tipo'],
    ['título vacío', con({ titulo: '   ' }), 'titulo'],
    ['título demasiado largo', con({ titulo: 'x'.repeat(121) }), 'titulo'],
    ['título con caracteres de control', con({ titulo: 'a\u0000b' }), 'titulo'],
    ['título que no es texto', con({ titulo: 7 }), 'titulo'],
    ['fecha del hecho inexistente', con({ fechaHecho: '2026-02-31' }), 'fechaHecho'],
    ['fecha del hecho con otro formato', con({ fechaHecho: '01/11/2026' }), 'fechaHecho'],
    ['vigencia con otro formato', con({ vigenteHasta: 'mañana' }), 'vigenteHasta'],
    ['vigencia anterior al hecho', con({ vigenteHasta: '2026-10-31' }), 'vigenteHasta'],
    ['estado desconocido', con({ estado: 'borrada' }), 'estado'],
    ['reemplaza algo que no es UUID', con({ reemplazaId: 'x' }), 'reemplazaId'],
    ['se reemplaza a sí misma', con({ reemplazaId: base().id }), 'reemplazaId'],
    ['sin archivo', con({ archivo: undefined }), 'archivo'],
    ['archivo de un tipo fuera de la lista (SVG)', conArchivo({ tipo: 'image/svg+xml' }), 'archivo.tipo'],
    ['archivo de un tipo HTML', conArchivo({ tipo: 'text/html' }), 'archivo.tipo'],
    ['archivo vacío', conArchivo({ bytes: 0 }), 'archivo.bytes'],
    ['archivo de más de 25 MB', conArchivo({ bytes: TAMANO_MAX_BYTES + 1 }), 'archivo.bytes'],
    ['tamaño con decimales', conArchivo({ bytes: 10.5 }), 'archivo.bytes'],
    ['huella que no es SHA-256', conArchivo({ sha256: 'abc' }), 'archivo.sha256'],
    ['huella en mayúsculas', conArchivo({ sha256: 'A'.repeat(64) }), 'archivo.sha256'],
    ['nombre de archivo sin normalizar (con ruta)', conArchivo({ nombre: '../../x.pdf' }), 'archivo.nombre'],
    ['nombre de archivo vacío', conArchivo({ nombre: '' }), 'archivo.nombre'],
    ['nombre del archivo en el almacén que no es UUID', conArchivo({ id: '../../etc/passwd' }), 'archivo.id'],
  ])('rechaza %s', (_n, datos, campo) => {
    expect(falla(datos)?.campo).toBe(campo);
  });

  it('la vigencia anterior al hecho lo dice con su motivo', () => {
    expect(falla(con({ vigenteHasta: '2026-10-31' }))?.motivos).toEqual(['anterior_al_hecho']);
  });

  it('el error nunca repite el valor recibido', () => {
    expect(String(falla(con({ titulo: 'SECRETO'.repeat(100) }))?.message)).not.toContain('SECRETO');
  });

  it('es inmutable', () => {
    const e = Evidencia.crear(base());
    expect(Object.isFrozen(e)).toBe(true);
    expect(Object.isFrozen(e.archivo)).toBe(true);
  });
});

describe('vigencia', () => {
  it('sin vencimiento está vigente siempre', () => {
    const e = Evidencia.crear(base());
    expect(e.vigenteEn('2099-12-31')).toBe(true);
    expect(e.vencidaEn('2099-12-31')).toBe(false);
  });
  it('con vencimiento está vigente hasta ese día inclusive y vencida desde el siguiente', () => {
    const e = Evidencia.crear(con({ vigenteHasta: '2026-12-31' }));
    expect(e.vigenteEn('2026-12-31')).toBe(true);
    expect(e.vencidaEn('2026-12-31')).toBe(false);
    expect(e.vigenteEn('2027-01-01')).toBe(false);
    expect(e.vencidaEn('2027-01-01')).toBe(true);
  });
  it('una evidencia reemplazada o eliminada no está vigente ni vencida, aunque su fecha esté al día', () => {
    for (const estado of ['reemplazada', 'eliminada'] as const) {
      const e = Evidencia.crear(con({ estado, vigenteHasta: '2030-01-01' }));
      expect(e.vigenteEn('2026-11-11'), estado).toBe(false);
      expect(e.vencidaEn('2031-01-01'), estado).toBe(false);
    }
  });
});

describe('transiciones de estado', () => {
  it('una evidencia activa se puede reemplazar o eliminar, sin tocar el original', () => {
    const e = Evidencia.crear(base());
    const r = e.marcarReemplazada();
    expect(r.estado).toBe('reemplazada');
    expect(e.marcarEliminada().estado).toBe('eliminada');
    expect(e.estado).toBe('activa');
    expect(r.archivo).toEqual(e.archivo);
    expect(r.id).toBe(e.id);
  });

  it('una evidencia que ya no está activa no se vuelve a reemplazar ni a eliminar', () => {
    for (const estado of ['reemplazada', 'eliminada'] as const) {
      const e = Evidencia.crear(con({ estado }));
      for (const accion of [() => e.marcarReemplazada(), () => e.marcarEliminada()]) {
        try { accion(); expect.unreachable(); } catch (x) { expect((x as ErrorCertificacion).motivos).toEqual(['no_activa']); }
      }
    }
  });
});
