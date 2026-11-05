// Compila los tokens W3C (DTCG) a CSS y a un JSON con los valores resueltos (para pruebas de contraste).
// Style Dictionary resuelve las referencias {palette.x.y}; el CSS lo emitimos nosotros (claro, oscuro y preferencia del sistema).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import StyleDictionary from 'style-dictionary';

const aqui = import.meta.dirname;
const dist = join(aqui, 'dist');
mkdirSync(dist, { recursive: true });

const resolver = async (archivos) => {
  const sd = new StyleDictionary({
    source: archivos.map((f) => join(aqui, 'tokens', f)),
    platforms: { css: { transformGroup: 'css', buildPath: join(dist, '/') } },
    log: { verbosity: 'silent' },
  });
  const tokens = await sd.getPlatformTokens('css');
  const salida = {};
  const recorrer = (nodo, ruta = []) => {
    if (nodo && typeof nodo === 'object' && '$value' in nodo) {
      salida[ruta.join('.')] = Array.isArray(nodo.$value) ? nodo.$value.join(', ') : String(nodo.$value);
    } else if (nodo && typeof nodo === 'object') {
      for (const [k, v] of Object.entries(nodo)) if (!k.startsWith('$')) recorrer(v, [...ruta, k]);
    }
  };
  recorrer(tokens.tokens ?? tokens);
  return salida;
};

const claro = await resolver(['base.tokens.json', 'light.tokens.json']);
const oscuro = await resolver(['base.tokens.json', 'dark.tokens.json']);

const nombreVar = (clave) => `--sig-${clave.replace(/^color\./, 'color-').replace(/\./g, '-')}`;
const emitir = (mapa, filtro) =>
  Object.entries(mapa)
    .filter(([k]) => filtro(k))
    .map(([k, v]) => `  ${nombreVar(k)}: ${v};`)
    .join('\n');

const semantico = (k) => !k.startsWith('palette.');
const soloColores = (k) => k.startsWith('color.');

const css = `/* GENERADO por packages/tokens/build.mjs — no editar a mano. */
:root {
${emitir(claro, semantico)}
  color-scheme: light;
}
[data-theme='dark'] {
${emitir(oscuro, soloColores)}
  color-scheme: dark;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${emitir(oscuro, soloColores).replace(/^/gm, '  ')}
    color-scheme: dark;
  }
}
`;
writeFileSync(join(dist, 'tokens.css'), css);
writeFileSync(join(dist, 'tokens.resolved.json'), JSON.stringify({ claro, oscuro }, null, 2));
console.log(`tokens: ${Object.keys(claro).length} claro, ${Object.keys(oscuro).length} oscuro -> dist/tokens.css`);
