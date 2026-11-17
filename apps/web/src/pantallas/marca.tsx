import { Alert, Button, Card, CardTitle, Input, Label } from '@sig/ui';
import type { Rol } from '../api/tipos';
import { es } from '../i18n/es-EC';
import type { AvisoMarca } from '../marca/editar';
import type { MarcaDetalle } from '../marca/marca';
import type { Empresa } from '../marca/tipos';
import { AvisoEnfocado } from './aviso-enfocado';
import { LogoEmpresa, logoSeguro, MarcoApp } from './marco';
import { COLOR } from '../validacion/patrones';

const t = es.marcaEdicion;

export interface PropsMarca {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly marca: MarcaDetalle;
  readonly aviso?: AvisoMarca | null;
}

/** Una muestra de color. El valor ya viene validado como #RRGGBB (nunca se usa un color sin comprobar). */
const Muestra = ({ hex, etiqueta }: { hex: string; etiqueta: string }) =>
  COLOR.test(hex) ? (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="inline-block size-6 rounded-md border border-line-strong" style={{ backgroundColor: hex }} />
      <span className="text-sm text-fg">
        {etiqueta}: <span className="font-mono">{hex}</span>
      </span>
    </div>
  ) : null;

const AvisoDeMarca = ({ aviso }: { aviso: AvisoMarca | null }) => {
  if (!aviso) return null;
  const a = t.avisos[aviso];
  return (
    <AvisoEnfocado etiqueta={es.app.aviso}>
      <Alert tono={a.tono} titulo={a.titulo}>
        {a.detalle}
      </Alert>
    </AvisoEnfocado>
  );
};

/** Marca de la empresa: cómo se ve ahora y, para el administrador SIG, el formulario para cambiarla. La empresa no viaja en el formulario. */
export const PantallaMarca = ({ empresa, persona, marca, aviso = null }: PropsMarca) => {
  const esAdmin = persona.roles.includes('administrador_sig');
  return (
    <MarcoApp empresa={empresa} activo="marca" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{t.ayuda}</p>
      <AvisoDeMarca aviso={aviso} />

      <Card>
        <CardTitle>{t.vistaTitulo}</CardTitle>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <p className="mb-1 text-sm font-medium text-fg">{t.logoActual}</p>
            <LogoEmpresa empresa={empresa} />
            {!logoSeguro(marca.logoUrl ?? undefined) && <p className="mt-1 text-sm text-fg-muted">{t.sinLogo}</p>}
          </div>
          <Muestra hex={marca.colorPrimario} etiqueta={t.colorAplicado} />
          <Muestra hex={marca.colorOriginal} etiqueta={t.colorElegido} />
          {marca.ajustadoPorContraste ? (
            <Alert tono="warning" titulo={t.ajustado(marca.colorOriginal, marca.colorPrimario)} />
          ) : (
            <p className="text-sm text-fg-muted">{t.sinAjuste}</p>
          )}
        </div>
      </Card>

      <div className="mt-6">
        {esAdmin ? (
          <Card>
            <CardTitle>{t.editarTitulo}</CardTitle>
            <form method="post" action={`/e/${empresa.id}/marca/guardar`} className="mt-3 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="marca-color">{t.colorEtiqueta}</Label>
                <Input
                  id="marca-color"
                  name="color"
                  type="color"
                  defaultValue={marca.colorOriginal}
                  required
                  aria-describedby="marca-color-ayuda"
                />
                <p id="marca-color-ayuda" className="text-sm text-fg-muted">
                  {t.colorAyuda}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="marca-logo">{t.logoEtiqueta}</Label>
                <Input
                  id="marca-logo"
                  name="logo"
                  type="text"
                  inputMode="url"
                  maxLength={2048}
                  autoComplete="off"
                  defaultValue={marca.logoUrl ?? ''}
                  aria-describedby="marca-logo-ayuda"
                />
                <p id="marca-logo-ayuda" className="text-sm text-fg-muted">
                  {t.logoAyuda}
                </p>
              </div>
              <div>
                <Button type="submit">{t.guardar}</Button>
              </div>
            </form>
          </Card>
        ) : (
          <Alert tono="info" titulo={t.soloAdmin} />
        )}
      </div>
    </MarcoApp>
  );
};
