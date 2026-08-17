module.exports = Object.freeze({
    DB_HOST     : process.env.DB_HOST     || '',
    DB_USER     : process.env.DB_USER     || '',
    DB_PWD      : process.env.DB_PWD      || '',
    DB_DATABASE : process.env.DB_DATABASE || '',
    DB_PORT     : process.env.DB_PORT     || 3306,
});
