module.exports = {
    job: {
        ttl: 5 * 60 * 1000
    },
    cleanUp: {
        active: true,
        refreshRate: 5 * 60 * 1000
    },
    refreshRate: 1000,
    monitor: {
        host: 'http://127.0.0.1',
        port: '3001'
    },
    adapter: {
        type: 'native'
    }
};
