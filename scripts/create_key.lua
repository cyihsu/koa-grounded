--
-- create_key.lua
-- avoiding race-condition on key setting
-- using atomic check-and-set strategy
--
-- Params: KEYS[1] := userKey,
--         ARGV[1] := exp
--         ARGV[2] := uat
--         ARGV[3] := remaining
--         ARGV[4] := partitionKey

local target_ban = tonumber(redis.call('ZSCORE', ARGV[4]..'-ban', KEYS[1]))
local target_exp = redis.call('ZSCORE', ARGV[4]..'-exp', KEYS[1])
local target_remaining = tonumber(redis.call('HGET', ARGV[4]..'-remaining', KEYS[1]))

if (not target_ban or target_ban < tonumber(ARGV[2])) and (not target_exp or tonumber(target_exp) < tonumber(ARGV[2])) then
    redis.call('ZADD', ARGV[4]..'-exp', ARGV[1], KEYS[1])
    redis.call('HSET', ARGV[4]..'-remaining', KEYS[1], ARGV[3])
    redis.call('ZREM', ARGV[4]..'-ban', KEYS[1])
    redis.call('PUBLISH', ARGV[4]..'-unban', KEYS[1]..":"..ARGV[1])
    return 1

-- Avoiding key creation, decrease the remaining value or ignore instead
else
    if (target_remaining > 0) then
        redis.call('HINCRBY', ARGV[4]..'-remaining', KEYS[1], '-1')
        target_remaining = target_remaining - 1
    end
    return {
        target_exp,
        target_remaining
    }
end