module.exports = function (config) {
    var self = this;

    self.registerQueue = function (type, concurrency, removeOnSuccess, cb) {
    };
    self.getWork = function (socket, slots, cb) {
    };
    self.createJob = function (type, data, cb) {
    };
    self.getJob = function (type, id, cb) {
    };
    self.clear = function (cb) {
    };
    self.finishJob = function (type, id, status, cb) {
    };
    self.removeJob = function (type, id, cb) {
    };
    self.updateJobField = function (type, id, field, value, cb) {
    };
    self.getStats = function (cb) {
    };
    self.getJobResult = function (type, id, cb) {
    };
    self.saveJobResult = function (type, id, result, cb) {
    };
    self.checkChildren = function (children, cb) {
    };
    self.getChildrenResults = function (children, cb) {
    };
    self.jobCleanup = function (jobs, cb) {
    };

    return self;
};
