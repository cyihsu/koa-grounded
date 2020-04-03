import Koa from 'koa';
import Redis from 'ioredis';
import LRU from 'lru-cache';
import microtime from 'microtime';
import fs from 'fs';
import path from 'path';

import { iptoHex, logger, micro_to_mili, isExist } from './utils';
import { VisitorAttrs, GroundedConfigs, GroundedMacros } from './interfaces';

export = (Configs: GroundedConfigs) => {
  /*
   * Global Variables of the Grounded Instance
   */
  const db = new Redis(Configs.dbStr);
  const watcher = new Redis(Configs.dbStr);

  // prettier-ignore
  const bannedKeys: LRU<string, number> = new LRU<string, number>(Configs.cacheSize);
  // prettier-ignore
  const localCache: LRU<string, VisitorAttrs> = new LRU<string, VisitorAttrs>(Configs.cacheSize);
  let localQueue: string[][] = [];
  let lastCommited: number = microtime.now();

  /*
   * Init worker (Retrieve banned keys)
   *
   * Note: Since expired keys has been pruned locally when request received,
   *       There's no need to publish such message to the channel
   */
  db.multi()
    // prettier-ignore
    .zrevrangebyscore(
      `${Configs.partitionKey}-ban`,
      '+inf',
      lastCommited,
      'WITHSCORES'
    )
    .zremrangebyscore(`${Configs.partitionKey}-ban`, '+inf', lastCommited)
    .exec((err, result) => {
      if (err) logger(Configs.verbose, 'ERR', 'ERR', err);
      else {
        const [key, exp] = result[0][1];
        const expParse: number = parseInt(exp, 10);
        bannedKeys.set(key, expParse, micro_to_mili(expParse));
      }
    });

  /*
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
   * Listening to changes in a certain interval
   *
   * Note: To avoid intruction blocking on Redis,
   *       Split into two smaller instructions batch
   */
  setInterval(() => {
    const currentTime = microtime.now();
    _write_to_redis(currentTime);
    lastCommited = currentTime;
    _update_local(currentTime);
  }, Configs.timeout);

  /**
   * Listening to Pub/Sub Channel
   */
  watcher.subscribe(
    `${Configs.partitionKey}-ban`,
    `${Configs.partitionKey}-unban`
  );
  watcher.on('message', (channel: any, message: any) => {
    logger(Configs.verbose, 'REMOTE', 'RECV_MSG', [channel, message]);
    const [key, exp] = message.split(':');
    const expAsInt = parseInt(exp, 10);
    switch (channel) {
      case `${Configs.partitionKey}-ban`: {
        // Set User to local ban list
        // prettier-ignore
        if (!bannedKeys.has(key) || bannedKeys.get(key) !== expAsInt) {
          bannedKeys.set(key, expAsInt, micro_to_mili(expAsInt));
          localCache.del(key);
        }
      }
      case `${Configs.partitionKey}-unban`: {
        bannedKeys.del(message);
        localCache.set(
          key,
          {
            exp: expAsInt,
            remaining: Configs.ratelimit - 1,
            uat: expAsInt,
          },
          micro_to_mili(expAsInt)
        );
      }
    }
  });

  /**
   * Update local cache
   */
  async function _update_local(currentTime: number): Promise<void> {
    const queryTmp = localCache.keys();
    if (queryTmp.length > 0) {
      await db
        .hmget(`${Configs.partitionKey}-remaining`, ...queryTmp)
        .then((res) => {
          res.forEach((result: any, index: number) => {
            const cacheUpdateTmp = localCache.get(queryTmp[index]);
            if (isExist(cacheUpdateTmp)) {
              localCache.set(
                queryTmp[index],
                {
                  exp: cacheUpdateTmp!.exp,
                  remaining: parseInt(result, 10),
                  uat: currentTime,
                },
                micro_to_mili(cacheUpdateTmp!.exp)
              );
            }
          });
        });
    }
  }

  /**
   * Update localCache with remote response
   */
  async function _write_to_redis(currentTime: number): Promise<void> {
    if (localQueue.length > 0) {
      await db.pipeline(localQueue).exec((err) => {
        if (err) logger(Configs.verbose, 'ERROR', 'ERR', err);
        else {
          logger(Configs.verbose, 'REMOTE', 'WRITTEN_MSG', [
            localQueue.length.toString(),
          ]);
        }
      });
      localQueue = [];
    }
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

        localQueue.push([
          'visitKey',
          userKey,
          currentReg.uat.toString(),
          Configs.partitionKey,
        ]);
        if (grounded) {
          _write_to_redis(currentTime);
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
            ['createKey', userKey, currentReg.exp.toString(), currentReg.uat.toString(), currentReg.remaining.toString(), Configs.partitionKey],
          ])
          .exec((err, res) => {
            if (err) logger(Configs.verbose, 'ERR', 'ERR', err);
            else {
              if (isExist(res[0][1][0])) {
                const remoteRemains = parseInt(res[0][1][1], 10);
                const remoteExp = parseInt(res[0][1][0], 10);
                currentReg = {
                  exp: remoteExp,
                  remaining: remoteRemains,
                  uat: currentTime,
                };
                if (remoteRemains > 0) {
                  grounded = false;
                  logger(Configs.verbose, 'REMOTE', 'EXISTED_KEY', [userKey]);
                } else {
                  grounded = true;
                  logger(Configs.verbose, 'REMOTE', 'BANNED_KEY', [userKey]);
                }
              } else {
                logger(Configs.verbose, 'REMOTE', 'CREATED_KEY', [userKey]);
              }
            }
          });
      }
    }
    if (grounded === false) {
      // Update the localCache Value
      localCache.set(userKey, currentReg, micro_to_mili(currentReg.exp));
    } else {
      bannedKeys.set(userKey, currentReg.exp, micro_to_mili(currentReg.exp));
      localCache.del(userKey);
    }

    // Check for verbosity
    // prettier-ignore
    logger(Configs.verbose, !grounded ? 'PERMIT' : 'GROUNDED', 'VERBOSE', [{ key: userKey, attrs: currentReg }, microtime.now() - currentTime]);

    // Reponses
    ctx.set({
      'X-RateLimit-Remaining': currentReg.remaining.toString(),
      'X-RateLimit-Reset': micro_to_mili(currentReg.exp).toString(),
    });
    grounded ? (ctx.status = 429) : await next();
  };
};
