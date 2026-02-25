const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const settingsController = require('../controllers/settingsController');

router.get ('/', authenticate,                       settingsController.getSettings);
router.patch('/', authenticate, requireRole('admin'), settingsController.updateSettings);

module.exports = router;
