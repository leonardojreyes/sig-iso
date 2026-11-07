// Adaptador de FlagsPort con OpenFeature (ADR 013) y el proveedor EN MEMORIA del SDK. Sin flagd todavía (ADR 025): cuando haya
// dónde alojarlo, solo cambia el proveedor. Cada instancia usa su propio «dominio» del SDK, que es global al proceso.
import { InMemoryProvider, OpenFeature, type Provider } from '@openfeature/server-sdk';
import type { FlagsPort, NombreFlag } from '@sig/normas';
import type { EmpresaId } from '@sig/tenancy';

/** Valor que se usa si el servicio de flags no responde o no conoce el flag: las funciones están encendidas. */
const POR_OMISION: Readonly<Record<NombreFlag, boolean>> = { 'adopcion-habilitada': true };

const configuracionEnMemoria = (adopcionHabilitada: boolean) => ({
  'adopcion-habilitada': { disabled: false, variants: { on: true, off: false }, defaultVariant: adopcionHabilitada ? 'on' : 'off' },
});

let instancias = 0;

export class FlagsOpenFeature implements FlagsPort {
  private readonly cliente;
  /** Se resuelve a `false` si el proveedor no pudo arrancar. */
  private readonly arranco: Promise<boolean>;

  constructor(opciones: { adopcionHabilitada?: boolean; proveedor?: Provider } = {}) {
    const dominio = `sig-iso-${++instancias}`;
    const proveedor = opciones.proveedor ?? new InMemoryProvider(configuracionEnMemoria(opciones.adopcionHabilitada ?? true));
    // Si el proveedor no arranca no se rompe la API: cada consulta usa el valor por omisión (el SDK seguiría evaluando con un
    // proveedor en estado de error recuperable, y eso no es lo que queremos).
    this.arranco = OpenFeature.setProviderAndWait(dominio, proveedor).then(
      () => true,
      () => false,
    );
    this.cliente = OpenFeature.getClient(dominio);
  }

  async habilitado(flag: NombreFlag, empresaId: EmpresaId): Promise<boolean> {
    if (!Object.hasOwn(POR_OMISION, flag)) throw new Error('Flag desconocido');
    if (!(await this.arranco)) return POR_OMISION[flag];
    try {
      // La empresa es la clave de segmentación: permite apagar o encender una función solo para algunas.
      return await this.cliente.getBooleanValue(flag, POR_OMISION[flag], { targetingKey: empresaId });
    } catch {
      return POR_OMISION[flag];
    }
  }
}
