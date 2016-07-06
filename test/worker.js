var redisMock = require('redis-js');
var chai = require('chai');
var assert = chai.assert;

var defaultConfig = require('../config/defaults');

var Worker = require('../lib/worker');

describe('Worker', function () {
    var testWorker;

    beforeEach(function getTestWorker() {
        testWorker = new Worker({redis: {db: 1}, refreshRate: 100});
        testWorker.monitor.redis.flushall();
        testWorker.process('testJob', 10, function (job, done) {
            done(null, {result: 1});
        });

        testWorker.process('testJob2', 20, function (job, done) {
            done('fail');
        });
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
        testWorker.pause();
        testWorker.createJob('testJob').save(function (err, job) {
            if (err) throw err;
            assert.equal(JSON.stringify(job.data), '{}', 'data object should not be null when no data was supplied');
            done();
        });
    });

    it('should get an existing job object', function (done) {
        testWorker.pause();
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

    it('should know how to process jobs of type \'testJob\'', function () {
        testWorker.pause();

        assert.isDefined(testWorker.queues['testJob'], 'no definition for \'testJob\' exists');
        assert.equal(testWorker.queues['testJob'].concurrency, 10, 'default concurrency definition should be 1');
    });

    it('should calculate free work slots', function () {
        var slots = testWorker.getFreeSlots();
        assert.equal(
            JSON.stringify(slots),
            JSON.stringify([{type: 'testJob', available: 10}, {"type": "testJob2", "available": 20}]),
            'testJob should have 10 free slots, testJob2 should have 20 free slots');
    });

    it('should process concurrency correctly', function () {
        testWorker.process('testJob2', 20, function (job, done) {
            done();
        });

        var slots = testWorker.getFreeSlots();

        assert.equal(
            JSON.stringify(slots),
            JSON.stringify([
                {type: 'testJob', available: 10},
                {type: 'testJob2', available: 20}
            ]),
            'testJob2 should have 2 free slot');
    });

    it('should create a valid done method for job processing', function (done) {
        testWorker.createJob('testJob').save(function (err, job) {
            var doneMethod = testWorker.createDoneMethod(job);

            assert.isFunction(doneMethod, 'done method must be a function');
            done();
        });
    });

    it('should create a done method for failed job processing', function (done) {
        testWorker.process('failingJob', function (job, done) {
            done('fail');
        });

        testWorker.createJob('failingJob').save(function (err, job) {
            testWorker.getWork(function () {
                var doneMethod = testWorker.createDoneMethod(job, function () {
                    testWorker.getJob(job.type, job.id, function (err, doneJob) {
                        assert.equal(doneJob.status, 'failed', 'job should fail when providing done method with an error');
                        done();
                    });
                });

                doneMethod('error');
            });
        });
    });

    it('should create a done method for successful job processing', function (done) {
        testWorker.createJob('testJob2').save(function (err, job) {
            testWorker.getWork(function () {
                var doneMethod = testWorker.createDoneMethod(job, function () {
                    testWorker.getJob(job.type, job.id, function (err, doneJob) {
                        assert.equal(doneJob.status, 'completed', 'job should succeed when providing done method without an error');
                        done();
                    });
                });

                doneMethod();
            });
        });
    });

    it('should fetch a job result', function (done) {
        testWorker.createJob('testJob').save(function (err, job) {
            testWorker.executeJob(job, function (job, jobDone) {
                jobDone(null, {result: 1});
            });

            testWorker.getJobResult(job.type, job.id, function (err, result) {
                assert.deepEqual(result, {result: 1}, 'job did not execute properly');
                done();
            });
        });
    });

    it('should fetch an empty result from a job without results', function (done) {
        testWorker.createJob('testJob').save(function (err, job) {
            testWorker.getJobResult(job.type, job.id, function (err, result) {
                assert.deepEqual(result, [], 'job did not execute properly');
                done();
            });
        });
    });

    it('should have no work to fetch when paused', function (done) {
        testWorker.pause();
        testWorker.getWork(function (newJobs) {
            assert.deepEqual(newJobs, []);
            done();
        });
    });

    it('should wait for all child jobs to complete', function (done) {
        testWorker.process('testJobChildren', function (job, jobDone) {
            testWorker.createJob('testJob').save(function (err, childJob) {
                job.addChild(childJob);

                job.waitForChildren(function (err, result) {
                    assert.deepEqual(result, [{result: 1}]);
                    jobDone();
                    done();
                });
            });
        });
        testWorker.createJob('testJobChildren').save();
    });

    it('should wait for all child jobs to fail', function (done) {
        testWorker.process('testJobChildren2', function (job, jobDone) {
            testWorker.createJob('testJob2').save(function (err, childJob) {
                job.addChild(childJob);

                job.waitForChildren(function (err, result) {
                    assert.deepEqual(result, []);
                    jobDone();
                    done();
                });
            });
        });
        testWorker.createJob('testJobChildren2').save();
    });
});