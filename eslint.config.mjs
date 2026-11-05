import nx from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';

// Librerías que pertenecen a `infrastructure`: el dominio y la aplicación llegan a ellas solo por puertos.
const infraestructura = ['kysely', 'kysely/*', 'jose', 'ajv', 'ajv/*', 'yaml', '@sig/tenancy/contexto'];

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/next-env.d.ts', '**/coverage/**', '.nx/**'] },
  ...tseslint.configs.recommended,
  {
    plugins: { '@nx': nx },
    rules: {
      // P1: límites entre proyectos del monorepo
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: false,
          allow: [],
          depConstraints: [
            { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:module', 'type:platform', 'type:package'] },
            { sourceTag: 'type:module', onlyDependOnLibsWithTags: ['type:platform', 'type:package'] },
            { sourceTag: 'type:platform', onlyDependOnLibsWithTags: ['type:package'] },
            { sourceTag: 'type:package', onlyDependOnLibsWithTags: ['type:package'] },
          ],
        },
      ],
    },
  },
  // P2: arquitectura hexagonal dentro de cada módulo
  {
    files: ['modules/*/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/application/**', '**/infrastructure/**', '**/interface/**'], message: 'El dominio no depende de otras capas.' },
            { group: ['@nestjs/*', 'next', 'next/*', 'react', 'pg', 'openai', 'ollama'], message: 'El dominio no conoce frameworks, BD ni proveedores de IA.' },
            { group: infraestructura, message: 'El dominio no importa librerías de infraestructura (BD, tokens, validadores, archivos YAML).' },
            { group: ['node:*'], message: 'El dominio no usa módulos de Node (archivos, red, contexto asíncrono).' },
          ],
        },
      ],
    },
  },
  {
    files: ['modules/*/src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/infrastructure/**', '**/interface/**'], message: 'La aplicación depende solo del dominio y de puertos.' },
            { group: ['@nestjs/*', 'next', 'next/*', 'react'], message: 'La aplicación no conoce frameworks.' },
            { group: infraestructura, message: 'La aplicación no importa librerías de infraestructura: usa un puerto y su adaptador.' },
            { group: ['node:*'], message: 'La aplicación no usa módulos de Node: usa un puerto y su adaptador.' },
          ],
        },
      ],
    },
  },
  {
    files: ['modules/*/src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/interface/**'], message: 'Infraestructura no depende de la interfaz.' }] }],
    },
  },
);
