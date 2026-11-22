import client from 'prom-client';

// Create a dedicated Prometheus Registry
export const registry = new client.Registry();

// Set default labels across all metrics
registry.setDefaultLabels({
  app: 'farmer-saathi',
  env: process.env.NODE_ENV || 'development'
});

// Automatically collect Node.js runtime & system performance metrics
client.collectDefaultMetrics({
  register: registry,
  prefix: 'farmer_saathi_'
});

// 1. Total HTTP Requests Counter
export const httpRequestCounter = new client.Counter({
  name: 'farmer_saathi_http_requests_total',
  help: 'Total number of HTTP requests processed by Farmer Saathi API',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry]
});

// 2. HTTP Request Duration Histogram (Latency & Response Times)
export const httpRequestDurationHistogram = new client.Histogram({
  name: 'farmer_saathi_http_request_duration_seconds',
  help: 'Histogram of HTTP request processing duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry]
});

// 3. Active Concurrent Connections Gauge
export const httpActiveConnectionsGauge = new client.Gauge({
  name: 'farmer_saathi_http_active_connections',
  help: 'Current count of active concurrent HTTP connections',
  registers: [registry]
});

// 4. Agricultural AI Advisory Metrics
export const aiRequestsCounter = new client.Counter({
  name: 'farmer_saathi_ai_requests_total',
  help: 'Total number of Groq AI agricultural advisory & translation requests',
  labelNames: ['task', 'status', 'language'],
  registers: [registry]
});

// 5. Sarvam AI Voice TTS & STT Metrics
export const voiceOperationsCounter = new client.Counter({
  name: 'farmer_saathi_voice_operations_total',
  help: 'Total number of Indic voice synthesis and speech-to-text operations',
  labelNames: ['operation', 'language', 'status'],
  registers: [registry]
});

// 6. APMC Mandi Market Queries
export const mandiQueriesCounter = new client.Counter({
  name: 'farmer_saathi_mandi_queries_total',
  help: 'Total count of APMC mandi market price searches',
  labelNames: ['status'],
  registers: [registry]
});

/**
 * Normalize express route paths to prevent high-cardinality metric explosion
 */
function normalizeRoute(path) {
  if (!path) return 'unknown';
  return path
    .replace(/\/[a-f0-9]{24}\b/gi, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '/:id')
    .replace(/\/\d+\b/g, '/:id')
    .split('?')[0];
}

/**
 * Express Middleware for automated HTTP request observability
 */
export function metricsMiddleware(req, res, next) {
  // Don't track the metrics endpoint itself to keep scrape overhead zero
  if (req.path === '/api/metrics' || req.path === '/metrics') {
    return next();
  }

  httpActiveConnectionsGauge.inc();
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    httpActiveConnectionsGauge.dec();
    const endTime = process.hrtime.bigint();
    const durationSeconds = Number(endTime - startTime) / 1e9;

    const route = normalizeRoute(req.baseUrl ? `${req.baseUrl}${req.path}` : req.path);
    const method = req.method;
    const statusCode = String(res.statusCode || 200);

    httpRequestCounter.inc({ method, route, status_code: statusCode });
    httpRequestDurationHistogram.observe({ method, route, status_code: statusCode }, durationSeconds);
  });

  next();
}

/**
 * Return Prometheus metrics payload
 */
export async function getMetrics() {
  return registry.metrics();
}

/**
 * Return Prometheus content type header
 */
export function getContentType() {
  return registry.contentType;
}
