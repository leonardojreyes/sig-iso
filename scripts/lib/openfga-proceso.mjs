// Arranque local de OpenFGA (ADR 025): solo en 127.0.0.1, con clave compartida y sin interfaces extra. Solo Node.
const HOST = '127.0.0.1';
const puertoValido = (p) => Number.isInteger(p) && p >= 1 && p <= 65535;

export const argumentosEjecucion = () => ['run'];
export const argumentosMigracion = () => ['migrate'];

export const entornoOpenfga = ({ datastoreUri, apiToken, base, puertoHttp = 8081, puertoGrpc = 8082 }) => {
  for (const p of [puertoHttp, puertoGrpc]) if (!puertoValido(p)) throw new Error(`Puerto inválido: ${String(p)}`);
  if (puertoHttp === puertoGrpc) throw new Error('Los puertos HTTP y gRPC deben ser distintos');
  if (typeof apiToken !== 'string' || apiToken.length < 16)
    throw new Error('Falta la clave de la API de OpenFGA (mínimo 16 caracteres)');
  if (typeof datastoreUri !== 'string' || !/^postgres(ql)?:\/\//.test(datastoreUri)) {
    throw new Error('La base de OpenFGA debe ser una URI de PostgreSQL');
  }
  // Sin heredar OPENFGA_*: una variable del usuario podría abrir otra interfaz o quitar la autenticación.
  const limpio = Object.fromEntries(Object.entries(base).filter(([k]) => !k.startsWith('OPENFGA_')));
  return {
    ...limpio,
    OPENFGA_DATASTORE_ENGINE: 'postgres',
    OPENFGA_DATASTORE_URI: datastoreUri,
    OPENFGA_DATASTORE_MAX_OPEN_CONNS: '10',
    OPENFGA_HTTP_ADDR: `${HOST}:${puertoHttp}`,
    OPENFGA_GRPC_ADDR: `${HOST}:${puertoGrpc}`,
    OPENFGA_AUTHN_METHOD: 'preshared',
    OPENFGA_AUTHN_PRESHARED_KEYS: apiToken,
    OPENFGA_PLAYGROUND_ENABLED: 'false',
    OPENFGA_METRICS_ENABLED: 'false',
    OPENFGA_PROFILER_ENABLED: 'false',
    OPENFGA_TRACE_ENABLED: 'false',
  };
};
