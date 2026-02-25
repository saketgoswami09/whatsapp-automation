const AppError = require('../utils/AppError');
const env = require('../config/env');

// In-memory settings store (replace with DB model for multi-instance deployments)
let settings = {
  botName: env.BOT_NAME || 'WhatsApp AI',
  aiEnabled: String(env.AI_ENABLED) !== 'false',
  aiDailyTokenBudget: env.AI_DAILY_TOKEN_BUDGET,
  aiMaxCallsPerUserPerHour: env.AI_MAX_CALLS_PER_USER_PER_HOUR,
  autoFollowUpEnabled: true,
  followUpDelayHours: 24,
};

// GET /api/settings
exports.getSettings = (req, res) => {
  res.json({
    status: 'success',
    data: {
      settings: {
        ...settings,
        // Show integration status (configured or not) — never expose actual secrets
        whatsappConfigured: !!(env.WHATSAPP_ACCESS_TOKEN && !env.WHATSAPP_ACCESS_TOKEN.includes('DUMMY')),
        aiApiKeyConfigured: !!(env.AI_API_KEY && !env.AI_API_KEY.includes('dummy')),
        cloudinaryConfigured: !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_CLOUD_NAME !== 'dummy_cloud'),
      },
    },
  });
};

// PATCH /api/settings
exports.updateSettings = (req, res, next) => {
  const allowed = ['botName', 'aiEnabled', 'aiDailyTokenBudget', 'aiMaxCallsPerUserPerHour', 'autoFollowUpEnabled', 'followUpDelayHours'];
  const invalid = Object.keys(req.body).filter(k => !allowed.includes(k));
  if (invalid.length) return next(new AppError(`Unknown settings: ${invalid.join(', ')}`, 400));

  settings = { ...settings, ...Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k))) };
  res.json({ status: 'success', data: { settings } });
};
