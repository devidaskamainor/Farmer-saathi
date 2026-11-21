import './config/env.js';
import { closeDatabasePool } from './config/database.js';
import { getVerificationEmailStatus } from './services/email.js';
import { connectRedis, closeCache } from './services/cache.js';

const { default: app } = await import('./app.js');

const port = Number(process.env.PORT) || 4000;
const server = app.listen(port, () => {
  console.info(`Farmer advisory API listening on http://localhost:${port}`);
  connectRedis().catch(() => {});
  const emailStatus = getVerificationEmailStatus();
  if (emailStatus.configured) {
    console.info(`Email verification SMTP settings are present (port ${emailStatus.port}; ${emailStatus.secure ? 'implicit TLS' : 'STARTTLS required'}).`);
  } else {
    console.warn(`Email verification SMTP settings are incomplete. Missing or invalid: ${[...emailStatus.missing, ...emailStatus.invalid].join(', ') || 'none reported'}.`);
  }
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other API process or set PORT to a free port.`);
  } else {
    console.error('The Farmer advisory API could not start.', error);
  }
  process.exitCode = 1;
});

async function shutdown(signal) {
  console.info(`Received ${signal}; shutting down Farmer Saathi API.`);
  server.close(async error => {
    try {
      await closeDatabasePool();
      await closeCache();
      if (error) {
        console.error('The API did not shut down cleanly.', error);
        process.exitCode = 1;
      }
    } catch (closeError) {
      console.error('Could not close resources cleanly.', closeError);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
