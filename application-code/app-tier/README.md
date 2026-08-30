# Application Tier

The application tier is a Node.js/Express backend that handles transaction-related API requests and connects to MySQL and Redis.

## Features

### Runtime Secrets Management

Application secrets are loaded at startup from AWS Secrets Manager instead of being hardcoded or injected directly into the application configuration.

The application loads:

* Database credentials from `retailedge/db`
* Redis credentials from `retailedge/redis`

Secret names can also be configured through environment variables:

```bash
DB_SECRET_NAME
REDIS_SECRET_NAME
```

Secrets are fetched once during application startup and used to initialize the required services.

### Redis Cache

Redis is used as a cache for transaction reads using the **Cache-Aside Pattern**.

For `GET /transaction`:

1. The application checks Redis for the cached transactions.
2. On a cache hit, the data is returned directly from Redis.
3. On a cache miss, the application queries MySQL.
4. The result is stored in Redis with a **60-second TTL**.
5. If Redis is unavailable, the application automatically falls back to MySQL.

The cache is invalidated after successful transaction write/delete operations to prevent stale transaction data.

### Database Connection Pool

MySQL connections are managed through a connection pool initialized during application startup.

The database configuration is loaded from AWS Secrets Manager and is not stored directly in the source code.

### Health Check

The application exposes:

```text
GET /health
```

The health check verifies the actual MySQL connection and reports the current Redis status.

Example response:

```json
{
  "status": "ok",
  "mysql": "connected",
  "redis": "connected"
}
```

MySQL is considered **critical**. If MySQL is unavailable, the endpoint returns HTTP `503`.

Redis is considered **non-critical** because the application can continue serving requests using MySQL when Redis is unavailable.

### Application Startup

The application follows this startup sequence:

```text
Load Secrets
     ↓
Initialize Redis
     ↓
Initialize MySQL Connection Pool
     ↓
Start HTTP Server
```

The HTTP server only starts listening after the required secrets and database configuration have been successfully initialized.

If startup initialization fails, the application exits with a non-zero status.

## Environment Variables

The application supports the following environment variables:

| Variable            | Description                               | Default                 |
| ------------------- | ----------------------------------------- | ----------------------- |
| `PORT`              | Application listening port                | `8080`                  |
| `DB_SECRET_NAME`    | AWS Secrets Manager secret name for MySQL | `retailedge/db`         |
| `REDIS_SECRET_NAME` | AWS Secrets Manager secret name for Redis | `retailedge/redis`      |
| `AWS_REGION`        | AWS Region used by the AWS SDK            | Provided by the runtime |

## Running Locally

Install dependencies:

```bash
npm install
```

Build the Docker image:

```bash
docker build -t retailedge-app:redis-secrets-test .
```

The application requires AWS credentials and access to AWS Secrets Manager at runtime.

When running locally, credentials and the AWS Region must be available to the container. In the AWS environment, these are provided through the EC2 IAM role and runtime configuration.

Example:

```bash
docker run --rm \
  -p 8080:8080 \
  -e AWS_REGION=<aws-region> \
  retailedge-app:redis-secrets-test
```

Without valid AWS credentials and access to the required Secrets Manager secrets, the application will fail during startup. This is expected when running the container locally without the AWS infrastructure and IAM role configured.