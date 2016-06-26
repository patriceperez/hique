var Monitor = require('./monitor');
var Job = require('./job');
var defaults = require('../config/defaults');
var _ = require('lodash');

module.exports = function (config) {
    var self = this;
    self.config = _.merge(defaults, config);
    self.monitor = new Monitor(self.config);
    self.queues = {};
    self.active = true;

    self.createJob = function (type, data) {
        return new Job(type, data, self.monitor);
    };

    self.pause = function () {
        self.active = false;
    };

    self.start = function () {
        self.active = true;
    };

    self.getWork = function () {
        if (self.active) {
            self.monitor.getWork(self.getFreeSlots(), function (newJobs) {
                _(newJobs).forEach(function (newJob) {
                    self.executeJob(new Job(null, null, self.monitor).fromData(newJob), self.queues[newJob.type].jobLogic);
                });
            });
        }
    };

    self.executeJob = function (job, jobLogic) {
        self.queues[job.type].jobs.push(job);
        jobLogic(job, self.createDoneMethod(job));
    };

    self.createDoneMethod = function (job) {
        return function (err, result) {
            if (err) {
                self.monitor.finishJob(job, 'failed');
            } else {
                self.monitor.finishJob(job, 'completed');
                if (result !== null) {
                    self.monitor.saveResult(job, result);
                }
            }

            self.queues[job.type].jobs.splice(self.queues[job.type].jobs.indexOf(job), 1);
        }
    };

    self.getFreeSlots = function () {
        var freeSlots = [];
        _(self.queues).forEach(function (queue, type) {
            if (queue.jobs.length < queue.concurrency) {
                freeSlots.push({type: type, available: queue.concurrency - queue.jobs.length})
            }
        });
        return freeSlots;
    };

    self.process = function (type, concurrency, jobLogic) {
        if (typeof concurrency === 'function') {
            self.monitor.registerQueue(type, 1);
            self.queues[type] = {concurrency: 1, jobLogic: jobLogic, jobs: []};
        } else {
            self.monitor.registerQueue(type, concurrency);
            self.queues[type] = {concurrency: concurrency, jobLogic: jobLogic, jobs: []};
        }
    };

    self.getJob = function (type, jobId, cb) {
        return self.monitor.getJob(type, jobId, cb);
    };

    self.updateInterval = setInterval(self.getWork, self.config.refreshRate);

    return self;
};