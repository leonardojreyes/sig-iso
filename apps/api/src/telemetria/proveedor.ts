import { resourceFromAttributes } from '@opentelemetry/resources';
import { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor, type SpanExporter } from '@opentelemetry/sdk-trace-base';

export interface ConfiguracionTrazas {
  readonly exportador: 'consola' | 'ninguno';
}

export type Entorno = Readonly<Record<string, string | undefined>>;

/**
 * `OTEL_TRACES_EXPORTER` (nombre estándar de OpenTelemetry): `console` (por defecto) o `none`. Cualquier otro exportador (OTLP, etc.)
 * llegará con su ADR cuando haya dónde enviarlo. El error nombra la variable y no repite su valor.
 */
export const leerConfiguracionTrazas = (env: Entorno): ConfiguracionTrazas => {
  const valor = env.OTEL_TRACES_EXPORTER;
  if (valor === undefined || valor === 'console') return { exportador: 'consola' };
  if (valor === 'none') return { exportador: 'ninguno' };
  throw new Error('Configuración no válida en OTEL_TRACES_EXPORTER: use «console» o «none»');
};

/** Proveedor de trazas mínimo (ADR 025: sin recolector ni auto-instrumentación). `exportador` puede ser uno propio (pruebas). */
export const crearProveedorDeTrazas = (opciones: { exportador: 'consola' | 'ninguno' | SpanExporter }): BasicTracerProvider => {
  const e = opciones.exportador;
  const spanProcessors = e === 'ninguno' ? [] : [new SimpleSpanProcessor(e === 'consola' ? new ConsoleSpanExporter() : e)];
  return new BasicTracerProvider({ resource: resourceFromAttributes({ 'service.name': 'sig-iso-api' }), spanProcessors });
};
