// Escritura de los criterios desde la web (ADR 038). La web NO decide nada: reenvía a la API (que autoriza, valida y registra en la
// bitácora) con el token de la sesión; la empresa y la persona salen del token. Solo se arma un cuerpo con una lista cerrada de campos.
import { campo, opcional, reenviar, type Entrada } from '../certificacion/escribir';
import { NIVELES_CRITERIO } from './tipos';

const DESCRIPCION_MAX = 200;

/** Las cinco descripciones de un eje (`probabilidad_1` … `probabilidad_5`), con texto y acotadas; `null` si alguna falta o es larga. */
const eje = (f: FormData, nombre: string): string[] | null => {
  const salida: string[] = [];
  for (const n of [1, 2, 3, 4, 5]) {
    const v = opcional(f, `${nombre}_${n}`);
    if (!v || v.length > DESCRIPCION_MAX) return null;
    salida.push(v);
  }
  return salida;
};

export const guardarCriterios = (peticion: Request, entrada: Entrada): Promise<Response> =>
  reenviar(peticion, entrada, {
    pantalla: 'criterios',
    volverA: () => 'criterios',
    metodoApi: 'PUT',
    rutaApi: '/criterios',
    exito: 'criterios_guardados',
    cuerpo: (f) => {
      const probabilidad = eje(f, 'probabilidad');
      const impacto = eje(f, 'impacto');
      const nivel = campo(f, 'nivelAceptacion');
      const version = campo(f, 'version');
      if (!probabilidad || !impacto || !nivel || !(NIVELES_CRITERIO as readonly string[]).includes(nivel) || version === null || !/^(0|[1-9]\d{0,8})$/.test(version)) return null;
      return { probabilidad, impacto, nivelAceptacion: nivel, versionEsperada: Number(version) };
    },
  });
