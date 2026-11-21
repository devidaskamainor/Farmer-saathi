export function normalizeNeonSslMode(connectionString) {
  const url = new URL(connectionString);
  const hostname = url.hostname.toLowerCase();
  const neon = hostname === 'neon.tech' || hostname.endsWith('.neon.tech');
  const sslMode = url.searchParams.get('sslmode')?.toLowerCase();
  if (neon && ['prefer', 'require', 'verify-ca'].includes(sslMode)) {
    url.searchParams.set('sslmode', 'verify-full');
  }
  return url.toString();
}
