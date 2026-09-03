import { createManifest } from './catalog.js';
import { corsHeaders, jsonResponse } from './http.js';
import { addModelStats } from './model-stats.js';
import { createDesktopReleaseManifest } from './desktop/release-manifest.js';
import { handleTrackedRedirect } from './tracked-redirect.js';

const MANIFEST_CACHE = 'public, max-age=60, s-maxage=60, stale-while-revalidate=3600, stale-if-error=86400';
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const cors = corsHeaders(env.ALLOWED_ORIGIN || '*');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!['GET', 'HEAD'].includes(request.method)) {
      return jsonResponse({ error: 'Method not allowed' }, 405, cors, request.method, { Allow: 'GET, HEAD, OPTIONS' });
    }
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse(url.pathname === '/health' ? { status: 'ok' } : {
        name: 'models-hub', version: 'v1', manifest: '/models.json',
      }, 200, cors, request.method);
    }
    if (url.pathname === '/models.json') {
      const manifest = await addModelStats(createManifest(url.origin, env.R2_PUBLIC_BASE_URL), env.DB);
      return jsonResponse(manifest, 200, cors, request.method, { 'Cache-Control': MANIFEST_CACHE });
    }
    if (url.pathname === '/releases.json') {
      return jsonResponse(
        createDesktopReleaseManifest(env.R2_PUBLIC_BASE_URL),
        200,
        cors,
        request.method,
        { 'Cache-Control': MANIFEST_CACHE },
      );
    }
    if (url.pathname.startsWith('/download/')) {
      return handleTrackedRedirect(request, env, cors, url.pathname.slice('/download/'.length), 'download');
    }
    if (url.pathname.startsWith('/workshop/')) {
      return handleTrackedRedirect(request, env, cors, url.pathname.slice('/workshop/'.length), 'workshop');
    }
    if (url.pathname.startsWith('/avatars/') || url.pathname.startsWith('/previews/')) {
      return serveAsset(request, env, cors);
    }
    return jsonResponse({ error: 'Not found' }, 404, cors, request.method);
  },
};

async function serveAsset(request, env, cors) {
  if (!env.ASSETS?.fetch) return jsonResponse({ error: 'Asset binding unavailable' }, 503, cors, request.method);
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', response.ok ? IMMUTABLE_CACHE : 'no-store');
  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status, statusText: response.statusText, headers,
  });
}
