const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    whatsappMessageId: { type: String, sparse: true },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'template', 'image', 'document', 'audio', 'video', 'location', 'interactive', 'system'],
      default: 'text',
    },
    content: { type: String },
    mediaUrl: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'sent',
    },
    generatedByAI: { type: Boolean, default: false },
    tokensUsed: { type: Number, default: 0 }, // Track AI token cost
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

messageSchema.index({ conversationId: 1, timestamp: 1 });
messageSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
