var chai = require('chai');
var async = require('async');
var assert = chai.assert;

process.env.DEBUG = '*';

var defaultConfig = require('../config/defaults');

var Worker = require('../lib/worker');
var Monitor = require('../lib/monitor');

describe('Worker', function () {
    var testWorker = null, testMonitor = null;

    before(function () {
        testMonitor = new Monitor();
        testMonitor.start();
        defaultConfig.refreshRate = 10;
    });

    beforeEach(function getTestWorker() {
        testMonitor.clear();
        testWorker = new Worker({refreshRate: 10});
    });

    afterEach(function (done) {
        testWorker.stop(done);
    });

    after(function () {
        testMonitor.stop();
        testMonitor = null;
        testWorker = null;
    });

    it('should construct default worker', function () {
        assert.isNotNull(testWorker, 'worker object is NULL');
    });

    it('should construct default worker monitor', function () {
        assert.isNotNull(testMonitor, 'worker monitor object is NULL');
    });

    it('should contain default config', function () {
        assert.deepEqual(testWorker.config, defaultConfig, 'config object does not equal to defaults');
    });

    it('should not be active by default', function () {
        assert.isFalse(testWorker.active, 'active flag should be true');
    });

    it('should be startable', function () {
        testWorker.start();
        assert.isTrue(testWorker.active, 'active flag should be false after pausing');
    });

    it('should be able to pause from active state', function () {
        testWorker.start();
        testWorker.pause();

        assert.isFalse(testWorker.active, 'active flag should be true after resuming work');
    });

    it('should create a job with no data', function (done) {
        testWorker.ready(function (worker) {
            worker.process('testJob', function (job, jobDone) {
                jobDone();
            });

            worker.createJob('testJob', {}, function (job) {
                assert.equal(JSON.stringify(job.data), '{}', 'data object should not be null when no data was supplied');
                done();
            });
        });
    });

    it('should get an existing job object', function (done) {
        testWorker.ready(function (worker) {
            worker.process('testJob', function (job, jobDone) {
                jobDone();
            });

            worker.createJob('testJob', {}, function (job) {
                worker.getJob('testJob', 1, function (existingJob) {
                    assert.deepEqual(job, existingJob, 'existing job should be equal to created job');
                    done();
                });
            });
        });
    });

    it('should get all queues stats', function (done) {
        testWorker.ready(function (worker) {
            worker.process('testJob', function (job, jobDone) {
                jobDone();
            });

            worker.process('testJob2', function (job, jobDone) {
                jobDone();
            });

            worker.getStats(function (stats) {
                assert.deepEqual(stats, [{type: 'testJob', active: 0, pending: 0, success: 0, failed: 0},
                    {
                        type: 'testJob2',
                        active: 0,
                        pending: 0,
                        success: 0,
                        failed: 0
                    }], 'stats object should contain 2 queues');
                done();
            });
        });
    });

    it('should know how to process jobs of type \'testJob\'', function (done) {
        testWorker.ready(function (worker) {
            worker.process('testJob', function (job, jobDone) {
                jobDone();
            });

            assert.isDefined(worker.queues['testJob'], 'no definition for \'testJob\' exists');
            assert.equal(worker.queues['testJob'].concurrency, 1, 'default concurrency definition should be 1');
            done();
        });
    });

    it('should calculate free work slots', function () {
        testWorker.ready(function (worker) {
            worker.process('testJob', function (job, jobDone) {
                jobDone();
            });

            var slots = worker.getFreeSlots();
            assert.deepEqual(slots, [{type: 'testJob', available: 1}], 'testJob should have 1 free slots');
        });
    });

    it('should process concurrency correctly', function () {
        testWorker.ready(function (worker) {
            worker.process('testJob', 10, function (job, jobDone) {
                jobDone();
            });

            var slots = worker.getFreeSlots();
            assert.equal(
                JSON.stringify(slots),
                JSON.stringify([{type: 'testJob', available: 10}]),
                'testJob should have 10 free slots');
        });
    });

    it('should create a valid done method for job processing', function (done) {
        testWorker.ready(function (worker) {
            worker.process('testJob', 10, function (job, jobDone) {
                jobDone();
            });

            worker.createJob('testJob', {}, function (job) {
                var doneMethod = worker.createDoneMethod(job);

                assert.isFunction(doneMethod, 'done method must be a function');
                done();
            });
        });
    });

    it('should create a done method for failed job processing', function (done) {
        testWorker.ready(function (worker) {
            worker.process('testJob', function (job, jobDone) {
                jobDone();
            });

            worker.createJob('testJob', {}, function (job) {
                var doneMethod = worker.createDoneMethod(job, function () {
                    testWorker.getJob(job.type, job.id, function (doneJob) {
                        assert.equal(doneJob.status, 'failed', 'job should fail when providing done method with an error');
                        assert.equal(doneJob.err, 'error', 'error should reflect the message input in done method');
                        done();
                    });
                });

                doneMethod('error');
            });
        });
    });

    it('should create a done method for successful job processing', function (done) {
        testWorker.ready(function (worker) {
            worker.process('testJob', function (job, jobDone) {
                jobDone();
            });

            worker.createJob('testJob', {}, function (job) {
                var doneMethod = worker.createDoneMethod(job, function () {
                    testWorker.getJob(job.type, job.id, function (doneJob) {
                        assert.equal(doneJob.status, 'success', 'job should succeed when providing proper done method');
                        done();
                    });
                });

                doneMethod();
            });
        });
    });

    it('should fetch a job result', function (done) {
        testWorker.ready(function (worker) {
            worker.process('testJob', function (innerJob, jobDone) {
                jobDone(null, {result: 1});
            });

            worker.createJob('testJob', {}, function (job) {
                var jobStatusCheck = setInterval(function () {
                    worker.getJob(job.type, job.id, function (innerJob) {
                        if (innerJob.status === 'success') {
                            clearInterval(jobStatusCheck);
                            worker.getJobResult(innerJob.type, innerJob.id, function (result) {
                                assert.deepEqual(result, {result: 1}, 'job did not execute properly');
                                done();
                            });
                        }
                    });
                }, 20);
            });

            worker.start();
        });
    });

    it('should fetch an empty result from a job without results', function (done) {
        testWorker.ready(function (worker) {
            worker.createJob('testJob2', {}, function (job) {
                worker.getJobResult(job.type, job.id, function (result) {
                    assert.deepEqual(result, [], 'job did not execute properly');
                    done();
                });
            });
        });
    });

    it('should wait for all child jobs to complete', function (done) {
        testWorker.ready(function (worker) {
            worker.process('testJob', function (innerJob, jobDone) {
                jobDone(null, {result: 2});
            });

            worker.process('testJobChildren', function (job, jobDone) {
                worker.createJob('testJob', {}, function (childJob) {
                    job.addChild(childJob);

                    job.waitForChildren(function (result) {
                        assert.deepEqual(result, [{result: 2}]);
                        jobDone();
                        done();
                    });
                });
            });
            worker.createJob('testJobChildren', {});
            worker.start();
        });
    });

    it('should wait for all child jobs to fail', function (done) {
        testWorker.ready(function (worker) {
            worker.process('testJob', function (job, jobDone) {
                jobDone('error');
            });

            worker.process('testJobChildren', function (job, jobDone) {
                worker.createJob('testJob', {}, function (childJob) {
                    job.addChild(childJob);

                    job.waitForChildren(function (result) {
                        assert.deepEqual(result, []);
                        jobDone();
                        done();
                    });
                });
            });
            worker.createJob('testJobChildren', {});
            worker.start();
        });
    });

    it('should crash job with unhandled exception', function (done) {
        testWorker.ready(function (worker) {
            worker.process('crashingJob', function (job, jobDone) {
                throw(new Error('crashed due to unhandled exception'));
            });

            worker.createJob('crashingJob', {}, function (job) {
                var jobInterval = setInterval(function () {
                    testWorker.getJob(job.type, job.id, function (updatedJob) {
                        if (updatedJob.status === 'crashed') {
                            clearInterval(jobInterval);
                            assert.equal(updatedJob.err, 'Error: crashed due to unhandled exception', 'error object should hold the details of the unhandled exception');
                            done();
                        }
                    });
                }, 100);
            });

            worker.start();
        });
    });

    it('should remove expired job objects', function (done) {
        testWorker.config.job.ttl = 0;
        testWorker.ready(function (worker) {
            worker.process('testCleanUpJob', function (job, jobDone) {
                assert.equal(worker.queues['testCleanUpJob'].jobs.length, 1, 'worker queue should contain 1 instance of \'testCleanUpJob\'');
                worker.activeJobCleanUp();
                assert.equal(worker.queues['testCleanUpJob'].jobs.length, 0, 'worker queue should contain no instance of \'testCleanUpJob\' after clean up');
                jobDone();
                done();
            });

            worker.start();
            worker.createJob('testCleanUpJob');
        });
    });

    it('should remove job from monitor on success', function (done) {
        testWorker.ready(function (worker) {
            worker.process('removedJob', function (job, jobDone) {
                jobDone();
            }, true);

            worker.createJob('removedJob', {}, function (job) {
                var jobInterval = setInterval(function () {
                    testWorker.getJob(job.type, job.id, function (updatedJob) {
                        if (updatedJob.err === 'No job found matching the criteria (type: removedJob, id: 1)') {
                            clearInterval(jobInterval);
                            assert.equal(updatedJob.err, 'No job found matching the criteria (type: removedJob, id: 1)');
                            done();
                        }
                    });
                }, 100);
            });

            worker.start();
        });
    });
});
