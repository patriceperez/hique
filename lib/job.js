var _ = require('lodash');

module.exports = function (type, data, worker) {
    var self = this;
    self.children = [];
    self.id = null;
    self.type = type;
    self.data = data || {};
    self.status = 'created';
    self.startTime = null;
    self.endTime = null;
    self.progress = 0;
    self.logic = null;
    self.worker = worker && worker;

    self.addChild = function (job) {
        self.children.push({type: job.type, id: job.id});
    };

    self.reportProgress = function (step, total, cb) {
        self.progress = Math.floor(step / total * 100);
        self.worker.socket.emit('updateJobField', {
            job: {type: self.type, id: self.id},
            field: 'progress',
            value: self.progress
        }, cb);
    };

    self.setStatus = function (newStatus, cb) {
        self.status = newStatus;
        self.worker.socket.emit('updateJobField', {
            job: {type: self.type, id: self.id},
            field: 'status', value: self.status
        }, cb);
    };

    self.setStartTime = function (startTime, cb) {
        self.startTime = startTime;
        self.worker.socket.emit('updateJobField', {
            job: {type: self.type, id: self.id},
            field: 'startTime', value: self.startTime
        }, cb);
    };

    self.reportError = function (err, cb) {
        self.err = err;
        self.worker.socket.emit('updateJobField', {
            job: {type: self.type, id: self.id},
            field: 'err', value: self.err
        }, cb);
    };

    self.serialize = function () {
        return {
            id: self.id,
            type: self.type,
            data: JSON.stringify(self.data),
            status: self.status,
            startTime: self.startTime || null,
            endTime: self.endTime || null,
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
        self.startTime = data.startTime || null;
        self.endtime = data.endTime || null;
        self.err = data.err;

        return self;
    };

    self.execute = function (jobLogic, doneMethod) {
        self.setStatus('active');
        self.logic = jobLogic;
        self.setStartTime(Date.now());
        self.logic(self, doneMethod);
    };

    self.waitForChildren = function (cb) {
        var checkInterval = setInterval(function () {
            self.worker.socket.emit('checkChildren', self.children, function (doneJobs) {
                var childrenInProgress = _.differenceBy(self.children, doneJobs, function (value) {
                    return value.type + value.id;
                });

                self.reportProgress(self.children.length - childrenInProgress.length, self.children.length, function () {
                    if (_.isEmpty(childrenInProgress)) {
                        clearInterval(checkInterval);
                        self.getChildrenResults(function (results) {
                            cb && cb(results);
                        });
                    }
                });
            });
        }, self.worker.config.refreshRate);
    };

    self.getChildrenResults = function (cb) {
        self.worker.socket.emit('getChildrenResults', self.children, cb);
    };

    self.expired = function () {
        return Date.now() - self.startTime >= self.worker.config.job.ttl;
    };

    return self;
};
