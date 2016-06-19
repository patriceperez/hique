var chai = require('chai');
var assert = chai.assert;

var defaultConfig = require('../config/defaults');

var Worker = require('../lib/worker');

describe('Worker', function () {
    it('should construct default worker', function () {
        var testWorker = new Worker();

        assert.isNotNull(testWorker, 'worker object is NULL');
    });

    it('should construct default worker monitor', function () {
        var testWorker = new Worker();

        assert.isNotNull(testWorker.monitor, 'worker monitor object is NULL');
    });

    it('should construct default worker job', function () {
        var testWorker = new Worker();

        assert.isNotNull(testWorker, 'worker job object is NULL');
    });

    it('should contain default config', function () {
        var testWorker = new Worker();

        assert.equal(testWorker.config, defaultConfig, 'config object does not equal to defaults');
    });
});