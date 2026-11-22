# Farmer Saathi Project Directory & Architecture Guide

This document outlines the organization, purpose, and contents of each directory across the repository.

```
Farmer/
├── .github/                      # GitHub Actions CI/CD workflows
│   └── workflows/ci.yml         # Automated unit testing, build, and docker verification
├── .vscode/                      # Editor settings and launch configurations
├── client/                       # Frontend Single Page Application (SPA)
│   ├── public/                   # Static public assets (icons, manifest)
│   ├── src/                      # React 18 + Vite source code
│   │   ├── app/                  # Application router and shell
│   │   ├── components/           # Reusable UI components and widgets
│   │   ├── config/               # Frontend configuration and API URLs
│   │   ├── hooks/                # Custom React hooks
│   │   ├── pages/                # Route views (Dashboard, AI Advisor, Mandi, Schemes)
│   │   ├── services/             # Client HTTP API calls, Web Audio API, notifications
│   │   └── styles/               # Tailwind CSS and global style definitions
│   ├── package.json              # Client workspace dependencies
│   └── vite.config.js            # Vite build configuration
├── server/                       # Backend REST API Service
│   ├── scripts/                  # Database migration and health check runner scripts
│   ├── src/                      # Express.js ES module source code
│   │   ├── config/               # Environment, database pool, and languages config
│   │   ├── middleware/           # JWT authentication, CSRF, and rate limiters
│   │   ├── models/               # Data queries and schema mappers
│   │   ├── routes/               # Modular Express routers (/auth, /voice, /schemes, etc.)
│   │   ├── services/             # External services (Groq AI, Sarvam AI, Kafka, FCM)
│   │   ├── utils/                # HTTP error abstractions and crypto helpers
│   │   ├── app.js                # Express app setup and route mounting
│   │   └── server.js             # Server lifecycle, Redis connection, and graceful shutdown
│   ├── test/                     # Node.js built-in automated test suite (120+ tests)
│   └── package.json              # Server workspace dependencies
├── shared/                       # Shared modules between client and server
│   └── languages.js              # Language metadata, Indic scripts, and speech cleaners
├── database/                     # Relational database resources
│   └── migrations/               # Sequential PostgreSQL migration SQL scripts (001-007)
├── k8s/                          # Kubernetes enterprise orchestration manifests
│   ├── configmap.yaml            # Environment variable configuration map
│   ├── secret.yaml.example       # Secrets and API credentials template
│   ├── deployment.yaml           # Deployment spec with health probes and anti-affinity
│   ├── service.yaml              # LoadBalancer and cluster routing service
│   ├── ingress.yaml              # NGINX ingress routing rules
│   ├── hpa.yaml                  # Horizontal Pod Autoscaler (2 to 10 replicas)
│   ├── pdb.yaml                  # Pod Disruption Budget (zero-downtime guarantees)
│   ├── postgres.yaml             # PostgreSQL StatefulSet and PVC
│   ├── redis.yaml                # Redis Deployment and Service
│   ├── kafka.yaml                # Apache Kafka StatefulSet (KRaft mode)
│   └── kustomization.yaml        # Single-command bundle configuration
├── deploy/                       # Deployment configurations
│   └── nginx.conf                # Production reverse-proxy configuration
├── postman/                      # Postman API testing collection and environment
│   ├── Farmer_Saathi_Postman_Collection.json  # Complete 10-folder API collection
│   ├── Farmer_Saathi_Postman_Environment.json # Environment configuration (baseUrl, jwt)
│   └── README.md                              # Postman setup and testing guide
├── docs/                         # Project architecture, plans, and specifications
│   ├── ARCHITECTURE.md           # This architecture guide
│   ├── spec.md                   # Full product requirements and technical specs
│   └── postgres-migration-plan.md# Migration roadmap and standalone database plan
├── scripts/                      # Developer and DevOps verification scripts
│   ├── verify-k8s-docker.mjs     # Automated validator for Docker and Kubernetes files
│   └── sarvam-chat.mjs           # Quick verification script for Sarvam AI
├── docker-compose.yml            # Multi-service local/production container stack
├── Dockerfile                    # Multi-stage production container build (Node 22 Alpine)
├── .dockerignore                 # Excluded build artifacts for Docker context
├── .gitattributes                # Cross-platform LF line ending normalization
├── .gitignore                    # Git exclusions
├── package.json                  # Root npm workspace orchestrator
└── README.md                     # Main repository documentation
```
