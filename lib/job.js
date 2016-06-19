module.exports = function (type, data, monitor) {
    var self = this;
    self.monitor = monitor;
    self.id = null;
    self.type = type;
    self.data = data;
    self.status = 'created';
    self.progress = 0;

    self.toRedis = function () {
        return JSON.stringify({
            data: self.data,
            status: self.status,
            progress: self.progress
        });
    };

    self.save = function (cb) {
        self.monitor.createJob(self, cb);
    };

    return self;
};