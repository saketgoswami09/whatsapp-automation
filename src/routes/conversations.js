const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const conversationController = require('../controllers/conversationController');

router.get ('/',             authenticate, conversationController.getConversations);
router.get ('/:id/messages', authenticate, conversationController.getMessages);
router.get ('/:id',          authenticate, conversationController.getConversation);
router.patch('/:id/assign',  authenticate, conversationController.assignAgent);
router.patch('/:id/close',   authenticate, conversationController.closeConversation);

module.exports = router;
