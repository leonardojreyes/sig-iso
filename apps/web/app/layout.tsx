import type { ReactNode } from 'react';

export const metadata = { title: 'sig-iso — SynapTech', description: 'Sistema de Gestión Integrado ISO' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-EC">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, color: '#1a1a1a' }}>{children}</body>
    </html>
  );
}
