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
        //self.monitor.stop();
    };

    self.resume = function () {
        //self.monitor.start();
    };

    self.process = function (type, concurrency, jobLogic) {
        if (typeof concurrency === 'Function') {
            self.monitor.registerQueue(type, 1);
            self.queues[type] = {concurrency: 1, jobLogic: concurrency, jobs: []};
        } else {
            self.monitor.registerQueue(type, concurrency);
            self.queues[type] = {concurrency: concurrency, jobLogic: jobLogic, jobs: []};
        }
    };

    return self;
};