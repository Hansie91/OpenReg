# Deployment Guide

This guide covers deploying OpenReg to production environments, from single-server Docker Compose to Kubernetes clusters.

---

## Prerequisites

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16+ GB |
| Storage | 50 GB SSD | 200+ GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements

- Docker 20.10+ and Docker Compose 2.0+
- (For Kubernetes) kubectl 1.24+, Helm 3.0+
- Git for cloning the repository

---

## Environment Configuration

All configuration is done through environment variables. Copy `.env.example` to `.env` and configure:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | JWT signing key (min 32 chars) | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Fernet key for credentials | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `POSTGRES_PASSWORD` | Database password | Strong random password |
| `MINIO_ROOT_PASSWORD` | MinIO admin password | Strong random password |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `development` | `development`, `staging`, `production` |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `WORKER_MAX_EXECUTION_TIME` | `3600` | Max report execution time (seconds) |
| `WORKER_MAX_MEMORY_MB` | `4096` | Max worker memory (MB) |

---

## Docker Compose Deployment

Best for single-server or small team deployments.

### Quick Start

```bash
# Clone repository
git clone https://github.com/Hansie91/OpenReg.git
cd OpenReg

# Configure environment
cp .env.example .env
# Edit .env with production values

# Start all services
docker-compose up -d

# Initialize database (first time only)
docker-compose exec backend python init_db.py

# View logs
docker-compose logs -f
```

### Production Hardening

1. **Use external database** (optional):
   ```yaml
   # In docker-compose.override.yml
   services:
     backend:
       environment:
         DATABASE_URL: postgresql://user:pass@external-host:5432/openreg
   ```

