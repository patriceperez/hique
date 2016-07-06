module.exports = {
    redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
        options: {
            family: 4,
            keyPrefix: 'hq'
        }
    },
    refreshRate: 1000
};
