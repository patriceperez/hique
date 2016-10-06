var hq = require('../lib/hique');

var monitor = new hq.Monitor();
var worker = new hq.Worker();

monitor.start();

worker.process('testJobParent', function (job, done) {
    for (var i = 0; i < 13; i++) {
        worker.createJob('testJob', {test: i}, function (childJob) {
            job.addChild(childJob);
        });
    }

    job.waitForChildren(function (results) {
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

worker.createJob('testJobParent', {}, function (job) {
    console.log('save new parent job %s and data %s', job.id, JSON.stringify(job.data));
});

worker.start();