const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient({});

/**
 * Fetches and parses a single secret from AWS Secrets Manager.
 * Returns the parsed JSON object stored inside the secret.
 */
async function getSecret(secretId) {
    const command = new GetSecretValueCommand({ SecretId: secretId });
    const response = await client.send(command);
    return JSON.parse(response.SecretString);
}

/**
 * Loads both the DB secret and the Redis secret in parallel.
 * This runs once, at application startup - see index.js.
 */
async function loadAppSecrets() {
    const dbSecretName = process.env.DB_SECRET_NAME || 'retailedge/db';
    const redisSecretName = process.env.REDIS_SECRET_NAME || 'retailedge/redis';

    const [dbSecret, redisSecret] = await Promise.all([
        getSecret(dbSecretName),
        getSecret(redisSecretName),
    ]);

    return { dbSecret, redisSecret };
}

module.exports = { loadAppSecrets };