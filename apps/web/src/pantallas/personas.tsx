import { Badge, Button, Card, CardTitle, EstadoVacio, Input, Label, Select, Tabla, Td, Th } from '@sig/ui';
import type { Personas, Rol } from '../api/tipos';
import type { AvisoEscritura } from '../certificacion/escribir';
import type { Empresa } from '../empresas';
import { es } from '../i18n/es-EC';
import { AvisoDeEscritura } from './aviso-escritura';
import { MarcoApp } from './marco';

const t = es.personas;
const ROLES: readonly Rol[] = ['administrador_sig', 'dueno_proceso', 'auditor_interno', 'auditor_externo', 'colaborador', 'alta_direccion'];
const fecha = (iso: string): string => new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(new Date(iso));

const OpcionesDeRol = () => (
  <>
    {ROLES.map((r) => (
      <option key={r} value={r}>
        {t.roles[r]}
      </option>
    ))}
  </>
);

/**
 * Personas y solicitudes de acceso de la empresa (ADR 036). Solo el administrador SIG llega aquí (la API decide de verdad). Las escrituras
 * son formularios `POST` hacia rutas propias de la web, sin la empresa: sale del token. El nombre y el correo se escriben aquí, al aprobar.
 */
export const PantallaPersonas = ({
  empresa,
  persona,
  datos,
  aviso,
}: {
  empresa: Empresa;
  persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  datos: Personas;
  aviso: AvisoEscritura | null;
}) => (
  <MarcoApp empresa={empresa} activo="personas" persona={persona.nombre}>
    <h1 className="mb-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
    <p className="mb-4 max-w-3xl text-sm text-fg-muted">{t.ayuda}</p>
    <AvisoDeEscritura aviso={aviso} />

    <section aria-labelledby="solicitudes-titulo" className="mb-8">
      <h2 id="solicitudes-titulo" className="mb-1 text-lg font-semibold text-fg">
        {t.solicitudesTitulo}
      </h2>
      <p className="mb-3 max-w-3xl text-sm text-fg-muted">{t.solicitudesAyuda}</p>
      {datos.solicitudes.length === 0 ? (
        <p className="text-sm text-fg-muted">{t.sinSolicitudes}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {datos.solicitudes.map((s, i) => (
            <li key={s.id}>
              <Card className="p-4">
                <CardTitle className="font-mono text-xl">{s.codigo}</CardTitle>
                <p className="mt-1 text-sm text-fg-muted">
                  {t.recibida(fecha(s.creadaEn))} {t.vence(fecha(s.venceEn))}
                </p>
                <form method="post" action={`/e/${empresa.id}/personas/aprobar`} className="mt-3 flex flex-wrap items-end gap-3" aria-label={t.aprobarDe(s.codigo)}>
                  <input type="hidden" name="solicitud" value={s.id} />
                  <div className="flex min-w-48 flex-col gap-1.5">
                    <Label htmlFor={`sol-${i}-nombre`}>{t.nombre}</Label>
                    <Input id={`sol-${i}-nombre`} name="nombre" required maxLength={120} autoComplete="off" />
                  </div>
                  <div className="flex min-w-64 flex-col gap-1.5">
                    <Label htmlFor={`sol-${i}-correo`}>{t.correo}</Label>
                    <Input id={`sol-${i}-correo`} name="correo" type="email" required maxLength={254} autoComplete="off" />
                  </div>
                  <div className="flex min-w-48 flex-col gap-1.5">
                    <Label htmlFor={`sol-${i}-rol`}>{t.rol}</Label>
                    <Select id={`sol-${i}-rol`} name="rol" required defaultValue="colaborador">
                      <OpcionesDeRol />
                    </Select>
                  </div>
                  <Button type="submit" aria-label={t.aprobarDe(s.codigo)}>
                    {t.aprobar}
                  </Button>
                </form>
                <form method="post" action={`/e/${empresa.id}/personas/descartar`} className="mt-2" aria-label={t.descartarDe(s.codigo)}>
                  <input type="hidden" name="solicitud" value={s.id} />
                  <Button type="submit" variante="ghost" aria-label={t.descartarDe(s.codigo)}>
                    {t.descartar}
                  </Button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>

    <section aria-labelledby="personas-titulo">
      <h2 id="personas-titulo" className="mb-1 text-lg font-semibold text-fg">
        {t.personasTitulo}
      </h2>
      <p className="mb-3 max-w-3xl text-sm text-fg-muted">{t.bajaAyuda}</p>
      {datos.personas.length === 0 ? (
        <EstadoVacio titulo={t.sinPersonas} descripcion={t.ayuda} />
      ) : (
        <Tabla aria-describedby="personas-desc">
          <caption id="personas-desc" className="sr-only">
            {t.tablaDescripcion}
          </caption>
          <thead>
            <tr>
              <Th>{t.columnas.nombre}</Th>
              <Th>{t.columnas.correo}</Th>
              <Th>{t.columnas.rol}</Th>
              <Th>{t.columnas.estado}</Th>
              <Th>{t.columnas.acciones}</Th>
            </tr>
          </thead>
          <tbody>
            {datos.personas.map((p, i) => (
              <tr key={p.id}>
                <Td>{p.nombre}</Td>
                <Td>{p.correo}</Td>
                <Td>{p.rol ? t.roles[p.rol] : '—'}</Td>
                <Td>{p.bajaEn ? <Badge tono="neutral">{t.dadaDeBaja(fecha(p.bajaEn))}</Badge> : <Badge tono="success">{t.conAcceso}</Badge>}</Td>
                <Td>
                  {p.rol && (
                    <div className="flex flex-wrap items-end gap-2">
                      <form method="post" action={`/e/${empresa.id}/personas/rol`} className="flex items-end gap-2" aria-label={t.cambiarRolDe(p.nombre)}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="version" value={p.version} />
                        <Label htmlFor={`per-${i}-rol`} className="sr-only">
                          {t.rolDe(p.nombre)}
                        </Label>
                        <Select id={`per-${i}-rol`} name="rol" defaultValue={p.rol}>
                          <OpcionesDeRol />
                        </Select>
                        <Button type="submit" variante="secondary" aria-label={t.cambiarRolDe(p.nombre)}>
                          {t.cambiarRol}
                        </Button>
                      </form>
                      <form method="post" action={`/e/${empresa.id}/personas/baja`} aria-label={t.darDeBajaA(p.nombre)}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="version" value={p.version} />
                        <Button type="submit" variante="danger" aria-label={t.darDeBajaA(p.nombre)}>
                          {t.darDeBaja}
                        </Button>
                      </form>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </section>
  </MarcoApp>
);
