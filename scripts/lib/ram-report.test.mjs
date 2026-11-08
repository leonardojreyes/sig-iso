import { describe, expect, it } from 'vitest';
import {
  agregar,
  clasificar,
  COMPONENTES,
  formatear,
  leerArgumentos,
  listarProcesos,
  parsearLsof,
  parsearPs,
  parsearPuertosWindows,
  parsearWindows,
  resumir,
} from './ram-report.mjs';

const KB = 1024;

describe('parsearPs (macOS y Linux: ps -axo pid=,ppid=,rss=,command=)', () => {
  it('lee pid, ppid, RSS en KB y la línea de comando completa (con espacios)', () => {
    const salida = [
      '    1     0  1234 /sbin/launchd',
      '  501     1 20480 /opt/homebrew/opt/postgresql@16/bin/postgres -D /opt/homebrew/var/postgresql@16',
      '  502   501  3000 postgres: checkpointer ',
    ].join('\n');
    expect(parsearPs(salida)).toEqual([
      { pid: 1, ppid: 0, rssKb: 1234, comando: '/sbin/launchd' },
      {
        pid: 501,
        ppid: 1,
        rssKb: 20480,
        comando: '/opt/homebrew/opt/postgresql@16/bin/postgres -D /opt/homebrew/var/postgresql@16',
      },
      { pid: 502, ppid: 501, rssKb: 3000, comando: 'postgres: checkpointer' },
    ]);
  });

  it('ignora líneas vacías o mal formadas', () => {
    expect(parsearPs('\n\nbasura\n  12 x 34 cmd\n  7  1  5 ok\n')).toEqual([
      { pid: 7, ppid: 1, rssKb: 5, comando: 'ok' },
    ]);
  });
});

describe('parsearWindows (Get-CimInstance Win32_Process … | ConvertTo-Json)', () => {
  it('convierte bytes de memoria de trabajo a KB y une nombre y línea de comando', () => {
    const json = JSON.stringify([
      {
        ProcessId: 10,
        ParentProcessId: 4,
        Name: 'postgres.exe',
        WorkingSetSize: 10485760,
        CommandLine: '"C:\\pg\\bin\\postgres.exe" -D data',
      },
      { ProcessId: 11, ParentProcessId: 10, Name: 'java.exe', WorkingSetSize: 2097152, CommandLine: null },
    ]);
    expect(parsearWindows(json)).toEqual([
      { pid: 10, ppid: 4, rssKb: 10240, comando: '"C:\\pg\\bin\\postgres.exe" -D data' },
      { pid: 11, ppid: 10, rssKb: 2048, comando: 'java.exe' },
    ]);
  });

  it('acepta un solo objeto (PowerShell no lo envuelve en lista) y valores nulos', () => {
    expect(
      parsearWindows(
        JSON.stringify({
          ProcessId: 5,
          ParentProcessId: 1,
          Name: 'a.exe',
          WorkingSetSize: null,
          CommandLine: 'a.exe x',
        }),
      ),
    ).toEqual([{ pid: 5, ppid: 1, rssKb: 0, comando: 'a.exe x' }]);
  });

  it.each(['', 'no es json', '{', 'null', '42'])('una salida inválida (%j) da lista vacía', (s) => {
    expect(parsearWindows(s)).toEqual([]);
  });
});

describe('puertos en escucha', () => {
  it('parsearLsof lee `lsof -Fpn`: pid y puertos por proceso', () => {
    const salida = 'p100\nf5\nn127.0.0.1:5432\nn[::1]:5432\np200\nn*:3001\np300\nn*:3000\n';
    expect(parsearLsof(salida)).toEqual(
      new Map([
        [100, [5432]],
        [200, [3001]],
        [300, [3000]],
      ]),
    );
  });

  it('parsearPuertosWindows lee Get-NetTCPConnection (lista u objeto)', () => {
    expect(
      parsearPuertosWindows(
        JSON.stringify([
          { OwningProcess: 7, LocalPort: 3000 },
          { OwningProcess: 7, LocalPort: 3001 },
          { OwningProcess: 8, LocalPort: 5432 },
        ]),
      ),
    ).toEqual(
      new Map([
        [7, [3000, 3001]],
        [8, [5432]],
      ]),
    );
    expect(parsearPuertosWindows(JSON.stringify({ OwningProcess: 9, LocalPort: 8080 }))).toEqual(
      new Map([[9, [8080]]]),
    );
    expect(parsearPuertosWindows('basura')).toEqual(new Map());
  });
});

