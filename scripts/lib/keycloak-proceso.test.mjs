import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { argumentosArranque, encontrarJavaHome, entornoArranque, puertoOcupado, rutaKc } from './keycloak-proceso.mjs';

let carpeta;
beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), 'kc-proc-'));
});
afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

describe('argumentosArranque (solo local y con el realm importado)', () => {
  const args = argumentosArranque({ puerto: 8080 });
  it('escucha solo en 127.0.0.1, nunca en todas las interfaces', () => {
    expect(args).toContain('--http-host=127.0.0.1');
    expect(args.join(' ')).not.toMatch(/0\.0\.0\.0|::/);
  });
  it('fija el emisor con el nombre de host de la configuración y el puerto elegido', () => {
    expect(args).toContain('--hostname=http://127.0.0.1:8080');
    expect(argumentosArranque({ puerto: 9090 })).toContain('--hostname=http://127.0.0.1:9090');
    expect(argumentosArranque({ puerto: 9090 })).toContain('--http-port=9090');
  });
  it('importa el realm y no abre el puerto de gestión (sin health ni métricas)', () => {
    expect(args[0]).toBe('start-dev');
    expect(args).toContain('--import-realm');
    expect(args.join(' ')).not.toMatch(/health|metrics/);
  });
  it('rechaza un puerto inválido', () => {
    for (const p of [0, -1, 65536, 70000, 1.5, '8080', NaN])
      expect(() => argumentosArranque({ puerto: p })).toThrow(/puerto/i);
    expect(() => argumentosArranque({ puerto: 1 })).not.toThrow();
    expect(() => argumentosArranque({ puerto: 65535 })).not.toThrow();
  });
});

describe('entornoArranque', () => {
  const secretos = { usuario: 'sigiso-admin', clave: 'clave-de-prueba-123' };
  const env = entornoArranque({ javaHome: '/jre', secretos, base: { PATH: '/bin', OTRA: 'x' } });
  it('acota el heap de la JVM (512 MB) para el presupuesto de 8 GB', () => {
    expect(env.JAVA_OPTS_KC_HEAP).toBe('-Xms128m -Xmx512m');
  });
  it('entrega el administrador inicial por variables del proceso, no por argumentos', () => {
    expect(env.KC_BOOTSTRAP_ADMIN_USERNAME).toBe('sigiso-admin');
    expect(env.KC_BOOTSTRAP_ADMIN_PASSWORD).toBe('clave-de-prueba-123');
    expect(argumentosArranque({ puerto: 8080 }).join(' ')).not.toContain('clave-de-prueba-123');
  });
  it('usa el JRE indicado y conserva el entorno base', () => {
    expect(env.JAVA_HOME).toBe('/jre');
    expect(env.PATH).toBe('/bin');
  });
  it('no hereda un JAVA_OPTS ni otras opciones de Keycloak del entorno del usuario', () => {
    const sucio = entornoArranque({
      javaHome: '/jre',
      secretos,
      base: {
        JAVA_OPTS: '-Xmx8g',
        JAVA_OPTS_APPEND: '-Dx=y',
        KC_HTTP_HOST: '0.0.0.0',
        KC_HOSTNAME: 'otro',
        KC_DB: 'postgres',
        PATH: '/bin',
      },
    });
    for (const k of ['JAVA_OPTS', 'JAVA_OPTS_APPEND', 'KC_HTTP_HOST', 'KC_HOSTNAME', 'KC_DB'])
      expect(sucio[k]).toBeUndefined();
  });
  it('el nivel de registro es opcional y solo admite un formato seguro', () => {
    expect(env.KC_LOG_LEVEL).toBeUndefined();
    const con = entornoArranque({ javaHome: '/jre', secretos, base: {}, nivelLog: 'info,org.keycloak.services:debug' });
    expect(con.KC_LOG_LEVEL).toBe('info,org.keycloak.services:debug');
    for (const malo of ['info; echo x', 'a b', '$(x)', '']) {
      expect(() => entornoArranque({ javaHome: '/jre', secretos, base: {}, nivelLog: malo })).toThrow(/registro/i);
    }
  });
  it('falla si falta el administrador', () => {
    expect(() => entornoArranque({ javaHome: '/jre', secretos: { usuario: '', clave: 'x' }, base: {} })).toThrow(
      /administrador/i,
    );
    expect(() => entornoArranque({ javaHome: '/jre', secretos: { usuario: 'a', clave: '' }, base: {} })).toThrow(
      /administrador/i,
    );
  });
});

describe('rutaKc', () => {
  it('kc.sh en macOS y Linux, kc.bat en Windows', () => {
    expect(rutaKc('/k', 'darwin')).toBe(join('/k', 'bin', 'kc.sh'));
    expect(rutaKc('/k', 'linux')).toBe(join('/k', 'bin', 'kc.sh'));
    expect(rutaKc('/k', 'win32')).toBe(join('/k', 'bin', 'kc.bat'));
  });
});

describe('encontrarJavaHome', () => {
  it('en macOS entra en Contents/Home', () => {
    mkdirSync(join(carpeta, 'jdk-21.0.13+9-jre', 'Contents', 'Home', 'bin'), { recursive: true });
    expect(encontrarJavaHome(carpeta)).toBe(join(carpeta, 'jdk-21.0.13+9-jre', 'Contents', 'Home'));
  });
  it('en Windows y Linux usa la carpeta del JRE', () => {
    mkdirSync(join(carpeta, 'jdk-21.0.13+9-jre', 'bin'), { recursive: true });
    expect(encontrarJavaHome(carpeta)).toBe(join(carpeta, 'jdk-21.0.13+9-jre'));
  });
  it('falla de forma clara si el JRE no está instalado', () => {
    expect(() => encontrarJavaHome(join(carpeta, 'no-existe'))).toThrow(/keycloak:install/);
    expect(() => encontrarJavaHome(carpeta)).toThrow(/keycloak:install/);
  });
});

describe('puertoOcupado', () => {
  it('detecta un puerto en uso y uno libre', async () => {
    const servidor = createServer();
    await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
    const { port } = servidor.address();
    expect(await puertoOcupado('127.0.0.1', port)).toBe(true);
    await new Promise((r) => servidor.close(r));
    expect(await puertoOcupado('127.0.0.1', port)).toBe(false);
  });
});
