const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: { type: String, trim: true, default: 'Unknown' },
    email: { type: String, trim: true, lowercase: true },
    tags: [{ type: String }],
    leadStatus: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'converted', 'paid', 'lost'],
      default: 'new',
      index: true,
    },
    language: { type: String, default: 'en' },
    optedOut: { type: Boolean, default: false },
    aiCallCount: { type: Number, default: 0 }, // daily AI call counter per user
    aiCallResetAt: { type: Date, default: () => new Date() },
    lastInteractionAt: { type: Date, default: Date.now, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

// Compound index for efficient dashboard queries
userSchema.index({ leadStatus: 1, lastInteractionAt: -1 });

module.exports = mongoose.model('User', userSchema);
