import type { ReactNode } from 'react';
import { es } from '../src/i18n/es-EC';
import './globals.css';

export const metadata = { title: `${es.app.nombre} — SynapTech`, description: es.app.lema };

// Aplica el tema guardado antes del primer pintado para evitar el destello.
const scriptTema = `try{var t=localStorage.getItem('sig-tema');if(t==='claro')document.documentElement.setAttribute('data-theme','light');if(t==='oscuro')document.documentElement.setAttribute('data-theme','dark')}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-EC" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
