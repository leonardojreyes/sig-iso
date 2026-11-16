'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Envoltorio de un aviso que llega CON la página (por ejemplo, el resultado de enviar un formulario, que recarga la pantalla). Un
 * `role="alert"` que ya está en la página al cargarla no se anuncia de forma fiable; lo que sí se lee es lo que recibe el foco. Por eso
 * el envoltorio toma el foco al montarse. `tabIndex={-1}`: se enfoca por programa pero no entra en el orden del tabulador.
 * Solo un aviso por pantalla debe usarlo (si hay varios, solo este anuncia: ver `Alert anunciar={false}`).
 */
export const AvisoEnfocado = ({
  children,
  etiqueta,
  etiquetadoPor,
  como = 'div',
  className = 'mb-4',
}: {
  children: ReactNode;
  /** Nombre accesible del envoltorio. */
  etiqueta?: string;
  /** O el `id` de un encabezado que lo nombra. */
  etiquetadoPor?: string;
  como?: 'div' | 'section';
  className?: string;
}) => {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const comunes = {
    ref: ref as never,
    tabIndex: -1,
    className: `${className} outline-none`,
    role: 'group' as const,
    ...(etiquetadoPor ? { 'aria-labelledby': etiquetadoPor } : { 'aria-label': etiqueta }),
  };
  return como === 'section' ? <section {...comunes}>{children}</section> : <div {...comunes}>{children}</div>;
};
