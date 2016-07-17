var async = require('async');
var _ = require('lodash');

module.exports = function (type, data, monitor) {
    var self = this;
    self.monitor = monitor;
    self.children = [];
    self.id = null;
    self.type = type;
    self.data = data || {};
    self.status = 'created';
    self.progress = 0;

    self.addChild = function (job) {
        self.children.push({type: job.type, id: job.id});
    };

    self.reportProgress = function (step, total, cb) {
        self.progress = Math.floor(step / total * 100);
        self.updateRedis('progress', cb);
    };

    self.setStatus = function (newStatus, cb) {
        self.status = newStatus;
        self.updateRedis('status', cb);
    };

    self.updateRedis = function (field, cb) {
        self.monitor.updateJob(self, field, cb);
    };

    self.toRedis = function () {
        return {
            id: self.id,
            type: self.type,
            data: JSON.stringify(self.data),
            status: self.status,
            progress: self.progress,
            err: self.err || null
        };
    };

    self.fromData = function (data) {
        self.id = data.id;
        self.type = data.type;
        self.data = data.data;
        self.status = data.status;
        self.progress = data.progress;
        self.err = data.err;

        return self;
    };

    self.waitForChildren = function (cb) {
        var results = [];
        var childInterval = setInterval(function checkForChildrenInterval() {
            async.each(self.children, function checkChildJob(child, callback) {
                self.monitor.getJob(child.type, child.id, function getJob(err, childJob) {
                    if (err) {
                        return callback(err);
                    }

                    if (childJob.status === 'completed') {
                        self.monitor.getJobResult(child.type, child.id, function getCompletedJobresult(err, result) {
                            results.push(result);
                        });
                        callback();
                    } else if (childJob.status === 'failed') {
                        callback({msg: 'child job failed', scope: childJob});
                        results.push([]);
                    }
                });
            }, function handleChildErrorAndFinalize(err) {
                self.reportProgress(results.length, self.children.length);

                if (results.length === self.children.length) {
                    cb(err, _.flattenDeep(results));
                    clearInterval(childInterval);
                } else {
                    results = [];
                }
            });
        }, self.monitor.config.refreshRate);
    };

    self.save = function (cb) {
        self.monitor.createJob(self, function getSavedJobDetails(err, job) {
            self.id = job.id;
            cb && cb(err, job);
        });
    };

    return self;
};