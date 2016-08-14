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
            .exec(function re_getLastJobId(err, result) {
                job.id = result[0][1];
                job.setStatus('pending');
                self.redis.multi()
                    .hmset(redisUtils.toKey(job.type, job.id, 'jobs'), job.toRedis())
                    .lpush(redisUtils.toKey(job.type, 'pending'), job.id)
                    .exec(function re_createJob(err) {
                        cb(err, job);
                    });
            });
    };

    self.updateJob = function (job, field, cb) {
        var multi = self.redis.multi();

        multi.hmset(redisUtils.toKey(job.type, job.id, 'jobs'), [field, job[field]]);
        multi.expire(redisUtils.toKey(job.type, job.id, 'jobs'), self.config.job.ttl);
        multi.exec(function updateJob(err, result) {
            cb && cb(err, result[0][1]);
        });
    };

    self.registerQueue = function (type, concurrency) {
        self.redis.set(redisUtils.toKey(type, 'concurrency'), concurrency);
    };

    self.getJob = function (type, id, cb) {
        self.redis.hgetall(redisUtils.toKey(type, id, 'jobs'), function re_getAllJobFields(err, job) {
            if (job.type && job.id) {
                job.data = JSON.parse(job.data || '{}');
                cb(err, job);
            } else {
                cb(new Error('No Job found'));
            }
        });
    };

    self.getJobField = function (type, id, field, cb) {
        self.redis.hget(redisUtils.toKey(type, id, 'jobs'), field, function re_getAllJobFields(err, jobField) {
            if (!err && field === 'data') {
                cb(null, JSON.parse(jobField));
            } else {
                cb(err, jobField);
            }
        });
    };

    self.finishJob = function (job, status, cb) {
        job.setStatus(status);
        self.redis.multi()
            .lrem(redisUtils.toKey(job.type, 'active'), 0, job.id)
            .lpush(redisUtils.toKey(job.type, status), job.id)
            .expire(redisUtils.toKey(job.type, job.id, 'jobs'), self.config.job.ttl)
            .exec(function re_finishJob(err) {
                cb && cb(err);
            });
    };

    self.saveResult = function (job, result, cb) {
        var multi = self.redis.multi();
        multi.hset(redisUtils.toKey(job.type, 'result'), job.id, JSON.stringify(result));
        multi.expire(redisUtils.toKey(job.type, job.id, 'result'), self.config.job.ttl);
        multi.exec(function re_saveResult(err) {
            cb && cb(err);
        });
    };

    self.getJobResult = function (type, id, cb) {
        self.redis.hget(redisUtils.toKey(type, 'result'), id, function re_getJobResult(err, result) {
            cb(err, JSON.parse(result || '[]'));
        });
    };

    self.getWork = function (freeSlots, cb) {
        async.each(freeSlots, function getWorkForJobType(slots, callback) {
            self.redis.llen(redisUtils.toKey(slots.type, 'pending'), function populateWorkForSingleJob(err, pendingJobsCount) {
                if (pendingJobsCount > 0) {
                    var times = pendingJobsCount < slots.available ? pendingJobsCount : slots.available;

                    async.times(times, function getPendingJobIdFromRedis(n, next) {
                        self.redis.brpoplpush(redisUtils.toKey(slots.type, 'pending'),
                            redisUtils.toKey(slots.type, 'active'),
                            self.config.refreshRate / 2,
                            next);
                    }, function (err, jobIds) {
                        if (err) {
                            callback(err);
                        } else {
                            async.map(jobIds, function getJobObjectFromRedis(jobId, cb) {
                                self.getJob(slots.type, jobId, cb);
                            }, function reportJobObjectsToCallback(err, results) {
                                if ([{"data": {}}] === results) {
                                    throw new Error('fuck');
                                } else {
                                    cb(err, results);
                                }
                            });
                        }
                    });
                } else {
                    callback();
                }
            });
        });
    };

    self.getStatus = function (cb) {
        self.redis.keys(redisUtils.toKey('*', 'concurrency'), function re_getJobTypes(err, results) {
            var stats = [];
            var queues = _.map(results, function (queue) {
                return queue.split(':')[1];
            });

            async.each(queues, function re_getQueuesCount(queue, callback) {
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
            }, function deliverStats(err) {
                cb(err, stats);
            });
        });
    };

    self.cleanUp = function (cb) {
        self.redis.keys(redisUtils.toKey('*', 'concurrency'), function re_getJobTypes(err, results) {
            var jobs = {};

            _(results).forEach(function extractJobTypesFromConcurrency(jobKey) {
                var details = jobKey.split(':');

                if (_.isUndefined(jobs[details[1]])) {
                    jobs[details[1]] = [];
                }
            });

            async.forEachOf(jobs, function getJobTypeIds(value, jobType, callback) {
                self.redis.keys(redisUtils.toKey(jobType, 'jobs:*'), function re_getJobTypeIds(err, ids) {
                    var jobIds = _.map(ids, function extraceJobTypeFromRedisKey(id) {
                        return id.split(':')[3]
                    });

                    async.forEach(['active', 'pending', 'completed', 'failed', 'result'],
                        function re_removeDetachedIds(queue, innerCB) {
                            if (queue === 'result') {
                                self.redis.hkeys(redisUtils.toKey(jobType, queue),
                                    function re_getExistingJobResultIds(err, result) {
                                        _.difference(result, jobIds).forEach(function re_removeDetachedResultId(resultId) {
                                            self.redis.hdel(redisUtils.toKey(jobType, queue), resultId);
                                        });
                                        innerCB();
                                    });
                            } else {
                                self.redis.lrange(redisUtils.toKey(jobType, queue), 0, -1,
                                    function re_getExistingJobIds(err, result) {
                                        _(_.difference(result, jobIds)).forEach(function re_removeDetachedJobId(staleId) {
                                            self.redis.lrem(redisUtils.toKey(jobType, queue), 1, staleId);
                                        });
                                        innerCB();
                                    });
                            }
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