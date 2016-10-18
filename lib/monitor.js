var async = require('async');
var _ = require('lodash');
var http = require('http');
var url = require('url');
var io = require('socket.io');
var adapters = require('./adapters')();
var defaults = require('../config/defaults');

module.exports = function (config) {
    var self = this;

    self.server = http.createServer();
    self.paused = true;
    self.config = _.defaultsDeep(config, defaults);
    self.workers = {};
    self.adapter = new adapters[self.config.adapter.type || 'native'](self.config.adapter);

    self.start = function () {
        self.server.listen(self.config.monitor.port);

        self.listener = io.listen(self.server);
        self.listener.sockets.on('connection', function (socket) {
            self.workers[socket.id] = socket;

            socket.on('createJob', function (data, fn) {
                self.createJob(data.type, data.data || {}, fn);
            });

            socket.on('registerQueue', function (data, fn) {
                self.registerQueue(data.type, data.concurrency, data.removeOnsSuccess, fn);
            });

            socket.on('requestWork', function (data, fn) {
                self.getWork(socket.id, data.slots, fn);
            });

            socket.on('getJob', function (data, fn) {
                self.getJob(data.type, data.jobId, fn);
            });

            socket.on('finishJob', function (data, fn) {
                self.finishJob(data.type, data.id, data.status, fn);
            });

            socket.on('updateJobField', function (data, fn) {
                self.updateJobField(data.job.type, data.job.id, data.field, data.value, fn);
            });

            socket.on('getStats', function (data, fn) {
                self.getStats(fn);
            });

            socket.on('getJobResult', function (data, fn) {
                self.getJobResult(data.type, data.id, fn);
            });

            socket.on('saveJobResult', function (data, fn) {
                self.saveJobResult(data.job.type, data.job.id, data.result, fn);
            });

            socket.on('checkChildren', function (data, fn) {
                self.checkChildren(data, fn);
            });

            socket.on('getChildrenResults', function (data, fn) {
                self.getChildrenResults(data, fn);
            });

            socket.on('jobCleanup', function (data, fn) {
                self.jobCleanup(data, fn);
            });
        });

        self.listener.sockets.on('disconnect', function (socket) {
            self.workers.splice(self.workers.indexOf(socket), 1);
        });
    };

    self.stop = function () {
        self.clear();

        _(self.workers).forEach(function (worker) {
            worker.disconnect();
        });

        self.workers = {};
        self.listener && self.listener.close();
        self.server && self.server.close();
    };

    self.createJob = function (type, data, cb) {
        return self.adapter.createJob(type, data, cb);
    };

    self.registerQueue = function (type, concurrency, removeOnSuccess, cb) {
        return self.adapter.registerQueue(type, concurrency, removeOnSuccess, cb);
    };

    self.getWork = function (socket, slots, cb) {
        return self.adapter.getWork(socket, slots, cb);
    };

    self.getJob = function (type, id, cb) {
        return self.adapter.getJob(type, id, cb);
    };

    self.finishJob = function (type, id, status, cb) {
        return self.adapter.finishJob(type, id, status, cb);
    };

    self.updateJobField = function (type, id, field, value, cb) {
        return self.adapter.updateJobField(type, id, field, value, cb);
    };

    self.getStats = function (cb) {
        return self.adapter.getStats(cb);
    };

    self.getJobResult = function (type, id, cb) {
        return self.adapter.getJobResult(type, id, cb);
    };

    self.saveJobResult = function (type, id, result, cb) {
        return self.adapter.saveJobResult(type, id, result, cb);
    };

    self.checkChildren = function (children, cb) {
        return self.adapter.checkChildren(children, cb);
    };

    self.getChildrenResults = function (children, cb) {
        return self.adapter.getChildrenResults(children, cb);
    };

    self.clear = function (cb) {
        self.adapter.clear(cb);
    };

    self.jobCleanup = function (jobs, cb) {
        self.adapter.jobCleanup(jobs, cb);
    };

    return self;
};
