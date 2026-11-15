import { render, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { CargaLibreria, LibreriaResumen } from '../api/tipos';
import { es } from '../i18n/es-EC';
import type { ResultadoCarga } from '../librerias/resultados-carga';
import { PantallaNormas, textoDeError } from './normas';

const empresa = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };
const admin = { nombre: 'Laura Mena', roles: ['administrador_sig'] as const };
const colaborador = { nombre: 'Pedro Soto', roles: ['colaborador'] as const };
const H = 'a'.repeat(64);
const L1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const L2 = 'aaaaaaaa-2222-4222-8222-222222222222';

const libreria = (o: Partial<LibreriaResumen> = {}): LibreriaResumen => ({ id: L1, codigo: 'propia-mi-norma', nombre: 'Mi norma', version: '1.0.0', esEjemplo: false, fuente: 'elaboración propia', propia: true, adoptada: false, ...o });
const librerias = [libreria(), libreria({ id: L2, codigo: 'iso-27001-anexo-a', nombre: 'Anexo A', fuente: 'SynapTech', propia: false, adoptada: true })];
const carga = (o: Partial<CargaLibreria> = {}): CargaLibreria => ({ estado: 'cargada', motivo: null, codigo: 'propia-mi-norma', version: '1.0.0', entradas: 3, huella: H, errores: [], ...o });
const resultado = (...archivos: ResultadoCarga['archivos'][number][]): ResultadoCarga => ({ archivos, omitidos: 0, recortado: false });
const base = { empresa, persona: admin, librerias };

describe('PantallaNormas', () => {
  it('no tiene violaciones de accesibilidad (axe) en sus estados', async () => {
    const estados = [
      <PantallaNormas key="a" {...base} />,
      <PantallaNormas key="b" {...base} persona={colaborador} />,
      <PantallaNormas key="c" {...base} aviso="sin_permiso" />,
      <PantallaNormas key="d" {...base} librerias={[]} />,
      <PantallaNormas
        key="e"
        {...base}
        resultado={resultado(
          { nombre: 'a.yaml', tipo: 'respuesta', carga: carga() },
          { nombre: 'b.yaml', tipo: 'respuesta', carga: carga({ estado: 'rechazada', motivo: 'formato_invalido', codigo: null, version: null, entradas: null, errores: [{ entrada: 'x-4.1', indice: 0, ruta: 'entradas[0].guia', codigo: 'campo_obligatorio' }] }) },
          { nombre: 'c.yaml', tipo: 'fallo', motivo: 'archivo_grande' },
        )}
      />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect((await axe(container)).violations).toEqual([]);
      unmount();
    }
  });

  it('el administrador ve el formulario con archivos y carpeta, la plantilla y el botón de adoptar solo en lo que falta', () => {
    const { container, getByRole, getByLabelText } = render(<PantallaNormas {...base} />);
    const form = container.querySelector('form[action="/e/empresa-a/normas/subir"]')!;
    expect(form.getAttribute('method')).toBe('post');
    expect(form.getAttribute('enctype')).toBe('multipart/form-data');
    const archivos = getByLabelText(es.normas.archivosEtiqueta) as HTMLInputElement;
    expect([archivos.name, archivos.type, archivos.multiple, archivos.accept]).toEqual(['archivos', 'file', true, '.yaml,.yml']);
    const carpeta = getByLabelText(es.normas.carpetaEtiqueta) as HTMLInputElement;
    expect([carpeta.name, carpeta.multiple, carpeta.hasAttribute('webkitdirectory')]).toEqual(['archivos', true, true]);
    expect(getByRole('link', { name: es.normas.plantilla }).getAttribute('href')).toBe('/e/empresa-a/normas/plantilla');
    // Adoptar solo la que no está adoptada.
    expect(container.querySelectorAll('form[action$="/adopcion"]')).toHaveLength(1);
    expect(container.querySelector(`form[action="/e/empresa-a/librerias/${L1}/adopcion"]`)).not.toBeNull();
    // Ningún campo lleva la empresa.
    expect([...form.querySelectorAll('input')].map((i) => i.name)).toEqual(['archivos', 'archivos']);
  });

  it('el colaborador ve las librerías pero no el formulario ni el botón de adoptar', () => {
    const { container, queryByLabelText, getByText } = render(<PantallaNormas {...base} persona={colaborador} />);
    expect(queryByLabelText(es.normas.archivosEtiqueta)).toBeNull();
    expect(container.querySelector('form')).toBeNull();
    expect(getByText(es.normas.soloAdmin)).toBeTruthy();
    expect(getByText('Mi norma')).toBeTruthy();
  });

  it('distingue las propias del catálogo y lo adoptado de lo que no', () => {
    const { getAllByText, getByText } = render(<PantallaNormas {...base} />);
    expect(getAllByText(es.normas.propias)).toHaveLength(1);
    expect(getAllByText(es.normas.catalogo)).toHaveLength(1);
    expect(getAllByText(es.normas.adoptada)).toHaveLength(1);
    expect(getAllByText(es.normas.noAdoptada)).toHaveLength(1);
    expect(getByText(/propia-mi-norma · versión 1.0.0/)).toBeTruthy();
  });

  it('sin librerías muestra el estado vacío', () => {
    const { getByText } = render(<PantallaNormas {...base} librerias={[]} />);
    expect(getByText(es.normas.sinLibrerias)).toBeTruthy();
  });

  describe('resultado de la subida', () => {
    it('explica en palabras lo cargado, lo ya cargado, lo rechazado y los fallos, archivo por archivo', () => {
      const { getByRole } = render(
        <PantallaNormas
          {...base}
          resultado={{
            omitidos: 2,
            recortado: true,
            archivos: [
              { nombre: 'a.yaml', tipo: 'respuesta', carga: carga() },
              { nombre: 'b.yaml', tipo: 'respuesta', carga: carga({ estado: 'ya_cargada' }) },
              { nombre: 'c.yaml', tipo: 'respuesta', carga: carga({ estado: 'rechazada', motivo: 'hash_distinto', errores: [] }) },
              { nombre: 'd.yaml', tipo: 'fallo', motivo: 'no_disponible' },
            ],
          }}
        />,
      );
      const region = within(getByRole('region', { name: es.normas.resultadoTitulo }));
      expect(region.getByText(es.normas.estados.cargada('propia-mi-norma', '1.0.0', 3))).toBeTruthy();
      expect(region.getByText(es.normas.estados.ya_cargada('propia-mi-norma', '1.0.0'))).toBeTruthy();
      expect(region.getByText(es.normas.motivos.hash_distinto)).toBeTruthy();
      expect(region.getByText(es.normas.fallos.no_disponible)).toBeTruthy();
      expect(region.getByText(es.normas.omitidos(2))).toBeTruthy();
      expect(region.getByText(es.normas.recortado(20))).toBeTruthy();
      for (const n of ['a.yaml', 'b.yaml', 'c.yaml', 'd.yaml']) expect(region.getByText(es.normas.archivo(n))).toBeTruthy();
    });

    it('lista los errores con dónde y qué, y recorta los muy numerosos', () => {
      const errores = Array.from({ length: 20 }, (_, i) => ({ entrada: `x-${i}`, indice: i, ruta: `entradas[${i}].guia`, codigo: 'tono_normativo' }));
      const { getByText, getAllByRole } = render(
        <PantallaNormas {...base} resultado={resultado({ nombre: 'a.yaml', tipo: 'respuesta', carga: carga({ estado: 'rechazada', motivo: 'contenido_no_permitido', codigo: null, version: null, entradas: null, errores }) })} />,
      );
      expect(getByText(es.normas.motivos.contenido_no_permitido)).toBeTruthy();
      expect(getByText(/En «entradas\[0\]\.guia» \(entrada «x-0»\): el texto suena a norma/)).toBeTruthy();
      expect(getAllByRole('listitem').filter((li) => li.textContent?.includes('suena a norma'))).toHaveLength(15);
      expect(getByText(/y 5 más/)).toBeTruthy();
    });

    it('nunca muestra marcas HTML del nombre del archivo como marcas (se escapan)', () => {
      const { container } = render(<PantallaNormas {...base} resultado={resultado({ nombre: '<img src=x onerror=alert(1)>.yaml', tipo: 'fallo', motivo: 'archivo_grande' })} />);
      expect(container.querySelector('img')).toBeNull();
    });
  });

  describe('avisos', () => {
    it.each(Object.keys(es.normas.avisos) as (keyof typeof es.normas.avisos)[])('el aviso «%s» muestra su título y detalle', (a) => {
      const { getByText } = render(<PantallaNormas {...base} aviso={a} />);
      expect(getByText(es.normas.avisos[a].titulo)).toBeTruthy();
      expect(getByText(es.normas.avisos[a].detalle)).toBeTruthy();
    });
  });
});

