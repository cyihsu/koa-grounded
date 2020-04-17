# koa-grounded
> A distributed rate-limit middleware for Koa 2, inspired by Dcard's intern preliminary project.

[![Build Status](https://travis-ci.org/cyihsu/koa-grounded.svg?branch=master)](https://travis-ci.org/cyihsu/koa-grounded)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![Weekly Downloads](https://img.shields.io/npm/dw/koa-grounded)](https://img.shields.io/npm/dw/koa-grounded)
[![HitCount](http://hits.dwyl.com/cyihsu/koa-grounded.svg)](http://hits.dwyl.com/cyihsu/koa-grounded)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fcyihsu%2Fkoa-grounded.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fcyihsu%2Fkoa-grounded?ref=badge_shield)

[![asciicast](https://asciinema.org/a/JDWi8oUmqbLNjZL4gakvhJa3n.svg)](https://asciinema.org/a/JDWi8oUmqbLNjZL4gakvhJa3n)
<p align="center">
  Watch it in action on <a href="https://asciinema.org/a/JDWi8oUmqbLNjZL4gakvhJa3n">asciinema</a>
</p>

# Quick Start

## Install

```shell
$ yarn add koa-grounded
```

## Basic Usage

```javascript
const Koa = require('koa');
const Grounded = require('koa-grounded');

const app = new Koa();

// Remember to set app.proxy flag if you are using under a reverse proxy
app.proxy = true;

const RateLimiter = Grounded({
  partitionKey: 'grounded',
  ratelimit: 1000,
  globalEXP: 60 * 60 * 1000 * 1000, // expiration time in μs
  timeout: 2000,
  cacheSize: 500,
  dbStr: 'redis://127.0.0.1:6379/',
  verbose: true,
});

// Grounded Middleware
app.use(RateLimiter);

// Ping Pong
app.use(async (ctx) => {
  ctx.body = 'Pong!';
});

// Using IPv4 instead of IPv6;
app.listen(4000, '0.0.0.0');

console.log('listening on port 4000');
```

See the document [#API](#API) for further informations.


# API
| Param        | Type      | Description                                                                                                                                                                                                                                                              |
|--------------|-----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| partitionKey | `string`  | A partition key for current Rate-Limiter to listen, will create `${partitionKey}-exp`, `${partitionKey}-remaining` and `${partitionKey}-ban` keys on Redis Instance, and subscribe to `${partitionKey}-ban` and `${partitionKey}-unban` channels |
| ratelimit    | `number`  | Ratelimit for each user's session |
| globalEXP    | `number`  | Expiration time for user's ratelimit session, in `microseconds`(10^-6 seconds) unit |
| timeout      | `number`  | Worker-Redis synchronization intervals, in `miliseconds`(10^-3 seconds) unit, it is suggested to modify the value as fast as the worker localQueue size reaches MTU size |
| cacheSize    | `number`  | Maxmimum key size stored on local LRU cache |
| dbStr        | `string`  | Connection string to the Redis instance, see [luin/ioredis#connect-to-redis](https://github.com/luin/ioredis#connect-to-redis) for further information |
| verbose      | `boolean` | Showing access log informations or not |

# Running tests

```shell
$ yarn test
```

# Overview
## Concept
### Introduction
Since Redis is fast enough for its in-memory data operations, the bottleneck of a Redis connection is the **Round-Trip Time(RTT)**, which may dramatically affects throughputs of services having Redis as the centralized datastore.

This approach implemented a **Eventually consistency and Availability-Partition tolerance(AP)** approach using **pipelined Lua scripts**, **LRU cache** and **Pub/Sub** to optimize the throughput of the Rate-Limit service, and it is also capable of:
  - [X] sharing states among all workers
  - [X] key-space partitioning
  - [X] Ratelimiting

As a result, we can **achieve 10x faster** than normal non-pipelined Redis approach with such optimization(See [#Benchmark](#Benchmark) for details).

### Implementation
WIP

## Benchmark
### One Worker, local Redis
_(Redis Instance on Intel Core i7 9850H, 16GB RAM, macOS 10.15.3)_

#### Ping RTT
```shell
--- localhost ping statistics ---
20 packets transmitted, 20 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 0.050/0.093/0.113/0.017 ms
```

#### using koajs/ratelimit
```shell
➜  ~ wrk -t12 -c1200 -d5s
Running 5s test
  12 threads and 1200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    34.73ms   20.94ms 627.03ms   81.09%
    Req/Sec   760.13    236.27     1.42k    74.61%
  39505 requests in 5.07s, 11.05MB read
  Socket errors: connect 0, read 623, write 0, timeout 0
  Non-2xx or 3xx responses: 38505
Requests/sec:   7794.90
Transfer/sec:      2.18MB
```

#### our implementation
```shell
➜  ~ wrk -t12 -c1200 -d5s
Running 5s test
  12 threads and 1200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    13.74ms   11.99ms 479.43ms   98.00%
    Req/Sec     1.53k   592.69     3.90k    77.36%
  84128 requests in 5.10s, 18.43MB read
  Socket errors: connect 0, read 529, write 0, timeout 0
  Non-2xx or 3xx responses: 83128
Requests/sec:  16500.27
Transfer/sec:      3.61MB
```

### One Worker, remote Redis
_(Redis Instance located on TANet, vSphere6.7, 1vCPU 2GB RAM, CentOS7 + docker 19.03)_

#### Ping RTT
```shell
--- Remote-Redis ping statistics ---
20 packets transmitted, 20 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 19.858/67.130/250.806/61.965 ms
```

#### using koajs/ratelimit
```shell
➜  ~ wrk -t12 -c1200 -d5s
Running 5s test
  12 threads and 1200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency   129.69ms   56.67ms 632.29ms   71.43%
    Req/Sec   155.99     71.33   323.00     65.16%
  7712 requests in 5.10s, 2.10MB read
  Socket errors: connect 0, read 625, write 0, timeout 0
  Non-2xx or 3xx responses: 6712
Requests/sec:   1513.19
Transfer/sec:    422.69KB
```
#### our implementation
```shell
➜  ~ wrk -t12 -c1200 -d5s
Running 5s test
  12 threads and 1200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    16.75ms   12.07ms 449.36ms   76.08%
    Req/Sec     1.48k   526.48     3.13k    74.82%
  81097 requests in 5.10s, 17.76MB read
  Socket errors: connect 0, read 613, write 0, timeout 0
  Non-2xx or 3xx responses: 80097
Requests/sec:  15899.12
Transfer/sec:      3.48MB
```

# Roadmap
  - [ ] Worker-Threads
  - [ ] Increase Unit Test Coverage
  - [ ] Support for other Redis Client
  - [ ] LUA script for cleaning expired keys on Redis

# License
[MIT](https://github.com/cyihsu/koa-grounded/blob/master/LICENSE)


[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fcyihsu%2Fkoa-grounded.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fcyihsu%2Fkoa-grounded?ref=badge_large)
