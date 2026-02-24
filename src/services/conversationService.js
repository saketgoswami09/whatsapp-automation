const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

const SESSION_TTL = 60 * 30; // 30 minutes

/**
 * Get or create a user record from phone number
 */
const getOrCreateUser = async (phone, name = 'Unknown') => {
  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({ phone, name });
    logger.info(`New user created: ${phone}`);
  } else if (name !== 'Unknown' && user.name === 'Unknown') {
    user.name = name;
  }
  user.lastInteractionAt = new Date();
  await user.save();
  return user;
};

/**
 * Get or create an active conversation for a user
 */
const getOrCreateConversation = async (userId, phone) => {
  // Check Redis for active session
  const sessionKey = `session:${phone}`;
  const cachedSessionId = await redisClient.get(sessionKey).catch(() => null);

  if (cachedSessionId) {
    const conv = await Conversation.findOne({ sessionId: cachedSessionId, status: { $ne: 'closed' } });
    if (conv) {
      await redisClient.expire(sessionKey, SESSION_TTL);
      return conv;
    }
  }

  // Create new conversation
  const sessionId = uuidv4();
  const conv = await Conversation.create({ userId, phone, sessionId, status: 'bot' });

  // Cache session
  await redisClient.setex(sessionKey, SESSION_TTL, sessionId).catch(() => {});

  logger.info(`New conversation: ${sessionId} for user ${phone}`);
  return conv;
};

/**
 * Save a message to the database
 */
const saveMessage = async ({
  conversationId,
  userId,
  direction,
  type = 'text',
  content,
  mediaUrl,
  metadata = {},
  whatsappMessageId,
  generatedByAI = false,
  tokensUsed = 0,
}) => {
  const message = await Message.create({
    conversationId,
    userId,
    direction,
    type,
    content,
    mediaUrl,
    metadata,
    whatsappMessageId,
    generatedByAI,
    tokensUsed,
    timestamp: new Date(),
  });

  // Update conversation metadata
  await Conversation.findByIdAndUpdate(conversationId, {
    $inc: { messageCount: 1, ...(generatedByAI && { aiCallCount: 1 }) },
    lastMessageAt: new Date(),
  });

  return message;
};

/**
 * Mark a conversation as closed
 */
const closeConversation = async (conversationId, phone) => {
  await Conversation.findByIdAndUpdate(conversationId, {
    status: 'closed',
    closedAt: new Date(),
  });
  await redisClient.del(`session:${phone}`).catch(() => {});
};

/**
 * Get paginated messages for a conversation
 */
const getMessages = async (conversationId, { page = 1, limit = 50 } = {}) => {
  const skip = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    Message.find({ conversationId }).sort({ timestamp: 1 }).skip(skip).limit(limit).lean(),
    Message.countDocuments({ conversationId }),
  ]);
  return { messages, total, page, pages: Math.ceil(total / limit) };
};

module.exports = {
  getOrCreateUser,
  getOrCreateConversation,
  saveMessage,
  closeConversation,
  getMessages,
};
