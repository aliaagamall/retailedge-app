const dbcreds = require('./DbConfig');
const mysql = require('mysql');

const pool = mysql.createPool({
    connectionLimit : 10,
    host            : dbcreds.DB_HOST,
    user            : dbcreds.DB_USER,
    password        : dbcreds.DB_PWD,
    database        : dbcreds.DB_DATABASE,
    port            : dbcreds.DB_PORT
});

function addTransaction(amount, desc, callback) {
    const sql = 'INSERT INTO `transactions` (`amount`, `description`) VALUES (?, ?)';
    pool.query(sql, [amount, desc], (err, result) => callback(err, result));
}

function getAllTransactions(callback) {
    pool.query('SELECT * FROM transactions', (err, result) => callback(err, result));
}

function findTransactionById(id, callback) {
    pool.query('SELECT * FROM transactions WHERE id = ?', [id], (err, result) => callback(err, result));
}

function deleteAllTransactions(callback) {
    pool.query('DELETE FROM transactions', (err, result) => callback(err, result));
}

function deleteTransactionById(id, callback) {
    pool.query('DELETE FROM transactions WHERE id = ?', [id], (err, result) => callback(err, result));
}

module.exports = { addTransaction, getAllTransactions, deleteAllTransactions, findTransactionById, deleteTransactionById };
