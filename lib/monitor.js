var Redis = require('ioredis');
var keyUtils = require('./key-utils');
var async = require('async');
var _ = require('lodash');

module.exports = function (config) {
    var self = this;
    var redisUtils = new keyUtils(config);

    self.config = config;
    self.interval = null;

    self.redis = new Redis(self.config.redis);

    self.createJob = function (job, cb) {
        self.redis.multi()
            .incr(redisUtils.toKey(job.type, 'id'))
            .get(redisUtils.toKey(job.type, 'id'))
            .exec(function (err, result) {
                job.id = result[0][1];
                job.setStatus('active');
                self.redis.multi()
                    .hmset(redisUtils.toKey(job.type, job.id, 'jobs'), job.toRedis())
                    .lpush(redisUtils.toKey(job.type, 'pending'), job.id)
                    .exec();
                cb(err, job);
            });
    };

    self.updateJob = function (job, field) {
        self.redis.hmset(redisUtils.toKey(job.type, job.id, 'jobs'), [field, job[field]]);
    };

    self.registerQueue = function (type, concurrency) {
        self.redis.set(redisUtils.toKey(type, 'concurrency'), concurrency);
    };

    self.getJob = function (type, id, cb) {
        self.redis.hgetall(redisUtils.toKey(type, id, 'jobs'), function (err, job) {
            job.data = JSON.parse(job.data);
            cb(err, job);
        });
    };

    self.finishJob = function (job, status) {
        job.setStatus(status);
        self.redis.multi()
            .lrem(redisUtils.toKey(job.type, 'active'), 0, job.id)
            .lpush(redisUtils.toKey(job.type, status), job.id)
            .exec();
    };

    self.saveResult = function (job, result) {
        self.redis.hset(redisUtils.toKey(job.type, 'result'), job.id, JSON.stringify(result));
    };

    self.getJobResult = function (type, id, cb) {
        self.redis.hget(redisUtils.toKey(type, 'result'), id, function (err, result) {
            cb(err, JSON.parse(result));
        });
    };

    self.getWork = function (freeSlots, cb) {
        var newJobs = [];
        async.each(freeSlots, function (slots, callback) {
            var tasks = [];
            for (var i = 0; i < slots.available; i++) {
                tasks.push(function (innerCB) {
                    self.redis.llen(redisUtils.toKey(slots.type, 'pending'), function (err, pendingJobsCount) {
                        if (pendingJobsCount > 0) {
                            self.redis.brpoplpush(redisUtils.toKey(slots.type, 'pending'), redisUtils.toKey(slots.type, 'active'), self.config.refreshRate, function (err, jobId) {
                                if (err) console.log(err);

                                self.getJob(slots.type, jobId, innerCB);
                            });
                        } else {
                            innerCB();
                        }
                    });
                });
            }

            async.series(tasks, function (err, jobs) {
                if (err) console.log(err);

                newJobs = _.concat(newJobs, jobs);

                callback(err);
            });
        }, function (err) {
            cb(_.filter(newJobs, function (job) {
                return typeof job !== 'undefined';
            }));
        });
    };

    return self;
};