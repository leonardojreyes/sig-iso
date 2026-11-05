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
    return [{ source: '/:path*', headers: cabeceras }];
  },
};
