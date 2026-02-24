const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Middleware to check express-validator results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errMessages = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    return next(new AppError('Validation failed', 422, errMessages));
  }
  next();
};

module.exports = validate;
