// Composición de producción: arma el verificador de tokens y el registro de hechos a partir del entorno.
import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { crearJwksRemoto, TokenVerifierJose } from '@sig/autenticacion';
import { GestorPools, leerUrls } from '@sig/db';
import { leerConfiguracionAuth, type Entorno } from './autenticacion/configuracion.js';
import type { OpcionesAutenticacion } from './autenticacion/autenticacion.module.js';

/**
 * El registro de hechos abre sus conexiones la primera vez que se usa: si faltan las URLs de la base, la API arranca (por
 * ejemplo para `/health`) y cualquier rechazo que deba registrarse falla con 500, nunca pasa en silencio.
 */
export const opcionesAutenticacionDesdeEntorno = (env: Entorno): OpcionesAutenticacion => {
  const config = leerConfiguracionAuth(env);
  let bitacora: Bitacora | undefined;
  return {
    verificador: new TokenVerifierJose({
      emisor: config.emisor,
      audiencia: config.audiencia,
      clienteAutorizado: config.clienteAutorizado,
      claves: crearJwksRemoto(config.jwksUrl),
    }),
    hechos: {
      registrar: async (evento) => {
        if (!bitacora) {
          const pools = new GestorPools(leerUrls(env, ['app', 'plataforma']), { max: 2 });
          bitacora = new Bitacora(new BitacoraKysely({ app: pools.db('app'), plataforma: pools.db('plataforma') }));
        }
        await bitacora.registrar(evento);
      },
    },
  };
};
