'use client';
import { useEffect, useState } from 'react';
import { Select } from '@sig/ui';
import { es } from '../i18n/es-EC';

type Tema = 'sistema' | 'claro' | 'oscuro';
const CLAVE = 'sig-tema';

const aplicar = (t: Tema) => {
  const raiz = document.documentElement;
  if (t === 'sistema') raiz.removeAttribute('data-theme');
  else raiz.setAttribute('data-theme', t === 'claro' ? 'light' : 'dark');
};

export const SelectorTema = () => {
  const [tema, setTema] = useState<Tema>('sistema');

  useEffect(() => {
    const guardado = (localStorage.getItem(CLAVE) as Tema | null) ?? 'sistema';
    setTema(guardado);
  }, []);

  const cambiar = (t: Tema) => {
    setTema(t);
    localStorage.setItem(CLAVE, t);
    aplicar(t);
  };

  return (
    <label className="flex items-center gap-2 text-sm text-fg-muted">
      <span>{es.tema.etiqueta}</span>
      <Select className="h-9 w-auto" value={tema} onChange={(e) => cambiar(e.target.value as Tema)}>
        <option value="sistema">{es.tema.sistema}</option>
        <option value="claro">{es.tema.claro}</option>
        <option value="oscuro">{es.tema.oscuro}</option>
      </Select>
    </label>
  );
};
