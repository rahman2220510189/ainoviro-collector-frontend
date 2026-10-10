import type { NextConfig } from 'next';

/**
 * UI only (spec §3): no API routes, no server actions. Every page is a client page
 * that talks to the backend through src/lib/api.ts.
 *
 * Hosted (Render): the browser calls /api/v1 on THIS website, and Next passes each call
 * on to the backend (BACKEND_URL). The website and the backend then look like one site to
 * the browser, so the login cookie keeps its strict SameSite=Lax setting; two different
 * onrender.com addresses would count as two sites and the cookie would not be sent.
 * Locally BACKEND_URL is not set and the app calls http://localhost:5000 directly.
 * Rewrites are fixed at build time: BACKEND_URL must be set when building.
 */
const backend = process.env.BACKEND_URL?.replace(/\/+$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The dev-mode badge would cover the sidebar's "Log out" button (bottom left).
  devIndicators: { position: 'bottom-right' },
  experimental: {
    // A sleeping free backend needs up to a minute to wake: wait for it (default 30 s).
    proxyTimeout: 120_000,
  },
  // The start page is the leads list (where the one-click export lives).
  async redirects() {
    return [{ source: '/', destination: '/leads', permanent: false }];
  },
  async rewrites() {
    return backend ? [{ source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` }] : [];
  },
};

export default nextConfig;
