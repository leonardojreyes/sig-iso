import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DATOS_SIEMBRA } from './datos-siembra.ts';
import { generarSecretos, marcadoresDe, resolverRealm, sustituirMarcadores } from './realm-keycloak.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const leer = (nombre) => JSON.parse(readFileSync(join(raiz, 'infra', 'keycloak', nombre), 'utf8'));
const plantillaTexto = readFileSync(join(raiz, 'infra', 'keycloak', 'realm-sigiso.plantilla.json'), 'utf8');
const plantilla = JSON.parse(plantillaTexto);
const perfil = leer('perfil-usuario.json');

let n = 0;
const generarFijo = () => `clave-${(n += 1).toString().padStart(4, '0')}-xxxxxxxxxxxxxxxxxxxxxxxx`;
const aliases = DATOS_SIEMBRA.usuarios.map((u) => u.alias);
const secretos = generarSecretos({
  existentes: {},
  aliases,
  generar: generarFijo,
});
const resolver = (cambios = {}) =>
  resolverRealm({
    plantilla,
    perfil,
    valores: {
      WEB_ORIGIN: 'http://localhost:3000',
      ...secretos.marcadores,
      ...cambios,
    },
    usuarios: DATOS_SIEMBRA.usuarios,
    clavesUsuarios: secretos.usuarios,
  });
const cliente = (realm, id) => realm.clients.find((c) => c.clientId === id);

describe('la plantilla no contiene secretos', () => {
  it('todo secreto o contraseña es un marcador {{…}}', () => {
    const hallazgos = [];
    const recorrer = (valor, ruta) => {
      if (Array.isArray(valor)) valor.forEach((v, i) => recorrer(v, `${ruta}[${i}]`));
      else if (valor && typeof valor === 'object')
        for (const [k, v] of Object.entries(valor)) recorrer(v, `${ruta}.${k}`);
      else if (
        typeof valor === 'string' &&
        /^(secret|password|value)$/i.test(ruta.split('.').pop()) &&
        !/^\{\{[A-Z0-9_]+\}\}$/.test(valor)
      )
        hallazgos.push(ruta);
    };
    recorrer(plantilla, 'plantilla');
    expect(hallazgos).toEqual([]);
  });

  it('no trae ninguna cadena larga parecida a una clave (≥ 32 caracteres sin espacios)', () => {
    // Nombres de evento (MAYÚSCULAS_Y_GUION_BAJO) e identificadores de proveedor (minúsculas-y-guiones) no son claves.
    const largas = (plantillaTexto.match(/"[A-Za-z0-9+/_=-]{32,}"/g) ?? []).filter(
      (c) => !/^"([A-Z_]+|[a-z-]+)"$/.test(c),
    );
    expect(largas).toEqual([]);
  });

  it('sus marcadores son solo los conocidos', () => {
    expect(marcadoresDe(plantillaTexto).sort()).toEqual([
      'KEYCLOAK_EVENTS_CLIENT_SECRET',
      'OIDC_CLIENT_SECRET',
      'WEB_ORIGIN',
    ]);
  });

  it('el realm resuelto queda en una carpeta ignorada por git', () => {
    const ignorado = execFileSync('git', ['check-ignore', '.local/realm/sigiso-realm.json'], {
      cwd: raiz,
      encoding: 'utf8',
    });
    expect(ignorado.trim()).toBe('.local/realm/sigiso-realm.json');
  });
});

describe('sustituirMarcadores', () => {
  it('reemplaza dentro de cadenas, anidados y arreglos sin tocar lo demás', () => {
    expect(sustituirMarcadores({ a: ['{{X}}/ruta', 1, true], b: { c: 'sin' } }, { X: 'http://h' })).toEqual({
      a: ['http://h/ruta', 1, true],
      b: { c: 'sin' },
    });
  });
  it('falla si falta un valor, sin repetir ningún valor en el mensaje', () => {
    expect(() => sustituirMarcadores({ a: '{{X}}' }, {})).toThrow(/Falta el valor del marcador X/);
  });
  it('falla si sobra un valor que ningún marcador usa (error de escritura)', () => {
    expect(() => sustituirMarcadores({ a: 'x' }, { SOBRA: 'secreto-1234' })).toThrow(/SOBRA/);
  });
  it('un valor con comillas o llaves no rompe la estructura', () => {
    const realm = resolver({ OIDC_CLIENT_SECRET: 'a"b\\c{{d}}' });
    expect(cliente(realm, 'sigiso-web').secret).toBe('a"b\\c{{d}}');
  });
});

