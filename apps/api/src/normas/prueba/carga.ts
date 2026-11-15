// Carga de librerías propias para las pruebas de la API: caso de uso REAL con el lector de YAML real y un almacén en memoria que
// separa por empresa (como la RLS) y revierte de verdad si algo falla.
import { validarEvento, type RegistroBitacora } from '@sig/auditoria';
import { CargarLibreriaUseCase, LectorLibreriaYaml, type AutorizacionPort, type ContextoCarga } from '@sig/normas';

export class AlmacenCargaFalso {
  /** Clave `empresa|codigo|version`. */
  librerias = new Map<string, { hash: string; entradas: number }>();
  bitacora: RegistroBitacora[] = [];
  falloBitacora = false;
}

export const cargarDePrueba = (autorizacion: AutorizacionPort, almacen: AlmacenCargaFalso = new AlmacenCargaFalso()) => {
  const caso = new CargarLibreriaUseCase(
    {
      ejecutar: async (empresaId, fn) => {
        const copia = new Map(almacen.librerias);
        const copiaBitacora = [...almacen.bitacora];
        const contexto: ContextoCarga = {
          propias: {
            guardar: async (l, huella) => {
              const k = `${empresaId}|${l.codigo}|${l.version}`;
              const previa = almacen.librerias.get(k);
              if (previa) return previa.hash === huella ? 'ya' : 'distinto';
              almacen.librerias.set(k, { hash: huella, entradas: l.entradas.length });
              return 'nueva';
            },
          },
          bitacora: {
            registrar: async (e) => {
              if (almacen.falloBitacora) throw new Error('bitácora caída');
              if (e.empresaId !== empresaId) throw new Error('RLS: el registro no es de la empresa del contexto');
              almacen.bitacora.push(validarEvento(e));
            },
          },
        };
        try {
          return await fn(contexto);
        } catch (e) {
          almacen.librerias = copia;
          almacen.bitacora = copiaBitacora;
          throw e;
        }
      },
    },
    autorizacion,
    new LectorLibreriaYaml(),
  );
  return { caso, almacen };
};
