import app from '../server/src/app.js';

export default function handler(req, res) {
  // Normalize request URL for the Express router when hosted on Vercel Serverless
  const matchedPath = req.headers['x-matched-path'] || req.url || '/api/health';
  let normalizedUrl = matchedPath;

  if (!normalizedUrl.startsWith('/api')) {
    normalizedUrl = '/api' + (normalizedUrl.startsWith('/') ? normalizedUrl : '/' + normalizedUrl);
  }

  // Strip rewrite artifact suffix like /api/index.js
  normalizedUrl = normalizedUrl.replace(/^\/api\/index\.js(\?|\/|$)/, (_match, sep) => {
    return '/api' + (sep === '/' ? '/' : sep === '?' ? '?' : '');
  });

  if (normalizedUrl === '/api' || normalizedUrl === '/api/') {
    normalizedUrl = '/api/health';
  }

  req.url = normalizedUrl;
  return app(req, res);
}
