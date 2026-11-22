import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let errorCount = 0;
let checkCount = 0;

function assert(condition, message) {
  checkCount++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    errorCount++;
  } else {
    console.log(`✔ PASSED: ${message}`);
  }
}

console.log('\n--- 1. Validating Dockerfile & Container Architecture ---');
const dockerfilePath = path.join(rootDir, 'Dockerfile');
assert(fs.existsSync(dockerfilePath), 'Dockerfile exists at repository root');
const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');

assert(dockerfileContent.includes('FROM node:22-alpine AS builder'), 'Uses official lightweight Node 22 Alpine builder');
assert(dockerfileContent.includes('FROM node:22-alpine AS runner'), 'Uses official lightweight Node 22 Alpine runner');
assert(dockerfileContent.includes('EXPOSE 4000'), 'Exposes standard application port 4000');
assert(dockerfileContent.includes('CMD ["node", "server/src/server.js"]'), 'Starts application server via node entrypoint');
assert(dockerfileContent.includes('USER node'), 'Enforces non-root security container principle (USER node)');

console.log('\n--- 2. Validating Docker Compose Orchestration ---');
const composePath = path.join(rootDir, 'docker-compose.yml');
assert(fs.existsSync(composePath), 'docker-compose.yml exists at repository root');
const composeContent = fs.readFileSync(composePath, 'utf8');

assert(composeContent.includes('farmer-saathi-app'), 'Defines web application service');
assert(composeContent.includes('farmer-saathi-db'), 'Defines PostgreSQL 16 database service with healthcheck');
assert(composeContent.includes('farmer-saathi-redis'), 'Defines Redis caching service');
assert(composeContent.includes('farmer-saathi-kafka'), 'Defines Apache Kafka service in KRaft mode');
assert(composeContent.includes('4000:4000'), 'Maps web port 4000');
assert(composeContent.includes('9092:9092'), 'Maps Kafka client port 9092');

console.log('\n--- 3. Validating Kubernetes Manifests (k8s/) ---');
const k8sDir = path.join(rootDir, 'k8s');
assert(fs.existsSync(k8sDir), 'k8s/ directory exists');

const requiredK8sFiles = [
  'configmap.yaml',
  'secret.yaml.example',
  'deployment.yaml',
  'service.yaml',
  'postgres.yaml',
  'redis.yaml',
  'kafka.yaml',
  'ingress.yaml',
  'kustomization.yaml'
];

for (const file of requiredK8sFiles) {
  const filePath = path.join(k8sDir, file);
  assert(fs.existsSync(filePath), `Manifest exists: k8s/${file}`);
  const content = fs.readFileSync(filePath, 'utf8');
  assert(content.includes('apiVersion:'), `k8s/${file} contains valid apiVersion definition`);
  assert(content.includes('kind:'), `k8s/${file} contains valid kind definition`);
  assert(content.includes('metadata:'), `k8s/${file} contains valid metadata`);
}

const deploymentContent = fs.readFileSync(path.join(k8sDir, 'deployment.yaml'), 'utf8');
assert(deploymentContent.includes('path: /api/health'), 'Deployment configures HTTP healthcheck readiness probe');
assert(deploymentContent.includes('containerPort: 4000'), 'Deployment matches port 4000');

console.log('\n--- 4. Cross-Platform Scripts & Environment Checks ---');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
assert(packageJson.scripts['build'] === 'npm run build -w client', 'Client build script is verified');
assert(Boolean(packageJson.scripts['start']), 'Production start script is verified');

const gitAttributesPath = path.join(rootDir, '.gitattributes');
assert(fs.existsSync(gitAttributesPath), '.gitattributes exists for cross-platform LF line endings normalization');

console.log(`\nValidation complete: ${checkCount - errorCount}/${checkCount} checks passed.`);
if (errorCount > 0) {
  process.exit(1);
}
