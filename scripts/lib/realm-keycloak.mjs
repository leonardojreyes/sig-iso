// Realm de desarrollo de Keycloak (ADR 025 y 027): plantilla con marcadores + cuentas de prueba de la siembra + secretos
// generados. La plantilla (infra/keycloak/) NO contiene secretos; el realm resuelto se escribe en .local/ (ignorado por git).
// Se trabaja sobre objetos (no sobre texto) para que ningún valor pueda romper el JSON.
import { randomBytes } from 'node:crypto';

const MARCADOR = /\{\{([A-Z0-9_]+)\}\}/g;

export const marcadoresDe = (texto) => [...new Set([...texto.matchAll(MARCADOR)].map((m) => m[1]))];

// Sustituye marcadores en todas las cadenas. Los mensajes de error nombran el marcador, nunca su valor.
export const sustituirMarcadores = (valor, valores) => {
  const usados = new Set();
  const recorrer = (x) => {
    if (typeof x === 'string') {
      return x.replace(MARCADOR, (_, nombre) => {
        if (!Object.hasOwn(valores, nombre)) throw new Error(`Falta el valor del marcador ${nombre}`);
        usados.add(nombre);
        return valores[nombre];
      });
    }
    if (Array.isArray(x)) return x.map(recorrer);
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, recorrer(v)]));
    return x;
  };
  const resultado = recorrer(valor);
  const sobrantes = Object.keys(valores).filter((nombre) => !usados.has(nombre));
  if (sobrantes.length > 0) throw new Error(`Valores sin marcador en la plantilla: ${sobrantes.join(', ')}`);
  return resultado;
};

const generarClave = () => randomBytes(18).toString('base64url');

// Completa solo lo que falta: volver a ejecutar no cambia contraseñas ya entregadas.
export const generarSecretos = ({ existentes = {}, aliases, generar = generarClave }) => {
  const previos = existentes.marcadores ?? {};
  const usuarios = Object.fromEntries(aliases.map((alias) => [alias, existentes.usuarios?.[alias] ?? generar()]));
  return {
    marcadores: {
      OIDC_CLIENT_SECRET: previos.OIDC_CLIENT_SECRET ?? generar(),
      KEYCLOAK_EVENTS_CLIENT_SECRET: previos.KEYCLOAK_EVENTS_CLIENT_SECRET ?? generar(),
    },
    adminPassword: existentes.adminPassword ?? generar(),
    usuarios,
  };
};

const cuentaDePrueba = (dato, clave) => ({
  id: dato.id,
  username: dato.alias,
  email: dato.correo,
  emailVerified: true,
  enabled: true,
  firstName: dato.nombre,
  lastName: 'Prueba',
  attributes: { empresa_id: [dato.empresaId] },
  credentials: [{ type: 'password', temporary: false, value: clave }],
});

export const resolverRealm = ({ plantilla, perfil, valores, usuarios, clavesUsuarios }) => {
  const realm = sustituirMarcadores(plantilla, valores);
  const personas = usuarios.map((dato) => {
    const clave = clavesUsuarios[dato.alias];
    if (!clave) throw new Error(`Falta la contraseña de la cuenta ${dato.alias}`);
    return cuentaDePrueba(dato, clave);
  });
  realm.users = [...(realm.users ?? []), ...personas];
  realm.components = {
    ...realm.components,
    'org.keycloak.userprofile.UserProfileProvider': [
      {
        providerId: 'declarative-user-profile',
        config: { 'kc.user.profile.config': [JSON.stringify(perfil)] },
      },
    ],
  };
  return realm;
};