2. **Enable TLS** (see [TLS Setup](#tls-setup) below)

3. **Resource limits**:
   ```yaml
   services:
     worker:
       deploy:
         resources:
           limits:
             cpus: '2'
             memory: 4G
   ```

---

## Kubernetes Deployment

For production clusters with high availability requirements.

### Architecture

```mermaid
graph TB
    subgraph "Ingress"
        ING[Ingress Controller]
    end

    subgraph "Application"
        FE[Frontend Pods]
        API[Backend Pods]
        WORKER[Worker Pods]
        BEAT[Beat Pod]
    end

    subgraph "Data"
        PG[(PostgreSQL)]
        REDIS[(Redis)]
        MINIO[(MinIO)]
    end

    ING --> FE
    ING --> API
    API --> PG
    API --> REDIS
    API --> MINIO
    WORKER --> PG
    WORKER --> REDIS
    WORKER --> MINIO
    BEAT --> REDIS
```

### Example Manifests

#### Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: openreg
```

#### ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: openreg-config
  namespace: openreg
data:
  ENVIRONMENT: "production"
  LOG_LEVEL: "INFO"
  CORS_ORIGINS: "https://openreg.example.com"
```

#### Secrets

```yaml
# secrets.yaml (use sealed-secrets or external-secrets in production)
apiVersion: v1
kind: Secret
metadata:
  name: openreg-secrets
  namespace: openreg
type: Opaque
stringData:
  SECRET_KEY: "your-secret-key"
  ENCRYPTION_KEY: "your-encryption-key"
  DATABASE_URL: "postgresql://user:pass@postgres:5432/openreg"
  REDIS_URL: "redis://redis:6379/0"
```

#### Backend Deployment

```yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openreg-backend
  namespace: openreg
spec:
  replicas: 3
  selector:
    matchLabels:
      app: openreg-backend
  template:
    metadata:
      labels:
        app: openreg-backend
    spec:
      containers:
      - name: backend
        image: openreg/backend:latest
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: openreg-config
        - secretRef:
            name: openreg-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: openreg-backend
  namespace: openreg
spec:
  selector:
    app: openreg-backend
  ports:
  - port: 8000
    targetPort: 8000
```

#### Worker Deployment

```yaml
# worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openreg-worker
  namespace: openreg
spec:
  replicas: 2
  selector:
    matchLabels:
      app: openreg-worker
  template:
    metadata:
      labels:
        app: openreg-worker
    spec:
      containers:
      - name: worker
        image: openreg/backend:latest
        command: ["celery", "-A", "worker", "worker", "--loglevel=info"]
        envFrom:
        - configMapRef:
            name: openreg-config
        - secretRef:
            name: openreg-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
```

#### Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: openreg-ingress
  namespace: openreg
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - openreg.example.com
    secretName: openreg-tls
  rules:
  - host: openreg.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: openreg-backend
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: openreg-frontend
            port:
              number: 3000
```

### Applying Manifests

```bash
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f worker-deployment.yaml
kubectl apply -f ingress.yaml
```

---

## TLS Setup

### Docker Compose with Traefik

```yaml
# docker-compose.override.yml
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.le.acme.httpchallenge=true"
      - "--certificatesresolvers.le.acme.email=admin@example.com"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt

  frontend:
    labels:
      - "traefik.http.routers.frontend.rule=Host(`openreg.example.com`)"
      - "traefik.http.routers.frontend.tls.certresolver=le"

  backend:
    labels:
      - "traefik.http.routers.backend.rule=Host(`openreg.example.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend.tls.certresolver=le"

volumes:
  letsencrypt:
```

### Kubernetes with cert-manager

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

---

## Database Setup

### Initialize Schema

```bash
# Docker Compose
docker-compose exec backend python init_db.py

# Kubernetes
kubectl exec -it deployment/openreg-backend -n openreg -- python init_db.py
```

### Migrations (Future)

```bash
# Generate migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head
```

---

## Backup & Recovery

### Database Backup

```bash
# Docker Compose
docker-compose exec postgres pg_dump -U openreg openreg > backup_$(date +%Y%m%d).sql

# Kubernetes
kubectl exec -it statefulset/postgres -n openreg -- pg_dump -U openreg openreg > backup.sql
```

### MinIO Backup

```bash
# Using MinIO Client
mc mirror openreg/artifacts /backup/artifacts/
```

### Automated Backups

Create a CronJob for automated backups:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: db-backup
  namespace: openreg
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15-alpine
            command:
            - /bin/sh
            - -c
            - pg_dump -h postgres -U openreg openreg | gzip > /backup/db-$(date +%Y%m%d).sql.gz
            volumeMounts:
            - name: backup
              mountPath: /backup
          volumes:
          - name: backup
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
```

---

## Monitoring

### Health Checks

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Backend health |
| Redis `PING` | Queue health |
| MinIO `/minio/health/live` | Storage health |

### Log Aggregation

Recommended: Ship logs to centralized logging (ELK, Loki, CloudWatch).

```yaml
# Example: Fluent Bit sidecar
containers:
- name: fluent-bit
  image: fluent/fluent-bit:latest
  volumeMounts:
  - name: logs
    mountPath: /var/log/openreg
```

### Metrics (Planned)

Prometheus metrics endpoint: `/metrics` (v1 roadmap)

---

## Upgrade Procedures

### Rolling Updates

```bash
# Docker Compose
docker-compose pull
docker-compose up -d

# Kubernetes
kubectl set image deployment/openreg-backend backend=openreg/backend:v1.2.0 -n openreg
kubectl rollout status deployment/openreg-backend -n openreg
```

### Database Migrations

1. Take a backup before upgrading
2. Apply migrations: `alembic upgrade head`
3. Roll back if needed: `alembic downgrade -1`

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Backend won't start | Check `DATABASE_URL` connection string |
| Workers not processing | Verify Redis connection, check `celery` logs |
| Artifacts not uploading | Check MinIO credentials and bucket permissions |
| 401 errors | Verify `SECRET_KEY` matches across all services |

### View Logs

```bash
# Docker Compose
docker-compose logs -f backend worker

# Kubernetes
kubectl logs -f deployment/openreg-backend -n openreg
kubectl logs -f deployment/openreg-worker -n openreg
```

---

## Related Documentation

- [Architecture Guide](./ARCHITECTURE.md) — System design overview
- [Security Model](./SECURITY.md) — Security hardening checklist
- [Quick Start](./QUICKSTART.md) — Development setup
