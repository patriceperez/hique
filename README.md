# Hique 
[![npm version](https://badge.fury.io/js/hique.svg)](https://badge.fury.io/js/hique)
[![Build Status](https://travis-ci.org/patriceperez/hique.svg?branch=master)](https://travis-ci.org/patriceperez/hique)
[![Coverage Status](https://coveralls.io/repos/github/patriceperez/hique/badge.svg?branch=master)](https://coveralls.io/github/patriceperez/hique?branch=master&dummy=1)
hique is a job queue for NodeJS.

feel free to contribute / open issues / create pull requests / fork

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
For all setup and technical usage information please consult the [wiki](https://github.com/patriceperez/hique/wiki/1.-Home)

## The MIT License (MIT)

Copyright (c) 2016 Patrice Perez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
