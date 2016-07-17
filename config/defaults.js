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
    job: {
        ttl: 5 * 60
    },
    cleanUp: {
        active: true,
        refreshRate: 60 * 60 * 1000
    },
    refreshRate: 1000
};
