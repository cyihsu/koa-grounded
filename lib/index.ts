import Koa from 'koa';
import Redis from 'ioredis';
import LRU from 'lru-cache';
import microtime from 'microtime-nodejs';
import fs from 'fs';
import path from 'path';

import {
  iptoHex,
  groundedVerbose,
  logger,
  micro_to_mili,
  REDIS_CONSOLE_PREFIX,
} from './utils';
import { VisitorAttrs, GroundedConfigs, GroundedMacros } from './interfaces';

export = (Configs: GroundedConfigs) => {
  /*
   * Global Variables of the Grounded Instance
   */
  const db = new Redis(Configs.dbStr);
  const watcher = new Redis(Configs.dbStr);

  const bannedKeys: LRU<string, number> = new LRU<string, number>(
    Configs.cacheSize
  );
  // prettier-ignore
  const localCache: LRU<string, VisitorAttrs> = new LRU<string, VisitorAttrs>(Configs.cacheSize);
  let localQueue: string[][] = [];

  /*
   *
   * Redis-Lua Macros Definitions
   */
  GroundedMacros.forEach((macro) => {
    db.defineCommand(macro.name, {
      numberOfKeys: macro.key_num,
      lua: fs.readFileSync(
        path.resolve(__dirname, `../scripts/${macro.filename}.lua`),
        {
          encoding: 'utf8',
        }
      ),
    });
  });

  /**
   *
   * Listening to Pub/Sub Channel
   */
  watcher.subscribe('g-ban', 'g-unban');
  watcher.on('message', (channel: any, message: any) => {
    switch (channel) {
      case 'g-ban': {
        // Set User to local ban list
        const messageToken: string[] = message.split(':');
        // prettier-ignore
        if (!bannedKeys.has(messageToken[0]) || bannedKeys.get(messageToken[0]) !== parseInt(messageToken[1], 10)) {
          bannedKeys.set(messageToken[0], parseInt(messageToken[1], 10));
          localCache.del(messageToken[0]);
        }
      }
      case 'g-unban': {
        bannedKeys.del(message);
      }
    }
  });

  // localCache Synchronization
  async function synchronize(currentTime: number): Promise<void> {
    await db.pipeline(localQueue).exec((err, res) => {
      if (err) logger(err);
      else {
        logger(
          `${REDIS_CONSOLE_PREFIX('REDIS')}Written ${
            localQueue.length
          } commands to redis`
        );
        // Update local LRU by redis' response
        res.forEach((resultValue: any, index: number) => {
          // prettier-ignore
          if (typeof resultValue[1] !== 'undefined' && resultValue[1] !== null) {
            const tmpString = resultValue[1].split(':');
            const localReg = localCache.get(tmpString[0]);
            if (localReg) {
              localCache.set(tmpString[0], {
                remaining: parseInt(tmpString[1], 10),
                uat: currentTime,
                exp: localReg.exp,
              }, micro_to_mili(localReg.exp));
            }
          }
        });
      }
    });
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

        // Try to decrease localCache Value
        currentReg = {
          remaining: grounded ? 0 : --cacheReg.remaining,
          uat: grounded ? cacheReg.uat : currentTime,
          exp: cacheReg.exp,
        };

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

        // Only key creation can trigger a redis pipeline directly
        await db
          .pipeline([
            // prettier-ignore
            ['createKey', userKey, currentReg.exp.toString(), currentReg.uat.toString(), currentReg.remaining.toString()],
          ])
          .exec((err, res) => {
            if (err) logger(err);
            else {
              if (typeof res[0][1][0] !== 'undefined') {
                currentReg = {
                  exp: res[0][1][0],
                  remaining: res[0][1][1],
                  uat: currentTime,
                };
                logger(
                  `${REDIS_CONSOLE_PREFIX(
                    'REDIS'
                  )}key: ${userKey} has existed on Redis, decrease instead.`
                );
              } else {
                logger(
                  `${REDIS_CONSOLE_PREFIX(
                    'REDIS'
                  )}Written key: ${userKey} to Redis Server`
                );
              }
            }
          });
      }
    }

    // Update the localCache Value
    localCache.set(userKey, currentReg, micro_to_mili(currentReg.exp));

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
      'X-RateLimit-Reset': micro_to_mili(currentReg.exp).toString(),
    });
    grounded ? (ctx.status = 429) : await next();
  };
};
