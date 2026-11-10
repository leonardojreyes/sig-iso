// Adaptador de CatalogoLecturaPort: delega en los casos de uso de `@sig/normas` (solo por su API pública). Una sola versión por
// código de librería: la mayor de las adoptadas. Lo que no está adoptado por la empresa del token no aparece.
import type { CatalogoLecturaPort, EntradaCatalogo } from '@sig/certificacion';
import type { ListarLibreriasUseCase, ListarRequisitosUseCase } from '@sig/normas';
import type { EmpresaId } from '@sig/tenancy';

const comparar = (a: string, b: string): number => {
  const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

export class CatalogoNormasAdapter implements CatalogoLecturaPort {
  constructor(
    private readonly librerias: ListarLibreriasUseCase,
    private readonly requisitos: ListarRequisitosUseCase,
  ) {}

  async listarEntradasVigentes(empresaId: EmpresaId): Promise<readonly EntradaCatalogo[]> {
    const adoptadas = (await this.librerias.ejecutar(empresaId)).filter((l) => l.adoptada);
    const vigentes = new Map<string, { id: string; codigo: string; version: string }>();
    for (const l of adoptadas) {
      const actual = vigentes.get(l.codigo);
      if (!actual || comparar(l.version, actual.version) > 0) vigentes.set(l.codigo, l);
    }
    const codigoDe = new Map([...vigentes.values()].map((l) => [l.id, l.codigo]));
    const entradas = await this.requisitos.ejecutar({ empresaId });
    return entradas
      .filter((e) => codigoDe.has(e.libreriaId))
      .map((e, orden): EntradaCatalogo => ({
        libreriaCodigo: codigoDe.get(e.libreriaId) as string,
        libreriaId: e.libreriaId,
        idEstable: e.idEstable,
        tipo: e.tipo,
        capitulo: e.capitulo,
        grupo: e.grupo,
        titulo: e.titulo,
        guia: e.guia,
        aplicaA: e.aplicaA,
        orden,
      }))
      .sort((a, b) => a.libreriaCodigo.localeCompare(b.libreriaCodigo) || a.orden - b.orden);
  }
}
