var Redis = require('ioredis');
var Job = require('./job');
var keyUtils = require('./key-utils');

module.exports = function (config) {
    var self = this;
    var redisUtils = new keyUtils(config);

    self.config = config;
    self.interval = null;

    self.redis = new Redis(config.redis);

    self.createJob = function (job, cb) {
        self.redis.multi()
            .get(redisUtils.toKey(job.type, 'id'))
            .incr(redisUtils.toKey(job.type, 'id'))
            .exec(function (err, result) {
                job.id = result[0][1];
                self.redis.hset(redisUtils.toKey(job.type, 'pending'), job.id, job.toRedis());
                cb(err, job);
            });
    };

    self.registerQueue = function (type, concurrency) {
        self.redis.multi()
            .set(redisUtils.toKey(type, 'concurrency'), concurrency)
            .set(redisUtils.toKey(type, 'id'), 1)
            .exec();
    };

    return self;
};