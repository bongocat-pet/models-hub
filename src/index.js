import { createManifest } from './catalog.js';

const MANIFEST_CACHE = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800';
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const cors = corsHeaders(env.ALLOWED_ORIGIN || '*');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!['GET', 'HEAD'].includes(request.method)) {
      return json({ error: 'Method not allowed' }, 405, cors, request.method, { Allow: 'GET, HEAD, OPTIONS' });
    }
    if (url.pathname === '/' || url.pathname === '/health') {
      return json(url.pathname === '/health' ? { status: 'ok' } : {
        name: 'models-hub', version: 'v1', manifest: '/models.json',
      }, 200, cors, request.method);
    }
    if (url.pathname === '/models.json') {
      return json(createManifest(url.origin), 200, cors, request.method, { 'Cache-Control': MANIFEST_CACHE });
    }
    if (url.pathname.startsWith('/avatars/') || url.pathname.startsWith('/previews/')) {
      return serveAsset(request, env, cors);
    }
    return json({ error: 'Not found' }, 404, cors, request.method);
  },
};

async function serveAsset(request, env, cors) {
  if (!env.ASSETS?.fetch) return json({ error: 'Asset binding unavailable' }, 503, cors, request.method);
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', response.ok ? IMMUTABLE_CACHE : 'no-store');
  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status, statusText: response.statusText, headers,
  });
}

function json(payload, status, cors, method = 'GET', extra = {}) {
  return new Response(method === 'HEAD' ? null : JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...cors,
      ...extra,
    },
  });
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
