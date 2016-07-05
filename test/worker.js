var chai = require('chai');
var assert = chai.assert;

var defaultConfig = require('../config/defaults');

var Worker = require('../lib/worker');

describe('Worker', function () {
    var testWorker;

    beforeEach(function () {
        testWorker = new Worker();
    });

    it('should construct default worker', function () {
        assert.isNotNull(testWorker, 'worker object is NULL');
    });

    it('should construct default worker monitor', function () {
        assert.isNotNull(testWorker.monitor, 'worker monitor object is NULL');
    });

    it('should construct default worker job', function () {
        assert.isNotNull(testWorker, 'worker job object is NULL');
    });

    it('should contain default config', function () {
        assert.equal(testWorker.config, defaultConfig, 'config object does not equal to defaults');
    });

    it('be active by default', function () {
        assert.isTrue(testWorker.active, 'active flag should be true');
    });

    it('be pausable', function () {
        testWorker.pause();
        assert.isNotTrue(testWorker.active, 'active flag should be false after pausing');
    });

    it('be able to resume from paused state', function () {
        testWorker.pause();
        testWorker.start();

        assert.isTrue(testWorker.active, 'active flag should be true after resuming work');
    });

    it('should create a job with no data', function (done) {
        testWorker.createJob('testJob').save(function (err, job) {
            if (err) throw err;
            assert.isNotNull(job.data, 'data object should not be null when no data was supplied');
            done();
        });
    });

    it('should get an existing job object', function (done) {
        testWorker.createJob('testJob').save(function (err, job) {
            if (err) throw err;

            testWorker.getJob('testJob', job.id, function (err, existingJob) {
                if (err) throw err;

                assert.equal(job.id, existingJob.id, 'existing job id should be equal to the one created');
                assert.equal(JSON.stringify(job.data), JSON.stringify(existingJob.data), 'existing job data should be equal to the one created');
                assert.equal(job.status, existingJob.status, 'existing job status should be equal to the one created');
                done();
            });
        });
    });

    it('should get all queues stats', function (done) {
        testWorker.getStatus(function (err, result) {
            assert.isNotNull(result, 'stats object cannot be NULL');
            done(err);
        });
    });
});