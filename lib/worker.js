var Monitor = require('./monitor');
var Job = require('./job');
var defaults = require('../config/defaults');
var _ = require('lodash');
var io = require('socket.io');
var ioClient = require('socket.io-client');

module.exports = function (config) {
    var self = this;
    self.config = _.defaultsDeep(config, defaults);
    self.queues = {};
    self.active = false;
    self.fetchingWork = false;
    self.readyFlag = false;

    self.socket = ioClient.connect(self.config.monitor.host + ':' + self.config.monitor.port, {
        transports: ['websocket'], path: '/socket.io'
    });

    self.on = function (event, cb) {
        self.socket.on(event, cb);
    };

    self.socket.on('connect', function () {
        self.readyFlag = true;
    });

    self.socket.on('disconnect', function () {
        self.readyFlag = false;
        self.ready(self.bootstrap);
    });

    self.socket.on('error', function (err) {
        console.log('err', err);
    });

    self.socket.on('connect_error', function (err) {
        console.log(err);
    });

    self.pause = function () {
        self.active = false;
        clearInterval(self.updateInterval);
        clearInterval(self.cleanUpInterval);
    };

    self.stop = function (cb) {
        self.queues = [];
        if (self.readyFlag) {
            self.socket.on('disconnect', function () {
                cb && cb();
            });
            self.socket.close();
        } else {
            cb && cb();
        }
    };

    self.start = function (cb) {
        self.active = true;
        self.updateInterval = setInterval(self.requestWork, self.config.refreshRate);
        self.cleanUpInterval = setInterval(self.activeJobCleanUp, self.config.cleanUp.refreshRate);

        if (!self.readyFlag) {
            self.socket.on('connect', function () {
                cb && cb();
            });
            self.socket.connect();
        } else {
            cb && cb();
        }
    };

    self.ready = function (cb) {
        var readyCheck = setInterval(function () {
            if (self.readyFlag) {
                clearInterval(readyCheck);
                self.bootstrap = cb && cb;
                self.bootstrap(self);
            }
        });
    };

    self.requestWork = function () {
        if (self.readyFlag && !(self.fetchingWork) && self.getFreeSlots().length > 0) {
            self.socket.emit('requestWork', {slots: self.getFreeSlots()}, function (newJobs) {
                if (newJobs.length > 0) {
                    self.fetchingWork = true;

                    newJobs.forEach(function executeNewJob(newJob) {
                        var newLiveJob = new Job(null, null, self).fromData(newJob);

                        try {
                            self.executeJob(newLiveJob);
                        } catch (e) {
                            newLiveJob.reportError(e.toString(), function () {
                                self.finishJob(newLiveJob, 'crashed');
                                self.clearActiveJob(newLiveJob);
                            });
                        }
                    });

                    self.fetchingWork = false;
                }
            });
        }
    };

    self.executeJob = function (job) {
        self.queues[job.type].jobs.push(job);

        job.execute(self.queues[job.type].jobLogic, self.createDoneMethod(job));
    };

    self.saveResult = function (job, result, cb) {
        self.socket.emit('saveJobResult', {job: {type: job.type, id: job.id}, result: result}, cb);
    };

    self.createDoneMethod = function (job, cb) {
        return function doneMethod(err, result) {
            if (err) {
                self.finishJob(job, 'failed', cb);
            } else {
                self.finishJob(job, 'success', cb);
                if (!_.isEmpty(result)) {
                    self.saveResult(job, result, function () {
                        result = null;
                    });
                }
            }

            self.clearActiveJob(job);
        }
    };

    self.clearActiveJob = function (job) {
        self.queues[job.type] &&
        self.queues[job.type].jobs &&
        _.remove(self.queues[job.type].jobs, function removeJobOnDone(activeJob) {
            return activeJob.id === job.id;
        });

        if (_.isUndefined(self.queues[job.type].jobs)) {
            self.queues[job.type].jobs = [];
        }
    };

    self.getFreeSlots = function () {
        var freeSlots = [];
        _.forOwn(self.queues, function getFreeSlotsForQueue(queue, type) {
            if (queue.jobs && queue.jobs.length < queue.concurrency) {
                freeSlots.push({type: type, available: queue.concurrency - queue.jobs.length})
            }
        });

        return freeSlots;
    };

    self.process = function (type, concurrency, jobLogic) {
        if (typeof concurrency === 'function') {
            self.registerQueue(type, 1);
            self.queues[type] = {concurrency: 1, jobLogic: concurrency, jobs: []};
        } else {
            self.registerQueue(type, concurrency);
            self.queues[type] = {concurrency: concurrency, jobLogic: jobLogic, jobs: []};
        }
        //console.log('process', type, self.queues[type].jobLogic.toString());
    };

    self.getJob = function (type, jobId, cb) {
        self.socket.emit('getJob', {type: type, jobId: jobId}, cb);
    };

    self.getStats = function (cb) {
        self.socket.emit('getStats', {}, cb);
    };

    self.activeJobCleanUp = function () {
        var jobsToClean = [];
        _(self.queues).forEach(function iterateOverActiveJobTypes(queue) {
            _(queue.jobs).forEach(function activeJobCleanup(job) {
                if (job.expired()) {
                    jobsToClean.push(job.serialize());
                    self.clearActiveJob(job);
                }
            });
        });

        self.jobCleanup(jobsToClean);
    };

    self.jobCleanup = function (jobs, cb) {
        self.socket.emit('jobCleanup', jobs, cb);
    };

    self.createJob = function (type, data, cb) {
        self.socket.emit('createJob', {type: type, data: data}, cb);
    };

    self.getJobResult = function (type, id, cb) {
        self.socket.emit('getJobResult', {type: type, id: id}, cb);
    };

    self.registerQueue = function (type, concurrency) {
        self.socket.emit('registerQueue', {type: type, concurrency: concurrency});
    };

    self.finishJob = function (job, status, cb) {
        self.socket.emit('finishJob', {type: job.type, id: job.id, status: status}, function (updatedJob) {
            var currentJob = _.find(self.queues[job.type].jobs, {id: job.id});
            currentJob = updatedJob;

            cb && cb();
        });
    };

    return self;
};
