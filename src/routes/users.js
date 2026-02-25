const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.get ('/',    authenticate, userController.getUsers);
router.get ('/:id', authenticate, userController.getUser);
router.patch('/:id', authenticate, userController.updateUser);

module.exports = router;
