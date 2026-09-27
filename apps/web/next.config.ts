import type { NextConfig } from 'next';

/**
 * The website has no backend of its own. `/api/*` is proxied to the shared Edventure API so the
 * API's HttpOnly session cookies are first-party to the website origin.
 */
const configuredOrigin = process.env.EDVENTURE_API_ORIGIN ?? 'http://localhost:4000';
// Render's private network provides `host:port`; traffic inside it is plain HTTP.
const apiOrigin = configuredOrigin.includes('://') ? configuredOrigin : `http://${configuredOrigin}`;

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@edventure/api-client', '@edventure/contracts', '@edventure/design-tokens', '@edventure/i18n'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
