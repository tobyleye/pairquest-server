import redis from "redis";

const envRedisURL = process.env.REDIS_URL;

export const redisClient = redis.createClient(
  envRedisURL
    ? {
        url: envRedisURL,
      }
    : undefined
);
