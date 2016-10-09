var _ = require('lodash');

module.exports = function (config) {
    var self = this;
    self.queues = {};

    self.registerQueue = function (type, concurrency, removeOnSuccess) {
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
    };

    self.getWork = function (socket, slots) {
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

        return jobs;
    };

    self.createJob = function (type, data) {
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

            return self.queues[type].jobs[self.queues[type].latestId];
        } else return {err: 'cannot create job without an associated registered queue'};
    };

    self.getJob = function (type, id) {
        if (_.isObject(self.queues[type]) &&
            _.isObject(self.queues[type].jobs) &&
            _.isObject(self.queues[type].jobs[id]) &&
            self.queues[type].jobs[id]) {
            var fetchedJob = _.clone(self.queues[type].jobs[id]);
            delete fetchedJob.result;
            delete fetchedJob.workerId;

            return fetchedJob;
        } else {
            return {err: 'No job found matching the criteria (type: ' + type + ', id: ' + id + ')'};
        }
    };

    self.clear = function () {
        self.queues = [];
    };

    self.finishJob = function (type, id, status) {
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

                return self.queues[type].jobs[id];
            } else if (status === 'success') {
                self.removeJob(type, id);
                return false;
            }
        } else return false;
    };

    self.removeJob = function (type, id) {
        self.queues[type].jobs = _.remove(self.queues[type].jobs, function (job) {
            return job.id === id;
        });
    };

    self.updateJobField = function (type, id, field, value) {
        self.queues[type].jobs[id][field] = value;
    };

    self.getStats = function () {
        var stats = [];
        _.forOwn(self.queues, function (value, key) {
            stats.push({
                type: value.type,
                active: value.active.length,
                pending: value.pending.length,
                success: value.success.length,
                failed: value.failed.length
            });
        });

        return stats;
    };

    self.getJobResult = function (type, id) {
        if (_.isObject(self.queues[type]) &&
            _.isObject(self.queues[type].jobs) &&
            _.isObject(self.queues[type].jobs[id]) &&
            _.isObject(self.queues[type].jobs[id].result)) {
            return self.queues[type].jobs[id].result
        } else {
            return [];
        }
    };

    self.saveJobResult = function (type, id, result) {
        if (_.isObject(self.queues[type]) && _.isObject(self.queues[type].jobs) &&
            _.isObject(self.queues[type].jobs[id])) {
            self.queues[type].jobs[id].result = result;
        }
    };

    self.checkChildren = function (children) {
        var doneChildren = [];
        _(children).forEach(function (child) {
            var job = self.getJob(child.type, child.id);
            if (job.status === 'success' || job.status === 'failed') {
                doneChildren.push({type: job.type, id: job.id});
            }
        });

        return doneChildren;
    };

    self.getChildrenResults = function (children) {
        var results = [];
        _(children).forEach(function (child) {
            results.push(self.getJobResult(child.type, child.id));
        });

        return results;
    };

    self.jobCleanup = function (jobs) {
        _(jobs).forEach(function (job) {
            self.finishJob(job.type, job.id, 'failed');
        });
    };

    return self;
};