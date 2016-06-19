module.exports = {
    redis: {
        host: 'localhost',
        port: 6379,
        options: {
            keyPrefix: 'hq',
            db: 0,
            family: 4
        }
    },
    refreshRate: 1000
};
