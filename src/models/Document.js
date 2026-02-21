const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
    originalName: { type: String },
    filename: { type: String, required: true },
    mimeType: {
      type: String,
      enum: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    },
    size: { type: Number }, // bytes
    storageUrl: { type: String, required: true },
    publicId: { type: String }, // Cloudinary public_id for deletion
    ocrText: { type: String },
    extractedFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    validationStatus: {
      type: String,
      enum: ['pending', 'processing', 'valid', 'invalid', 'failed'],
      default: 'pending',
    },
    validationErrors: [{ type: String }],
    documentType: {
      type: String,
      enum: ['id_proof', 'address_proof', 'invoice', 'contract', 'other'],
      default: 'other',
    },
  },
  { timestamps: true },
);

documentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Document', documentSchema);