describe('clasificar', () => {
  const c = (comando, puertos = []) => clasificar({ pid: 1, ppid: 0, rssKb: 1, comando }, puertos);

  it.each([
    ['/opt/homebrew/opt/postgresql@16/bin/postgres -D /var/pg', 'postgresql'],
    ['postgres: checkpointer', 'postgresql'],
    ['postgres: sigiso_app sigiso 127.0.0.1(5555) idle', 'postgresql'],
    ['"C:\\Program Files\\PostgreSQL\\16\\bin\\postgres.exe" -D data', 'postgresql'],
    ['/usr/lib/jvm/java-21/bin/java -Xmx512m -jar /Users/x/.local/keycloak/lib/quarkus-run.jar start-dev', 'keycloak'],
    ['C:\\jdk\\bin\\java.exe -jar C:\\keycloak\\lib\\quarkus-run.jar', 'keycloak'],
    ['/opt/homebrew/bin/openfga run', 'openfga'],
    ['openfga.exe run --datastore-engine postgres', 'openfga'],
    ['node /repo/node_modules/.bin/tsx watch src/main.ts @sig/api', 'api'],
    ['node /repo/apps/api/dist/main.js', 'api'],
    ['node C:\\repo\\apps\\api\\dist\\main.js', 'api'],
    ['node /repo/node_modules/next/dist/server/lib/start-server.js apps/web', 'web'],
    ['next-server (v15.0.0)', 'web'],
  ])('%s → %s', (comando, esperado) => {
    expect(c(comando)).toBe(esperado);
  });

  it('un nodo que escucha en el puerto de la API o de la web se atribuye a ellas', () => {
    expect(c('node server.js', [3001])).toBe('api');
    expect(c('node server.js', [3000])).toBe('web');
  });

  it.each([
    ['/Applications/Safari.app/Contents/MacOS/Safari'],
    ['node /repo/node_modules/vitest/vitest.mjs run'],
    ['/usr/bin/java -jar otra-herramienta.jar'],
    ['/usr/bin/postgres-client-tool'],
    ['mi-postgres-helper'],
    ['/bin/zsh -l'],
  ])('%s no es de la pila', (comando) => {
    expect(c(comando)).toBeNull();
  });

  it('un proceso que escucha en un puerto cualquiera no se clasifica por eso', () => {
    expect(c('/bin/otra-cosa', [8080])).toBeNull();
  });

  it('los componentes conocidos son los del plan, en orden', () => {
    expect(COMPONENTES.map((x) => x.id)).toEqual(['postgresql', 'keycloak', 'openfga', 'api', 'web']);
  });
});

describe('agregar: cada proceso suma a su componente o al del antecesor clasificado', () => {
  const procs = [
    { pid: 1, ppid: 0, rssKb: 100, comando: '/sbin/launchd' },
    { pid: 10, ppid: 1, rssKb: 10 * KB, comando: '/opt/homebrew/bin/postgres -D x' },
    { pid: 11, ppid: 10, rssKb: 2 * KB, comando: 'postgres: checkpointer' },
    { pid: 12, ppid: 10, rssKb: 3 * KB, comando: 'proceso-hijo-sin-nombre-de-pila' },
    { pid: 20, ppid: 1, rssKb: 5 * KB, comando: 'pnpm --filter @sig/api dev' },
    { pid: 21, ppid: 20, rssKb: 40 * KB, comando: 'node /repo/node_modules/.bin/tsx watch src/main.ts' },
    { pid: 22, ppid: 21, rssKb: 60 * KB, comando: '/usr/local/bin/node src/main.ts' },
    { pid: 30, ppid: 1, rssKb: 999 * KB, comando: '/Applications/Safari.app/Contents/MacOS/Safari' },
  ];

  it('suma por componente y cuenta procesos; lo ajeno a la pila no cuenta', () => {
    const r = agregar(procs, new Map());
    expect(r.postgresql).toEqual({ procesos: 3, rssKb: 15 * KB });
    expect(r.api).toEqual({ procesos: 3, rssKb: 105 * KB });
    expect(r.keycloak).toEqual({ procesos: 0, rssKb: 0 });
    expect(r.openfga).toEqual({ procesos: 0, rssKb: 0 });
    expect(r.web).toEqual({ procesos: 0, rssKb: 0 });
  });

  it('un proceso nunca se cuenta dos veces', () => {
    const r = agregar(procs, new Map());
    const total = Object.values(r).reduce((s, x) => s + x.rssKb, 0);
    expect(total).toBe(15 * KB + 105 * KB);
  });

  it('tolera ciclos de pid (datos corruptos) sin colgarse', () => {
    const r = agregar(
      [
        { pid: 1, ppid: 2, rssKb: 1, comando: 'x' },
        { pid: 2, ppid: 1, rssKb: 1, comando: 'y' },
      ],
      new Map(),
    );
    expect(Object.values(r).every((x) => x.procesos === 0)).toBe(true);
  });

  it('usa los puertos para atribuir a la API y a la web', () => {
    const r = agregar(
      [
        { pid: 5, ppid: 1, rssKb: 7 * KB, comando: 'node servidor.js' },
        { pid: 6, ppid: 1, rssKb: 9 * KB, comando: 'node otro.js' },
      ],
      new Map([
        [5, [3001]],
        [6, [3000]],
      ]),
    );
    expect(r.api).toEqual({ procesos: 1, rssKb: 7 * KB });
    expect(r.web).toEqual({ procesos: 1, rssKb: 9 * KB });
  });
});

