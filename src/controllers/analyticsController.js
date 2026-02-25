const Message = require('../models/Message');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Document = require('../models/Document');
const env = require('../config/env');

// GET /api/analytics/overview
exports.overview = async (req, res) => {
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const [totalUsers, newToday, totalMessages, todayMessages, activeConvs, totalConvs, leads, totalDocs] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: todayStart } }),
    Message.countDocuments(),
    Message.countDocuments({ timestamp: { $gte: todayStart } }),
    require('../models/Conversation').countDocuments({ status: { $in: ['active', 'bot'] } }),
    require('../models/Conversation').countDocuments(),
    Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Document.countDocuments(),
  ]);

  // AI token tracking via aggregation
  const aiUsage = await Message.aggregate([
    { $match: { generatedByAI: true, timestamp: { $gte: todayStart } } },
    { $group: { _id: null, total: { $sum: '$tokensUsed' } } },
  ]);

  const leadMap = leads.reduce((acc, l) => { acc[l._id] = l.count; return acc; }, {});
  const totalLeads = Object.values(leadMap).reduce((a, b) => a + b, 0);
  const converted = (leadMap.converted || 0) + (leadMap.paid || 0);
  const conversionRate = totalLeads > 0 ? `${((converted / totalLeads) * 100).toFixed(1)}%` : '0.0%';

  res.json({
    status: 'success',
    data: {
      users: { total: totalUsers, newToday },
      messages: { total: totalMessages, today: todayMessages },
      conversations: { active: activeConvs, total: totalConvs },
      leads: { ...leadMap, total: totalLeads, conversionRate },
      documents: { total: totalDocs },
      ai: { dailyTokensUsed: aiUsage[0]?.total || 0, dailyBudget: env.AI_DAILY_TOKEN_BUDGET },
    },
  });
};

// GET /api/analytics/messages-over-time
exports.messagesOverTime = async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const since = new Date(Date.now() - days * 86400000);
  const data = await Message.aggregate([
    { $match: { timestamp: { $gte: since } } },
    { $group: {
      _id: {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        direction: '$direction',
      },
      count: { $sum: 1 },
    }},
    { $sort: { '_id.date': 1 } },
  ]);
  res.json({ status: 'success', data });
};

// GET /api/analytics/lead-funnel
exports.leadFunnel = async (req, res) => {
  const data = await Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  res.json({ status: 'success', data });
};
