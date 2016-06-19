var hq = require('../lib/hique');

var worker = hq.Worker();
worker.process('testJob', 5, function (job, done) {
    console.log('executed job ' + job.id);
    done();
});

for (var i = 0; i < 10; i++) {
    worker.createJob('testJob', {}).save(function (err, job) {
        console.log('save new job ', job);
    });
}
