import Koa from 'koa';

// Expose the Limiter Instance
export = () => {
    return async (ctx: Koa.Context, next: () => Promise<any>) => {
        // tslint:disable-next-line: no-console
        console.log(ctx.request.ip);
        await next();
    }
}