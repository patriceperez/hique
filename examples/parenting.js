var hq = require('../lib/hique');

var worker = hq.Worker();

worker.process('testJobParent', function (job, done) {
    for (var i = 0; i < 13; i++) {
        worker.createJob('testJob', {test: i}).save(function (err, childJob) {
            job.addChild(childJob);
        });
    }

    job.waitForChildren(function (err, results) {
        console.log('parent done with results from children', results);
        done();
        process.exit();
    });
});


worker.process('testJob', 5, function (job, done) {
    console.log('executed child job %s with data %s', job.id, JSON.stringify(job.data));
    job.reportProgress(1, 1);
    done(null, job.data);
});

worker.createJob('testJobParent').save(function (err, job) {
    console.log('save new parent job %s and data %s', job.id, JSON.stringify(job.data));
});

worker.start();