--
-- visit_key.lua
-- update value in centralized k-v storage
--
-- Params: KEYS[1] := userKey,
--         ARGV[1] := uat
--         ARGV[2] := partitionKey

local target_exp = redis.call('ZSCORE', ARGV[2]..'-exp', KEYS[1])
local target_remaining = tonumber(redis.call('HGET', ARGV[2]..'-remaining', KEYS[1]))

-- If the key is not yet expired
if (tonumber(target_exp) > tonumber(ARGV[1])) then
    if (target_remaining > 0) then
        redis.call('HINCRBY', ARGV[2]..'-remaining', KEYS[1], '-1')
    else
        redis.call('ZADD', ARGV[2]..'-ban', target_exp, KEYS[1])
        redis.call('ZREM', ARGV[2]..'-exp', KEYS[1])
        redis.call('HDEL', ARGV[2]..'-remaining', KEYS[1])
        redis.call('PUBLISH', ARGV[2]..'-ban', KEYS[1]..':'..target_exp)
    end

    local result = tonumber(redis.call('HGET', ARGV[2]..'-remaining', KEYS[1]))
    if (result) then
        return KEYS[1]..":"..result
    else
        return nil
    end

else
    return 0
end