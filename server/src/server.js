import './config/env.js';
import { exec } from 'node:child_process';
import { closeDatabasePool } from './config/database.js';
import { getVerificationEmailStatus } from './services/email.js';
import { connectRedis, closeCache } from './services/cache.js';

let browserOpened = false;

function autoOpenBrowser(targetUrl) {
  if (
    browserOpened ||
    process.env.NODE_ENV === 'test' ||
    process.env.AUTO_OPEN === 'false' ||
    process.env.CI ||
    process.env.NODE_ENV === 'production'
  ) {
    return;
  }

  browserOpened = true;

  const startCmd =
    process.platform === 'win32'
      ? `start "" "${targetUrl}"`
      : process.platform === 'darwin'
        ? `open "${targetUrl}"`
        : `xdg-open "${targetUrl}"`;

  exec(startCmd, () => {});
}

const { default: app } = await import('./app.js');

const port = Number(process.env.PORT) || 4000;
const host = '0.0.0.0';

const server = app.listen(port, host, () => {
  console.info(`Farmer Saathi API listening on ${host}:${port}`);

  connectRedis().catch(error => {
    console.error('Redis connection failed:', error.message);
  });

  const emailStatus = getVerificationEmailStatus();

  if (emailStatus.configured) {
    console.info(
      `Email verification SMTP settings are present (port ${emailStatus.port}; ${
        emailStatus.secure ? 'implicit TLS' : 'STARTTLS required'
      }).`
    );
  } else {
    console.warn(
      `Email verification SMTP settings are incomplete. Missing or invalid: ${
        [...emailStatus.missing, ...emailStatus.invalid].join(', ') ||
        'none reported'
      }.`
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    autoOpenBrowser(`http://localhost:${port}`);
  }
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use. Stop the other API process or set PORT to a free port.`
    );
  } else {
    console.error('The Farmer Saathi API could not start.', error);
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
