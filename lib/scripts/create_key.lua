--
-- create_key.lua
-- avoiding race-condition on key setting
--
-- Params: KEYS[1] := userKey,
--         ARGV[1] := exp
--         ARGV[2] := uat
--         ARGV[3] := remaining

local target_exp = redis.call('ZSCORE','grounded-exp', KEYS[1])
local target_remaining = redis.call('ZSCORE','grounded-remaining', KEYS[1])
local current_time = redis.call('time')

if (not target_exp or target_exp < ARGV[2]) then
    redis.call('ZADD', 'grounded-exp', ARGV[1], KEYS[1])
    redis.call('ZADD', 'grounded-remaining', ARGV[3], KEYS[1])
    redis.call('ZREM', 'grounded-ban', KEYS[1])
    return 1

-- Avoiding key creation, decrease the remaining value instead
else
    if (tonumber(target_remaining) > 0) then
        redis.call('ZINCRBY', 'grounded-remaining', '-1', KEYS[1])
        target_remaining = target_remaining - 1
    end
    return {
        target_exp,
        target_remaining
    }
end