var Monitor = require('./monitor');
var Job = require('./job');
var defaults = require('../config/defaults');
var _ = require('lodash');

module.exports = function (config, redisObj) {
    var self = this;
    self.config = _.merge(defaults, config);
    self.monitor = new Monitor(self.config, redisObj);
    self.queues = {};
    self.active = false;

    self.createJob = function (type, data) {
        return new Job(type, data, self.monitor);
    };

    self.pause = function () {
        self.active = false;
    };

    self.start = function () {
        self.active = true;
    };

    self.getWork = function (cb) {
        if (self.active) {
            self.monitor.getWork(self.getFreeSlots(), function executeNewJobs(newJobs) {
                _(newJobs).forEach(function executeNewJob(newJob) {
                    var newLiveJob = new Job(null, null, self.monitor).fromData(newJob);
                    try {
                        self.executeJob(newLiveJob, self.queues[newJob.type].jobLogic);
                    } catch (e) {
                        newLiveJob.err = e.toString();
                        newLiveJob.updateRedis('err', function re_crashJob() {
                            self.monitor.finishJob(newLiveJob, 'crashed');
                            self.clearActiveJob(newLiveJob);
                        });
                    }
                });

                cb && cb(newJobs);
            });
        } else {
            cb && cb([]);
        }
    };

    self.executeJob = function (job, jobLogic) {
        self.queues[job.type].jobs.push(job);
        jobLogic(job, self.createDoneMethod(job));
    };

    self.createDoneMethod = function (job, cb) {
        return function doneMethod(err, result) {
            if (err) {
                self.monitor.finishJob(job, 'failed', cb);
            } else {
                self.monitor.finishJob(job, 'completed', cb);
                if (!_.isEmpty(result)) {
                    self.monitor.saveResult(job, result, function (err) {
                        result = null;
                    });
                }
            }

            self.clearActiveJob(job);
        }
    };

    self.clearActiveJob = function (job) {
        _.remove(self.queues[job.type].jobs, function removeJobOnDone(activeJob) {
            return activeJob.id === job.id;
        });
    };

    self.getFreeSlots = function () {
        var freeSlots = [];
        _(self.queues).forEach(function getFreeSlotsForQueue(queue, type) {
            if (queue.jobs.length < queue.concurrency) {
                freeSlots.push({type: type, available: queue.concurrency - queue.jobs.length})
            }
        });

        return freeSlots;
    };

    self.process = function (type, concurrency, jobLogic) {
        if (typeof concurrency === 'function') {
            self.monitor.registerQueue(type, 1);
            self.queues[type] = {concurrency: 1, jobLogic: concurrency, jobs: []};
        } else {
            self.monitor.registerQueue(type, concurrency);
            self.queues[type] = {concurrency: concurrency, jobLogic: jobLogic, jobs: []};
        }
    };

    self.getJob = function (type, jobId, cb) {
        return self.monitor.getJob(type, jobId, cb);
    };

    self.getJobResult = function (type, id, cb) {
        return self.monitor.getJobResult(type, id, cb);
    };

    self.getStatus = function (cb) {
        return self.monitor.getStatus(cb);
    };

    self.cleanUp = function (cb) {
        if (self.config.cleanUp.active) {
            self.monitor.cleanUp(cb);
        }
    };

    self.updateInterval = setInterval(self.getWork, self.config.refreshRate);
    self.cleanUpInterval = setInterval(self.cleanUp, self.config.cleanUp.refreshRate);

    return self;
};