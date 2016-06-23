var keyUtils = require('./key-utils');

module.exports = function (type, data, monitor) {
    var self = this;
    self.monitor = monitor;
    var redisUtils = new keyUtils(self.monitor.config);
    self.id = null;
    self.type = type;
    self.data = data;
    self.status = 'created';
    self.progress = 0;

    self.progress = function (step, total) {
        self.progress = Math.floor(step / total * 100);
        self.updateRedis();
    };

    self.setStatus = function (newStatus) {
        self.status = newStatus;
        self.updateRedis();
    };

    self.updateRedis = function () {
        self.monitor.updateJob(self);
    };

    self.toRedis = function () {
        return JSON.stringify({
            id: self.id,
            type: self.type,
            data: self.data,
            status: self.status,
            progress: self.progress
        });
    };

    self.fromData = function (data) {
        self.id = data.id;
        self.type = data.type;
        self.data = data.data;
        self.status = data.status;
        self.progress = data.progress;

        return self;
    };

    self.save = function (cb) {
        self.monitor.createJob(self, function (err, job) {
            self.id = job.id;
            cb(err, job);
        });
    };

    return self;
};