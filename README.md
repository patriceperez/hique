# Beta is live!

feel free to contribute / open issues / create pull requests / fork, 
however use in production at your own risk as bugs are bound to happen

# Hique 
[![npm version](https://badge.fury.io/js/hique.svg)](https://badge.fury.io/js/hique)
[![Build Status](https://travis-ci.org/patriceperez/hique.svg?branch=master)](https://travis-ci.org/patriceperez/hique)
[![Coverage Status](https://coveralls.io/repos/github/patriceperez/hique/badge.svg?branch=master)](https://coveralls.io/github/patriceperez/hique?branch=master&dummy=1)

hique is a job queue for NodeJS.

## Introduction
hique is heavily inspired by [kue](https://github.com/Automattic/kue) and [bee-queue](https://github.com/LewisJEllis/bee-queue), and after using both frameworks pretty extensively I found that, though very well written, these frameworks do not fulfill two of my  most desired aspects in:
* Stability
* Scalability

hique was designed with these in mind.

#### Stability
hique differs from most frameworks by sacrificing a bit of performance to gain a much more stable environment, even when scaled up on different machines. 

#### Scalability
To scale hique to available cpus / machines, simply create a NodeJS process with a hique worker pointing to the same monitor object as every other worker and voila! scaling done easy.

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
var hq = require('../lib/hique');

var monitor = new hq.Monitor();
var worker = new hq.Worker();

monitor.start();

worker.process('testJob', 5, function (job, done) {
    console.log('executed job %s with data %s', job.id, JSON.stringify(job.data));
    job.reportProgress(1, 1);
    done(null, job.data.test);
});

for (var i = 0; i < 13; i++) {
    worker.createJob('testJob', {test: i}, function (job) {
        console.log('save new job %s and data %s', job.id, JSON.stringify(job.data));
    });
}

worker.start();
```

check out the [examples](https://github.com/patriceperez/hique/tree/master/examples) folder for more use cases

## API Reference
### Table of Contents
- [Worker](#worker)
	- [Configuration](#configuration)
	- [Processing Jobs](#processing-jobs)
	- [Creating Jobs](#creating-jobs)
	- [Pause / Resume](#pause)
	- [Get Existing Job](#get-existing-job)
	- [Get Completed Job Result](#get-completed-job-result)
	- [Get System Status](#get-system-status)
- [Job](#job)
	- [Report Progress](#report-progress)
	- [Add Child](#add-child)
	- [Wait For Child Jobs](#wait-for-child-jobs)
- [Monitoring](#monitoring)
    - [Data Store](#data-store)
    - [Native - In Memory](#native---in-memory)
    - [Creating Your Own Data Store](#creating-your-own-data-store)

### Worker
#### Configuration
Default configuration for workers
```javascript
{
    job: {
        ttl: 5 * 60 * 1000
    },
    cleanUp: {
        active: true,
        refreshRate: 5 * 60 * 1000
    },
    refreshRate: 1000,
    monitor: {
        host: 'http://127.0.0.1',
        port: '3001'
    }
}
```

Any value can be overridden by providing a new value via the worker constructor: 
```javascript
new Worker({refreshRate: 2000})
```

Field|Description
-----|-----------
job.ttl|maximum time allowed (in milliseconds) for a job to stay active
cleanUp.active|should the cleanup process remove outdated data from the data store
cleanUp.refreshRate|interval (in milliseconds) between cleanup iterations
refreshRate|interval (in milliseconds) between job updates fetching in the data store
monitor.host|the host of the coordinating data store
monitor.port|the port the data store is listening on

#### Processing Jobs
Process a new job type
```javascript
worker.process(type, concurrency, function(job, done){
	// job logic
    done(error, result);
});
```
param|Description
-----|-----------
type|string literal representing the job type
concurrency (optional)|integer representing the amount of concurrent jobs the worker can handle simultaneously

#### Creating Jobs
Create a new job
```javascript
worker.createJob(type, data, function(job){
    //job object contains the job id as well as other meta data
});
```

param|Description
-----|-----------
type|string literal representing the job type
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
worker.getJob(type, id, function(job){
	//job object contains the job status as well as other meta data
});
```
param|Description
-----|-----------
type|string literal represnting the job type
id| integer representing the job id

#### Get Completed Job Result
Get a completed job's result
```javascript
worker.getJobResult(type, id, function(result){
	// handle result of the job
});
```
param|Description
-----|-----------
type|string literal representing the job type
id| integer representing the job id


#### Get System Stats
Get an overview of each job type and its status (active, pending, etc...)
```javascript
worker.getStats(function(stats){
	// handle system wide stats
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
After cloning the repo and resolving dependencies via `npm install`, run
```javascript
npm test
```

## Monitoring
### Data Store
hique saves all data in-memory by default. (using the 'native' adapter)
Data is stored inside the data store through an `adapter` object, which is highly extensible, allowing adapters be written for other data stores (mysql, mongo, redis, etc`) fairly easily

### Native - In Memory
The native adapter saves all data in-memory in the javascript's heap.
Since the heap is limited to about 1.2G by default (per process) it can be switched to any other adapter. 

### Creating Your Own Data Store
In order to create your own data store please follow these simple steps:
1. add a javascript file under the `lib/adapters` directory
2. copy the code from `stub.js` in order to get the interface of all adapters
3. implement all functions (refer to the `native.js` for more details about how to invoke the correct data in callbacks)
4. add any default configuration values to `config/default.js` under the `adapter` key to be passed at initialization, this will allow to pass a config object at runtime for specific hosts, ports, etc`

- If you have written an adapter, Don`t be shy! - share it with everyone here, programmers will get an additional way to use hique, and you will gain the power of the masses in discovering bugs and issues 
