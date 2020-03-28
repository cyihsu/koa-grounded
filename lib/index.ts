import Koa from 'koa';
import microtime from 'microtime-nodejs';
import fs from 'fs';
import path from 'path';

import { iptoHex, groundedVerbose } from './utils';
import { VisitorAttrs, GroundedConfigs } from './interfaces';

/*
 * Global Variables of the Grounded Instance
 */
const bannedKeys: Map<string, number> = new Map<string, number>();
const localCache: Map<string, VisitorAttrs> = new Map<string, VisitorAttrs>();
let localQueue: string[][] = [];

// Expose the Limiter Instance
export = (Configs: GroundedConfigs) => {
  Configs.db.defineCommand('createKey', {
    numberOfKeys: 1,
    lua: fs.readFileSync(path.resolve(__dirname, './scripts/create_key.lua'), {
      encoding: 'utf8',
    }),
  });
  return async (ctx: Koa.Context, next: () => Promise<any>) => {
    // Fetching Current Sessions
    const currentTime: number = microtime.now();
    const userKey: string = iptoHex(ctx.ip);
    const cacheReg: VisitorAttrs | undefined = localCache.get(userKey);
    const bannedReg: number | undefined = bannedKeys.get(userKey);

    // Responses
    let grounded: boolean;
    let currentReg: VisitorAttrs;

    // If the key is banned and expiration time is later than currentTime
    if (bannedReg && currentTime < bannedReg) {
      grounded = true;
      currentReg = {
        remaining: 0,
        uat: currentTime,
        exp: bannedReg,
      };
    } else {
      // If the localCache contains the key and the currentTime(stamp) is not yet expired
      // Decrease the value, or ground the user
      if (cacheReg && currentTime < cacheReg.exp) {
        grounded = !(cacheReg.remaining > 0);
        // Decrease Local Value
        currentReg = {
          remaining: grounded ? 0 : --cacheReg.remaining,
          uat: grounded ? cacheReg.uat : currentTime,
          exp: cacheReg.exp,
        };
        if (
          grounded &&
          (!bannedKeys.has(userKey) ||
            bannedKeys.get(userKey) !== currentReg.uat)
        ) {
          // Set to local blacklist
          bannedKeys.set(userKey, currentReg.exp);
          localCache.delete(userKey);
        }
        // Else, initialize a new token
      } else {
        grounded = false;
        currentReg = {
          remaining: Configs.ratelimit - 1,
          uat: currentTime,
          exp: currentTime + Configs.globalEXP,
        };
        if (bannedReg) {
          bannedKeys.delete(userKey);
        }
        // Only key creation can trigger a redis pipeline directly
        await Configs.db
          .pipeline([
            [
              'createKey',
              userKey,
              currentReg.exp.toString(),
              currentReg.uat.toString(),
              currentReg.remaining.toString(),
            ],
          ])
          .exec((err, res) => {
            currentReg = {
              exp: res[0][1][0],
              remaining: res[0][1][1],
              uat: currentTime,
            };
          });
      }
    }

    // Update the Value
    localCache.set(userKey, currentReg);

    // Check for parameter verbosity
    if (Configs.verbose) {
      groundedVerbose(
        {
          key: userKey,
          isGrounded: grounded,
          attrs: currentReg,
        },
        microtime.now() - currentTime
      );
    }

    // Reponses
    ctx.set({
      'X-RateLimit-Remaining': currentReg.remaining.toString(),
      'X-RateLimit-Reset': Math.floor(currentReg.exp / 1000000).toString(),
    });
    grounded ? (ctx.status = 429) : await next();
  };
};
