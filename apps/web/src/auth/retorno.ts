// Destino de retorno tras el ingreso (ADR 027): solo rutas relativas del propio sitio. Cualquier otra cosa vuelve a la
// ruta por omisión, sin avisar de qué se rechazó (evita servir de redirección abierta o de oráculo).

export const RETORNO_POR_OMISION = '/';
const LARGO_MAXIMO = 1024;

// Caracteres de control (incluidos tabulación y saltos de línea, que el navegador ignora dentro de una URL).
const CONTROL = /[\u0000-\u001f\u007f]/;
// Barra y barra invertida codificadas, también con doble codificación: abrirían un `//` o `\\` después de decodificar.
const BARRA_CODIFICADA = /%(?:25)?(?:2f|5c)/i;

export const rutaDeRetornoSegura = (valor: unknown, origenPropio: string): string => {
  if (typeof valor !== 'string' || valor.length === 0 || valor.length > LARGO_MAXIMO) return RETORNO_POR_OMISION;
  if (CONTROL.test(valor) || valor.includes('\\') || BARRA_CODIFICADA.test(valor)) return RETORNO_POR_OMISION;
  if (!valor.startsWith('/') || valor.startsWith('//')) return RETORNO_POR_OMISION;

  let destino: URL;
  let origen: string;
  try {
    origen = new URL(origenPropio).origin;
    destino = new URL(valor, origen);
  } catch {
    return RETORNO_POR_OMISION;
  }
  if (destino.origin !== origen) return RETORNO_POR_OMISION;
  const ruta = `${destino.pathname}${destino.search}${destino.hash}`;
  // Tras normalizar los puntos (`/..//x`) no puede quedar un esquema relativo.
  if (ruta.startsWith('//') || ruta.startsWith('/\\')) return RETORNO_POR_OMISION;
  return ruta;
};
