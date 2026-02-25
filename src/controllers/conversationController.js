const Conversation = require('../models/Conversation');
const AppError = require('../utils/AppError');
const { getMessages } = require('../services/conversationService');

// GET /api/conversations
exports.getConversations = async (req, res) => {
  const { page = 1, limit = 20, status, phone } = req.query;
  const query = {};
  if (status) query.status = status;
  if (phone) query.phone = { $regex: phone, $options: 'i' };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [conversations, total] = await Promise.all([
    Conversation.find(query)
      .populate('userId', 'name phone leadStatus')
      .populate('assignedAgent', 'name email')
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Conversation.countDocuments(query),
  ]);
  res.json({ status: 'success', data: { conversations, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
};

// GET /api/conversations/:id/messages
exports.getMessages = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const result = await getMessages(req.params.id, { page: parseInt(page), limit: parseInt(limit) });
  res.json({ status: 'success', data: result });
};

// GET /api/conversations/:id
exports.getConversation = async (req, res, next) => {
  const conv = await Conversation.findById(req.params.id)
    .populate('userId', 'name phone email tags leadStatus')
    .populate('assignedAgent', 'name email');
  if (!conv) return next(new AppError('Conversation not found', 404));
  res.json({ status: 'success', data: { conversation: conv } });
};

// PATCH /api/conversations/:id/assign
exports.assignAgent = async (req, res) => {
  const conv = await Conversation.findByIdAndUpdate(
    req.params.id,
    { assignedAgent: req.admin._id, status: 'agent' },
    { new: true }
  );
  res.json({ status: 'success', data: { conversation: conv } });
};

// PATCH /api/conversations/:id/close
exports.closeConversation = async (req, res) => {
  const conv = await Conversation.findByIdAndUpdate(
    req.params.id,
    { status: 'closed', closedAt: new Date() },
    { new: true }
  );
  res.json({ status: 'success', data: { conversation: conv } });
};
