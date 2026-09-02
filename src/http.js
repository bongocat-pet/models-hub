export function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function jsonResponse(payload, status, cors, method = 'GET', extra = {}) {
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

export function redirectResponse(destination, cors) {
  return new Response(null, {
    status: 302,
    headers: { ...cors, 'Cache-Control': 'no-store', Location: destination },
  });
}
