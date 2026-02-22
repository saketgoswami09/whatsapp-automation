const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  note: String,
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  addedAt: { type: Date, default: Date.now },
});

const leadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    phone: { type: String, required: true, index: true },
    name: { type: String },
    email: { type: String },
    source: {
      type: String,
      enum: ['whatsapp', 'manual', 'api', 'referral'],
      default: 'whatsapp',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'converted', 'paid', 'lost'],
      default: 'new',
      index: true,
    },
    productInterest: { type: String },
    notes: [noteSchema],
    paymentLink: { type: String },
    paymentLinkId: { type: String },
    amount: { type: Number },
    currency: { type: String, default: 'INR' },
    followUpAt: { type: Date, index: true },
    followUpCount: { type: Number, default: 0 },
    convertedAt: { type: Date },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    tags: [{ type: String }],
  },
  { timestamps: true },
);

leadSchema.index({ status: 1, followUpAt: 1 });
leadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);
