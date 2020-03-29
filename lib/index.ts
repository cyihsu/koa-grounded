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
const localBucket: Map<string, number> = new Map<string, number>();
let localQueue: string[][] = [];

// Expose the Limiter Instance
export = (Configs: GroundedConfigs) => {
  // Redis-Lua Macros Definition
  Configs.db.defineCommand('createKey', {
    numberOfKeys: 1,
    lua: fs.readFileSync(path.resolve(__dirname, '../scripts/create_key.lua'), {
      encoding: 'utf8',
    }),
  });

  Configs.db.defineCommand('visitKey', {
    numberOfKeys: 1,
    lua: fs.readFileSync(path.resolve(__dirname, '../scripts/visit_key.lua'), {
      encoding: 'utf8',
    }),
  });

  // localCache Synchronization
  async function synchronize(currentTime: number): Promise<void> {
    await Configs.db.pipeline(localQueue).exec((err, res) => {
      if (err) {
        // tslint:disable-next-line: no-console
        console.log(err);
      } else {
        console.log(
          '[  RATELIMIT:  REDIS  ]\t\tWritten %d commands to redis',
          localQueue.length
        );
        res.forEach((resultValue: any, index: number) => {
          if (
            typeof resultValue[1] !== 'undefined' &&
            resultValue[1] !== null
          ) {
            const tmpString = resultValue[1].split(':');
            const localReg = localCache.get(tmpString[0]);
            if (localReg) {
              localCache.set(tmpString[0], {
                remaining: parseInt(tmpString[1], 10),
                uat: currentTime,
                exp: localReg.exp,
              });
            }
          }
        });
      }
    });
    // Clear localQueue
    localQueue = [];
  }

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
      if (cacheReg && currentTime < cacheReg.exp) {
        // If the localCache contains the key and the currentTime(stamp) is not yet expired
        // Decrease the value, or ground the user
        grounded = !(cacheReg.remaining > 0);

        // Try to decrease Local Value
        currentReg = {
          remaining: grounded ? 0 : --cacheReg.remaining,
          uat: grounded ? cacheReg.uat : currentTime,
          exp: cacheReg.exp,
        };

        const tmpBucket = localBucket.get(userKey);
        if (tmpBucket !== undefined) localBucket.set(userKey, tmpBucket - 1);

        if (
          grounded &&
          (!bannedKeys.has(userKey) ||
            bannedKeys.get(userKey) !== currentReg.uat)
        ) {
          // Set to local blacklist
          bannedKeys.set(userKey, currentReg.exp);
          localCache.delete(userKey);
        }

        localQueue.push(['visitKey', userKey, currentReg.uat.toString()]);
        if (grounded) {
          synchronize(currentTime);
        }
      } else {
        // Else, initialize a new token
        grounded = false;
        currentReg = {
          remaining: Configs.ratelimit - 1,
          uat: currentTime,
          exp: currentTime + Configs.globalEXP,
        };

        if (bannedReg) {
          bannedKeys.delete(userKey);
        }

        localBucket.set(userKey, Configs.localThreshold);

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
            if (err) {
              // tslint:disable-next-line: no-console
              console.log(err);
            } else {
              if (typeof res[0][1][0] !== 'undefined') {
                currentReg = {
                  exp: res[0][1][0],
                  remaining: res[0][1][1],
                  uat: currentTime,
                };
                console.log(
                  '[  RATELIMIT: REDIS  ]\t\tkey: %s has existed on Redis, decrease instead.',
                  userKey
                );
              } else {
                console.log(
                  '[  RATELIMIT:  REDIS  ]\t\tWritten key: %s to Redis Server',
                  userKey
                );
              }
            }
          });
      }
    }

    // Update the localCache Value
    localCache.set(userKey, currentReg);

    // Check for verbosity
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
