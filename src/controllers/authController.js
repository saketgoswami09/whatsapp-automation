const Admin = require('../models/Admin');
const AppError = require('../utils/AppError');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const logger = require('../utils/logger');

// POST /api/auth/login
exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email, isActive: true }).select('+password +refreshTokens');
  if (!admin || !(await admin.comparePassword(password))) {
    return next(new AppError('Invalid email or password', 401));
  }
  const accessToken = generateAccessToken({ id: admin._id, role: admin.role });
  const refreshToken = generateRefreshToken({ id: admin._id });
  admin.refreshTokens = [...(admin.refreshTokens || []).slice(-4), refreshToken];
  admin.lastLogin = new Date();
  await admin.save();
  logger.info(`Admin login: ${admin.email}`);
  res.json({ status: 'success', data: { accessToken, refreshToken, admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role } } });
};

// POST /api/auth/refresh
exports.refresh = async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return next(new AppError('Refresh token required', 400));
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return next(new AppError('Invalid or expired refresh token', 401));
  }
  const admin = await Admin.findById(decoded.id).select('+refreshTokens');
  if (!admin || !admin.refreshTokens?.includes(refreshToken)) {
    return next(new AppError('Invalid refresh token', 401));
  }
  const newAccess = generateAccessToken({ id: admin._id, role: admin.role });
  const newRefresh = generateRefreshToken({ id: admin._id });
  admin.refreshTokens = admin.refreshTokens.filter(t => t !== refreshToken).concat(newRefresh);
  await admin.save();
  res.json({ status: 'success', data: { accessToken: newAccess, refreshToken: newRefresh } });
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken && req.admin) {
    await Admin.findByIdAndUpdate(req.admin._id, { $pull: { refreshTokens: refreshToken } });
  }
  res.json({ status: 'success', message: 'Logged out' });
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json({ status: 'success', data: { admin: req.admin } });
};

// POST /api/auth/register
exports.register = async (req, res, next) => {
  const { email, password, name, role = 'agent' } = req.body;
  if (await Admin.findOne({ email })) return next(new AppError('Email already in use', 400));
  // NOTE: Do NOT hash manually — Admin pre-save hook handles bcrypt hashing
  const admin = await Admin.create({ email, password, name, role });
  logger.info(`New admin registered: ${email} (${role})`);
  res.status(201).json({ status: 'success', data: { admin: { id: admin._id, name, email, role } } });
};
