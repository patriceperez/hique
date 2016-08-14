var chai = require('chai');
var async = require('async');
var redis = new require('ioredis')({db: 1});
var assert = chai.assert;

var defaultConfig = require('../config/defaults');

var Worker = require('../lib/worker');

describe('Worker', function () {
    var testWorker = null;

    beforeEach(function getTestWorker(done) {
        async.during(function (callback) {
            redis.keys('*', function (err, keys) {
                //console.log('keys', keys.length);
                callback(null, keys.length > 0);
            });
        }, function (callback) {
            redis.flushall(function (err) {
                callback(err);
            });
        }, function (err) {
            if (err) console.log(err);
            testWorker = new Worker({redis: {db: 1}, refreshRate: 40});
            testWorker.process('testJob', 10, function (job, jobDone) {
                jobDone(null, {result: 1});
            });

            testWorker.process('testJob2', 20, function (job, jobDone2) {
                jobDone2('fail');
            });

            done();
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
        testWorker.createJob('testJob').save(function (err, job) {
            assert.equal(JSON.stringify(job.data), '{}', 'data object should not be null when no data was supplied');
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

    it('should know how to process jobs of type \'testJob\'', function () {
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
            'testJob2 should have 20 free slot');
    });

    it('should create a valid done method for job processing', function (done) {
        testWorker.createJob('testJob').save(function (err, job) {
            var doneMethod = testWorker.createDoneMethod(job);

            assert.isFunction(doneMethod, 'done method must be a function');
            done();
        });
    });

    it('should create a done method for failed job processing', function (done) {
        testWorker.createJob('testJob2').save(function (err, job) {
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
        testWorker.createJob('testJob').save(function (err, job) {
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
                assert.isNull(err);
                assert.deepEqual(result, {result: 1}, 'job did not execute properly');
                done();
            });
        });
    });

    it('should fetch an empty result from a job without results', function (done) {
        testWorker.createJob('testJob2').save(function (err, job) {
            testWorker.getJobResult(job.type, job.id, function (err, result) {
                assert.deepEqual(result, [], 'job did not execute properly');
                done();
            });
        });
    });

    it('should have no work to fetch when paused', function (done) {
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
        testWorker.start();
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
        testWorker.start();
    });

    it('should crash job with unhandled exception', function (done) {
        testWorker.process('crashingJob', function (job, crashingDone) {
            throw(new Error('crashed due to unhandled exception'));
        });

        testWorker.createJob('crashingJob').save(function (err, job) {
            var jobInterval = setInterval(function () {
                testWorker.getJob(job.type, job.id, function (err, job) {
                    if (job.status === 'crashed') {
                        clearInterval(jobInterval);
                        assert.equal(job.err, 'Error: crashed due to unhandled exception', 'error object should hold the details of the unhandled exception');
                        done();
                    }
                });
            }, 50);
        });
        testWorker.start();
    });

    it('should clean up detached ids in redis queues', function (done) {
        testWorker.createJob('testJob').save(function (err, job) {
            testWorker.createJob('testJob2').save(function (err, childJob) {
                testWorker.monitor.redis.del('hq:testJob:jobs:' + childJob.id, function (err) {
                    testWorker.cleanUp(function () {
                        testWorker.monitor.redis.get('hq:testJob:pending', function (err, result) {
                            assert.isNull(result, 'job id should not be present in pending queue once the job was removed');
                            done();
                        });
                    });
                });
            });
        });
    });

    it('should remove expired job objects', function (done) {
        testWorker.config.job.ttl = 0;
        testWorker.process('testCleanUpJob', function (job, jobDone) {
            assert.equal(testWorker.queues['testCleanUpJob'].jobs.length, 1, 'worker queue should contain 1 instance of \'testCleanUpJob\'');
            testWorker.activeJobCleanUp();
            assert.equal(testWorker.queues['testCleanUpJob'].jobs.length, 0, 'worker queue should contain no instance of \'testCleanUpJob\' after clean up');
            jobDone();
            done();
        });
        testWorker.start();
        testWorker.createJob('testCleanUpJob').save();
    });
});