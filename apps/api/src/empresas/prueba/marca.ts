// Edición de la marca para las pruebas de la API (M6b-2): caso de uso REAL sobre un almacén en memoria que se comporta como la base:
// cada empresa ve y cambia solo su fila, y si el hecho de la bitácora falla el cambio se revierte.
import type { EventoBitacora } from '@sig/auditoria';
import { ActualizarMarcaUseCase, type ContextoMarca, type DatosEmpresa, type PermisoMarcaPort } from '@sig/empresas';
import type { EmpresaId } from '@sig/tenancy';

export const marcaDePrueba = (empresas: Record<string, DatosEmpresa>, permisos: PermisoMarcaPort) => {
  const estado = { eventos: [] as EventoBitacora[], fallaBitacora: false };
  const caso = new ActualizarMarcaUseCase(
    {
      ejecutar: async <T>(empresaId: EmpresaId, fn: (c: ContextoMarca) => Promise<T>): Promise<T> => {
        const copia = structuredClone(empresas);
        const copiaEventos = [...estado.eventos];
        const ctx: ContextoMarca = {
          marcas: {
            obtener: async () => empresas[empresaId] ?? null,
            actualizar: async (c) => {
              const e = empresas[empresaId]!;
              empresas[empresaId] = { ...e, colorPrimario: c.colorPrimario, logoUrl: c.logoUrl };
            },
          },
          bitacora: {
            registrar: async (e) => {
              if (estado.fallaBitacora) throw new Error('bitácora caída');
              if (e.empresaId !== empresaId) throw new Error('RLS: el registro no es de la empresa del contexto');
              estado.eventos.push(e);
            },
          },
        };
        try {
          return await fn(ctx);
        } catch (error) {
          for (const k of Object.keys(empresas)) delete empresas[k];
          Object.assign(empresas, copia);
          estado.eventos = copiaEventos;
          throw error;
        }
      },
    },
    permisos,
  );
  return { caso, estado };
};
