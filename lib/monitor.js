var Redis = require('ioredis');
var keyUtils = require('./key-utils');
var async = require('async');
var _ = require('lodash');

module.exports = function (config, redisObj) {
    var self = this;
    var redisUtils = new keyUtils(config);

    self.config = config;
    self.interval = null;

    self.redis = redisObj || new Redis(self.config.redis);

    self.createJob = function (job, cb) {
        self.redis.multi()
            .incr(redisUtils.toKey(job.type, 'id'))
            .get(redisUtils.toKey(job.type, 'id'))
            .exec(function (err, result) {
                job.id = result[0][1];
                job.setStatus('pending');
                self.redis.multi()
                    .hmset(redisUtils.toKey(job.type, job.id, 'jobs'), job.toRedis())
                    .lpush(redisUtils.toKey(job.type, 'pending'), job.id)
                    .exec();
                cb(err, job);
            });
    };

    self.updateJob = function (job, field, cb) {
        if (_.isFunction(cb)) {
            self.redis.hmset(redisUtils.toKey(job.type, job.id, 'jobs'), [field, job[field]], cb);
        } else {
            self.redis.hmset(redisUtils.toKey(job.type, job.id, 'jobs'), [field, job[field]]);
        }
    };

    self.registerQueue = function (type, concurrency) {
        self.redis.set(redisUtils.toKey(type, 'concurrency'), concurrency);
    };

    self.getJob = function (type, id, cb) {
        self.redis.hgetall(redisUtils.toKey(type, id, 'jobs'), function (err, job) {
            job.data = JSON.parse(job.data || '{}');
            cb(err, job);
        });
    };

    self.finishJob = function (job, status, cb) {
        job.setStatus(status);
        self.redis.multi()
            .lrem(redisUtils.toKey(job.type, 'active'), 0, job.id)
            .lpush(redisUtils.toKey(job.type, status), job.id)
            .expire(redisUtils.toKey(job.type, job.id, 'jobs'), 3600)
            .exec(function (err) {
                cb && cb(err);
            });
    };

    self.saveResult = function (job, result, cb) {
        self.redis.hset(redisUtils.toKey(job.type, 'result'), job.id, JSON.stringify(result), function (err) {
            cb && cb(err);
        });

        self.redis.expire(redisUtils.toKey(job.type, job.id, 'result'), 3600);
    };

    self.getJobResult = function (type, id, cb) {
        self.redis.hget(redisUtils.toKey(type, 'result'), id, function (err, result) {
            cb(err, JSON.parse(result || '[]'));
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

    self.getStatus = function (cb) {
        self.redis.keys(redisUtils.toKey('*', 'concurrency'), function (err, results) {
            var stats = [];
            var queues = _.map(results, function (queue) {
                return queue.split(':')[1];
            });

            async.each(queues, function (queue, callback) {
                var multi = self.redis.multi();
                multi.llen(redisUtils.toKey(queue, 'active'));
                multi.llen(redisUtils.toKey(queue, 'pending'));
                multi.llen(redisUtils.toKey(queue, 'failed'));
                multi.llen(redisUtils.toKey(queue, 'completed'));
                multi.llen(redisUtils.toKey(queue, 'crashed'));
                multi.exec(function (err, results) {
                    stats.push({
                        queue: queue,
                        active: results[0][1],
                        pending: results[1][1],
                        failed: results[2][1],
                        completed: results[3][1],
                        crashed: results[4][1]
                    });
                    callback();
                });
            }, function (err) {
                cb(err, stats);
            });
        });
    };

    self.cleanUp = function (cb) {
        self.redis.keys(redisUtils.toKey('*', 'concurrency'), function (err, results) {
            var jobs = {};

            _(results).forEach(function (jobKey) {
                var details = jobKey.split(':');

                if (_.isUndefined(jobs[details[1]])) {
                    jobs[details[1]] = [];
                }
            });

            async.forEachOf(jobs, function (value, jobType, callback) {
                self.redis.keys(redisUtils.toKey(jobType, 'jobs:*'), function (err, ids) {
                    var jobIds = _.map(ids, function (id) {
                        return id.split(':')[3]
                    });

                    async.forEach(['active', 'pending', 'completed', 'failed', 'crashed'], function (queue, innerCB) {
                        self.redis.lrange(redisUtils.toKey(jobType, queue), 0, -1, function (err, result) {
                            _(_.difference(result, jobIds)).forEach(function (staleId) {
                                self.redis.lrem(redisUtils.toKey(jobType, queue), 1, staleId);
                            });
                            innerCB();
                        });
                    }, function (err) {
                        callback();
                    });
                });
            }, function (err) {
                cb && cb();
            });
        });
    };

    return self;
};