describe('generarSecretos', () => {
  it('genera una clave por marcador y por cuenta, todas distintas', () => {
    const todas = [
      ...Object.values(secretos.marcadores).filter((v) => v !== 'http://localhost:3000'),
      ...Object.values(secretos.usuarios),
      secretos.adminPassword,
    ];
    expect(new Set(todas).size).toBe(todas.length);
    expect(Object.keys(secretos.usuarios).sort()).toEqual([...aliases].sort());
  });
  it('conserva los existentes y solo completa lo que falta (idempotente)', () => {
    const otra = generarSecretos({
      existentes: { ...secretos, usuarios: { 'admin-a': 'ya-existente' } },
      aliases,
      generar: () => 'nuevo',
    });
    expect(otra.usuarios['admin-a']).toBe('ya-existente');
    expect(otra.usuarios['colab-a']).toBe('nuevo');
    expect(otra.marcadores.OIDC_CLIENT_SECRET).toBe(secretos.marcadores.OIDC_CLIENT_SECRET);
    expect(otra.adminPassword).toBe(secretos.adminPassword);
  });
});

describe('realm resuelto (ADR 025 y 027)', () => {
  const realm = resolver();

  it('no deja marcadores sin resolver', () => {
    expect(JSON.stringify(realm)).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
  });

  it('realm sigiso, español y sin registro ni recuperación por correo', () => {
    expect(realm).toMatchObject({
      realm: 'sigiso',
      enabled: true,
      sslRequired: 'external',
      registrationAllowed: false,
      resetPasswordAllowed: false,
      rememberMe: false,
      editUsernameAllowed: false,
      internationalizationEnabled: true,
      defaultLocale: 'es',
      supportedLocales: ['es'],
    });
  });

  it('expiración del ADR 027: 30 min de inactividad, 8 h de sesión, 5 min de token, rotación sin reutilización', () => {
    expect(realm).toMatchObject({
      ssoSessionIdleTimeout: 1800,
      ssoSessionMaxLifespan: 28800,
      accessTokenLifespan: 300,
      revokeRefreshToken: true,
      refreshTokenMaxReuse: 0,
      defaultSignatureAlgorithm: 'RS256',
    });
  });

  it('detección de fuerza bruta activada con bloqueo temporal', () => {
    expect(realm).toMatchObject({
      bruteForceProtected: true,
      permanentLockout: false,
    });
    expect(realm.failureFactor).toBeLessThanOrEqual(5);
  });

  it('eventos de usuario y de administración habilitados, con LOGIN_ERROR, y sin detalle de administración', () => {
    expect(realm.eventsEnabled).toBe(true);
    expect(realm.enabledEventTypes).toEqual(
      expect.arrayContaining(['LOGIN', 'LOGIN_ERROR', 'LOGOUT', 'REFRESH_TOKEN_ERROR']),
    );
    expect(realm.eventsExpiration).toBeGreaterThan(0);
    expect(realm.adminEventsEnabled).toBe(true);
    expect(realm.adminEventsDetailsEnabled).toBe(false);
    // El listener de registro escribiría IP y nombre de usuario de cada fallo en un archivo de texto (datos personales, LOPDP).
    expect(realm.eventsListeners).toEqual([]);
  });

  it('cliente web: confidencial, código con PKCE S256, sin flujos inseguros y URIs exactas sin comodines', () => {
    const web = cliente(realm, 'sigiso-web');
    expect(web).toMatchObject({
      publicClient: false,
      standardFlowEnabled: true,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      secret: secretos.marcadores.OIDC_CLIENT_SECRET,
      redirectUris: ['http://localhost:3000/auth/callback'],
      optionalClientScopes: [],
    });
    expect(web.attributes['pkce.code.challenge.method']).toBe('S256');
    expect(web.attributes['post.logout.redirect.uris']).toBe('http://localhost:3000/');
    expect(
      JSON.stringify([web.redirectUris, web.attributes['post.logout.redirect.uris'], web.webOrigins]),
    ).not.toContain('*');
  });

  it('mapper empresa_id desde el atributo de la cuenta y audiencia propia sigiso-api en el access token', () => {
    const mappers = cliente(realm, 'sigiso-web').protocolMappers;
    const empresa = mappers.find((m) => m.config['claim.name'] === 'empresa_id');
    expect(empresa).toMatchObject({
      protocolMapper: 'oidc-usermodel-attribute-mapper',
    });
    expect(empresa.config).toMatchObject({
      'user.attribute': 'empresa_id',
      'access.token.claim': 'true',
      'userinfo.token.claim': 'false',
    });
    const audiencia = mappers.find((m) => m.protocolMapper === 'oidc-audience-mapper');
    expect(audiencia.config).toMatchObject({
      'included.custom.audience': 'sigiso-api',
      'access.token.claim': 'true',
    });
  });

  it('alcances explícitos y mínimos: la web recibe solo «basic» (sub); «roles» solo la cuenta de eventos', () => {
    expect(realm.clientScopes.map((s) => s.name)).toEqual(['basic', 'roles', 'kc-admin-api']);
    expect(cliente(realm, 'sigiso-web').defaultClientScopes).toEqual(['basic']);
    const sub = realm.clientScopes[0].protocolMappers.find((m) => m.protocolMapper === 'oidc-sub-mapper');
    expect(sub.config).toMatchObject({ 'access.token.claim': 'true', 'id.token.claim': 'true' });
    expect(realm.defaultDefaultClientScopes).toEqual(['basic']);
    expect(realm.defaultOptionalClientScopes).toEqual([]);
    expect(cliente(realm, 'sigiso-events').defaultClientScopes).toEqual(['basic', 'roles', 'kc-admin-api']);
  });

  it('el alcance «roles» pone los roles de cliente y la audiencia de realm-management en el token de la cuenta de eventos', () => {
    const roles = realm.clientScopes.find((s) => s.name === 'roles');
    const mapeadores = roles.protocolMappers.map((m) => m.protocolMapper).sort();
    expect(mapeadores).toEqual(['oidc-audience-resolve-mapper', 'oidc-usermodel-client-role-mapper']);
    const claim = roles.protocolMappers.find((m) => m.protocolMapper === 'oidc-usermodel-client-role-mapper');
    expect(claim.config).toMatchObject({
      'claim.name': 'resource_access.${client_id}.roles',
      'access.token.claim': 'true',
    });
    expect(claim.config['id.token.claim']).toBe('false');
  });

  it('«kc-admin-api» (exigido por la API de administración de Keycloak 26.8) va en el scope del token y pone la audiencia del realm', () => {
    const admin = realm.clientScopes.find((s) => s.name === 'kc-admin-api');
    expect(admin.attributes['include.in.token.scope']).toBe('true');
    expect(admin.protocolMappers.map((m) => m.protocolMapper)).toEqual(['oidc-admin-api-audience-mapper']);
    expect(admin.protocolMappers[0].config['access.token.claim']).toBe('true');
    // Solo la cuenta de eventos lo recibe: la web nunca debe poder llamar a la API de administración.
    expect(cliente(realm, 'sigiso-web').defaultClientScopes).not.toContain('kc-admin-api');
    expect(realm.defaultDefaultClientScopes).not.toContain('kc-admin-api');
  });

  it('con fullScopeAllowed falso, view-events es el único rol que el cliente de eventos puede llevar en su token', () => {
    expect(cliente(realm, 'sigiso-events').fullScopeAllowed).toBe(false);
    expect(realm.clientScopeMappings).toEqual({
      'realm-management': [{ client: 'sigiso-events', roles: ['view-events'] }],
    });
  });

  it('clientes integrados de autoservicio y de administración del realm: deshabilitados y sin flujos', () => {
    for (const id of ['account', 'account-console', 'admin-cli', 'security-admin-console']) {
      const c = cliente(realm, id);
      expect(c, id).toBeDefined();
      expect(c, id).toMatchObject({
        enabled: false,
        standardFlowEnabled: false,
        implicitFlowEnabled: false,
        directAccessGrantsEnabled: false,
        serviceAccountsEnabled: false,
        redirectUris: [],
        webOrigins: [],
      });
    }
    // Los únicos clientes habilitados son los nuestros.
    expect(
      realm.clients
        .filter((c) => c.enabled)
        .map((c) => c.clientId)
        .sort(),
    ).toEqual(['sigiso-events', 'sigiso-web']);
  });

  it('cuenta de servicio de eventos: solo view-events, sin flujos de personas', () => {
    const eventos = cliente(realm, 'sigiso-events');
    expect(eventos).toMatchObject({
      serviceAccountsEnabled: true,
      standardFlowEnabled: false,
      directAccessGrantsEnabled: false,
      secret: secretos.marcadores.KEYCLOAK_EVENTS_CLIENT_SECRET,
    });
    const cuenta = realm.users.find((u) => u.serviceAccountClientId === 'sigiso-events');
    expect(cuenta.clientRoles).toEqual({ 'realm-management': ['view-events'] });
    expect(cuenta.attributes).toBeUndefined();
  });

  it('perfil de usuario: empresa_id solo lo ve y edita el administrador, con formato UUID', () => {
    const texto =
      realm.components['org.keycloak.userprofile.UserProfileProvider'][0].config['kc.user.profile.config'][0];
    const atributos = JSON.parse(texto).attributes;
    const empresa = atributos.find((a) => a.name === 'empresa_id');
    expect(empresa.permissions).toEqual({ view: ['admin'], edit: ['admin'] });
    expect(new RegExp(empresa.validations.pattern.pattern).test('a5eed000-0000-4000-8000-00000000000a')).toBe(true);
    expect(new RegExp(empresa.validations.pattern.pattern).test("x'; --")).toBe(false);
    for (const a of atributos.filter((x) => x.name !== 'empresa_id')) expect(a.permissions.edit).toEqual(['admin']);
    expect(JSON.parse(texto).unmanagedAttributePolicy).toBeUndefined();
  });

  it('cuentas de prueba: las de la siembra, mismos id (= sub) y empresa, contraseña propia no temporal', () => {
    const personas = realm.users.filter((u) => !u.serviceAccountClientId);
    expect(personas).toHaveLength(DATOS_SIEMBRA.usuarios.length);
    for (const dato of DATOS_SIEMBRA.usuarios) {
      const u = personas.find((x) => x.username === dato.alias);
      expect(u).toMatchObject({
        id: dato.id,
        email: dato.correo,
        enabled: true,
        emailVerified: true,
      });
      expect(u.attributes).toEqual({ empresa_id: [dato.empresaId] });
      expect(u.credentials).toEqual([
        {
          type: 'password',
          temporary: false,
          value: secretos.usuarios[dato.alias],
        },
      ]);
      expect(u.requiredActions ?? []).toEqual([]);
    }
    expect(new Set(personas.map((u) => u.credentials[0].value)).size).toBe(personas.length);
  });

  it('todos los correos de prueba son de un dominio reservado', () => {
    for (const u of realm.users.filter((x) => x.email)) expect(u.email).toMatch(/@example\.test$/);
  });

  it('falla si falta la contraseña de alguna cuenta', () => {
    expect(() =>
      resolverRealm({
        plantilla,
        perfil,
        valores: {
          WEB_ORIGIN: 'http://localhost:3000',
          ...secretos.marcadores,
        },
        usuarios: DATOS_SIEMBRA.usuarios,
        clavesUsuarios: {},
      }),
    ).toThrow(/Falta la contraseña de la cuenta admin-a/);
  });
});
