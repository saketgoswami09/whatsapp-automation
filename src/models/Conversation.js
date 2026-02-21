const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    phone: { type: String, required: true, index: true },
    sessionId: { type: String, unique: true },
    status: {
      type: String,
      enum: ['active', 'idle', 'closed', 'bot', 'agent'],
      default: 'bot',
      index: true,
    },
    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    messageCount: { type: Number, default: 0 },
    aiCallCount: { type: Number, default: 0 }, // per-conversation AI usage
    tags: [{ type: String }],
    lastMessageAt: { type: Date, default: Date.now, index: true },
    closedAt: { type: Date },
    summary: { type: String }, // AI-generated summary
  },
  { timestamps: true },
);

conversationSchema.index({ userId: 1, lastMessageAt: -1 });
conversationSchema.index({ status: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
