const logger = require('../utils/logger');
const env = require('../config/env');

/* eslint-disable no-unused-vars */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log all errors; only full stack in development
  const meta = {
    statusCode: err.statusCode,
    method: req.method,
    path: req.path,
    ip: req.ip,
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  };
  if (err.statusCode >= 500) logger.error(err.message, meta);
  else logger.warn(err.message, meta);

  if (env.NODE_ENV === 'production') {
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
        ...(err.errors?.length && { errors: err.errors }),
      });
    }
    // Non-operational: don't leak details
    return res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again.' });
  }

  // Development — full details
  return res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    errors: err.errors,
    stack: err.stack,
  });
};

module.exports = errorHandler;
