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
                var createdJob = self.createJob(data.type, data.data || {});
                fn && fn(createdJob);
            });

            socket.on('registerQueue', function (data, fn) {
                self.registerQueue(data.type, data.concurrency);
                fn && fn();
            });

            socket.on('requestWork', function (data, fn) {
                fn && fn(self.getWork(socket.id, data.slots));
            });

            socket.on('getJob', function (data, fn) {
                fn && fn(self.getJob(data.type, data.jobId));
            });

            socket.on('finishJob', function (data, fn) {
                var finishedJob = self.finishJob(data.type, data.id, data.status);
                fn && fn(finishedJob);
            });

            socket.on('updateJobField', function (data, fn) {
                self.updateJobField(data.job.type, data.job.id, data.field, data.value);
                fn && fn();
            });

            socket.on('getStats', function (data, fn) {
                fn && fn(self.getStats());
            });

            socket.on('getJobResult', function (data, fn) {
                fn && fn(self.getJobResult(data.type, data.id));
            });

            socket.on('saveJobResult', function (data, fn) {
                self.saveJobResult(data.job.type, data.job.id, data.result);
                fn && fn();
            });

            socket.on('checkChildren', function (data, fn) {
                fn && fn(self.checkChildren(data));
            });

            socket.on('getChildrenResults', function (data, fn) {
                fn && fn(self.getChildrenResults(data));
            });

            socket.on('jobCleanup', function (data, fn) {
                self.jobCleanup(data);
                fn && fn();
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

    self.createJob = function (type, data) {
        return self.adapter.createJob(type, data);
    };

    self.registerQueue = function (type, concurrency) {
        return self.adapter.registerQueue(type, concurrency);
    };

    self.getWork = function (socket, slots) {
        return self.adapter.getWork(socket, slots);
    };

    self.getJob = function (type, id) {
        return self.adapter.getJob(type, id);
    };

    self.finishJob = function (type, id, status) {
        return self.adapter.finishJob(type, id, status);
    };

    self.updateJobField = function (type, id, field, value) {
        return self.adapter.updateJobField(type, id, field, value);
    };

    self.getStats = function () {
        return self.adapter.getStats();
    };

    self.getJobResult = function (type, id) {
        return self.adapter.getJobResult(type, id);
    };

    self.saveJobResult = function (type, id, result) {
        return self.adapter.saveJobResult(type, id, result);
    };

    self.checkChildren = function (children) {
        return self.adapter.checkChildren(children);
    };

    self.getChildrenResults = function (children) {
        return self.adapter.getChildrenResults(children);
    };

    self.clear = function () {
        self.adapter.clear();
    };

    self.jobCleanup = function (jobs) {
        self.adapter.jobCleanup(jobs);
    };

    return self;
};
