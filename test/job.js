var redisMock = require('redis-js');
var _ = require('lodash');
var chai = require('chai');
var assert = chai.assert;

var defaults = require('../config/defaults');

var Job = require('../lib/job');
var Monitor = require('../lib/monitor');

describe('Job', function () {
    var testMonitor;
    var testJob;

    before(function clearRedisData() {
        testMonitor = new Monitor(_.merge(defaults, {redis: {options: {db: 1}}}));
        testMonitor.redis.flushall();
    });

    beforeEach(function getTestJob() {
        testJob = new Job('testJob', {test: 1}, testMonitor);
    });

    after(function clearRedisData() {
        testMonitor.redis.flushall();
    });

    it('should initialize with no children', function () {
        assert.equal(testJob.children.length, 0, 'new job should have no children');
    });

    it('should serialize to a format redis can handle', function () {
        assert.deepEqual(
            testJob.toRedis(),
            {
                id: null,
                type: 'testJob',
                data: JSON.stringify({test: 1}),
                status: 'created',
                progress: 0
            },
            'serialized object differs from the expected format');
    });

    it('should create a live Job from JSON', function () {
        var deserialized = new Job(null, null, testMonitor).fromData({
            id: null,
            type: 'testJob',
            data: {
                test: 1
            },
            status: 'created',
            progress: 0
        });

        assert.equal(testJob.id, deserialized.id, 'id mismatch');
        assert.equal(testJob.type, deserialized.type, 'type mismatch');
        assert.deepEqual(testJob.data, deserialized.data, 'data mismatch');
        assert.equal(testJob.status, deserialized.status, 'status mismatch');
        assert.equal(testJob.progress, deserialized.progress, 'progress mismatch');
        assert.isFunction(testJob.toRedis, 'deserialized object is missing functions');
        assert.isFunction(testJob.addChild, 'deserialized object is missing functions');
    });

    it('should add child jobs', function (done) {
        new Job('testJob', null, testMonitor).save(function (err, job) {
            testJob.addChild(job);

            assert.deepEqual(testJob.children[0], {type: job.type, id: job.id}, 'mismatch job in job children');
            done();
        });
    });

    it('should report progress on job object', function (done) {
        new Job('testJob', null, testMonitor).save(function (err, job) {
            testJob.reportProgress(55, 100);

            assert.equal(testJob.progress, 55, 'job progress mismatch');
            done();
        });
    });

    it('should report progress in redis', function (done) {
        new Job('testJob', null, testMonitor).save(function (err, job) {
            testJob.reportProgress(55, 100, function (err, result) {
                assert.equal(result, 'OK');
                done();
            });
        });
    });
});