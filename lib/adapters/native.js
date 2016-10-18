var _ = require('lodash');

module.exports = function (config) {
    var self = this;
    self.queues = {};

    self.registerQueue = function (type, concurrency, removeOnSuccess, cb) {
        if (_.isUndefined(self.queues[type])) {
            self.queues[type] = {
                type: type,
                concurrency: concurrency,
                latestId: 0,
                jobs: {},
                active: [],
                pending: [],
                success: [],
                failed: [],
                removeOnSuccess: removeOnSuccess
            };
        }

        cb && cb();
    };

    self.getWork = function (socket, slots, cb) {
        var jobs = [];
        _(slots).forEach(function (slot) {
            _.times(slot.available, function () {
                if (self.queues[slot.type].pending.length > 0) {
                    var jobId = self.queues[slot.type].pending.pop();
                    if (jobId > 0) {
                        self.queues[slot.type].active.push(jobId);
                        self.queues[slot.type].jobs[jobId].workerId = socket;
                        jobs.push(self.queues[slot.type].jobs[jobId]);
                    }
                }
            });
        });

        cb && cb(jobs);
    };

    self.createJob = function (type, data, cb) {
        if (_.isObject(self.queues[type])) {
            self.queues[type].latestId++;
            self.queues[type].jobs[self.queues[type].latestId] = {
                id: self.queues[type].latestId,
                status: 'Pending',
                data: data,
                type: type,
                progress: 0,
                err: null
            };
            self.queues[type].pending.unshift(self.queues[type].latestId);

            cb && cb(self.queues[type].jobs[self.queues[type].latestId]);
        } else {
            cb && cb({err: 'cannot create job without an associated registered queue'});
        }
    };

    self.getJob = function (type, id, cb) {
        if (_.isObject(self.queues[type]) &&
            _.isObject(self.queues[type].jobs) &&
            _.isObject(self.queues[type].jobs[id]) &&
            self.queues[type].jobs[id]) {
            var fetchedJob = _.clone(self.queues[type].jobs[id]);
            delete fetchedJob.result;
            delete fetchedJob.workerId;

            cb && cb(fetchedJob);
        } else {
            cb && cb({err: 'No job found matching the criteria (type: ' + type + ', id: ' + id + ')'});
        }
    };

    self.clear = function (cb) {
        self.queues = [];
        cb && cb();
    };

    self.finishJob = function (type, id, status, cb) {
        if (_.isObject(self.queues[type]) &&
            _.isObject(self.queues[type].jobs) &&
            _.isObject(self.queues[type].jobs[id])) {

            _.remove(self.queues[type][self.queues[type].jobs[id].status], function (jobId) {
                return jobId === id;
            });

            if (_.isUndefined(self.queues[type][status])) {
                self.queues[type][status] = [];
            }

            if (!(self.queues[type].removeOnSuccess)) {
                self.queues[type][status].push(id);
                self.queues[type].jobs[id].status = status;
                self.queues[type].jobs[id].progress = 100;

                cb && cb(self.queues[type].jobs[id]);
            } else if (status === 'success') {
                self.removeJob(type, id);
                cb && cb(false);
            }
        } else {
            cb && cb(false);
        }
    };

    self.removeJob = function (type, id, cb) {
        self.queues[type].jobs = _.remove(self.queues[type].jobs, function (job) {
            return job.id === id;
        });

        cb && cb();
    };

    self.updateJobField = function (type, id, field, value, cb) {
        self.queues[type].jobs[id][field] = value;

        cb && cb();
    };

    self.getStats = function (cb) {
        var stats = [];
        _.forOwn(self.queues, function (value) {
            stats.push({
                type: value.type,
                active: value.active.length,
                pending: value.pending.length,
                success: value.success.length,
                failed: value.failed.length
            });
        });

        cb && cb(stats);
    };

    self.getJobResult = function (type, id, cb) {
        if (_.isObject(self.queues[type]) &&
            _.isObject(self.queues[type].jobs) &&
            _.isObject(self.queues[type].jobs[id]) &&
            _.isObject(self.queues[type].jobs[id].result)) {
            cb && cb(self.queues[type].jobs[id].result);
        } else {
            cb && cb([]);
        }
    };

    self.saveJobResult = function (type, id, result, cb) {
        if (_.isObject(self.queues[type]) && _.isObject(self.queues[type].jobs) &&
            _.isObject(self.queues[type].jobs[id])) {
            self.queues[type].jobs[id].result = result;
        }

        cb && cb();
    };

    self.checkChildren = function (children, cb) {
        var doneChildren = [];
        _(children).forEach(function (child) {
            var job = self.queues[child.type].jobs[child.id];
            if (job.status === 'success' || job.status === 'failed') {
                doneChildren.push({type: job.type, id: job.id});
            }
        });

        cb && cb(doneChildren);
    };

    self.getChildrenResults = function (children, cb) {
        var results = [];
        _(children).forEach(function (child) {
            if (self.queues[child.type].jobs[child.id].result) {
                results.push(self.queues[child.type].jobs[child.id].result);
            }
        });

        cb && cb(results);
    };

    self.jobCleanup = function (jobs, cb) {
        _(jobs).forEach(function (job) {
            self.finishJob(job.type, job.id, 'failed');
        });

        cb && cb();
    };

    return self;
};