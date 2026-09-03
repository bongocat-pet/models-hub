import { findModel, publicDownloadUrl } from './catalog.js';
import { jsonResponse, redirectResponse } from './http.js';
import { recordModelEventSafely } from './model-stats.js';

const DEFAULT_R2_PUBLIC_BASE_URL = 'https://downloads.bongocat.pet';

export async function handleTrackedRedirect(request, env, cors, encodedModelId, eventType) {
  const modelId = decodeModelId(encodedModelId);
  if (!modelId) return jsonResponse({ error: 'Invalid model id' }, 400, cors, request.method);

  const model = findModel(modelId);
  if (!model) return jsonResponse({ error: 'Model not found' }, 404, cors, request.method);

  const destination = eventDestination(model, eventType, env.R2_PUBLIC_BASE_URL);
  if (!destination) return jsonResponse({ error: 'Download unavailable' }, 404, cors, request.method);

  if (request.method === 'GET') {
    const ipHash = await hashClientIp(request, env.IP_HASH_SECRET);
    await recordModelEventSafely(env.DB, model.id, eventType, ipHash);
  }
  return redirectResponse(destination, cors);
}

async function hashClientIp(request, secret = '') {
  const ip = request.headers.get('CF-Connecting-IP')?.trim();
  if (!ip) return '';

  try {
    const input = new TextEncoder().encode(`${String(secret)}:${ip}`);
    const digest = await crypto.subtle.digest('SHA-256', input);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Unable to hash client IP', error);
    return '';
  }
}

function decodeModelId(encodedModelId) {
  try {
    return decodeURIComponent(encodedModelId);
  } catch {
    return '';
  }
}

function eventDestination(model, eventType, configuredR2Base) {
  if (eventType === 'workshop') return model.fullVersionUrl;
  if (model.repositoryKey.endsWith('-custom')) return undefined;
  return publicDownloadUrl(
    configuredR2Base || DEFAULT_R2_PUBLIC_BASE_URL,
    model.repositoryKey,
    model.downloadFilename,
  );
}
