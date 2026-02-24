const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const Document = require('../models/Document');
const env = require('../config/env');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Multer — memory storage
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB (generous but still free-tier safe)

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type not allowed. Accepted: ${ALLOWED_TYPES.join(', ')}`, 400), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });

/**
 * Upload buffer to Cloudinary, return URL and public_id
 */
const uploadToCloudinary = (buffer, mimeType, folder = 'whatsapp-docs') => {
  return new Promise((resolve, reject) => {
    const resourceType = mimeType === 'application/pdf' ? 'raw' : 'image';
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'] },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    uploadStream.end(buffer);
  });
};

/**
 * Extract text from image or PDF buffer using Tesseract.js
 * Note: PDF OCR is done via image conversion first (basic implementation)
 */
const extractTextOCR = async (buffer, mimeType) => {
  if (mimeType === 'application/pdf') {
    // For resume booster: in prod use a paid OCR for PDF
    // Free path: store and return placeholder
    return { text: '[PDF OCR — integrate PDF-to-image for full text extraction]', confidence: 0 };
  }

  try {
    const worker = await createWorker('eng');
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    return { text: data.text, confidence: data.confidence };
  } catch (err) {
    logger.error(`OCR failed: ${err.message}`);
    return { text: '', confidence: 0 };
  }
};

/**
 * Extract common structured fields from OCR text
 */
const extractFields = (ocrText) => {
  const fields = {};
  const emailMatch = ocrText.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  const phoneMatch = ocrText.match(/(\+?\d[\d\s\-().]{8,}\d)/);
  const dateMatch = ocrText.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
  const amountMatch = ocrText.match(/(?:₹|Rs\.?|INR|USD|\$)\s*[\d,]+(?:\.\d{2})?/i);

  if (emailMatch) fields.email = emailMatch[0];
  if (phoneMatch) fields.phone = phoneMatch[1].replace(/\s/g, '');
  if (dateMatch) fields.date = dateMatch[0];
  if (amountMatch) fields.amount = amountMatch[0];

  return fields;
};

/**
 * Full document processing pipeline:
 * 1. Upload to Cloudinary
 * 2. OCR
 * 3. Extract fields
 * 4. Save Document record
 */
const processDocument = async ({ userId, conversationId, file, documentType = 'other' }) => {
  // 1. Upload
  const { url, publicId } = await uploadToCloudinary(file.buffer, file.mimetype);

  // 2. Create initial document record (pending OCR)
  const doc = await Document.create({
    userId,
    conversationId,
    originalName: file.originalname,
    filename: `${Date.now()}-${file.originalname}`,
    mimeType: file.mimetype,
    size: file.size,
    storageUrl: url,
    publicId,
    documentType,
    validationStatus: 'processing',
  });

  // 3. OCR (async — update document after)
  setImmediate(async () => {
    try {
      const { text, confidence } = await extractTextOCR(file.buffer, file.mimetype);
      const extractedFields = extractFields(text);

      await Document.findByIdAndUpdate(doc._id, {
        ocrText: text,
        extractedFields,
        validationStatus: Object.keys(extractedFields).length > 0 ? 'valid' : 'invalid',
      });
      logger.info(`OCR complete for doc ${doc._id}, confidence: ${confidence.toFixed(1)}%`);
    } catch (err) {
      logger.error(`OCR processing failed: ${err.message}`);
      await Document.findByIdAndUpdate(doc._id, { validationStatus: 'failed' });
    }
  });

  return doc;
};

/**
 * Delete a document from Cloudinary and DB
 */
const deleteDocument = async (docId, userId) => {
  const doc = await Document.findOne({ _id: docId, userId });
  if (!doc) throw new AppError('Document not found', 404);

  if (doc.publicId) {
    const resourceType = doc.mimeType === 'application/pdf' ? 'raw' : 'image';
    await cloudinary.uploader.destroy(doc.publicId, { resource_type: resourceType });
  }

  await doc.deleteOne();
};

module.exports = { upload, processDocument, deleteDocument };
