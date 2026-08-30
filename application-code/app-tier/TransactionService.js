const mysql = require('mysql');
const { getDbConfig } = require('./DbConfig');
const { getRedisClient } = require('./config/redis');

const CACHE_KEY = 'transactions:all';
const CACHE_TTL_SECONDS = 60;

let pool = null;

/**
 * Creates the MySQL connection pool. Must be called AFTER setDbConfig()
 * has run - see index.js for the startup order.
 */
function initDbPool() {
    const dbConfig = getDbConfig();

    pool = mysql.createPool({
        connectionLimit: 10,
        host: dbConfig.DB_HOST,
        user: dbConfig.DB_USER,
        password: dbConfig.DB_PWD,
        database: dbConfig.DB_DATABASE,
        port: dbConfig.DB_PORT,
    });

    return pool;
}

function addTransaction(amount, desc, callback) {
    const sql = 'INSERT INTO `transactions` (`amount`, `description`) VALUES (?, ?)';
    pool.query(sql, [amount, desc], (err, result) => {
        if (err) return callback(err);

        // Write succeeded - invalidate the cached list so the next
        // read reflects the new data instead of a stale cached copy.
        invalidateTransactionsCache();
        callback(null, result);
    });
}

/**
 * Cache-aside read: check Redis first, fall back to MySQL on a miss
 * or if Redis is unavailable for any reason.
 */
function getAllTransactions(callback) {
    const redis = getRedisClient();

    if (!redis) {
        // Redis was never initialized (e.g. disabled) - go straight to MySQL
        return queryAllFromDb(callback);
    }

    redis.get(CACHE_KEY)
        .then((cached) => {
            if (cached) {
                // Cache hit - no database query needed
                return callback(null, JSON.parse(cached));
            }
            // Cache miss - read from MySQL and populate the cache
            queryAllFromDb((err, results) => {
                if (err) return callback(err);

                redis.set(CACHE_KEY, JSON.stringify(results), 'EX', CACHE_TTL_SECONDS)
                    .catch((cacheErr) => {
                        console.error('[REDIS] Failed to populate cache:', cacheErr.message);
                    });

                callback(null, results);
            });
        })
        .catch((err) => {
            // Redis failed (network issue, timeout, etc.) - fall back to MySQL
            console.error('[REDIS] Read failed - falling back to MySQL:', err.message);
            queryAllFromDb(callback);
        });
}

function queryAllFromDb(callback) {
    pool.query('SELECT * FROM transactions', (err, result) => callback(err, result));
}

function findTransactionById(id, callback) {
    pool.query('SELECT * FROM transactions WHERE id = ?', [id], (err, result) => callback(err, result));
}

function deleteAllTransactions(callback) {
    pool.query('DELETE FROM transactions', (err, result) => {
        if (err) return callback(err);
        invalidateTransactionsCache();
        callback(null, result);
    });
}

function deleteTransactionById(id, callback) {
    pool.query('DELETE FROM transactions WHERE id = ?', [id], (err, result) => {
        if (err) return callback(err);
        invalidateTransactionsCache();
        callback(null, result);
    });
}

function invalidateTransactionsCache() {
    const redis = getRedisClient();
    if (!redis) return;

    redis.del(CACHE_KEY).catch((err) => {
        console.error('[REDIS] Failed to invalidate cache:', err.message);
    });
}

/**
 * Used by the /health endpoint to confirm the DB is actually reachable,
 * not just that the pool object exists.
 */
function pingDb() {
    return new Promise((resolve, reject) => {
        pool.query('SELECT 1', (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

module.exports = {
    initDbPool,
    addTransaction,
    getAllTransactions,
    deleteAllTransactions,
    findTransactionById,
    deleteTransactionById,
    pingDb,
};