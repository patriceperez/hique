# Work in progress...

feel free to contribute / open issues / create pull requests / fork, however use in production is highly discouraged

# Hique
hique is a redis-backed job queue for NodeJS.

## Introduction
hique is heavily inspired by [kue](https://github.com/Automattic/kue) and [bee-queue](https://github.com/LewisJEllis/bee-queue), and after using both frameworks pretty extensively I found that, though very well written, these frameworks do not fulfill two of my  most desired aspects in:
* Stability
* Scalability

hique was designed with these in mind.

#### Stability
hique differs from most frameworks by sacrificing a bit of performance to gain a much more stable environment, even when scaled up on different machines. 

#### Scalability
To scale hique to available cpus / machines, simply create a NodeJS process with a hique worker pointing to the same redis as every other worker and voila! scaling done easy.

### Installation
##### NPM
```
npm install hique
```
##### GitHub
```
npm install git+https://github.com/patriceperez/hique.git
```

## Getting Started
Here is a simple example on how to set up a basic worker and a few jobs for testing
```javascript
var hq = require('hique');

var worker = hq.Worker();
// tell the worker how to handle a job from type 'testJob'
worker.process('testJob', 5, function (job, done) {
    console.log('executed job %s with data %s', job.id, JSON.stringify(job.data));
    job.reportProgress(1, 1);
    done(null, job.data.test); // complete job and save it's result
});

// inject 13 jobs from type 'testJob' to the worker to handle
for (var i = 0; i < 13; i++) {
    worker.createJob('testJob', {test: i}).save(function (err, job) {
        console.log('save new job %s and data %s', job.id, JSON.stringify(job.data));
    });
}
```

check out the [examples](https://github.com/patriceperez/hique/tree/master/examples) folder for more use cases

## API Reference
### Table of Contents
- [Worker](https://github.com/patriceperez/hique#worker)
	- [Configuration](https://github.com/patriceperez/hique#configuration)
	- [Processing Jobs](https://github.com/patriceperez/hique#processing-jobs)
	- [Creating Jobs](https://github.com/patriceperez/hique#creating-jobs)
	- [Pause / Resume](https://github.com/patriceperez/hique#pause)
	- [Get Existing Job](https://github.com/patriceperez/hique#get-existing-job)
	- [Get Completed Job Result](https://github.com/patriceperez/hique#get-completed-job-result)
	- [Get System Status](https://github.com/patriceperez/hique#get-system-status)
- [Job](https://github.com/patriceperez/hique#job)
	- [Report Progress](https://github.com/patriceperez/hique#report-progress)
	- [Add Child](https://github.com/patriceperez/hique#add-child)
	- [Wait For Child Jobs](https://github.com/patriceperez/hique#wait-for-child-jobs)

### Worker
#### Configuration
```javascript
var worker = new Worker({
    redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
        options: {
            family: 4,
            keyPrefix: 'hq'
        }
    },
    refreshRate: 1000
});
```

Field|Description
-----|-----------
redis|same as the [ioredis config object](https://github.com/luin/ioredis/blob/master/API.md#new-redisport-host-options)
refreshRate|time in milliseconds to check for work in redis

The values represented here are the defaults when no options are provided to the worker constructor.

In order to override any of the fields, simply provide them with the required value to the constructor, as follows
```javascript
var worker = new Worker({
	redis:{
    	db: 1
	}
);
```

- Additionally an existing ioredis instance can be directly provided to the worker constructor

```javascript
var redisInstance = require('ioredis');
var Worker = new Worker({}, redisInstance);
```

#### Processing Jobs
Process a new job type
```javascript
worker.process(type, concurrency, function(job, done){
	// job logic
    done();
});
```
param|Description
-----|-----------
type|string literal represnting the job type
concurrenct (optional)|integer representing the amount of concurrent jobs the worker can handle simultaneously

#### Creating Jobs
Create a new job
```javascript
worker.createJob(type, data);
```
In order to save the new job object to redis so it can start work simplty add the `save` function as follows
```javascript
worker.createJob(type, data).save(function(err, job){
	// error handling and the created job object
});
```

param|Description
-----|-----------
type|string literal represnting the job type
data| JSON object providing data to the job execution function

#### Pause
Pause the worker from handling any new work
```javascript
worker.pause();
```
#### Resume
Resume the worker to handle any new work
```javascript
worker.start();
```

#### Get Existing Job
Get an existing job from redis with its current state
```javascript
worker.getJob(type, id, function(err, job){
	// error handling and the retrieved job object
});
```
param|Description
-----|-----------
type|string literal represnting the job type
id| integer representing the job id

#### Get Completed Job Result
Get a completed job's result
```javascript
worker.getJobResult(type, id, function(err, result){
	// error handling and the result of the job
});
```
param|Description
-----|-----------
type|string literal represnting the job type
id| integer representing the job id


#### Get System Status
Get an overview of each job type and its status (active, pending, etc...)
```javascript
worker.getStatus(function(err, status){
	// error handling and system status data
});
```

### Job
Job functions are available within the processing function, and can be used freely inside a `worker.process()` function

#### Report Progress
Report and save the current progress of the job
```javascript
job.reportProgress(step, total);
```
param|Description
-----|-----------
step|integer representing the current step progress from the total
total|integer representing the total amount of progress steps in the job

example: `job.reportProgress(5,10)` will result in 50% progress for the job

#### Add Child
Add a child job to the current job
```javascript
job.addChild(job);
```
param|Description
-----|-----------
job|a live Job object, usually gathered from a `worker.getJob()` or `worker.createJob()` functions

#### Wait For Child Jobs
Gather data from child jobs, previously added via `job.addChild()`
```javascript
job.waitForChildren(function(){
	// handle data from children
});
```
- usually when delegating to child jobs, one would want to keep the parent alive untill all the children are done, in which case a `done()` can be called inside the `job.waitForChildren()` callbac


## Testing
After cloning the repo, make sure a local redis instance is running with db1 available (**WARNING tests flush all data in db1**) and run
```javascript
npm test
```
