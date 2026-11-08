const cabeceras = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  agentRules: false,
  transpilePackages: ['@sig/ui', '@sig/tokens'],
  async headers() {
    return [
      { source: '/:path*', headers: cabeceras },
      // Las pantallas internas nunca se guardan en caché: «atrás» tras cerrar sesión no debe mostrar datos (H1.4).
      { source: '/e/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};
