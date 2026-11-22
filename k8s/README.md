# Kubernetes Deployment Guide for Farmer Saathi

This directory contains production-ready Kubernetes manifests designed for high availability, automatic scaling, and zero-downtime rolling updates.

## Manifest Overview

| File | Resource | Description |
| :--- | :--- | :--- |
| `configmap.yaml` | `ConfigMap` | Non-sensitive configurations (`NODE_ENV`, `PORT`, `KAFKA_BROKERS`, `CLIENT_ORIGIN`) |
| `secret.yaml.example` | `Secret` | Credentials template (Database, JWT, AI keys, Firebase FCM) |
| `postgres.yaml` | `StatefulSet` + `PVC` | Persistent PostgreSQL 16 database with health check |
| `redis.yaml` | `Deployment` + `Service`| Redis 7 in-memory cache |
| `kafka.yaml` | `StatefulSet` + `Service`| Apache Kafka message queue in KRaft mode |
| `deployment.yaml` | `Deployment` | Farmer Saathi application with anti-affinity, startup/liveness/readiness probes |
| `service.yaml` | `Service` | LoadBalancer exposing application port 80 & 4000 |
| `ingress.yaml` | `Ingress` | NGINX Ingress rules with body size & timeout configs |
| `hpa.yaml` | `HorizontalPodAutoscaler` | Auto-scales pods from 2 to 10 replicas under high load |
| `pdb.yaml` | `PodDisruptionBudget` | Guarantees at least 1 replica is always serving users |
| `kustomization.yaml` | `Kustomization` | Bundles all resources for single-command deploy |

## One-Command Deployment

```bash
# 1. Copy and configure secrets
cp secret.yaml.example secret.yaml
# Edit secret.yaml with your production database credentials and API keys

# 2. Deploy the complete stack
kubectl apply -k .

# 3. Verify pod status
kubectl get pods -w

# 4. View autoscaling metrics
kubectl get hpa
```