describe('textoDeError', () => {
  it('traduce los códigos conocidos y usa un texto genérico para los desconocidos, sin repetir nada recibido', () => {
    expect(textoDeError({ entrada: null, indice: null, ruta: '', codigo: 'yaml_invalido' })).toMatch(/^En el archivo: el archivo no es un YAML bien formado/);
    expect(textoDeError({ entrada: null, indice: null, ruta: 'codigo', codigo: 'prefijo_obligatorio' })).toBe('En «codigo»: el código debe empezar con «propia-».');
    expect(textoDeError({ entrada: null, indice: null, ruta: 'x', codigo: '<b>raro</b>' })).toBe(`En «x»: ${es.normas.errorDesconocido}.`);
  });
  it('todos los códigos que puede devolver la API tienen texto propio', () => {
    const codigos = [
      'yaml_invalido', 'no_es_texto', 'archivo_vacio', 'demasiado_largo', 'prefijo_obligatorio', 'ejemplo_no_permitido',
      'campo_obligatorio', 'campo_desconocido', 'tipo_incorrecto', 'demasiado_corto', 'formato_invalido', 'valor_no_permitido', 'fuera_de_rango', 'lista_vacia', 'esquema_no_soportado', 'invalido', 'id_repetido', 'referencia_repetida', 'norma_no_declarada', 'aplica_a_repetido',
      'titulo_demasiado_corto', 'titulo_demasiado_largo', 'guia_demasiado_corta', 'guia_demasiado_larga', 'guia_demasiadas_frases', 'frase_demasiado_larga', 'tono_normativo', 'cita_textual', 'formato_de_lista', 'enlace_o_correo',
    ];
    for (const c of codigos) expect(Object.keys(es.normas.errores), c).toContain(c);
  });
});
