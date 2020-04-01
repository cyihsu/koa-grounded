--
-- create_key.lua
-- avoiding race-condition on key setting
-- using atomic check-and-set strategy
--
-- Params: KEYS[1] := userKey,
--         ARGV[1] := exp
--         ARGV[2] := uat
--         ARGV[3] := remaining

local target_exp = redis.call('ZSCORE','grounded-exp', KEYS[1])
local target_remaining = tonumber(redis.call('HGET','grounded-remaining', KEYS[1]))

if (not target_exp or tonumber(target_exp) < tonumber(ARGV[2])) then
    redis.call('ZADD', 'grounded-exp', ARGV[1], KEYS[1])
    redis.call('HSET', 'grounded-remaining', KEYS[1], ARGV[3])
    redis.call('ZREM', 'grounded-ban', KEYS[1])
    redis.call('PUBLISH', 'g-unban', KEYS[1]..":"..ARGV[1])
    return 1

-- Avoiding key creation, decrease the remaining value instead
else
    if (target_remaining > 0) then
        redis.call('HINCRBY', 'grounded-remaining', KEYS[1], '-1')
        target_remaining = target_remaining - 1
    end
    return {
        target_exp,
        target_remaining
    }
end