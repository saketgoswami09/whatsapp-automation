const rateLimit = require('express-rate-limit');
const { redisClient } = require('../config/redis');
const env = require('../config/env');
const logger = require('../utils/logger');

// Generic limiter factory
const createLimiter = (options) =>
  rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'fail',
      message: options.message || 'Too many requests. Please try again later.',
    },
    handler: (req, res, next, opts) => {
      logger.warn(`Rate limit hit: ${req.ip} on ${req.path}`);
      res.status(429).json(opts.message);
    },
  });

// Default API limiter
const apiLimiter = createLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: 'Too many API requests from this IP.',
});

// Strict auth limiter — prevent brute force
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

// Webhook limiter — stricter, but allow Meta's delivery retries
const webhookLimiter = createLimiter({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: 'Webhook rate limit exceeded.',
});

// Upload limiter
const uploadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: 'Upload limit reached. Max 20 uploads per hour.',
});

module.exports = { apiLimiter, authLimiter, webhookLimiter, uploadLimiter };
