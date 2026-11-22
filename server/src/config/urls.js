import './env.js';

export function getClientUrl() {
  const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  const configuredOrigin = process.env.CLIENT_ORIGIN?.split(',')[0]?.trim();
  const clientUrl = process.env.CLIENT_URL?.trim() || configuredOrigin || vercelOrigin ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');
  if (!clientUrl) throw new Error('Set CLIENT_URL to the frontend URL before sending verification emails.');

  let url;
  try {
    url = new URL(clientUrl);
  } catch {
    throw new Error('CLIENT_URL must be an absolute HTTP or HTTPS frontend URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('CLIENT_URL must be an HTTP or HTTPS origin without credentials, path, query, or fragment.');
  }
  return url.origin;
}
