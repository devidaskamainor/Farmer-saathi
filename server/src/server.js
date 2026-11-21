import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../');
dotenv.config({ path: resolve(projectRoot, '.env') });
const { default: app } = await import('./app.js');

const port = Number(process.env.PORT) || 4000;
const server = app.listen(port, () => console.info(`Farmer advisory API listening on http://localhost:${port}`));

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other API process or set PORT to a free port.`);
  } else {
    console.error('The Farmer advisory API could not start.', error);
  }
  process.exitCode = 1;
});