describe('resumir y formatear', () => {
  const agregado = {
    postgresql: { procesos: 8, rssKb: 210 * KB },
    keycloak: { procesos: 1, rssKb: 900 * KB },
    openfga: { procesos: 0, rssKb: 0 },
    api: { procesos: 3, rssKb: 150 * KB },
    web: { procesos: 4, rssKb: 600 * KB },
  };

  it('resumir calcula el total, el porcentaje del presupuesto y el estado', () => {
    const r = resumir(agregado, { presupuestoMb: 4096, totalEquipoMb: 8192 });
    expect(r.totalMb).toBeCloseTo(1860, 5);
    expect(r.porcentajePresupuesto).toBeCloseTo((1860 / 4096) * 100, 5);
    expect(r.estado).toBe('dentro');
    expect(r.componentes.map((x) => [x.id, x.enEjecucion])).toEqual([
      ['postgresql', true],
      ['keycloak', true],
      ['openfga', false],
      ['api', true],
      ['web', true],
    ]);
  });

  it.each([
    [3500, 'dentro'],
    [3700, 'cerca'], // desde el 90 % del presupuesto
    [4096, 'cerca'],
    [4200, 'excedido'],
  ])('con %i MB el estado es %s', (mb, estado) => {
    expect(
      resumir(
        { ...agregado, web: { procesos: 1, rssKb: mb * KB - 1860 * KB + 600 * KB } },
        { presupuestoMb: 4096, totalEquipoMb: 8192 },
      ).estado,
    ).toBe(estado);
  });

  it('formatear da un informe legible: componentes, MB, procesos, total y estado', () => {
    const texto = formatear(resumir(agregado, { presupuestoMb: 4096, totalEquipoMb: 8192 }));
    expect(texto).toContain('PostgreSQL');
    expect(texto).toContain('Keycloak');
    expect(texto).toMatch(/OpenFGA\s+no está en ejecución/);
    expect(texto).toMatch(/PostgreSQL\s+8\s+210[.,]0/);
    expect(texto).toMatch(/Total\s+1860[.,]0 MB de 4096 MB/);
    expect(texto).toContain('dentro del presupuesto');
    expect(texto).toContain('8.0 GB');
  });

  it('el informe avisa cuando se acerca o excede el presupuesto', () => {
    const cerca = formatear(
      resumir({ ...agregado, web: { procesos: 1, rssKb: 2800 * KB } }, { presupuestoMb: 4096, totalEquipoMb: 8192 }),
    );
    expect(cerca).toContain('cerca del presupuesto');
    const mucho = formatear(
      resumir({ ...agregado, web: { procesos: 1, rssKb: 4000 * KB } }, { presupuestoMb: 4096, totalEquipoMb: 8192 }),
    );
    expect(mucho).toContain('EXCEDE el presupuesto');
  });

  it('aclara que RSS cuenta varias veces la memoria compartida (es una cota superior)', () => {
    expect(formatear(resumir(agregado, { presupuestoMb: 4096, totalEquipoMb: 8192 }))).toMatch(/compartida|cota/i);
  });

  it('NUNCA imprime líneas de comando (pueden llevar contraseñas)', () => {
    const procs = [
      {
        pid: 9,
        ppid: 1,
        rssKb: 5 * KB,
        comando: '/opt/homebrew/bin/openfga run --datastore-uri postgres://usuario:CLAVE-SECRETA@127.0.0.1/openfga',
      },
    ];
    const texto = formatear(resumir(agregar(procs, new Map()), { presupuestoMb: 4096, totalEquipoMb: 8192 }));
    expect(texto).not.toContain('CLAVE-SECRETA');
    expect(texto).not.toContain('postgres://');
    expect(
      JSON.stringify(resumir(agregar(procs, new Map()), { presupuestoMb: 4096, totalEquipoMb: 8192 })),
    ).not.toContain('CLAVE-SECRETA');
  });
});

describe('leerArgumentos', () => {
  it('por defecto: informe de texto y presupuesto de 4 GB', () => {
    expect(leerArgumentos([])).toEqual({ json: false, presupuestoMb: 4096 });
  });
  it('--json y --presupuesto-gb', () => {
    expect(leerArgumentos(['--json', '--presupuesto-gb', '6'])).toEqual({ json: true, presupuestoMb: 6144 });
    expect(leerArgumentos(['--presupuesto-gb=2.5'])).toEqual({ json: false, presupuestoMb: 2560 });
  });
  it.each([
    ['--nada'],
    ['--presupuesto-gb'],
    ['--presupuesto-gb', 'x'],
    ['--presupuesto-gb', '0'],
    ['--presupuesto-gb', '-1'],
    ['--presupuesto-gb', '1000'],
    ['suelto'],
  ])('rechaza %j', (...args) => {
    expect(() => leerArgumentos(args)).toThrow();
  });
});

describe('listarProcesos (lee los procesos REALES del sistema; macOS, Linux y Windows)', () => {
  it('incluye este mismo proceso, con memoria positiva y su padre', async () => {
    const lista = await listarProcesos();
    const yo = lista.find((p) => p.pid === process.pid);
    expect(yo).toBeDefined();
    expect(yo.rssKb).toBeGreaterThan(1000);
    expect(yo.ppid).toBeGreaterThan(0);
    expect(typeof yo.comando).toBe('string');
    expect(lista.length).toBeGreaterThan(5);
  });
});
