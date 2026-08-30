let dbConfig = null;

function setDbConfig(dbSecret) {
    dbConfig = Object.freeze({
        DB_HOST: dbSecret.DB_HOST,
        DB_USER: dbSecret.DB_USER,
        DB_PWD: dbSecret.DB_PWD,
        DB_DATABASE: dbSecret.DB_DATABASE,
        DB_PORT: dbSecret.DB_PORT || 3306,
    });
}

function getDbConfig() {
    if (!dbConfig) {
        throw new Error('DB config not initialized yet - call setDbConfig() first');
    }
    return dbConfig;
}

module.exports = { setDbConfig, getDbConfig };