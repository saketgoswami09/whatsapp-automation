const Document = require('../models/Document');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { processDocument, deleteDocument } = require('../services/documentService');

// POST /api/documents/upload
exports.upload = async (req, res, next) => {
  if (!req.file) return next(new AppError('No file uploaded', 400));
  const doc = await processDocument({
    userId: req.body.userId || req.admin._id,
    conversationId: req.body.conversationId,
    file: req.file,
    documentType: req.body.documentType || 'other',
  });
  res.status(201).json({ status: 'success', data: { document: doc } });
};

// GET /api/documents
exports.getDocuments = async (req, res) => {
  const { page = 1, limit = 20, userId } = req.query;
  const query = userId ? { userId } : {};
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [documents, total] = await Promise.all([
    Document.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    Document.countDocuments(query),
  ]);
  res.json({ status: 'success', data: { documents, total } });
};

// GET /api/documents/:id
exports.getDocument = async (req, res, next) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return next(new AppError('Document not found', 404));
  res.json({ status: 'success', data: { document: doc } });
};

// DELETE /api/documents/:id
exports.deleteDocument = async (req, res, next) => {
  await deleteDocument(req.params.id, req.admin._id); // pass userId for ownership check
  res.json({ status: 'success', message: 'Document deleted' });
};

