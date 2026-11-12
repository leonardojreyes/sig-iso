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
  experimental: {
    // El proxy (que protege /e/<empresa>/…) recibe también las subidas de evidencias. Por omisión Next solo conserva los primeros 10 MB del
    // cuerpo de una petición que pasa por un proxy y TRUNCA el resto sin avisar: una evidencia de más de 10 MB llegaría cortada. La API
    // acepta hasta 25 MB por archivo (más los campos de texto): este tope deja pasar eso y nada más.
    proxyClientMaxBodySize: '27mb',
  },
  async headers() {
    return [
      { source: '/:path*', headers: cabeceras },
      // Las pantallas internas nunca se guardan en caché: «atrás» tras cerrar sesión no debe mostrar datos (H1.4).
      { source: '/e/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};
