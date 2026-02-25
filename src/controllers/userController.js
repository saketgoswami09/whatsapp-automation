const User = require('../models/User');
const AppError = require('../utils/AppError');

// GET /api/users
exports.getUsers = async (req, res) => {
  const { page = 1, limit = 20, search, leadStatus } = req.query;
  const query = {};
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { phone: { $regex: search, $options: 'i' } },
  ];
  if (leadStatus) query.leadStatus = leadStatus;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    User.countDocuments(query),
  ]);
  res.json({ status: 'success', data: { users, total, page: parseInt(page) } });
};

// GET /api/users/:id
exports.getUser = async (req, res, next) => {
  const user = await User.findById(req.params.id).lean();
  if (!user) return next(new AppError('User not found', 404));
  res.json({ status: 'success', data: { user } });
};

// PATCH /api/users/:id
exports.updateUser = async (req, res, next) => {
  const allowed = ['name', 'email', 'tags', 'leadStatus'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );
  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!user) return next(new AppError('User not found', 404));
  res.json({ status: 'success', data: { user } });
};
