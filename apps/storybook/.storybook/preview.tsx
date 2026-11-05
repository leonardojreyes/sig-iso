import '@fontsource-variable/inter';
import '@sig/ui/styles.css';
import { cssMarca, derivarTema } from '@sig/tokens';
import type { Decorator, Preview } from '@storybook/react-vite';

const marcas = {
  'A — SynapTech (verde)': { id: 'a', nombre: 'A', primario: '#0E5C42' },
  'B — Andes (azul)': { id: 'b', nombre: 'B', primario: '#1D4ED8' },
} as const;

const css = Object.values(marcas).map((m) => cssMarca(m.id, derivarTema(m))).join('\n');

const conMarcaYTema: Decorator = (Story, ctx) => {
  const marca = marcas[ctx.globals.empresa as keyof typeof marcas] ?? marcas['A — SynapTech (verde)'];
  document.documentElement.setAttribute('data-theme', ctx.globals.tema === 'oscuro' ? 'dark' : 'light');
  return (
    <div data-empresa={marca.id} className="min-h-40 bg-bg p-6">
      <style>{css}</style>
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [conMarcaYTema],
  initialGlobals: { empresa: 'A — SynapTech (verde)', tema: 'claro' },
  globalTypes: {
    empresa: { description: 'Marca de empresa', toolbar: { icon: 'paintbrush', items: Object.keys(marcas), dynamicTitle: true } },
    tema: { description: 'Modo de color', toolbar: { icon: 'circlehollow', items: ['claro', 'oscuro'], dynamicTitle: true } },
  },
};
export default preview;
