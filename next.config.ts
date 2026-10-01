import type { NextConfig } from 'next';

/**
 * UI only (spec §3): no API routes, no server actions. Every page is a client page
 * that talks to the backend through src/lib/api.ts.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The dev-mode badge would cover the sidebar's "Log out" button (bottom left).
  devIndicators: { position: 'bottom-right' },
  // The start page is the leads list (where the one-click export lives).
  async redirects() {
    return [{ source: '/', destination: '/leads', permanent: false }];
  },
};

export default nextConfig;
