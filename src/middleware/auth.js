const { verifyAccessToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const Admin = require('../models/Admin');

/**
 * Authenticate admin via JWT Bearer token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(new AppError('Authentication required. Please log in.', 401));
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const admin = await Admin.findById(decoded.id).select('-password -refreshTokens');
    if (!admin || !admin.isActive) {
      return next(new AppError('User no longer exists or account is deactivated.', 401));
    }

    req.admin = admin;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') return next(new AppError('Invalid token.', 401));
    if (err.name === 'TokenExpiredError') return next(new AppError('Token expired. Please log in again.', 401));
    next(err);
  }
};

/**
 * Role-based access control factory
 * @param {...string} roles - allowed roles
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.admin.role)) {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }
  next();
};

module.exports = { authenticate, requireRole };
