# koa-grounded
A distributed rate-limit middleware for Koa 2, inspired by Dcard's intern prelimary project.

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

See the document for further informations.
