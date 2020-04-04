# koa-grounded
> A distributed rate-limit middleware for Koa 2, inspired by Dcard's intern prelimary project.

[![Build Status](https://travis-ci.org/cyihsu/koa-grounded.svg?branch=master)](https://travis-ci.org/cyihsu/koa-grounded)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

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
  ratelimit: 10,
  globalEXP: 1 * 10 * 1000 * 1000, // expiration time in μs
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
| timeout      | `number`  | Worker-Redis synchronization intervals, in `miliseconds`(10^-3 seconds) unit |
| cacheSize    | `number`  | Maxmimum key size stored in local LRU cache |
| dbStr        | `string`  | Connection string to the Redis instance, see [luin/ioredis#connect-to-redis](https://github.com/luin/ioredis#connect-to-redis) for further information |
| verbose      | `boolean` | Showing access log informations or not |

# Running tests

```shell
$ yarn test
```

# Overview

## Benchmark

# Roadmap
  - [ ] Increase Unit Test Coverage
  - [ ] Support for other Redis Client
  - [ ] LUA script for cleaning expired keys on Redis

# License
[MIT](https://github.com/cyihsu/koa-grounded/blob/master/LICENSE)
