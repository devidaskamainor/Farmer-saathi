# Utility & Verification Scripts

This directory contains automated testing and verification scripts:

- **`verify-k8s-docker.mjs`**: Comprehensive validator that checks Dockerfiles, `docker-compose.yml`, all Kubernetes manifests, non-root security principles, autoscaling configs, and cross-platform line endings.
- **`sarvam-chat.mjs`**: Verification script for Sarvam AI conversation completions and connectivity.

Run all verifications:
```bash
npm run k8s:verify
```
