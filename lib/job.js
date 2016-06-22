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

    self.updateRedis = function (cb) {
        self.monitor.hset(redisUtils.toKey(self.type, 'jobs'), self.id, self.toRedis(), cb);
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

    self.save = function (cb) {
        self.monitor.createJob(self, function (err, job) {
            self.id = job.id;
            cb(err, job);
        });
    };

    return self;
};