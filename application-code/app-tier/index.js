const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const { loadAppSecrets } = require('./config/secrets');
const { setDbConfig } = require('./DbConfig');
const { initRedisClient, getRedisClient } = require('./config/redis');
const transactionService = require('./TransactionService');

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

// Health check - reports MySQL (critical) and Redis (non-critical) status
app.get('/health', async (req, res) => {
    const health = { status: 'ok', mysql: 'connected', redis: 'unknown' };

    try {
        await transactionService.pingDb();
    } catch (err) {
        health.status = 'error';
        health.mysql = 'unavailable';
    }

    const redis = getRedisClient();
    if (!redis) {
        health.redis = 'not_configured';
    } else if (redis.status === 'ready') {
        health.redis = 'connected';
    } else {
        health.redis = 'unavailable';
    }

    const httpStatus = health.status === 'ok' ? 200 : 503;
    res.status(httpStatus).json(health);
});

// ADD TRANSACTION
app.post('/transaction', (req, res) => {
    transactionService.addTransaction(req.body.amount, req.body.desc, (err) => {
        if (err) return res.status(500).json({ message: 'something went wrong', error: err.message });
        res.status(200).json({ message: 'added transaction successfully' });
    });
});

// GET ALL TRANSACTIONS
app.get('/transaction', (req, res) => {
    transactionService.getAllTransactions((err, results) => {
        if (err) return res.status(500).json({ message: 'could not get all transactions', error: err.message });
        const transactionList = results.map(row => ({
            id: row.id, amount: row.amount, description: row.description,
        }));
        res.status(200).json({ result: transactionList });
    });
});

// DELETE ALL TRANSACTIONS
app.delete('/transaction', (req, res) => {
    transactionService.deleteAllTransactions((err) => {
        if (err) return res.status(500).json({ message: 'deleting all transactions failed', error: err.message });
        res.status(200).json({ message: 'delete function execution finished.' });
    });
});

// DELETE ONE TRANSACTION
app.delete('/transaction/id', (req, res) => {
    transactionService.deleteTransactionById(req.body.id, (err) => {
        if (err) return res.status(500).json({ message: 'error deleting transaction', error: err.message });
        res.status(200).json({ message: `transaction with id ${req.body.id} deleted` });
    });
});

// GET SINGLE TRANSACTION
app.get('/transaction/id', (req, res) => {
    transactionService.findTransactionById(req.body.id, (err, result) => {
        if (err) return res.status(500).json({ message: 'error retrieving transaction', error: err.message });
        if (!result || result.length === 0) return res.status(404).json({ message: 'transaction not found' });
        const { id, amount, description } = result[0];
        res.status(200).json({ id, amount, description });
    });
});

/**
 * Startup sequence - order matters here:
 * 1. Fetch secrets from Secrets Manager (async, must finish first)
 * 2. Initialize Redis client using the Redis secret
 * 3. Set the DB config and initialize the MySQL pool
 * 4. Only now start listening for HTTP requests
 */
async function startServer() {
    try {
        const { dbSecret, redisSecret } = await loadAppSecrets();

        initRedisClient(redisSecret);

        setDbConfig(dbSecret);
        transactionService.initDbPool();

        app.listen(port, () => {
            console.log(`RetailEdge app-tier listening on port ${port}`);
        });
    } catch (err) {
        console.error('[STARTUP] Failed to initialize application:', err.message);
        process.exit(1);
    }
}

startServer();