import { Alert, Badge, Button, Card, CardTitle, Input, Label, Select, Td, Th } from '@sig/ui';
import type { Rol } from '../api/tipos';
import type { AvisoEscritura } from '../certificacion/escribir';
import { NIVELES_CRITERIO, type Criterios, type NivelCriterio } from '../criterios/tipos';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { MarcoApp } from './marco';

export interface PropsCriterios {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly criterios: Criterios;
  readonly aviso?: AvisoEscritura | null;
}

const t = es.criterios;
const TONO: Record<NivelCriterio, 'success' | 'info' | 'warning' | 'danger'> = { bajo: 'success', medio: 'info', alto: 'warning', critico: 'danger' };
const VALORES = [1, 2, 3, 4, 5] as const;
const dia = (iso: string): string => iso.slice(0, 10);

/** La matriz 5 × 5: filas de mayor a menor probabilidad, columnas de menor a mayor impacto. El nivel SIEMPRE con palabras y números, nunca solo por color. */
export const MatrizCriterios = ({ criterios: c }: { criterios: Criterios }) => (
  <div className="overflow-x-auto" role="region" aria-label={t.matriz} tabIndex={0}>
    <table className="w-full border-collapse text-sm" aria-describedby="matriz-desc">
      <caption id="matriz-desc" className="sr-only">
        {t.matrizDescripcion}
      </caption>
      <thead>
        <tr>
          <Th scope="col">{t.columnaProbabilidad}</Th>
          {VALORES.map((i) => (
            <Th key={i} scope="col">
              {`${t.ejeImpacto} ${i}: ${c.impacto[i - 1]}`}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...VALORES].reverse().map((p) => (
          <tr key={p}>
            <Th scope="row">{`${t.ejeProbabilidad} ${p}: ${c.probabilidad[p - 1]}`}</Th>
            {VALORES.map((i) => {
              const celda = c.matriz.find((x) => x.probabilidad === p && x.impacto === i);
              if (!celda) return <Td key={i}>—</Td>;
              return (
                <Td key={i}>
                  <div aria-label={t.celdaAria(p, i, t.niveles[celda.nivel], celda.cantidad)} className="flex flex-col gap-1">
                    <Badge tono={TONO[celda.nivel]}>{t.celda(t.niveles[celda.nivel], celda.puntaje)}</Badge>
                    <span className="text-fg">{t.celdaRiesgos(celda.cantidad)}</span>
                  </div>
                </Td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const PantallaCriterios = ({ empresa, persona, criterios: c, aviso = null }: PropsCriterios) => {
  const puedeGestionar = persona.roles.includes('administrador_sig');
  return (
    <MarcoApp empresa={empresa} activo="criterios" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
      <p className="mb-2 max-w-3xl text-sm text-fg-muted">{t.ayuda}</p>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{t.advertencia}</p>
      <AvisoDeEscritura aviso={aviso} />
      {!puedeGestionar && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}

      {c.origen === 'omision' ? (
        <div className="mb-6 max-w-3xl">
          <Alert anunciar={false} tono="warning" titulo={t.rotuloOmision}>
            {t.rotuloOmisionAyuda}
          </Alert>
        </div>
      ) : (
        <p className="mb-6 text-sm text-fg">
          <Badge tono="success">{t.rotuloEmpresa(c.version)}</Badge> {c.creadoEn ? t.guardadosEl(dia(c.creadoEn)) : ''}
        </p>
      )}
      <p className="mb-6 text-sm font-medium text-fg">{c.nivelAceptacion ? t.nivelAceptacionValor(t.niveles[c.nivelAceptacion]) : t.nivelAceptacionSin}</p>

      <h2 className="mb-1 text-xl font-semibold text-fg">{t.matriz}</h2>
      <p className="mb-1 max-w-3xl text-sm text-fg-muted">{t.matrizAyuda}</p>
      <p className="mb-3 text-sm text-fg-muted">{t.totalRiesgos(c.riesgosVigentes)}</p>
      <div className="mb-8">
        <MatrizCriterios criterios={c} />
      </div>

      {puedeGestionar && (
        <Card aria-labelledby="form-criterios">
          <CardTitle id="form-criterios">{t.formulario}</CardTitle>
          <p className="mb-3 max-w-3xl text-sm text-fg-muted">{t.obligatorios}</p>
          <form method="post" action={`/e/${empresa.id}/criterios/guardar`} className="grid max-w-4xl gap-6">
            <input type="hidden" name="version" value={c.version} />
            <div className="grid gap-6 md:grid-cols-2">
              {([['probabilidad', t.ejeProbabilidad, c.probabilidad], ['impacto', t.ejeImpacto, c.impacto]] as const).map(([nombre, etiqueta, valores]) => (
                <fieldset key={nombre} className="flex flex-col gap-3">
                  <legend className="mb-1 text-base font-semibold text-fg">{etiqueta}</legend>
                  {VALORES.map((n) => (
                    <div key={n} className="flex flex-col gap-1.5">
                      <Label htmlFor={`${nombre}-${n}`}>{`${t.descripcionDe(etiqueta, n)} ${t.obligatorio}`}</Label>
                      <Input id={`${nombre}-${n}`} name={`${nombre}_${n}`} required maxLength={200} defaultValue={valores[n - 1]} />
                    </div>
                  ))}
                </fieldset>
              ))}
            </div>
            <div className="flex max-w-md flex-col gap-1.5">
              <Label htmlFor="nivel-aceptacion">{`${t.nivelAceptacion} ${t.obligatorio}`}</Label>
              <Select id="nivel-aceptacion" name="nivelAceptacion" required defaultValue={c.nivelAceptacion ?? 'medio'} aria-describedby="nivel-aceptacion-ayuda">
                {NIVELES_CRITERIO.map((n) => (
                  <option key={n} value={n}>
                    {t.niveles[n]}
                  </option>
                ))}
              </Select>
              <p id="nivel-aceptacion-ayuda" className="text-sm text-fg-muted">
                {t.nivelAceptacionAyuda}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div>
                <Button type="submit">{t.guardar}</Button>
              </div>
              <p className="text-sm text-fg-muted">{t.guardarAyuda}</p>
            </div>
          </form>
        </Card>
      )}
    </MarcoApp>
  );
};
