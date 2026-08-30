# AWS Three Tier Web Architecture Workshop

## Description

This workshop is a hands-on walk through of a three-tier web architecture in AWS. We will be manually creating the necessary network, security, app, and database components and configurations in order to run this architecture in an available and scalable manner.

## Audience

Although this is an introductory level workshop, it is intended for those who have a technical role. The assumption is that you have at least some foundational AWS knowledge around VPC, EC2, RDS, S3, ELB and the AWS Console.

## Pre-requisites

1. An AWS account. If you don’t have an AWS account, follow the instructions [here](https://aws.amazon.com/console/) and click on “Create an AWS Account” button in the top right corner to create one.
2. IDE or text editor of your choice.

## Architecture Overview

![Architecture Diagram](https://github.com/aliaagamall/retailedge-app/tree/feat/redis-cache-and-runtime-secrets/application-code/web-tier/src/assets)

In this architecture, a public-facing Application Load Balancer forwards client traffic to our web tier EC2 instances. The web tier is running Nginx webservers that are configured to serve a React.js website and redirects our API calls to the application tier’s internal facing load balancer. The internal facing load balancer then forwards that traffic to the application tier, which is written in Node.js. The application tier manipulates data in an Aurora MySQL multi-AZ database and returns it to our web tier. Load balancing, health checks and autoscaling groups are created at each layer to maintain the availability of this architecture.

---

# RetailEdge Modifications

This repository is a fork of the original AWS Three Tier Web Architecture Workshop and has been extended to support the requirements of the RetailEdge application.

The application-level changes are currently implemented in the following feature branch:

```text
feat/redis-cache-and-runtime-secrets
```

## Application Tier Changes

The application tier was enhanced with the following changes.

### 1. Runtime Secrets Management

Database and Redis credentials are no longer stored directly in the application configuration.

The application retrieves the required secrets from **AWS Secrets Manager** during startup.

The secret names can be configured through environment variables, with the following defaults:

```text
DB_SECRET_NAME=retailedge/db
REDIS_SECRET_NAME=retailedge/redis
```

The application loads both secrets in parallel before initializing the database and Redis connections.

This keeps credentials outside the source code and Docker image and allows the same application image to be used across different environments.

### 2. Redis Caching

Redis was added to the application tier using `ioredis`.

The `GET /transaction` endpoint now uses the **Cache-Aside Pattern**.

The flow is:

```text
Client
  ↓
GET /transaction
  ↓
Check Redis
  ↓
Cache Hit? ───── Yes ───→ Return cached data
  │
  No
  ↓
Query MySQL
  ↓
Store result in Redis
  ↓
Return data
```

The transaction list is cached with a **60-second TTL**.

The cache is invalidated after successful transaction write and delete operations to prevent stale data.

Redis is treated as a cache rather than the source of truth. If Redis is unavailable, the application automatically falls back to MySQL.

### 3. Database Configuration

The database configuration is no longer hardcoded or loaded directly from regular environment variables.

Instead, the application retrieves the database secret from AWS Secrets Manager during startup.

The retrieved credentials are then used to initialize a MySQL connection pool.

MySQL remains the **source of truth** for transaction data.

### 4. Health Check

A `/health` endpoint was added to provide application health information.

The health check:

* Verifies that MySQL is actually reachable.
* Reports the current Redis connection status.
* Treats MySQL as a critical dependency.
* Treats Redis as a non-critical dependency because the application can fall back to MySQL.

If MySQL is unavailable, the endpoint returns HTTP `503`.

Example response:

```json
{
  "status": "ok",
  "mysql": "connected",
  "redis": "connected"
}
```

Possible Redis states include:

```text
connected
unavailable
not_configured
```

A Redis failure does not cause the application to become unhealthy because MySQL can continue serving transaction requests.

### 5. Application Startup

Application initialization now follows a defined startup sequence:

```text
Load Secrets
     ↓
Initialize Redis
     ↓
Initialize MySQL Connection Pool
     ↓
Start HTTP Server
```

The HTTP server only starts listening after the required application configuration has been successfully initialized.

If the required secrets cannot be loaded or the application cannot initialize its required dependencies, the application exits with a non-zero status.

This prevents the application from running in a partially initialized state.

## Docker

The application tier is containerized and the Docker image is rebuilt after application changes to ensure that the latest source code and dependencies are included.

Example:

```bash
docker build -t retailedge-app:redis-secrets-test .
```

The Docker image contains the application code and dependencies but does **not** contain AWS credentials or application secrets.

Secrets are retrieved at runtime rather than during the image build process.

## AWS Integration

The application-level changes are designed to integrate with the AWS infrastructure through the following services:

### AWS Secrets Manager

Stores:

```text
retailedge/db
retailedge/redis
```

The application retrieves these secrets during startup.

### IAM

The EC2 instances running the application will use an IAM instance role with permission to retrieve the required Secrets Manager values.

AWS access keys are not hardcoded in the application or Docker image.

### Amazon ElastiCache for Redis

Redis will provide the caching layer for frequently accessed transaction data.

Redis is not the source of truth and the application can fall back to MySQL if Redis becomes unavailable.

### Amazon RDS MySQL

MySQL remains the persistent source of truth for transaction data.

The application connects to the database using credentials retrieved from AWS Secrets Manager.

## Runtime Configuration

The application supports the following environment variables:

| Variable            | Description                                            | Default                 |
| ------------------- | ------------------------------------------------------ | ----------------------- |
| `PORT`              | Application listening port                             | `8080`                  |
| `DB_SECRET_NAME`    | Secrets Manager secret containing database credentials | `retailedge/db`         |
| `REDIS_SECRET_NAME` | Secrets Manager secret containing Redis credentials    | `retailedge/redis`      |
| `AWS_REGION`        | AWS Region used by the AWS SDK                         | Provided by the runtime |

The AWS Region and credentials are provided by the runtime environment.

The application does not hardcode AWS credentials.

## Running Locally

Install dependencies:

```bash
npm install
```

Build the Docker image:

```bash
docker build -t retailedge-app:redis-secrets-test .
```

The application requires access to AWS Secrets Manager at runtime.

When running locally, the container must have access to valid AWS credentials and the AWS Region.

For example:

```bash
docker run --rm \
  -p 8080:8080 \
  -e AWS_REGION=<aws-region> \
  retailedge-app:redis-secrets-test
```

When running in AWS, the required AWS credentials will be provided through the EC2 IAM role.

When running locally without AWS credentials and the required AWS infrastructure, the application may fail during startup with an error such as:

```text
Could not load credentials from any providers
```

This is expected because the local Docker container does not have the EC2 IAM role that will be available in the AWS environment.

## Infrastructure Integration

The application changes in this branch are designed to work with the updated AWS infrastructure.

The infrastructure will provide:

```text
                    AWS
                     │
        ┌────────────┴────────────┐
        │                         │
 Secrets Manager             ElastiCache
        │                         │
   DB + Redis                Redis Cache
   Secrets                       │
        │                         │
        └──────────┬──────────────┘
                   │
                EC2 ASG
                   │
             Docker Container
                   │
             Node.js App
                   │
                 MySQL
```

The infrastructure configuration will separately handle the creation and configuration of the required AWS resources, networking, IAM permissions, Secrets Manager secrets, Redis, and application deployment.

> **Note:** The `feat/redis-cache-and-runtime-secrets` branch contains the application-level implementation of runtime secrets management, Redis caching, database configuration, and health checks. The corresponding AWS infrastructure integration is handled separately.

---

## Workshop Instructions

See [AWS Three Tier Web Architecture](https://catalog.us-east-1.prod.workshops.aws/workshops/85cd2bb2-7f79-4e96-bdee-8078e469752a/en-US)

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
