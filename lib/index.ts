import Koa from 'koa';
import microtime from 'microtime-nodejs';

import { iptoHex, groundedVerbose } from './utils';
import { VisitorAttrs, GroundedConfigs } from './interfaces';

/*
 * Global Variables of the Grounded Instance
 */
const bannedKeys: Map<string, number> = new Map<string, number>();
const localCache: Map<string, VisitorAttrs> = new Map<string, VisitorAttrs>();
const localQueue: string[][] = [];

// Expose the Limiter Instance
export = (Configs: GroundedConfigs) => {
    return async (ctx: Koa.Context, next: () => Promise<any>) => {
        // Fetching Current Sessions
        const currentTime: number = microtime.now();
        const userKey: string = iptoHex(ctx.ip);
        const cacheReg: VisitorAttrs | undefined = localCache.get(userKey);

        // Responses
        let grounded: boolean;
        let currentReg: VisitorAttrs;

        // If the localCache contains the key and the currentTime(stamp) is not yet expired
        // Decrease the value, or ground the user
        if(cacheReg && currentTime < cacheReg.exp) {
            grounded = !(cacheReg.remaining > 0)
            currentReg = {
                remaining: grounded ? 0 : --cacheReg.remaining,
                uat: grounded ? cacheReg.uat : currentTime,
                exp: cacheReg.exp
            }
            if(grounded && (!bannedKeys.has(userKey) || bannedKeys.get(userKey) !== cacheReg.uat)) {
                bannedKeys.set(userKey, cacheReg.uat);
                localCache.delete(userKey);
            }
        // Else, initialize a new token
        } else {
            grounded = false;
            currentReg = {
                remaining: Configs.ratelimit - 1,
                uat: currentTime,
                exp: currentTime + Configs.globalEXP
            }
        }

        // Update the Value
        localCache.set(userKey, currentReg);

        // Check for parameter verbosity
        if(Configs.verbose) {
            groundedVerbose({
                key: userKey,
                isGrounded: grounded,
                attrs: currentReg,
            }, microtime.now() - currentTime);
        }

        // Reponses
        ctx.set({
            'X-RateLimit-Remaining': currentReg.remaining.toString(),
            'X-RateLimit-Reset': Math.floor(currentReg.exp / 1000000).toString()
        });
        grounded ? ctx.status = 429 : await next();
    }
}