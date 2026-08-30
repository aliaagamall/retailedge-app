const Redis = require('ioredis');

let redisClient = null;

/**
 * Creates the Redis client once, using credentials from Secrets Manager.
 * The client is reused across all requests - never recreated per request.
 */
function initRedisClient(redisSecret) {
    redisClient = new Redis({
        host: redisSecret.REDIS_HOST,
        port: redisSecret.REDIS_PORT || 6379,
        password: redisSecret.REDIS_AUTH_TOKEN,
        tls: redisSecret.REDIS_TLS ? {} : undefined,
        retryStrategy(times) {
            return Math.min(times * 200, 2000);
        },
        maxRetriesPerRequest: 2,
    });

    redisClient.on('error', (err) => {
        console.error('[REDIS] Connection error - falling back to MySQL only:', err.message);
    });

    redisClient.on('connect', () => {
        console.log('[REDIS] Connected successfully');
    });

    return redisClient;
}

function getRedisClient() {
    return redisClient;
}

module.exports = { initRedisClient, getRedisClient };