'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, BotonEnlace, Button, Campo, Card, Checkbox, Input, Migas, Select, Textarea } from '@sig/ui';
import { normasDemo } from '../datos-demo';
import type { Empresa } from '../empresas';
import { es } from '../i18n/es-EC';
import { MarcoApp } from './marco';

interface Errores { clausula?: string; titulo?: string; guia?: string }

export const validarRequisito = (v: { clausula: string; titulo: string; guia: string }): Errores => {
  const e: Errores = {};
  if (!/^[A-Za-z0-9]+(\.[A-Za-z0-9]+)*$/.test(v.clausula.trim())) e.clausula = es.formulario.errores.clausula;
  if (!v.titulo.trim() || v.titulo.length > 80) e.titulo = es.formulario.errores.titulo;
  if (v.guia.trim().length < 10 || v.guia.length > 600) e.guia = es.formulario.errores.guia;
  return e;
};

/** Pantalla plantilla 4/5: formulario con validación accesible (errores enlazados por aria-describedby). */
export const PantallaFormularioRequisito = ({ empresa }: { empresa: Empresa }) => {
  const t = es.formulario;
  const [errores, setErrores] = useState<Errores>({});
  const [guardado, setGuardado] = useState(false);
  const [guiaLen, setGuiaLen] = useState(0);
  const [intentos, setIntentos] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Tras un envío inválido, el foco va al primer campo con error (WCAG 3.3.1).
  useEffect(() => {
    if (intentos > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [intentos]);

  const enviar = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    const errs = validarRequisito({ clausula: String(d.get('clausula') ?? ''), titulo: String(d.get('titulo') ?? ''), guia: String(d.get('guia') ?? '') });
    setErrores(errs);
    setGuardado(Object.keys(errs).length === 0);
    setIntentos((n) => n + 1);
  };

  return (
    <MarcoApp empresa={empresa} activo="requisitos">
      <Migas items={[{ texto: es.nav.requisitos, href: `/e/${empresa.id}/requisitos` }, { texto: t.titulo }]} />
      <h1 className="mb-6 mt-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
      <Card className="max-w-2xl">
        <form ref={formRef} noValidate onSubmit={enviar} aria-label={t.titulo} className="flex flex-col gap-5">
          <p className="text-sm text-fg-muted">{t.obligatorios}</p>
          <div role="status">{guardado && <Alert tono="success" titulo={t.exito}>{t.exitoDetalle}</Alert>}</div>
          <div role="alert">{Object.keys(errores).length > 0 && <Alert tono="danger" titulo={t.resumenErrores(Object.keys(errores).length)} />}</div>
          <Campo etiqueta={t.norma} requerido>{(p) => (<Select name="norma" {...p}>{normasDemo.map((n) => (<option key={n}>{n}</option>))}</Select>)}</Campo>
          <Campo etiqueta={t.clausula} ayuda={t.clausulaAyuda} error={errores.clausula} requerido>{(p) => <Input name="clausula" {...p} />}</Campo>
          <Campo etiqueta={t.tituloCampo} ayuda={t.tituloAyuda} error={errores.titulo} requerido>{(p) => <Input name="titulo" maxLength={120} {...p} />}</Campo>
          <Campo etiqueta={t.guia} ayuda={`${t.guiaAyuda} (${guiaLen}/600)`} error={errores.guia} requerido>
            {(p) => <Textarea name="guia" onChange={(e) => setGuiaLen(e.target.value.length)} {...p} />}
          </Campo>
          <div className="flex items-center gap-3">
            <Checkbox id="aplica" name="aplica" defaultChecked />
            <label htmlFor="aplica" className="text-sm text-fg">{t.aplica}</label>
          </div>
          <div className="flex gap-3">
            <Button type="submit">{t.guardar}</Button>
            <BotonEnlace variante="secondary" href={`/e/${empresa.id}/requisitos`}>{t.cancelar}</BotonEnlace>
          </div>
        </form>
      </Card>
    </MarcoApp>
  );
};
