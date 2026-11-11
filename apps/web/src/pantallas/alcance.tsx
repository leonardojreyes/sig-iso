import { Badge, Button, Card, CardTitle, EstadoVacio, Label, Textarea } from '@sig/ui';
import type { Alcance, Rol } from '../api/tipos';
import type { AvisoEscritura } from '../certificacion/escribir';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { MarcoApp } from './marco';

export interface PropsAlcance {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly alcances: readonly Alcance[];
  readonly aviso?: AvisoEscritura | null;
}

const fecha = (iso: string): string => iso.slice(0, 10);

/** Alcance por norma adoptada. Solo el administrador SIG ve los botones; la API decide de verdad (403 si no). */
export const PantallaAlcance = ({ empresa, persona, alcances, aviso = null }: PropsAlcance) => {
  const t = es.alcance;
  const puedeEditar = persona.roles.includes('administrador_sig');
  return (
    <MarcoApp empresa={empresa} activo="alcance" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{t.ayuda}</p>
      <AvisoDeEscritura aviso={aviso} />
      {!puedeEditar && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}
      {alcances.length === 0 ? (
        <EstadoVacio titulo={t.sinNormasTitulo} descripcion={t.sinNormasDescripcion} />
      ) : (
        <div className="flex flex-col gap-4">
          {alcances.map((a, i) => {
            const idTexto = `alcance-${i}`;
            return (
              <Card key={a.norma} aria-labelledby={`${idTexto}-titulo`}>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <CardTitle id={`${idTexto}-titulo`} className="mb-0">
                    {a.norma}
                  </CardTitle>
                  {a.texto === null ? (
                    <Badge>{t.sinDefinir}</Badge>
                  ) : a.aprobado && a.aprobadoEn ? (
                    <Badge tono="success">{t.aprobadoEl(fecha(a.aprobadoEn))}</Badge>
                  ) : (
                    <Badge tono="warning">{t.sinAprobar}</Badge>
                  )}
                </div>
                {puedeEditar ? (
                  <form method="post" action={`/e/${empresa.id}/alcance/guardar`} className="flex flex-col gap-3">
                    <input type="hidden" name="norma" value={a.norma} />
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={idTexto}>{t.texto}</Label>
                      <Textarea id={idTexto} name="texto" required maxLength={4000} defaultValue={a.texto ?? ''} aria-describedby={`${idTexto}-ayuda`} />
                      <p id={`${idTexto}-ayuda`} className="text-sm text-fg-muted">
                        {t.textoAyuda}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button type="submit">{t.guardar}</Button>
                      {a.texto !== null && !a.aprobado && (
                        <Button type="submit" variante="secondary" formAction={`/e/${empresa.id}/alcance/aprobar`} formNoValidate>
                          {t.aprobar}
                        </Button>
                      )}
                    </div>
                  </form>
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-fg">{a.texto ?? t.sinDefinir}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </MarcoApp>
  );
};
