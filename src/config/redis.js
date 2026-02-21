const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 5) {
      logger.error('Redis: max retries reached');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
});

redisClient.on('connect', () => logger.info('Redis connected'));
redisClient.on('error', (err) => logger.error(`Redis error: ${err.message}`));
redisClient.on('close', () => logger.warn('Redis connection closed'));

const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    logger.warn(`Redis connection failed: ${err.message} — falling back to in-memory caching`);
  }
};

module.exports = { redisClient, connectRedis };
