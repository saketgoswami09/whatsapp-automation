const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const documentController = require('../controllers/documentController');
const { upload } = require('../services/documentService');

router.post('/upload', authenticate, uploadLimiter, upload.single('file'), documentController.upload);
router.get ('/',       authenticate, documentController.getDocuments);
router.get ('/:id',    authenticate, documentController.getDocument);
router.delete('/:id',  authenticate, documentController.deleteDocument);

module.exports = router;
