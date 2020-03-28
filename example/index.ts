import Koa from 'koa';
import Grounded from '../lib';
import Redis from 'ioredis';
import dotenv from 'dotenv';
const app = new Koa();

// Load environment variables
dotenv.config();

// Grounded Middleware
app.use(
  Grounded({
    ratelimit: 10,
    globalEXP: 1 * 60 * 1000 * 1000,
    db: new Redis({
      port: parseInt(process.env.REDIS_PORT, 10),
      host: process.env.REDIS_HOST,
    }),
    verbose: true,
  })
);

// Sample Output
app.use(async (ctx: Koa.Context) => {
  ctx.body = 'Hello, World!';
});

// Using IPv4 instead of IPv6;
app.listen(4000, '0.0.0.0');

// tslint:disable-next-line: no-console
console.log('listening on port 4000');
