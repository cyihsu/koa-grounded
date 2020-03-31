--
-- visit_key.lua
-- update value in centralized k-v storage
--
-- Params: KEYS[1] := userKey,
--         ARGV[1] := uat

local target_exp = redis.call('ZSCORE','grounded-exp', KEYS[1])
local target_remaining = tonumber(redis.call('HGET','grounded-remaining', KEYS[1]))

-- If the key is not yet expired
if (tonumber(target_exp) > tonumber(ARGV[1])) then
    if (target_remaining > 0) then
        redis.call('HINCRBY', 'grounded-remaining', KEYS[1], '-1')
    else
        redis.call('ZADD', 'grounded-ban', target_exp, KEYS[1])
        redis.call('ZREM', 'grounded-exp', KEYS[1])
        redis.call('HDEL', 'grounded-remaining', KEYS[1])
        redis.call('PUBLISH', 'g-ban', KEYS[1]..':'..target_exp)
    end

    local result = tonumber(redis.call('HGET','grounded-remaining', KEYS[1]))
    if (result) then
        return KEYS[1]..":"..result
    else
        return nil
    end

else
    return 0
end