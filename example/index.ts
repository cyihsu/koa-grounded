import Koa from 'koa';
import Grounded from '../src';

const app = new Koa();

// Grounded Middleware
app.use(Grounded());

// Sample Output
app.use(async (ctx: Koa.Context) => {
    ctx.body = 'Hello, World!';
});

// Using IPv4 instead of IPv6;
app.listen(4000, '0.0.0.0');

// tslint:disable-next-line: no-console
console.log('listening on port 4000');