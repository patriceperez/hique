var hq = require('../lib/hique');

var worker = hq.Worker();
worker.process('testJob', 5, function (job, done) {
    console.log('executed job %s with data %s', job.id, JSON.stringify(job.data));
    job.reportProgress(1, 1);
    done(null, job.data.test);
});

for (var i = 0; i < 13; i++) {
    worker.createJob('testJob', {test: i}).save(function (err, job) {
        console.log('save new job %s and data %s', job.id, JSON.stringify(job.data));
    });
}